"""
sync_tool.pyw — PriceMaster Sync
CTk GUI desktop app. Double-click to run (no terminal window on Windows).

Features:
  - First-run setup screen (Supabase URL + service_role key)
  - DB file path picker (saved to config.json)
  - Push to Cloud — local SQLite → Supabase (full replace)
  - Pull from Cloud — Supabase → local SQLite (full replace, auto-backup first)
  - Live log area that streams progress
  - Settings button to re-open setup screen
  - Dark/light follows system via CTk set_appearance_mode("system")
"""

import json
import os
import shutil
import threading
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import filedialog, messagebox

import customtkinter as ctk

import sync_core
import fin_sync_tool_tab
import sundry_analyser_tab

# ── Config ────────────────────────────────────────────────────────────────────

CONFIG_PATH = Path(__file__).parent / "config.json"

DEFAULT_CONFIG = {
    "supabase_url": "",
    "service_role_key": "",
    "db_path": "",
    "fin_debtors_path": "",
    "fin_creditors_path": "",
    "fin_address_path": "",
    "sa_debtors_path": "",
    "sa_creditors_path": "",
}

def load_config() -> dict:
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Back-fill any missing keys
            for k, v in DEFAULT_CONFIG.items():
                data.setdefault(k, v)
            return data
        except Exception:
            pass
    return dict(DEFAULT_CONFIG)

def save_config(cfg: dict):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)


