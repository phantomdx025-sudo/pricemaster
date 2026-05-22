"""
sundry_analyser_tab.py — Sundry Analyser tab for PriceMaster Sync Tool.

Provides SundryAnalyserTab, a CTkFrame dropped into sync_tool.pyw as a new
tab.  It exposes two sub-tabs inside it:

  📊 Analyse & Sync
      Pick raw Tally .xls/.xlsx Debtors + Creditors exports, run the full
      analysis pipeline (parse → running balances → FIFO matching → anomaly
      detection), then push directly to Supabase — no intermediate file and
      no manual copy-paste step required.

  💾 Analyse Only
      Same pipeline but saves the processed workbook (.xlsx) to disk so it
      can be reviewed locally.  Identical output to the standalone Sundry
      Analyser tool.

Both sub-tabs share a single log area at the bottom of the frame.

The .xls files exported by Tally are actually Office Open XML (zip-based)
files saved with the .xls extension.  parser.py handles this transparently
via the _open_workbook() helper (BytesIO + magic-byte detection).
"""

import os
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox

import customtkinter as ctk

import fin_sync_core
from merger import merge_period_into_master
from parser import parse_workbook
from processor import compute_running_balances, detect_anomalies, run_fifo_matching
from writer import write_output_xlsx


# ── helpers ───────────────────────────────────────────────────────────────────

def _ext_filter():
    return [
        ("Excel / Tally export", "*.xls *.xlsx *.xlsm"),
        ("All files", "*.*"),
    ]


