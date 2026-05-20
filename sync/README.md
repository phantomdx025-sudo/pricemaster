# PriceMaster Sync — Setup Guide

This tool lets you sync your inventory between your computer and the cloud. You can push changes from your PC to the website, or pull the latest data from the website back to your PC.

---

## What you need before starting

- A Windows PC (the tool also works on Mac, but these instructions are for Windows)
- Python 3.10 or newer installed
- Your Supabase project URL and service role key (your developer can give you these)

---

## Step 1 — Install Python (if you haven't already)

1. Open your web browser and go to **python.org/downloads**
2. Click the big yellow **"Download Python"** button
3. Run the downloaded installer
4. **Important:** On the first screen of the installer, tick the box that says **"Add Python to PATH"** before clicking Install
5. Click **Install Now** and wait for it to finish

---

## Step 2 — Install the required packages

1. Press the **Windows key**, type `cmd`, and press Enter to open a black Command Prompt window
2. Type the following command and press Enter:

```
pip install customtkinter supabase pillow
```

3. Wait for it to finish downloading and installing (this may take a minute or two)
4. You can close the Command Prompt window when it's done

---

## Step 3 — Open the sync tool

1. Find the `sync` folder that came with PriceMaster
2. Double-click `sync_tool.pyw`

The PriceMaster Sync window will open. It looks like a clean app with two big buttons.

> **Tip:** If double-clicking does nothing, right-click the file, choose **"Open with"**, then select **Python**. If Python doesn't appear in the list, choose **"Look for another app"** and find `pythonw.exe` in your Python installation folder (usually `C:\Python312\` or similar).

---

## Step 4 — First-time setup

The first time you open the tool, a setup screen will appear asking for two things:

**Supabase Project URL**
This looks like: `https://abcdefghijk.supabase.co`
Your developer can give you this from the Supabase dashboard.

**Service Role Key**
A long string of letters and numbers starting with `eyJ...`
This is a secret key — do not share it with anyone. Your developer can give you this.

Type both in, then click **Save & Continue**.

These details are saved to a file called `config.json` in the sync folder. You only need to do this once. If you ever need to change them, click the ⚙ gear button in the top-right corner.

---

## Step 5 — Select your database file

In the main window, you'll see a "Database file" section near the top. Click **Browse…** and navigate to your `bills_data.db` file. This is the inventory database on your PC that your existing billing software uses.

Once selected, the path is saved — you won't need to browse for it again next time.

---

## Using the tool

### 📤 Push to Cloud
Use this when you've updated prices or added products on your PC and want the website to show the latest data.

1. Click **Push to Cloud**
2. A confirmation box will appear — click **Yes**
3. Watch the log at the bottom as it uploads your data
4. A green banner at the top confirms it's done

### 📥 Pull from Cloud
Use this if someone has updated the catalogue through the website and you want to bring those changes back to your PC.

1. Click **Pull from Cloud**
2. A confirmation box will appear — click **Yes**
3. **A backup of your local database is automatically saved** before anything is overwritten. The backup file will appear in the same folder as your database, named something like `bills_data_backup_20250115_143022.db`
4. Watch the log as it downloads the data
5. A green banner confirms it's done

---

## Troubleshooting

**The tool won't open / nothing happens when I double-click**
Make sure Python is installed and "Add Python to PATH" was ticked during installation. Try Step 2 again to install the packages.

**"Database file not found" error**
The database has been moved or renamed. Click **Browse…** to find it again.

**"Connection refused" or "Invalid API key" error**
Your Supabase credentials may be wrong. Click ⚙ Settings and re-enter them carefully. Make sure you're using the **service role key**, not the anon key.

**The log shows an error and stops**
A red banner will appear at the top explaining what went wrong. The most common causes are: no internet connection, wrong credentials, or the database file being open in another program. Fix the issue and try again — no data is partially saved (it's all or nothing).

---

## Important notes

- **Both push and pull are full replacements** — all inventory data is replaced, not merged. This is intentional: it's simple and reliable.
- **Pull only affects inventory tables** — your billing records, customer data, and any other information in `bills_data.db` are never touched.
- **The service role key is powerful** — it can read and write all your Supabase data. Keep `config.json` private and do not share it.

---

*PriceMaster Sync — built for [Your Business Name]*
