# How to Run Time Budget Tracker 🚀

## Quick Start (3 Steps)

### Step 1: Open Terminal/Command Prompt
- Press `Win + R`, type `cmd` or `powershell`, press Enter
- Or right-click in the `time-budget-tracker` folder → "Open in Terminal"

### Step 2: Navigate to the folder
```bash
cd time-budget-tracker
```

### Step 3: Start the server

**Option A: Python (Recommended)**
```bash
python server.py
```

**Option B: Python 3 (if python doesn't work)**
```bash
python3 server.py
```

**Option C: Node.js (if you have it)**
```bash
npx http-server -p 8000
```

**Option D: VS Code Live Server**
- Install "Live Server" extension in VS Code
- Right-click `index.html` → "Open with Live Server"

### Step 4: Open in Browser
- Open your browser
- Go to: **http://localhost:8000**
- Grant notification permissions when prompted

## Troubleshooting

**"python is not recognized"**
- Install Python from python.org
- Or use Option D (VS Code Live Server)

**"Port 8000 already in use"**
- Change port in `server.py` (line 8: `PORT = 8000` → `PORT = 8001`)
- Or close the program using port 8000

**"Cannot find path"**
- Make sure you're in the correct directory
- Use `dir` (Windows) or `ls` (Mac/Linux) to see files
- You should see: `index.html`, `app.js`, `server.py`

## After Running

1. ✅ The app will open in your browser
2. ✅ Grant notification permissions (for activity reminders)
3. ✅ Start tracking your activities!
4. ✅ Install as PWA (optional): Look for install icon in browser

## Need Help?

- Check browser console (F12) for errors
- Make sure all files are in the same folder
- Try a different browser (Chrome/Edge recommended)
