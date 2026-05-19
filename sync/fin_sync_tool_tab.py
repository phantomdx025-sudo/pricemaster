"""
fin_sync_tool_tab.py — Financial Sync tab for PriceMaster Sync Tool.

This module provides FinancialSyncTab, a CTkFrame subclass that is dropped
into the existing sync_tool.pyw window as a new tab in a CTkTabview.

Usage in sync_tool.pyw:
    from fin_sync_tool_tab import FinancialSyncTab
    # Then inside App._build_ui(), after the existing content:
    #   tab = FinancialSyncTab(self, config_getter=lambda: self._config,
    #                          config_saver=save_config,
    #                          log_callback=self._log)
    #   tab.pack(fill="both", expand=True, padx=0, pady=0)

The tab manages its own file-path entries and sync buttons.
It writes fin_debtors_path, fin_creditors_path, fin_address_path to config.json.
It reuses the parent window's log area by calling log_callback(msg).
All sync operations run on daemon threads (same pattern as push/pull).
"""

import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox

import customtkinter as ctk

import fin_sync_core


class FinancialSyncTab(ctk.CTkFrame):
    """
    Self-contained Financial Sync panel.
    Renders: 3 file pickers, 3 individual sync buttons, 1 Sync All button.
    Each sync button shows a preview dialog before proceeding.
    """

    def __init__(self, master, config_getter, config_saver, log_callback, **kwargs):
        """
        Parameters
        ----------
        master        : parent CTk widget
        config_getter : callable() → dict   (returns current config)
        config_saver  : callable(dict)      (persists config to disk)
        log_callback  : callable(str)       (appends to the shared log textbox)
        """
        super().__init__(master, fg_color="transparent", **kwargs)
        self._get_cfg = config_getter
        self._save_cfg = config_saver
        self._log = log_callback
        self._busy = False  # True while any fin sync is running

        self._build()

    # ── UI ────────────────────────────────────────────────────────────────────

    def _build(self):
        self.grid_columnconfigure(0, weight=1)

        # Section title
        ctk.CTkLabel(
            self,
            text="💹  Financial Sync",
            font=ctk.CTkFont(size=17, weight="bold"),
            anchor="w",
        ).grid(row=0, column=0, sticky="w", padx=18, pady=(18, 2))

        ctk.CTkLabel(
            self,
            text="Push Tally Excel exports to Supabase fin_* tables.",
            font=ctk.CTkFont(size=12),
            text_color="gray",
            anchor="w",
        ).grid(row=1, column=0, sticky="w", padx=18, pady=(0, 14))

        cfg = self._get_cfg()

        # ── Debtors ──────────────────────────────────────────────────────
        self._debtors_var, debtors_frame = self._make_file_row(
            row=2,
            label="Sundry Debtors Excel",
            config_key="fin_debtors_path",
            filetypes=[("Excel files", "*.xlsx *.xlsm"), ("All files", "*.*")],
            current_val=cfg.get("fin_debtors_path", ""),
        )

        self._btn_debtors = ctk.CTkButton(
            self,
            text="Sync Debtors",
            height=36,
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=("#d97706", "#92400e"),
            hover_color=("#b45309", "#78350f"),
            command=self._confirm_sync_debtors,
        )
        self._btn_debtors.grid(row=3, column=0, sticky="ew", padx=18, pady=(4, 14))

        # ── Creditors ─────────────────────────────────────────────────────
        self._creditors_var, _ = self._make_file_row(
            row=4,
            label="Sundry Creditors Excel",
            config_key="fin_creditors_path",
            filetypes=[("Excel files", "*.xlsx *.xlsm"), ("All files", "*.*")],
            current_val=cfg.get("fin_creditors_path", ""),
        )

        self._btn_creditors = ctk.CTkButton(
            self,
            text="Sync Creditors",
            height=36,
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=("#d97706", "#92400e"),
            hover_color=("#b45309", "#78350f"),
            command=self._confirm_sync_creditors,
        )
        self._btn_creditors.grid(row=5, column=0, sticky="ew", padx=18, pady=(4, 14))

        # ── Address Book ──────────────────────────────────────────────────
        self._address_var, _ = self._make_file_row(
            row=6,
            label="Address Book Excel",
            config_key="fin_address_path",
            filetypes=[("Excel files", "*.xlsx *.xlsm"), ("All files", "*.*")],
            current_val=cfg.get("fin_address_path", ""),
        )

        self._btn_address = ctk.CTkButton(
            self,
            text="Sync Address Book",
            height=36,
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=("#d97706", "#92400e"),
            hover_color=("#b45309", "#78350f"),
            command=self._confirm_sync_address,
        )
        self._btn_address.grid(row=7, column=0, sticky="ew", padx=18, pady=(4, 14))

        # ── Divider ───────────────────────────────────────────────────────
        ctk.CTkFrame(self, height=1, fg_color="gray").grid(
            row=8, column=0, sticky="ew", padx=18, pady=(4, 14)
        )

        # ── Sync All ──────────────────────────────────────────────────────
        self._btn_all = ctk.CTkButton(
            self,
            text="🔄  Sync All 3 Files",
            height=50,
            font=ctk.CTkFont(size=15, weight="bold"),
            fg_color=("#1d4ed8", "#1e3a8a"),
            hover_color=("#1e40af", "#172554"),
            command=self._confirm_sync_all,
        )
        self._btn_all.grid(row=9, column=0, sticky="ew", padx=18, pady=(0, 6))

        ctk.CTkLabel(
            self,
            text="Syncs Debtors → Creditors → Address Book sequentially",
            font=ctk.CTkFont(size=11),
            text_color="gray",
            anchor="center",
        ).grid(row=10, column=0, padx=18, pady=(0, 18))

    def _make_file_row(
        self, row: int, label: str, config_key: str, filetypes: list, current_val: str
    ) -> tuple[tk.StringVar, ctk.CTkFrame]:
        """Build a labelled file-picker row. Returns (StringVar, frame)."""
        frame = ctk.CTkFrame(self)
        frame.grid(row=row, column=0, sticky="ew", padx=18, pady=(0, 4))
        frame.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            frame,
            text=label,
            font=ctk.CTkFont(size=13, weight="bold"),
            anchor="w",
        ).grid(row=0, column=0, columnspan=3, sticky="w", padx=12, pady=(10, 2))

        var = tk.StringVar(value=current_val if current_val else "No file selected")

        ctk.CTkEntry(
            frame,
            textvariable=var,
            state="readonly",
            height=32,
            font=ctk.CTkFont(size=11),
        ).grid(row=1, column=0, columnspan=2, sticky="ew", padx=(12, 6), pady=(0, 10))

        ctk.CTkButton(
            frame,
            text="Browse…",
            width=80,
            height=32,
            command=lambda: self._browse(var, config_key, filetypes),
        ).grid(row=1, column=2, padx=(0, 12), pady=(0, 10))

        return var, frame

    # ── File browsing ─────────────────────────────────────────────────────────

    def _browse(self, var: tk.StringVar, config_key: str, filetypes: list):
        path = filedialog.askopenfilename(
            title="Select Excel file",
            filetypes=filetypes,
        )
        if path:
            var.set(path)
            cfg = self._get_cfg()
            cfg[config_key] = path
            self._save_cfg(cfg)
            self._log(f"📁 {config_key} set to: {path}")

    # ── Validation ────────────────────────────────────────────────────────────

    def _validate_creds(self) -> str | None:
        cfg = self._get_cfg()
        if not cfg.get("supabase_url"):
            return "Supabase URL is not set. Click ⚙ Settings to configure."
        if not cfg.get("service_role_key"):
            return "Service role key is not set. Click ⚙ Settings to configure."
        return None

    def _get_path(self, var: tk.StringVar) -> str | None:
        val = var.get().strip()
        if not val or val == "No file selected":
            return None
        if not Path(val).exists():
            return None
        return val

    # ── Confirm + preview dialogs ─────────────────────────────────────────────

    def _confirm_sync_debtors(self):
        err = self._validate_creds()
        if err:
            messagebox.showerror("Cannot Sync", err)
            return
        path = self._get_path(self._debtors_var)
        if not path:
            messagebox.showerror("Cannot Sync", "Please select the Sundry Debtors Excel file first.")
            return

        self._log("🔍 Scanning Debtors Excel for preview…")
        result = fin_sync_core.preview_debtors(path)
        if result is None:
            if not messagebox.askyesno(
                "Sync Debtors",
                "Could not read preview from file (it may still be valid).\n\nProceed with sync?",
            ):
                return
        else:
            parties, txns = result
            if not messagebox.askyesno(
                "Sync Debtors",
                f"Found {parties} parties and ~{txns} transactions.\n\n"
                "This will DELETE all existing debtor data in Supabase and re-upload.\n\nProceed?",
            ):
                self._log("⏹ Debtors sync cancelled.")
                return

        self._run_sync("debtors", path)

    def _confirm_sync_creditors(self):
        err = self._validate_creds()
        if err:
            messagebox.showerror("Cannot Sync", err)
            return
        path = self._get_path(self._creditors_var)
        if not path:
            messagebox.showerror("Cannot Sync", "Please select the Sundry Creditors Excel file first.")
            return

        self._log("🔍 Scanning Creditors Excel for preview…")
        result = fin_sync_core.preview_creditors(path)
        if result is None:
            if not messagebox.askyesno(
                "Sync Creditors",
                "Could not read preview from file.\n\nProceed with sync?",
            ):
                return
        else:
            parties, txns = result
            if not messagebox.askyesno(
                "Sync Creditors",
                f"Found {parties} parties and ~{txns} transactions.\n\n"
                "This will DELETE all existing creditor data in Supabase and re-upload.\n\nProceed?",
            ):
                self._log("⏹ Creditors sync cancelled.")
                return

        self._run_sync("creditors", path)

    def _confirm_sync_address(self):
        err = self._validate_creds()
        if err:
            messagebox.showerror("Cannot Sync", err)
            return
        path = self._get_path(self._address_var)
        if not path:
            messagebox.showerror("Cannot Sync", "Please select the Address Book Excel file first.")
            return

        self._log("🔍 Scanning Address Book for preview…")
        count = fin_sync_core.preview_address_book(path)
        if count is None:
            if not messagebox.askyesno(
                "Sync Address Book",
                "Could not read preview from file.\n\nProceed with sync?",
            ):
                return
        else:
            if not messagebox.askyesno(
                "Sync Address Book",
                f"Found {count} address entries.\n\n"
                "This will UPSERT all entries into Supabase (existing entries updated, new ones added).\n\nProceed?",
            ):
                self._log("⏹ Address Book sync cancelled.")
                return

        self._run_sync("address_book", path)

    def _confirm_sync_all(self):
        err = self._validate_creds()
        if err:
            messagebox.showerror("Cannot Sync", err)
            return

        # Validate all three paths
        debtors_path = self._get_path(self._debtors_var)
        creditors_path = self._get_path(self._creditors_var)
        address_path = self._get_path(self._address_var)

        missing = []
        if not debtors_path:
            missing.append("Sundry Debtors Excel")
        if not creditors_path:
            missing.append("Sundry Creditors Excel")
        if not address_path:
            missing.append("Address Book Excel")

        if missing:
            messagebox.showerror(
                "Cannot Sync All",
                "The following files are not set or not found:\n\n"
                + "\n".join(f"  • {m}" for m in missing)
                + "\n\nPlease select all three files before using Sync All.",
            )
            return

        # Build preview
        d_result = fin_sync_core.preview_debtors(debtors_path)
        c_result = fin_sync_core.preview_creditors(creditors_path)
        a_count = fin_sync_core.preview_address_book(address_path)

        d_str = f"{d_result[0]} parties, ~{d_result[1]} txns" if d_result else "preview unavailable"
        c_str = f"{c_result[0]} parties, ~{c_result[1]} txns" if c_result else "preview unavailable"
        a_str = f"{a_count} entries" if a_count is not None else "preview unavailable"

        if not messagebox.askyesno(
            "Sync All 3 Files",
            f"About to sync all 3 files:\n\n"
            f"  📊 Debtors: {d_str}\n"
            f"  📊 Creditors: {c_str}\n"
            f"  📒 Address Book: {a_str}\n\n"
            "Debtors and Creditors will DELETE existing Supabase data before re-uploading.\n"
            "Address Book will UPSERT (update existing, add new).\n\n"
            "Proceed?",
        ):
            self._log("⏹ Sync All cancelled.")
            return

        self._run_sync_all(debtors_path, creditors_path, address_path)

    # ── Background workers ────────────────────────────────────────────────────

    def _set_buttons_enabled(self, enabled: bool):
        state = "normal" if enabled else "disabled"
        def _set():
            self._btn_debtors.configure(state=state)
            self._btn_creditors.configure(state=state)
            self._btn_address.configure(state=state)
            self._btn_all.configure(state=state)
        self.after(0, _set)

    def _run_sync(self, file_type: str, path: str):
        """Run a single sync in a background thread."""
        if self._busy:
            messagebox.showwarning("Busy", "A sync is already in progress. Please wait.")
            return

        self._busy = True
        self._set_buttons_enabled(False)
        cfg = self._get_cfg()
        url = cfg["supabase_url"]
        key = cfg["service_role_key"]

        self._log("─" * 48)
        self._log(f"🚀 Starting {file_type} sync…")

        def worker():
            try:
                if file_type == "debtors":
                    success, msg = fin_sync_core.sync_debtors(path, url, key, self._log)
                elif file_type == "creditors":
                    success, msg = fin_sync_core.sync_creditors(path, url, key, self._log)
                else:
                    success, msg = fin_sync_core.sync_address_book(path, url, key, self._log)
            except Exception as exc:
                success = False
                msg = f"❌ Unexpected error: {exc}"
                self._log(msg)
            finally:
                self._busy = False
                self._set_buttons_enabled(True)
            self._log("─" * 48)

        threading.Thread(target=worker, daemon=True).start()

    def _run_sync_all(self, debtors_path: str, creditors_path: str, address_path: str):
        """Run all three syncs sequentially in a single background thread."""
        if self._busy:
            messagebox.showwarning("Busy", "A sync is already in progress. Please wait.")
            return

        self._busy = True
        self._set_buttons_enabled(False)
        cfg = self._get_cfg()
        url = cfg["supabase_url"]
        key = cfg["service_role_key"]

        self._log("─" * 48)
        self._log("🚀 Starting Sync All 3 Files…")

        def worker():
            results = []
            try:
                self._log("\n[1/3] Syncing Debtors…")
                ok, msg = fin_sync_core.sync_debtors(debtors_path, url, key, self._log)
                results.append(("Debtors", ok, msg))

                self._log("\n[2/3] Syncing Creditors…")
                ok, msg = fin_sync_core.sync_creditors(creditors_path, url, key, self._log)
                results.append(("Creditors", ok, msg))

                self._log("\n[3/3] Syncing Address Book…")
                ok, msg = fin_sync_core.sync_address_book(address_path, url, key, self._log)
                results.append(("Address Book", ok, msg))

            except Exception as exc:
                self._log(f"❌ Unexpected error during Sync All: {exc}")
            finally:
                self._busy = False
                self._set_buttons_enabled(True)

            self._log("\n── Sync All Summary ──")
            all_ok = True
            for name, ok, msg in results:
                icon = "✅" if ok else "❌"
                self._log(f"  {icon} {name}")
                if not ok:
                    all_ok = False
            if all_ok:
                self._log("🎉 All 3 syncs completed successfully.")
            else:
                self._log("⚠️  One or more syncs failed. See log above.")
            self._log("─" * 48)

        threading.Thread(target=worker, daemon=True).start()