class SundryAnalyserTab(ctk.CTkFrame):
    """
    Self-contained Sundry Analyser panel with two sub-tabs.
    """

    def __init__(self, master, config_getter, config_saver, log_callback, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        self._get_cfg = config_getter
        self._save_cfg = config_saver
        self._ext_log = log_callback   # shared log in the parent window (unused here
                                        # – we have our own log box; kept for parity)
        self._busy = False

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        self._build()

    # ── UI construction ───────────────────────────────────────────────────────

    def _build(self):
        # ── inner tab view ────────────────────────────────────────────────
        self._inner_tabs = ctk.CTkTabview(self)
        self._inner_tabs.grid(row=0, column=0, sticky="nsew", padx=0, pady=(0, 0))
        self.grid_rowconfigure(0, weight=1)

        tab_as = self._inner_tabs.add("📊  Analyse & Sync")
        tab_ao = self._inner_tabs.add("💾  Analyse Only")
        tab_im = self._inner_tabs.add("🔄  Incremental Merge")

        # ── Analyse & Sync sub-tab ────────────────────────────────────────
        tab_as.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            tab_as,
            text="Analyse raw Tally export and sync directly to Supabase.",
            font=ctk.CTkFont(size=12),
            text_color="gray",
            anchor="w",
        ).grid(row=0, column=0, sticky="w", padx=18, pady=(14, 10))

        cfg = self._get_cfg()

        # Debtors file
        self._as_deb_var, _ = self._make_file_row(
            tab_as, row=1,
            label="Sundry Debtors  (.xls / .xlsx from Tally)",
            config_key="sa_debtors_path",
            current_val=cfg.get("sa_debtors_path", ""),
        )

        # Creditors file
        self._as_cred_var, _ = self._make_file_row(
            tab_as, row=2,
            label="Sundry Creditors  (.xls / .xlsx from Tally)",
            config_key="sa_creditors_path",
            current_val=cfg.get("sa_creditors_path", ""),
        )

        # Ledger type override
        ltype_frame = ctk.CTkFrame(tab_as, fg_color="transparent")
        ltype_frame.grid(row=3, column=0, sticky="w", padx=18, pady=(8, 0))
        ctk.CTkLabel(
            ltype_frame, text="Ledger type override:",
            font=ctk.CTkFont(size=12, weight="bold"),
        ).pack(side="left", padx=(0, 12))
        self._as_ltype_var = tk.StringVar(value="auto")
        for text, val in [("Auto-detect", "auto"), ("Creditors", "creditor"), ("Debtors", "debtor")]:
            ctk.CTkRadioButton(
                ltype_frame, text=text,
                variable=self._as_ltype_var, value=val,
                font=ctk.CTkFont(size=12),
            ).pack(side="left", padx=6)

        # Options
        opts_frame = ctk.CTkFrame(tab_as, fg_color="transparent")
        opts_frame.grid(row=4, column=0, sticky="w", padx=18, pady=(10, 0))

        self._as_opt_ank = ctk.CTkCheckBox(
            opts_frame, text="Flag ANK entries in log",
            font=ctk.CTkFont(size=12),
        )
        self._as_opt_ank.select()
        self._as_opt_ank.pack(side="left", padx=(0, 20))

        self._as_opt_outstanding = ctk.CTkCheckBox(
            opts_frame, text="Include outstanding FIFO analysis",
            font=ctk.CTkFont(size=12),
        )
        self._as_opt_outstanding.select()
        self._as_opt_outstanding.pack(side="left")

        # Action buttons
        btn_frame = ctk.CTkFrame(tab_as, fg_color="transparent")
        btn_frame.grid(row=5, column=0, sticky="ew", padx=18, pady=(16, 0))
        btn_frame.grid_columnconfigure((0, 1), weight=1)

        self._btn_as_deb = ctk.CTkButton(
            btn_frame,
            text="📊  Analyse & Sync Debtors",
            height=46,
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=("#0369a1", "#075985"),
            hover_color=("#0284c7", "#0c4a6e"),
            command=self._confirm_as_debtors,
        )
        self._btn_as_deb.grid(row=0, column=0, sticky="ew", padx=(0, 6), pady=(0, 6))

        self._btn_as_cred = ctk.CTkButton(
            btn_frame,
            text="📊  Analyse & Sync Creditors",
            height=46,
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=("#0369a1", "#075985"),
            hover_color=("#0284c7", "#0c4a6e"),
            command=self._confirm_as_creditors,
        )
        self._btn_as_cred.grid(row=0, column=1, sticky="ew", padx=(6, 0), pady=(0, 6))

        ctk.CTkFrame(tab_as, height=1, fg_color="gray40").grid(
            row=6, column=0, sticky="ew", padx=18, pady=(8, 8)
        )

        self._btn_as_all = ctk.CTkButton(
            tab_as,
            text="🔄  Analyse & Sync Both",
            height=50,
            font=ctk.CTkFont(size=15, weight="bold"),
            fg_color=("#1d4ed8", "#1e3a8a"),
            hover_color=("#1e40af", "#172554"),
            command=self._confirm_as_both,
        )
        self._btn_as_all.grid(row=7, column=0, sticky="ew", padx=18, pady=(0, 4))

        ctk.CTkLabel(
            tab_as,
            text="Analyses Debtors then Creditors → pushes both to Supabase sequentially",
            font=ctk.CTkFont(size=11),
            text_color="gray",
            anchor="center",
        ).grid(row=8, column=0, padx=18, pady=(0, 14))

        # ── Analyse Only sub-tab ──────────────────────────────────────────
        tab_ao.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            tab_ao,
            text="Analyse and save processed workbook to disk (no Supabase upload).",
            font=ctk.CTkFont(size=12),
            text_color="gray",
            anchor="w",
        ).grid(row=0, column=0, sticky="w", padx=18, pady=(14, 10))

        # Input file
        inp_frame = ctk.CTkFrame(tab_ao)
        inp_frame.grid(row=1, column=0, sticky="ew", padx=18, pady=(0, 8))
        inp_frame.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            inp_frame, text="Input file  (.xls / .xlsx Tally export)",
            font=ctk.CTkFont(size=13, weight="bold"),
            anchor="w",
        ).grid(row=0, column=0, columnspan=3, sticky="w", padx=12, pady=(10, 2))

        self._ao_input_var = tk.StringVar(value="No file selected")
        ctk.CTkEntry(
            inp_frame, textvariable=self._ao_input_var,
            state="readonly", height=32, font=ctk.CTkFont(size=11),
        ).grid(row=1, column=0, columnspan=2, sticky="ew", padx=(12, 6), pady=(0, 10))
        ctk.CTkButton(
            inp_frame, text="Browse…", width=80, height=32,
            command=self._ao_browse_input,
        ).grid(row=1, column=2, padx=(0, 12), pady=(0, 10))

        # Output file
        out_frame = ctk.CTkFrame(tab_ao)
        out_frame.grid(row=2, column=0, sticky="ew", padx=18, pady=(0, 8))
        out_frame.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            out_frame, text="Output file  (.xlsx)",
            font=ctk.CTkFont(size=13, weight="bold"),
            anchor="w",
        ).grid(row=0, column=0, columnspan=3, sticky="w", padx=12, pady=(10, 2))

        self._ao_output_var = tk.StringVar(value="")
        ctk.CTkEntry(
            out_frame, textvariable=self._ao_output_var,
            state="readonly", height=32, font=ctk.CTkFont(size=11),
        ).grid(row=1, column=0, columnspan=2, sticky="ew", padx=(12, 6), pady=(0, 10))
        ctk.CTkButton(
            out_frame, text="Browse…", width=80, height=32,
            command=self._ao_browse_output,
        ).grid(row=1, column=2, padx=(0, 12), pady=(0, 10))

        # Ledger type + options
        ltype_frame2 = ctk.CTkFrame(tab_ao, fg_color="transparent")
        ltype_frame2.grid(row=3, column=0, sticky="w", padx=18, pady=(4, 0))
        ctk.CTkLabel(
            ltype_frame2, text="Ledger type:",
            font=ctk.CTkFont(size=12, weight="bold"),
        ).pack(side="left", padx=(0, 12))
        self._ao_ltype_var = tk.StringVar(value="auto")
        for text, val in [("Auto-detect", "auto"), ("Creditors", "creditor"), ("Debtors", "debtor")]:
            ctk.CTkRadioButton(
                ltype_frame2, text=text,
                variable=self._ao_ltype_var, value=val,
                font=ctk.CTkFont(size=12),
            ).pack(side="left", padx=6)

        opts_frame2 = ctk.CTkFrame(tab_ao, fg_color="transparent")
        opts_frame2.grid(row=4, column=0, sticky="w", padx=18, pady=(10, 0))
        self._ao_opt_summary = ctk.CTkCheckBox(
            opts_frame2, text="Include Summary sheet",
            font=ctk.CTkFont(size=12),
        )
        self._ao_opt_summary.select()
        self._ao_opt_summary.pack(side="left", padx=(0, 20))
        self._ao_opt_ank = ctk.CTkCheckBox(
            opts_frame2, text="Flag ANK entries in log",
            font=ctk.CTkFont(size=12),
        )
        self._ao_opt_ank.select()
        self._ao_opt_ank.pack(side="left", padx=(0, 20))
        self._ao_opt_outstanding = ctk.CTkCheckBox(
            opts_frame2, text="Include Outstanding Breakdown sheet",
            font=ctk.CTkFont(size=12),
        )
        self._ao_opt_outstanding.select()
        self._ao_opt_outstanding.pack(side="left")

        # Process button
        ao_btn_frame = ctk.CTkFrame(tab_ao, fg_color="transparent")
        ao_btn_frame.grid(row=5, column=0, sticky="ew", padx=18, pady=(16, 4))
        ao_btn_frame.grid_columnconfigure(0, weight=1)

        self._btn_ao_process = ctk.CTkButton(
            ao_btn_frame,
            text="⚙  Analyse File",
            height=46,
            font=ctk.CTkFont(size=14, weight="bold"),
            command=self._ao_start,
        )
        self._btn_ao_process.grid(row=0, column=0, sticky="ew", padx=(0, 8))

        self._btn_ao_reset = ctk.CTkButton(
            ao_btn_frame,
            text="↺  Reset",
            height=46,
            font=ctk.CTkFont(size=13),
            fg_color="gray40",
            hover_color="gray30",
            command=self._ao_reset,
        )
        self._btn_ao_reset.grid(row=0, column=1, sticky="e")

        # Progress bar (shared between both sub-tabs)
        self._progress_label = ctk.CTkLabel(
            self, text="Ready", anchor="w",
            font=ctk.CTkFont(size=12),
        )
        self._progress_label.grid(row=1, column=0, sticky="ew", padx=18, pady=(6, 0))

        self._progress_bar = ctk.CTkProgressBar(self)
        self._progress_bar.set(0)
        self._progress_bar.grid(row=2, column=0, sticky="ew", padx=18, pady=(0, 4))

        # Log area (shared between both sub-tabs)
        log_frame = ctk.CTkFrame(self, fg_color="transparent")
        log_frame.grid(row=3, column=0, sticky="nsew", padx=18, pady=(0, 10))
        log_frame.grid_columnconfigure(0, weight=1)
        log_frame.grid_rowconfigure(1, weight=1)
        self.grid_rowconfigure(3, weight=1)

        log_header = ctk.CTkFrame(log_frame, fg_color="transparent")
        log_header.grid(row=0, column=0, sticky="ew")
        log_header.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(
            log_header, text="Log",
            font=ctk.CTkFont(size=13, weight="bold"),
            anchor="w",
        ).grid(row=0, column=0, sticky="w")
        ctk.CTkButton(
            log_header, text="Clear", width=54, height=24,
            font=ctk.CTkFont(size=11),
            fg_color="transparent", border_width=1,
            command=self._clear_log,
        ).grid(row=0, column=1, sticky="e")

        self._log_box = ctk.CTkTextbox(
            log_frame,
            font=ctk.CTkFont(family="Courier New", size=11),
            wrap="word",
            state="disabled",
            height=180,
        )
        self._log_box.grid(row=1, column=0, sticky="nsew", pady=(4, 0))

        # ── Incremental Merge sub-tab ─────────────────────────────────────────
        self._build_im_tab(tab_im)

    # ── File-picker row builder ────────────────────────────────────────────────

    def _make_file_row(
        self, parent, row: int, label: str, config_key: str, current_val: str
    ) -> tuple:
        frame = ctk.CTkFrame(parent)
        frame.grid(row=row, column=0, sticky="ew", padx=18, pady=(0, 4))
        frame.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            frame, text=label,
            font=ctk.CTkFont(size=13, weight="bold"),
            anchor="w",
        ).grid(row=0, column=0, columnspan=3, sticky="w", padx=12, pady=(10, 2))

        var = tk.StringVar(value=current_val if current_val else "No file selected")

        ctk.CTkEntry(
            frame, textvariable=var,
            state="readonly", height=32,
            font=ctk.CTkFont(size=11),
        ).grid(row=1, column=0, columnspan=2, sticky="ew", padx=(12, 6), pady=(0, 10))

        ctk.CTkButton(
            frame, text="Browse…", width=80, height=32,
            command=lambda: self._browse_file(var, config_key),
        ).grid(row=1, column=2, padx=(0, 12), pady=(0, 10))

        return var, frame

    def _browse_file(self, var: tk.StringVar, config_key: str):
        path = filedialog.askopenfilename(
            title="Select Tally Excel export",
            filetypes=_ext_filter(),
        )
        if path:
            var.set(path)
            cfg = self._get_cfg()
            cfg[config_key] = path
            self._save_cfg(cfg)
            self._log(f"📁 {config_key} → {path}")

    # ── Analyse Only browse helpers ───────────────────────────────────────────

    def _ao_browse_input(self):
        path = filedialog.askopenfilename(
            title="Select Tally Excel export",
            filetypes=_ext_filter(),
        )
        if path:
            self._ao_input_var.set(path)
            # Auto-suggest output path
            stem = Path(path).stem
            out = Path(path).parent / (stem + "_running_balance.xlsx")
            self._ao_output_var.set(str(out))
            self._log(f"📁 Input: {path}")

    def _ao_browse_output(self):
        path = filedialog.asksaveasfilename(
            title="Save analysed workbook",
            defaultextension=".xlsx",
            filetypes=[("Excel files", "*.xlsx")],
        )
        if path:
            self._ao_output_var.set(path)

    # ── Log helpers ───────────────────────────────────────────────────────────

    def _log(self, msg: str):
        def _append():
            self._log_box.configure(state="normal")
            self._log_box.insert("end", msg + "\n")
            self._log_box.see("end")
            self._log_box.configure(state="disabled")
        self.after(0, _append)

    def _clear_log(self):
        self._log_box.configure(state="normal")
        self._log_box.delete("1.0", "end")
        self._log_box.configure(state="disabled")

    def _set_progress(self, value: float, text: str):
        def _set():
            self._progress_bar.set(value)
            self._progress_label.configure(text=text)
        self.after(0, _set)

    def _update_progress(self, current, total, name):
        self.after(0, lambda: (
            self._progress_bar.set(current / total),
            self._progress_label.configure(
                text=f"Writing {current}/{total}: {name}"
            ),
        ))

    # ── Validate Supabase credentials ─────────────────────────────────────────

    def _validate_creds(self) -> str | None:
        cfg = self._get_cfg()
        if not cfg.get("supabase_url"):
            return "Supabase URL not set — click ⚙ Settings."
        if not cfg.get("service_role_key"):
            return "Service role key not set — click ⚙ Settings."
        return None

    def _get_path(self, var: tk.StringVar) -> str | None:
        val = var.get().strip()
        if not val or val == "No file selected":
            return None
        if not Path(val).exists():
            return None
        return val

    # ══════════════════════════════════════════════════════════════════════════
    # ANALYSE & SYNC — confirm + run
    # ══════════════════════════════════════════════════════════════════════════

    def _confirm_as_debtors(self):
        err = self._validate_creds()
        if err:
            messagebox.showerror("Cannot Sync", err)
            return
        path = self._get_path(self._as_deb_var)
        if not path:
            messagebox.showerror("Cannot Sync", "Please select the Sundry Debtors file first.")
            return
        if not messagebox.askyesno(
            "Analyse & Sync Debtors",
            f"File: {os.path.basename(path)}\n\n"
            "This will analyse the raw Tally export and push to Supabase.\n"
            "Existing debtor data in Supabase will be DELETED and replaced.\n\n"
            "Proceed?",
        ):
            return
        self._run_as("debtor", path)

    def _confirm_as_creditors(self):
        err = self._validate_creds()
        if err:
            messagebox.showerror("Cannot Sync", err)
            return
        path = self._get_path(self._as_cred_var)
        if not path:
            messagebox.showerror("Cannot Sync", "Please select the Sundry Creditors file first.")
            return
        if not messagebox.askyesno(
            "Analyse & Sync Creditors",
            f"File: {os.path.basename(path)}\n\n"
            "This will analyse the raw Tally export and push to Supabase.\n"
            "Existing creditor data in Supabase will be DELETED and replaced.\n\n"
            "Proceed?",
        ):
            return
        self._run_as("creditor", path)

    def _confirm_as_both(self):
        err = self._validate_creds()
        if err:
            messagebox.showerror("Cannot Sync", err)
            return
        deb_path = self._get_path(self._as_deb_var)
        cred_path = self._get_path(self._as_cred_var)
        missing = []
        if not deb_path:
            missing.append("Sundry Debtors file")
        if not cred_path:
            missing.append("Sundry Creditors file")
        if missing:
            messagebox.showerror(
                "Cannot Sync Both",
                "Missing files:\n\n" + "\n".join(f"  • {m}" for m in missing),
            )
            return
        if not messagebox.askyesno(
            "Analyse & Sync Both",
            f"Debtors: {os.path.basename(deb_path)}\n"
            f"Creditors: {os.path.basename(cred_path)}\n\n"
            "Both files will be analysed and pushed to Supabase sequentially.\n"
            "Existing debtor and creditor data will be DELETED and replaced.\n\n"
            "Proceed?",
        ):
            return
        self._run_as_both(deb_path, cred_path)

    def _set_as_buttons_enabled(self, enabled: bool):
        state = "normal" if enabled else "disabled"
        def _set():
            self._btn_as_deb.configure(state=state)
            self._btn_as_cred.configure(state=state)
            self._btn_as_all.configure(state=state)
            self._btn_ao_process.configure(state=state)
            self._btn_ao_reset.configure(state=state)
        self.after(0, _set)

    def _run_as(self, party_type: str, path: str):
        if self._busy:
            messagebox.showwarning("Busy", "A task is already running. Please wait.")
            return
        self._busy = True
        self._set_as_buttons_enabled(False)
        cfg = self._get_cfg()
        url = cfg["supabase_url"]
        key = cfg["service_role_key"]
        ltype_pref = self._as_ltype_var.get()
        do_fifo = bool(self._as_opt_outstanding.get())
        flag_ank = bool(self._as_opt_ank.get())

        self._log("─" * 52)
        self._log(f"🚀 Analyse & Sync — {party_type.upper()}S")
        self._log(f"📁 {path}")
        self._set_progress(0, "Parsing…")

        def worker():
            try:
                self._log(f"→ Loading: {os.path.basename(path)}")
                vendors, detected_type = parse_workbook(path)

                ledger_type = detected_type if ltype_pref == "auto" else ltype_pref
                self._log(
                    f"✓ Ledger type: {ledger_type} "
                    f"({'auto-detected' if ltype_pref == 'auto' else 'manual override'})"
                )
                self._log(f"✓ Parsed {len(vendors)} parties")
                self._set_progress(0.2, "Computing balances…")

                vendors = compute_running_balances(vendors, ledger_type)
                self._log("✓ Running balances computed")
                self._set_progress(0.4, "FIFO matching…")

                if do_fifo:
                    vendors = run_fifo_matching(vendors, ledger_type)
                    self._log("✓ FIFO matching done")
                self._set_progress(0.6, "Detecting anomalies…")

                anomalies = detect_anomalies(vendors, ledger_type)
                errors   = [a for a in anomalies if a["severity"] == "error"]
                warnings = [a for a in anomalies if a["severity"] == "warning"]
                self._log(f"  Anomalies: {len(errors)} errors, {len(warnings)} warnings")
                for a in anomalies:
                    if a["severity"] == "error":
                        self._log(f"  ✗ [{a['type']}] {a['vendor']}: {a['detail']}")
                    elif a["severity"] == "warning":
                        if a["type"] == "ANK Entries" and not flag_ank:
                            continue
                        self._log(f"  ⚠ [{a['type']}] {a['vendor']}: {a['detail']}")

                self._set_progress(0.75, "Pushing to Supabase…")
                self._log("📤 Pushing to Supabase…")

                success, msg = fin_sync_core.push_analysed_data(
                    party_type=ledger_type,
                    vendor_data=vendors,
                    supabase_url=url,
                    service_role_key=key,
                    log_callback=self._log,
                )

                if success:
                    self._set_progress(1.0, "Done ✓")
                    self._log(f"✓ {msg}")
                else:
                    self._set_progress(1.0, "Failed ✗")
                    self._log(f"✗ {msg}")

            except Exception as exc:
                import traceback
                self._log(f"✗ Error: {exc}")
                self._log(traceback.format_exc())
                self._set_progress(1.0, "Error ✗")
            finally:
                self._busy = False
                self._set_as_buttons_enabled(True)
                self._log("─" * 52)

        threading.Thread(target=worker, daemon=True).start()

    def _run_as_both(self, deb_path: str, cred_path: str):
        if self._busy:
            messagebox.showwarning("Busy", "A task is already running. Please wait.")
            return
        self._busy = True
        self._set_as_buttons_enabled(False)
        cfg = self._get_cfg()
        url = cfg["supabase_url"]
        key = cfg["service_role_key"]
        ltype_pref = self._as_ltype_var.get()
        do_fifo = bool(self._as_opt_outstanding.get())
        flag_ank = bool(self._as_opt_ank.get())

        self._log("─" * 52)
        self._log("🚀 Analyse & Sync — BOTH (Debtors then Creditors)")
        self._set_progress(0, "Starting…")

        def worker():
            results = []
            pairs = [("debtor", deb_path), ("creditor", cred_path)]
            for step_idx, (party_type, path) in enumerate(pairs):
                label = party_type.upper() + "S"
                base_progress = step_idx * 0.5
                self._log(f"\n[{step_idx+1}/2] {label}  →  {os.path.basename(path)}")
                try:
                    self._log(f"→ Loading: {os.path.basename(path)}")
                    vendors, detected_type = parse_workbook(path)

                    ledger_type = detected_type if ltype_pref == "auto" else ltype_pref
                    self._log(f"✓ Ledger type: {ledger_type}")
                    self._log(f"✓ Parsed {len(vendors)} parties")
                    self._set_progress(base_progress + 0.1, f"{label}: computing balances…")

                    vendors = compute_running_balances(vendors, ledger_type)
                    if do_fifo:
                        vendors = run_fifo_matching(vendors, ledger_type)
                        self._log("✓ FIFO matching done")

                    anomalies = detect_anomalies(vendors, ledger_type)
                    errors   = [a for a in anomalies if a["severity"] == "error"]
                    warnings = [a for a in anomalies if a["severity"] == "warning"]
                    self._log(f"  Anomalies: {len(errors)} errors, {len(warnings)} warnings")
                    for a in anomalies:
                        if a["severity"] == "error":
                            self._log(f"  ✗ [{a['type']}] {a['vendor']}: {a['detail']}")
                        elif a["severity"] == "warning":
                            if a["type"] == "ANK Entries" and not flag_ank:
                                continue
                            self._log(f"  ⚠ [{a['type']}] {a['vendor']}: {a['detail']}")

                    self._set_progress(base_progress + 0.3, f"{label}: pushing to Supabase…")
                    self._log(f"📤 Pushing {label} to Supabase…")

                    ok, msg = fin_sync_core.push_analysed_data(
                        party_type=ledger_type,
                        vendor_data=vendors,
                        supabase_url=url,
                        service_role_key=key,
                        log_callback=self._log,
                    )
                    results.append((label, ok, msg))
                    self._log(msg)
                    self._set_progress(base_progress + 0.5, f"{label}: done")

                except Exception as exc:
                    import traceback
                    self._log(f"✗ {label} failed: {exc}")
                    self._log(traceback.format_exc())
                    results.append((label, False, str(exc)))

            # Summary
            self._log("\n── Sync Both Summary ──")
            all_ok = True
            for name, ok, msg in results:
                icon = "✅" if ok else "❌"
                self._log(f"  {icon} {name}")
                if not ok:
                    all_ok = False
            if all_ok:
                self._set_progress(1.0, "Done ✓")
                self._log("🎉 Both syncs completed successfully.")
            else:
                self._set_progress(1.0, "Some errors ✗")
                self._log("⚠  One or more syncs failed — see log above.")
            self._log("─" * 52)

            self._busy = False
            self._set_as_buttons_enabled(True)

        threading.Thread(target=worker, daemon=True).start()

    # ══════════════════════════════════════════════════════════════════════════
    # ANALYSE ONLY — run
    # ══════════════════════════════════════════════════════════════════════════

    def _ao_reset(self):
        self._ao_input_var.set("No file selected")
        self._ao_output_var.set("")
        self._set_progress(0, "Ready")
        self._clear_log()
        self._btn_ao_process.configure(state="normal")

    def _ao_start(self):
        input_path  = self._ao_input_var.get().strip()
        output_path = self._ao_output_var.get().strip()

        if not input_path or input_path == "No file selected" or not Path(input_path).exists():
            messagebox.showerror("Error", "Please select a valid input file.")
            return
        if not output_path:
            messagebox.showerror("Error", "Please specify an output file path.")
            return

        if self._busy:
            messagebox.showwarning("Busy", "A task is already running. Please wait.")
            return

        self._busy = True
        self._set_as_buttons_enabled(False)
        self._log("─" * 52)
        self._log(f"⚙  Analyse Only → {os.path.basename(input_path)}")
        self._set_progress(0, "Parsing…")

        ltype_pref   = self._ao_ltype_var.get()
        do_summary   = bool(self._ao_opt_summary.get())
        do_outstand  = bool(self._ao_opt_outstanding.get())
        flag_ank     = bool(self._ao_opt_ank.get())

        def worker():
            try:
                self._log(f"→ Loading: {os.path.basename(input_path)}")
                vendors, detected_type = parse_workbook(input_path)

                ledger_type = detected_type if ltype_pref == "auto" else ltype_pref
                self._log(
                    f"✓ Ledger type: {ledger_type} "
                    f"({'auto-detected' if ltype_pref == 'auto' else 'manual override'})"
                )
                self._log(f"✓ Parsed {len(vendors)} parties")
                self._set_progress(0.2, "Computing balances…")

                vendors = compute_running_balances(vendors, ledger_type)
                self._log("✓ Running balances computed")
                self._set_progress(0.4, "FIFO matching…")

                if do_outstand:
                    vendors = run_fifo_matching(vendors, ledger_type)
                    self._log("✓ FIFO matching done")
                self._set_progress(0.55, "Detecting anomalies…")

                anomalies = detect_anomalies(vendors, ledger_type)
                errors   = [a for a in anomalies if a["severity"] == "error"]
                warnings = [a for a in anomalies if a["severity"] == "warning"]
                self._log(f"  Anomalies: {len(errors)} errors, {len(warnings)} warnings")
                for a in anomalies:
                    if a["severity"] == "error":
                        self._log(f"  ✗ [{a['type']}] {a['vendor']}: {a['detail']}")
                    elif a["severity"] == "warning":
                        if a["type"] == "ANK Entries" and not flag_ank:
                            continue
                        self._log(f"  ⚠ [{a['type']}] {a['vendor']}: {a['detail']}")

                self._set_progress(0.65, "Writing output file…")
                write_output_xlsx(
                    vendors, output_path,
                    ledger_type=ledger_type,
                    include_summary=do_summary,
                    include_outstanding=do_outstand,
                    progress_callback=lambda c, t, v: self._update_progress(c, t, v),
                )
                self._log(f"✓ Output saved → {os.path.basename(output_path)}")
                self._set_progress(1.0, "Done ✓")

            except Exception as exc:
                import traceback
                self._log(f"✗ Error: {exc}")
                self._log(traceback.format_exc())
                self._set_progress(1.0, "Error ✗")
            finally:
                self._busy = False
                self._set_as_buttons_enabled(True)
                self._log("─" * 52)

        threading.Thread(target=worker, daemon=True).start()

    # ══════════════════════════════════════════════════════════════════════════
    # INCREMENTAL MERGE — sub-tab builder
    # ══════════════════════════════════════════════════════════════════════════

    def _build_im_tab(self, tab_im):
        """Build the 🔄 Incremental Merge sub-tab UI."""
        tab_im.grid_columnconfigure(0, weight=1)

        cfg = self._get_cfg()

        # ── Description label ─────────────────────────────────────────────
        ctk.CTkLabel(
            tab_im,
            text="Merge a short Tally period export (1–3 days) into an existing master.",
            font=ctk.CTkFont(size=12),
            text_color="gray",
            anchor="w",
        ).grid(row=0, column=0, sticky="w", padx=18, pady=(14, 4))

        # ═════════════════════════════════════════════════════════════════════
        # Section: Master Copy Paths
        # ═════════════════════════════════════════════════════════════════════
        ctk.CTkLabel(
            tab_im, text="Master Copy Paths  (analysed .xlsx)",
            font=ctk.CTkFont(size=13, weight="bold"),
            anchor="w",
        ).grid(row=1, column=0, sticky="w", padx=18, pady=(8, 2))

        # Debtors master
        self._im_deb_master_var, _ = self._make_master_file_row(
            tab_im, row=2,
            label="Debtors Master  (.xlsx — created by 'Analyse Only')",
            config_key="sa_debtors_master_path",
            current_val=cfg.get("sa_debtors_master_path", ""),
            is_master=True,
        )

        # Creditors master
        self._im_cred_master_var, _ = self._make_master_file_row(
            tab_im, row=3,
            label="Creditors Master  (.xlsx — created by 'Analyse Only')",
            config_key="sa_creditors_master_path",
            current_val=cfg.get("sa_creditors_master_path", ""),
            is_master=True,
        )

        ctk.CTkLabel(
            tab_im,
            text="ℹ  Set once after a full Analyse Only run. Leave blank to run fresh.",
            font=ctk.CTkFont(size=11),
            text_color="gray",
            anchor="w",
        ).grid(row=4, column=0, sticky="w", padx=22, pady=(0, 6))

        # Divider
        ctk.CTkFrame(tab_im, height=1, fg_color="gray40").grid(
            row=5, column=0, sticky="ew", padx=18, pady=(4, 8)
        )

        # ═════════════════════════════════════════════════════════════════════
        # Section: Period Export Paths
        # ═════════════════════════════════════════════════════════════════════
        ctk.CTkLabel(
            tab_im, text="Period Export  (Tally — 1–3 day window)",
            font=ctk.CTkFont(size=13, weight="bold"),
            anchor="w",
        ).grid(row=6, column=0, sticky="w", padx=18, pady=(0, 2))

        # Debtors period file
        self._im_deb_period_var, _ = self._make_master_file_row(
            tab_im, row=7,
            label="Debtors Period File  (.xls / .xlsx from Tally)",
            config_key="sa_debtors_period_path",
            current_val=cfg.get("sa_debtors_period_path", ""),
            is_master=False,
        )

        # Creditors period file
        self._im_cred_period_var, _ = self._make_master_file_row(
            tab_im, row=8,
            label="Creditors Period File  (.xls / .xlsx from Tally)",
            config_key="sa_creditors_period_path",
            current_val=cfg.get("sa_creditors_period_path", ""),
            is_master=False,
        )

        # Divider
        ctk.CTkFrame(tab_im, height=1, fg_color="gray40").grid(
            row=9, column=0, sticky="ew", padx=18, pady=(4, 8)
        )

        # ═════════════════════════════════════════════════════════════════════
        # Options row
        # ═════════════════════════════════════════════════════════════════════
        im_opts_frame = ctk.CTkFrame(tab_im, fg_color="transparent")
        im_opts_frame.grid(row=10, column=0, sticky="w", padx=18, pady=(0, 8))

        self._im_opt_push = ctk.CTkCheckBox(
            im_opts_frame, text="Push to Supabase after merge",
            font=ctk.CTkFont(size=12),
        )
        self._im_opt_push.select()
        self._im_opt_push.pack(side="left", padx=(0, 24))

        self._im_opt_ank = ctk.CTkCheckBox(
            im_opts_frame, text="Flag ANK entries",
            font=ctk.CTkFont(size=12),
        )
        self._im_opt_ank.select()
        self._im_opt_ank.pack(side="left")

        # ═════════════════════════════════════════════════════════════════════
        # Action buttons
        # ═════════════════════════════════════════════════════════════════════
        btn_frame_im = ctk.CTkFrame(tab_im, fg_color="transparent")
        btn_frame_im.grid(row=11, column=0, sticky="ew", padx=18, pady=(4, 0))
        btn_frame_im.grid_columnconfigure((0, 1), weight=1)

        self._btn_im_deb = ctk.CTkButton(
            btn_frame_im,
            text="🔄  Merge & Sync Debtors",
            height=46,
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=("#d97706", "#92400e"),
            hover_color=("#b45309", "#78350f"),
            command=self._confirm_im_debtors,
        )
        self._btn_im_deb.grid(row=0, column=0, sticky="ew", padx=(0, 6), pady=(0, 6))

        self._btn_im_cred = ctk.CTkButton(
            btn_frame_im,
            text="🔄  Merge & Sync Creditors",
            height=46,
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=("#d97706", "#92400e"),
            hover_color=("#b45309", "#78350f"),
            command=self._confirm_im_creditors,
        )
        self._btn_im_cred.grid(row=0, column=1, sticky="ew", padx=(6, 0), pady=(0, 6))

        self._btn_im_both = ctk.CTkButton(
            tab_im,
            text="🔄  Merge & Sync Both",
            height=50,
            font=ctk.CTkFont(size=15, weight="bold"),
            fg_color=("#1d4ed8", "#1e3a8a"),
            hover_color=("#1e40af", "#172554"),
            command=self._confirm_im_both,
        )
        self._btn_im_both.grid(row=12, column=0, sticky="ew", padx=18, pady=(0, 4))

        ctk.CTkLabel(
            tab_im,
            text="Merges period transactions into master → re-analyses → saves master → syncs to Supabase",
            font=ctk.CTkFont(size=11),
            text_color="gray",
            anchor="center",
        ).grid(row=13, column=0, padx=18, pady=(0, 10))

    # ── Master/period file row builder ────────────────────────────────────────

    def _make_master_file_row(
        self, parent, row: int, label: str, config_key: str,
        current_val: str, is_master: bool
    ) -> tuple:
        """
        Build a labelled path row with Browse… and Clear buttons.
        is_master=True  → filetypes = .xlsx only (master copy)
        is_master=False → filetypes = .xls .xlsx .xlsm (raw Tally export)
        """
        frame = ctk.CTkFrame(parent)
        frame.grid(row=row, column=0, sticky="ew", padx=18, pady=(0, 4))
        frame.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            frame, text=label,
            font=ctk.CTkFont(size=12, weight="bold"),
            anchor="w",
        ).grid(row=0, column=0, columnspan=4, sticky="w", padx=12, pady=(8, 2))

        var = tk.StringVar(value=current_val if current_val else "No file selected")

        ctk.CTkEntry(
            frame, textvariable=var,
            state="readonly", height=30,
            font=ctk.CTkFont(size=11),
        ).grid(row=1, column=0, columnspan=2, sticky="ew", padx=(12, 6), pady=(0, 8))

        filetypes = (
            [("Excel files", "*.xlsx"), ("All files", "*.*")]
            if is_master
            else _ext_filter()
        )

        ctk.CTkButton(
            frame, text="Browse…", width=76, height=30,
            command=lambda: self._im_browse(var, config_key, filetypes),
        ).grid(row=1, column=2, padx=(0, 4), pady=(0, 8))

        ctk.CTkButton(
            frame, text="Clear", width=54, height=30,
            fg_color="transparent", border_width=1,
            command=lambda: self._im_clear(var, config_key),
        ).grid(row=1, column=3, padx=(0, 12), pady=(0, 8))

        return var, frame

    def _im_browse(self, var: tk.StringVar, config_key: str, filetypes: list):
        path = filedialog.askopenfilename(
            title="Select file",
            filetypes=filetypes,
        )
        if path:
            var.set(path)
            cfg = self._get_cfg()
            cfg[config_key] = path
            self._save_cfg(cfg)
            self._log(f"📁 {config_key} → {os.path.basename(path)}")

    def _im_clear(self, var: tk.StringVar, config_key: str):
        var.set("No file selected")
        cfg = self._get_cfg()
        cfg[config_key] = ""
        self._save_cfg(cfg)
        self._log(f"✗ Cleared {config_key}")

    # ── IM button state ───────────────────────────────────────────────────────

    def _set_im_buttons_enabled(self, enabled: bool):
        state = "normal" if enabled else "disabled"
        def _set():
            self._btn_as_deb.configure(state=state)
            self._btn_as_cred.configure(state=state)
            self._btn_as_all.configure(state=state)
            self._btn_ao_process.configure(state=state)
            self._btn_ao_reset.configure(state=state)
            self._btn_im_deb.configure(state=state)
            self._btn_im_cred.configure(state=state)
            self._btn_im_both.configure(state=state)
        self.after(0, _set)

    # ── IM path helpers ───────────────────────────────────────────────────────

    def _im_get_master_path(self, var: tk.StringVar, ledger_label: str) -> str | None:
        """Validate and return master path, showing dialog if invalid."""
        val = var.get().strip()
        if not val or val == "No file selected":
            messagebox.showinfo(
                "No Master Copy",
                f"No {ledger_label} master copy found.\n\n"
                "Please run 'Analyse Only' first to create a master, "
                "then set its path here using Browse…",
            )
            return None
        if not Path(val).exists():
            messagebox.showerror(
                "File Not Found",
                f"Master file not found:\n{val}\n\n"
                "Please browse to the correct location.",
            )
            return None
        return val

    def _im_get_period_path(self, var: tk.StringVar, ledger_label: str) -> str | None:
        val = var.get().strip()
        if not val or val == "No file selected":
            messagebox.showerror(
                "No Period File",
                f"Please select the {ledger_label} period export file first.",
            )
            return None
        if not Path(val).exists():
            messagebox.showerror(
                "File Not Found",
                f"Period file not found:\n{val}",
            )
            return None
        return val

    # ══════════════════════════════════════════════════════════════════════════
    # INCREMENTAL MERGE — confirm + run
    # ══════════════════════════════════════════════════════════════════════════

    def _confirm_im_debtors(self):
        master = self._im_get_master_path(self._im_deb_master_var, "Debtors")
        if not master:
            return
        period = self._im_get_period_path(self._im_deb_period_var, "Debtors")
        if not period:
            return
        do_push = bool(self._im_opt_push.get())
        push_msg = "\nMerged data will be pushed to Supabase." if do_push else "\nSupabase push is OFF — master file only."
        if not messagebox.askyesno(
            "Merge & Sync Debtors",
            f"Master: {os.path.basename(master)}\n"
            f"Period: {os.path.basename(period)}\n"
            f"{push_msg}\n\n"
            "The master .xlsx will be overwritten. Proceed?",
        ):
            return
        self._run_im("debtor", master, period)

    def _confirm_im_creditors(self):
        master = self._im_get_master_path(self._im_cred_master_var, "Creditors")
        if not master:
            return
        period = self._im_get_period_path(self._im_cred_period_var, "Creditors")
        if not period:
            return
        do_push = bool(self._im_opt_push.get())
        push_msg = "\nMerged data will be pushed to Supabase." if do_push else "\nSupabase push is OFF — master file only."
        if not messagebox.askyesno(
            "Merge & Sync Creditors",
            f"Master: {os.path.basename(master)}\n"
            f"Period: {os.path.basename(period)}\n"
            f"{push_msg}\n\n"
            "The master .xlsx will be overwritten. Proceed?",
        ):
            return
        self._run_im("creditor", master, period)

    def _confirm_im_both(self):
        deb_master = self._im_get_master_path(self._im_deb_master_var, "Debtors")
        if not deb_master:
            return
        deb_period = self._im_get_period_path(self._im_deb_period_var, "Debtors")
        if not deb_period:
            return
        cred_master = self._im_get_master_path(self._im_cred_master_var, "Creditors")
        if not cred_master:
            return
        cred_period = self._im_get_period_path(self._im_cred_period_var, "Creditors")
        if not cred_period:
            return
        do_push = bool(self._im_opt_push.get())
        push_msg = "Merged data will be pushed to Supabase." if do_push else "Supabase push is OFF — master files only."
        if not messagebox.askyesno(
            "Merge & Sync Both",
            f"Debtors master:  {os.path.basename(deb_master)}\n"
            f"Debtors period:  {os.path.basename(deb_period)}\n"
            f"Creditors master: {os.path.basename(cred_master)}\n"
            f"Creditors period: {os.path.basename(cred_period)}\n\n"
            f"{push_msg}\n\n"
            "Both master .xlsx files will be overwritten. Proceed?",
        ):
            return
        self._run_im_both(
            deb_master, deb_period,
            cred_master, cred_period,
        )

    def _run_im(self, party_type: str, master_path: str, period_path: str):
        """Run incremental merge for a single ledger type."""
        if self._busy:
            messagebox.showwarning("Busy", "A task is already running. Please wait.")
            return
        self._busy = True
        self._set_im_buttons_enabled(False)

        cfg = self._get_cfg()
        do_push = bool(self._im_opt_push.get())
        flag_ank = bool(self._im_opt_ank.get())
        label = party_type.upper() + "S"

        self._log("─" * 52)
        self._log(f"🔄 Incremental Merge — {label}")
        self._set_progress(0, "Starting merge…")

        def worker():
            import time
            t0 = time.time()
            try:
                # Merge
                vendor_data, stats = merge_period_into_master(
                    master_path=master_path,
                    period_path=period_path,
                    ledger_type=party_type,
                    log_callback=self._log,
                )
                self._set_progress(0.6, "Saving master…")

                # Save master
                self._log(f"→ Saving master: {os.path.basename(master_path)} …")
                write_output_xlsx(
                    vendor_data, master_path,
                    ledger_type=party_type,
                    include_summary=True,
                    include_outstanding=True,
                    progress_callback=lambda c, t, v: self._update_progress(c, t, v),
                )
                self._log(f"  ✓ Saved → {os.path.basename(master_path)}")
                self._set_progress(0.75, "Master saved ✓")

                # Optionally push to Supabase
                if do_push:
                    err = self._validate_creds()
                    if err:
                        self._log(f"⚠  Supabase push skipped — {err}")
                    else:
                        self._set_progress(0.80, "Pushing to Supabase…")
                        self._log("📤 Pushing to Supabase…")
                        success, msg = fin_sync_core.push_analysed_data(
                            party_type=party_type,
                            vendor_data=vendor_data,
                            supabase_url=cfg["supabase_url"],
                            service_role_key=cfg["service_role_key"],
                            log_callback=self._log,
                        )
                        if success:
                            self._log(f"  ✓ {msg}")
                        else:
                            self._log(f"  ✗ {msg}")
                else:
                    self._log("  (Supabase push skipped — option unchecked)")

                elapsed = time.time() - t0
                self._set_progress(1.0, "Done ✓")
                self._log(f"✅ {label} merged and synced ({elapsed:.1f}s)")

            except Exception as exc:
                import traceback
                self._log(f"✗ Error: {exc}")
                self._log(traceback.format_exc())
                self._set_progress(1.0, "Error ✗")
            finally:
                self._busy = False
                self._set_im_buttons_enabled(True)
                self._log("─" * 52)

        threading.Thread(target=worker, daemon=True).start()

    def _run_im_both(
        self,
        deb_master: str, deb_period: str,
        cred_master: str, cred_period: str,
    ):
        """Run incremental merge for both Debtors then Creditors."""
        if self._busy:
            messagebox.showwarning("Busy", "A task is already running. Please wait.")
            return
        self._busy = True
        self._set_im_buttons_enabled(False)

        cfg = self._get_cfg()
        do_push = bool(self._im_opt_push.get())
        flag_ank = bool(self._im_opt_ank.get())

        self._log("─" * 52)
        self._log("🔄 Incremental Merge — BOTH (Debtors then Creditors)")
        self._set_progress(0, "Starting…")

        def worker():
            import time
            t0 = time.time()
            results = []
            pairs = [
                ("debtor",   "DEBTORS",   deb_master,  deb_period),
                ("creditor", "CREDITORS", cred_master, cred_period),
            ]

            for step_idx, (party_type, label, master_path, period_path) in enumerate(pairs):
                base_progress = step_idx * 0.5
                self._log(f"\n[{step_idx+1}/2] {label}")
                self._set_progress(base_progress, f"{label}: merging…")

                try:
                    vendor_data, stats = merge_period_into_master(
                        master_path=master_path,
                        period_path=period_path,
                        ledger_type=party_type,
                        log_callback=self._log,
                    )
                    self._set_progress(base_progress + 0.3, f"{label}: saving master…")

                    self._log(f"→ Saving master: {os.path.basename(master_path)} …")
                    write_output_xlsx(
                        vendor_data, master_path,
                        ledger_type=party_type,
                        include_summary=True,
                        include_outstanding=True,
                        progress_callback=lambda c, t, v: self._update_progress(c, t, v),
                    )
                    self._log(f"  ✓ Saved → {os.path.basename(master_path)}")

                    if do_push:
                        err = self._validate_creds()
                        if err:
                            self._log(f"  ⚠  Supabase push skipped — {err}")
                            results.append((label, False, err))
                        else:
                            self._set_progress(base_progress + 0.4, f"{label}: pushing…")
                            self._log(f"📤 Pushing {label} to Supabase…")
                            success, msg = fin_sync_core.push_analysed_data(
                                party_type=party_type,
                                vendor_data=vendor_data,
                                supabase_url=cfg["supabase_url"],
                                service_role_key=cfg["service_role_key"],
                                log_callback=self._log,
                            )
                            results.append((label, success, msg))
                            self._log(f"  {'✓' if success else '✗'} {msg}")
                    else:
                        self._log(f"  (Supabase push skipped)")
                        results.append((label, True, "Push skipped"))

                    self._set_progress(base_progress + 0.5, f"{label}: done")

                except Exception as exc:
                    import traceback
                    self._log(f"✗ {label} failed: {exc}")
                    self._log(traceback.format_exc())
                    results.append((label, False, str(exc)))

            # Summary
            elapsed = time.time() - t0
            self._log("\n── Merge Both Summary ──")
            all_ok = True
            for name, ok, msg in results:
                icon = "✅" if ok else "❌"
                self._log(f"  {icon} {name}")
                if not ok:
                    all_ok = False
            if all_ok:
                self._set_progress(1.0, "Done ✓")
                self._log(f"🎉 Both merges completed successfully ({elapsed:.1f}s).")
            else:
                self._set_progress(1.0, "Some errors ✗")
                self._log("⚠  One or more merges failed — see log above.")
            self._log("─" * 52)

            self._busy = False
            self._set_im_buttons_enabled(True)

        threading.Thread(target=worker, daemon=True).start()