# PriceMaster - Setup & Troubleshooting Guide

## Issue 1: Mobile Tables Not Visible ✅ FIXED

**What was wrong:** Mobile cards had missing width constraints causing overflow on some devices.

**What I fixed:**
- Added `w-full overflow-x-hidden` to mobile card container
- Added `w-full` to empty state for proper centering on mobile
- Added `w-full` to mobile skeleton loader

**Test on mobile:**
- Open on phone at `http://[your-computer-ip]:9000`
- Go to Catalogue tab
- You should see items as cards (not a table)

---

## Issue 2: Staff Signup - "Failed to Send Request to Edge Function" 🔧 NEEDS CONFIG

### Root Cause
Supabase environment variables are not configured. The app can't communicate with your edge functions.

### Solution (3 Steps)

#### Step 1: Get Your Supabase Credentials
1. Go to https://app.supabase.com/
2. Select your project
3. Click **Settings** → **API**
4. Copy:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **Anon public key** (long string starting with `eyJ...`)

#### Step 2: Create `.env.local` File
Create a new file named **`.env.local`** in your project root (same level as `package.json`):

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ IMPORTANT:**
- This file is already in `.gitignore` (won't be committed)
- Restart your dev server after creating this file: `npm run dev`

#### Step 3: Deploy Edge Functions to Supabase

Make sure your edge functions are deployed:

```bash
# From project root, run:
cd supabase
supabase functions deploy staff-signup
supabase functions deploy staff-login
supabase functions deploy staff-write
supabase functions deploy catalogue-write
```

If you don't have Supabase CLI installed:
```bash
npm install -g supabase
```

### Verify It Works

1. Open browser console (F12)
2. You should see either:
   - ✅ No errors (Supabase configured correctly)
   - ❌ Error message with missing env var (fix Step 1-2)

3. Try staff signup - should work now!

---

## Testing on Mobile

### Setup Local Network Testing
Your `vite.config.js` already has `host: true`, which exposes the dev server to your LAN.

**On your phone:**
1. Find your computer's IP: Run `ipconfig` in PowerShell
2. Look for "IPv4 Address" (usually `192.168.x.x`)
3. Open phone browser: `http://[your-ip]:9000`

### Troubleshooting Mobile Issues

| Problem | Solution |
|---------|----------|
| Can't reach from phone | Make sure phone is on same WiFi; check firewall |
| Still no tables visible | Clear browser cache; reload page; check console |
| Buttons/text too small | Already configured for mobile - zoom in if needed |

---

## Summary of Changes

### Files Modified:
- ✅ `src/components/catalogue/ItemTable.jsx` - Added width constraints for mobile
- ✅ `src/lib/supabase.js` - Better error messages for missing credentials
- ✅ `src/pages/Home.jsx` - Check credentials before API call

### Files Created:
- 📄 `.env.example` - Template for environment variables
- 📄 `SETUP.sh` - Quick reference guide
- 📄 This file - Complete troubleshooting guide

---

## Still Having Issues?

### Check browser console (F12) for:
1. **"Missing env vars"** → Follow Step 1-2 of Issue 2
2. **"Failed to send request"** → Check `.env.local` is created and correct
3. **"No items visible on mobile"** → Refresh page, clear cache

### Debug edge function calls:
In Supabase dashboard: **Functions** → **Logs** to see what's happening