# ── CTk appearance ────────────────────────────────────────────────────────────
ctk.set_appearance_mode("system")
ctk.set_default_color_theme("blue")


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  SetupScreen — first-run / settings overlay                                ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class SetupScreen(ctk.CTkToplevel):
    """Modal window for entering/updating Supabase credentials."""

    def __init__(self, parent, config: dict, on_save):
        super().__init__(parent)
        self.title("PriceMaster Sync — Setup")
        self.geometry("480x380")
        self.minsize(420, 340)
        self.resizable(True, True)
        self.grab_set()  # modal
        self.lift()
        self.focus_force()

        self._config = dict(config)
        self._on_save = on_save

        self._build()

    def _build(self):
        pad = {"padx": 28, "pady": 0}

        # Title
        ctk.CTkLabel(
            self, text="⚙️  Setup",
            font=ctk.CTkFont(size=20, weight="bold"),
            anchor="w",
        ).pack(fill="x", padx=28, pady=(24, 2))

        ctk.CTkLabel(
            self,
            text="Enter your Supabase project credentials.\nThese are saved locally to config.json — never shared.",
            font=ctk.CTkFont(size=12),
            anchor="w",
            justify="left",
            wraplength=420,
        ).pack(fill="x", padx=28, pady=(0, 18))

        # Supabase URL
        ctk.CTkLabel(self, text="Supabase Project URL", font=ctk.CTkFont(size=13, weight="bold"), anchor="w").pack(fill="x", **pad)
        self._url_entry = ctk.CTkEntry(self, placeholder_text="https://xxxx.supabase.co", height=36)
        self._url_entry.pack(fill="x", padx=28, pady=(4, 14))
        if self._config.get("supabase_url"):
            self._url_entry.insert(0, self._config["supabase_url"])

        # Service role key
        ctk.CTkLabel(self, text="Service Role Key  (secret — keep private)", font=ctk.CTkFont(size=13, weight="bold"), anchor="w").pack(fill="x", **pad)
        self._key_entry = ctk.CTkEntry(self, placeholder_text="eyJ...", height=36, show="•")
        self._key_entry.pack(fill="x", padx=28, pady=(4, 6))
        if self._config.get("service_role_key"):
            self._key_entry.insert(0, self._config["service_role_key"])

        # Show/hide key
        self._show_key = tk.BooleanVar(value=False)
        ctk.CTkCheckBox(
            self, text="Show key", variable=self._show_key,
            command=self._toggle_key, font=ctk.CTkFont(size=12),
        ).pack(anchor="w", padx=28, pady=(0, 18))

        self._error_label = ctk.CTkLabel(self, text="", text_color="red", font=ctk.CTkFont(size=12), anchor="w")
        self._error_label.pack(fill="x", padx=28, pady=(0, 6))

        # Buttons
        btn_frame = ctk.CTkFrame(self, fg_color="transparent")
        btn_frame.pack(fill="x", padx=28, pady=(0, 24))
        ctk.CTkButton(btn_frame, text="Cancel", width=100, fg_color="transparent",
                      border_width=1, command=self.destroy).pack(side="left")
        ctk.CTkButton(btn_frame, text="Save & Continue", width=160,
                      command=self._save).pack(side="right")

    def _toggle_key(self):
        self._key_entry.configure(show="" if self._show_key.get() else "•")

    def _save(self):
        url = self._url_entry.get().strip()
        key = self._key_entry.get().strip()

        if not url or not url.startswith("https://"):
            self._error_label.configure(text="⚠  Enter a valid Supabase URL (starts with https://)")
            return
        if not key or len(key) < 20:
            self._error_label.configure(text="⚠  Enter a valid service role key")
            return

        self._config["supabase_url"] = url
        self._config["service_role_key"] = key
        self._on_save(self._config)
        self.destroy()


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  App — main window                                                          ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class App(ctk.CTk):

    def __init__(self):
        super().__init__()

        self.title("PriceMaster Sync")
        self.geometry("680x800")
        self.minsize(560, 640)
        self.resizable(True, True)

        self._config = load_config()
        self._sync_running = False

        self._build_ui()

        # First-run check — show setup if creds are missing
        if not self._config.get("supabase_url") or not self._config.get("service_role_key"):
            self.after(200, self._open_setup)

    # ── UI construction ───────────────────────────────────────────────────────

    def _build_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)  # tabview expands

        # ── Header bar ────────────────────────────────────────────────────
        header = ctk.CTkFrame(self, corner_radius=0, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", padx=20, pady=(18, 0))
        header.grid_columnconfigure(0, weight=1)

        title_frame = ctk.CTkFrame(header, fg_color="transparent")
        title_frame.grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(title_frame, text="PriceMaster Sync",
                     font=ctk.CTkFont(size=22, weight="bold")).pack(side="left")
        ctk.CTkLabel(title_frame, text="  ·  Inventory & Financial sync",
                     font=ctk.CTkFont(size=13), text_color="gray").pack(side="left", pady=(4, 0))

        # Settings gear button
        ctk.CTkButton(
            header, text="⚙", width=36, height=36,
            font=ctk.CTkFont(size=16),
            fg_color="transparent", border_width=1,
            command=self._open_setup,
        ).grid(row=0, column=1, sticky="e")

        # ── Status banner (hidden until sync completes) ────────────────────
        self._banner_var = tk.StringVar(value="")
        self._banner = ctk.CTkLabel(
            self, textvariable=self._banner_var,
            font=ctk.CTkFont(size=13),
            corner_radius=8, height=34,
            fg_color="transparent",
        )
        self._banner.grid(row=1, column=0, sticky="ew", padx=20, pady=(10, 0))

        # ── Tab view: Inventory | Financial | Sundry Analyser ────────────
        self._tabview = ctk.CTkTabview(self)
        self._tabview.grid(row=2, column=0, sticky="nsew", padx=20, pady=(8, 0))

        inv_tab = self._tabview.add("📦  Inventory")
        fin_tab = self._tabview.add("💹  Financial")
        sa_tab  = self._tabview.add("📊  Sundry Analyser")

        # ── Inventory tab content (existing push/pull + log) ──────────────
        inv_tab.grid_columnconfigure(0, weight=1)
        inv_tab.grid_rowconfigure(2, weight=1)

        # DB file selector
        db_frame = ctk.CTkFrame(inv_tab)
        db_frame.grid(row=0, column=0, sticky="ew", pady=(4, 0))
        db_frame.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(db_frame, text="Database file", font=ctk.CTkFont(size=13, weight="bold"),
                     anchor="w").grid(row=0, column=0, columnspan=3, sticky="w", padx=14, pady=(10, 2))

        self._db_path_var = tk.StringVar(value=self._config.get("db_path") or "No file selected")
        ctk.CTkEntry(
            db_frame, textvariable=self._db_path_var,
            state="readonly", height=34, font=ctk.CTkFont(size=12),
        ).grid(row=1, column=0, columnspan=2, sticky="ew", padx=(14, 6), pady=(0, 12))

        ctk.CTkButton(
            db_frame, text="Browse…", width=90, height=34,
            command=self._browse_db,
        ).grid(row=1, column=2, padx=(0, 14), pady=(0, 12))

        # Action buttons
        actions = ctk.CTkFrame(inv_tab, fg_color="transparent")
        actions.grid(row=1, column=0, sticky="ew", pady=(10, 0))
        actions.grid_columnconfigure((0, 1), weight=1)

        # Push
        push_card = ctk.CTkFrame(actions)
        push_card.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        push_card.grid_columnconfigure(0, weight=1)

        ctk.CTkButton(
            push_card,
            text="📤  Push to Cloud",
            font=ctk.CTkFont(size=15, weight="bold"),
            height=56,
            command=self._confirm_push,
            fg_color=("#2563eb", "#1d4ed8"),
            hover_color=("#1d4ed8", "#1e40af"),
        ).grid(row=0, column=0, sticky="ew", padx=14, pady=(14, 6))

        ctk.CTkLabel(
            push_card,
            text="Send local changes → Supabase",
            font=ctk.CTkFont(size=11),
            text_color="gray",
        ).grid(row=1, column=0, padx=14, pady=(0, 14))

        # Pull
        pull_card = ctk.CTkFrame(actions)
        pull_card.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        pull_card.grid_columnconfigure(0, weight=1)

        ctk.CTkButton(
            pull_card,
            text="📥  Pull from Cloud",
            font=ctk.CTkFont(size=15, weight="bold"),
            height=56,
            command=self._confirm_pull,
            fg_color=("#16a34a", "#15803d"),
            hover_color=("#15803d", "#166534"),
        ).grid(row=0, column=0, sticky="ew", padx=14, pady=(14, 6))

        ctk.CTkLabel(
            pull_card,
            text="Overwrite local DB ← Supabase",
            font=ctk.CTkFont(size=11),
            text_color="gray",
        ).grid(row=1, column=0, padx=14, pady=(0, 2))

        ctk.CTkLabel(
            pull_card,
            text="⚠️  This will overwrite your local database",
            font=ctk.CTkFont(size=11),
            text_color=("orange", "#f59e0b"),
        ).grid(row=2, column=0, padx=14, pady=(0, 14))

        # Log area (inside Inventory tab)
        log_frame = ctk.CTkFrame(inv_tab, fg_color="transparent")
        log_frame.grid(row=2, column=0, sticky="nsew", pady=(10, 4))
        log_frame.grid_columnconfigure(0, weight=1)
        log_frame.grid_rowconfigure(1, weight=1)

        log_header = ctk.CTkFrame(log_frame, fg_color="transparent")
        log_header.grid(row=0, column=0, sticky="ew")
        log_header.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(log_header, text="Log", font=ctk.CTkFont(size=13, weight="bold"),
                     anchor="w").grid(row=0, column=0, sticky="w")
        ctk.CTkButton(
            log_header, text="Clear", width=54, height=24,
            font=ctk.CTkFont(size=11),
            fg_color="transparent", border_width=1,
            command=self._clear_log,
        ).grid(row=0, column=1, sticky="e")

        self._log_box = ctk.CTkTextbox(
            log_frame,
            font=ctk.CTkFont(family="Courier New", size=12),
            wrap="word",
            state="disabled",
        )
        self._log_box.grid(row=1, column=0, sticky="nsew", pady=(6, 0))

        # ── Financial tab content ─────────────────────────────────────────
        fin_tab.grid_columnconfigure(0, weight=1)
        fin_tab.grid_rowconfigure(0, weight=1)

        self._fin_tab = fin_sync_tool_tab.FinancialSyncTab(
            fin_tab,
            config_getter=lambda: self._config,
            config_saver=save_config,
            log_callback=self._log,
        )
        self._fin_tab.grid(row=0, column=0, sticky="nsew")

        # ── Sundry Analyser tab content ───────────────────────────────────
        sa_tab.grid_columnconfigure(0, weight=1)
        sa_tab.grid_rowconfigure(0, weight=1)

        self._sa_tab = sundry_analyser_tab.SundryAnalyserTab(
            sa_tab,
            config_getter=lambda: self._config,
            config_saver=save_config,
            log_callback=self._log,
        )
        self._sa_tab.grid(row=0, column=0, sticky="nsew")

    # ── Settings ──────────────────────────────────────────────────────────────

    def _open_setup(self):
        SetupScreen(self, self._config, on_save=self._on_setup_save)

    def _on_setup_save(self, new_cfg: dict):
        self._config.update(new_cfg)
        save_config(self._config)
        self._log("✅ Settings saved.")

    # ── DB browse ─────────────────────────────────────────────────────────────

    def _browse_db(self):
        path = filedialog.askopenfilename(
            title="Select bills_data.db",
            filetypes=[("SQLite database", "*.db"), ("All files", "*.*")],
        )
        if path:
            self._config["db_path"] = path
            self._db_path_var.set(path)
            save_config(self._config)
            self._log(f"📁 Database set to: {path}")

    # ── Log helpers ───────────────────────────────────────────────────────────

    def _log(self, message: str):
        """Append a line to the log box (thread-safe via after())."""
        def _append():
            self._log_box.configure(state="normal")
            self._log_box.insert("end", message + "\n")
            self._log_box.see("end")
            self._log_box.configure(state="disabled")
        self.after(0, _append)

    def _clear_log(self):
        self._log_box.configure(state="normal")
        self._log_box.delete("1.0", "end")
        self._log_box.configure(state="disabled")

    # ── Banner ────────────────────────────────────────────────────────────────

    def _show_banner(self, message: str, success: bool):
        def _set():
            color = ("#d1fae5", "#14532d") if success else ("#fee2e2", "#7f1d1d")
            text_color = ("#14532d", "#d1fae5") if success else ("#7f1d1d", "#fee2e2")
            self._banner.configure(fg_color=color, text_color=text_color)
            self._banner_var.set(message)
        self.after(0, _set)

    def _hide_banner(self):
        def _set():
            self._banner.configure(fg_color="transparent")
            self._banner_var.set("")
        self.after(0, _set)

    # ── Button state ──────────────────────────────────────────────────────────

    def _set_buttons_enabled(self, enabled: bool):
        state = "normal" if enabled else "disabled"
        def _set():
            # Walk all CTkButton widgets and toggle
            for widget in self.winfo_children():
                self._toggle_buttons(widget, state)
        self.after(0, _set)

    def _toggle_buttons(self, widget, state):
        if isinstance(widget, ctk.CTkButton):
            widget.configure(state=state)
        for child in widget.winfo_children():
            self._toggle_buttons(child, state)

    # ── Validation ────────────────────────────────────────────────────────────

    def _validate(self) -> str | None:
        """Return error string if config is incomplete, else None."""
        if not self._config.get("supabase_url"):
            return "Supabase URL is not set. Click ⚙ Settings to configure."
        if not self._config.get("service_role_key"):
            return "Service role key is not set. Click ⚙ Settings to configure."
        db = self._config.get("db_path", "")
        if not db or db == "No file selected":
            return "No database file selected. Click Browse… to pick bills_data.db."
        if not Path(db).exists():
            return f"Database file not found:\n{db}"
        return None

    # ── Push ──────────────────────────────────────────────────────────────────

    def _confirm_push(self):
        err = self._validate()
        if err:
            messagebox.showerror("Cannot Push", err, parent=self)
            return
        if messagebox.askyesno(
            "Push to Cloud",
            "Push local database to Supabase?\n\nThis will OVERWRITE all cloud inventory data with your local copy.",
            parent=self,
        ):
            self._run_push()

    def _run_push(self):
        self._hide_banner()
        self._set_buttons_enabled(False)
        self._sync_running = True
        self._log("─" * 48)
        self._log(f"📤 Starting push  [{datetime.now().strftime('%H:%M:%S')}]")

        def worker():
            success, summary = sync_core.push(
                db_path=self._config["db_path"],
                supabase_url=self._config["supabase_url"],
                service_role_key=self._config["service_role_key"],
                log_callback=self._log,
            )
            self._sync_running = False
            self._set_buttons_enabled(True)
            self._show_banner(summary, success)

        threading.Thread(target=worker, daemon=True).start()

    # ── Pull ──────────────────────────────────────────────────────────────────

    def _confirm_pull(self):
        err = self._validate()
        if err:
            messagebox.showerror("Cannot Pull", err, parent=self)
            return
        if messagebox.askyesno(
            "Pull from Cloud",
            "Pull from Supabase and overwrite your local bills_data.db?\n\n"
            "A backup of your local database will be created first.",
            parent=self,
        ):
            self._run_pull()

    def _run_pull(self):
        self._hide_banner()
        self._set_buttons_enabled(False)
        self._sync_running = True
        self._log("─" * 48)
        self._log(f"📥 Starting pull  [{datetime.now().strftime('%H:%M:%S')}]")

        # Auto-backup before overwriting
        db_path = self._config["db_path"]
        try:
            db_dir = Path(db_path).parent
            db_stem = Path(db_path).stem
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"{db_stem}_backup_{timestamp}.db"
            backup_path = db_dir / backup_name
            shutil.copy2(db_path, backup_path)
            self._log(f"💾 Backup saved: {backup_name}")
        except Exception as exc:
            self._log(f"⚠️  Backup failed (continuing anyway): {exc}")

        def worker():
            success, summary = sync_core.pull(
                db_path=db_path,
                supabase_url=self._config["supabase_url"],
                service_role_key=self._config["service_role_key"],
                log_callback=self._log,
            )
            self._sync_running = False
            self._set_buttons_enabled(True)
            self._show_banner(summary, success)

        threading.Thread(target=worker, daemon=True).start()

    # ── Window close guard ────────────────────────────────────────────────────

    def on_close(self):
        if self._sync_running:
            if not messagebox.askyesno(
                "Sync in progress",
                "A sync is currently running. Closing now may leave data in an inconsistent state.\n\nClose anyway?",
                parent=self,
            ):
                return
        self.destroy()


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = App()
    app.protocol("WM_DELETE_WINDOW", app.on_close)
    app.mainloop()
