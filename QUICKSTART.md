# Quick Start Guide 🚀

## Getting Started

### Option 1: Python Server (Recommended)
```bash
cd time-budget-tracker
python server.py
```
Then open http://localhost:8000 in your browser

### Option 2: Node.js (if you have it)
```bash
cd time-budget-tracker
npx http-server -p 8000
```

### Option 3: VS Code Live Server
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

## First Time Setup

1. **Open the app** in your browser
2. **Grant notification permissions** when prompted (for activity reminders)
3. **Install as PWA** (optional but recommended):
   - Chrome/Edge: Click install icon in address bar
   - Safari iOS: Share → Add to Home Screen

## Creating Icons

1. Open `create-icons.html` in your browser
2. Right-click each canvas and "Save image as..."
3. Save as `icon-192.png` and `icon-512.png` in the project folder

## Features Overview

### 🎯 Smart Time Filtering
- Only shows activities available at current time
- Missed activities can be added as history (doesn't affect streaks)

### 🔥 Streak System
- Streaks only count when activities are done during their time window
- 10+ day streaks show fire badges
- Breaking a 10+ day streak shows regret message

### 📊 Real-time Stats
- Variance tracking (actual vs planned)
- Calorie burn estimation
- Completion rate
- Current streak count

### 🎉 Gamification
- Achievement notifications for milestones
- Celebration animations for 10-day streak milestones
- Visual progress bars

### 📥 Weekly Export
- Tap the floating export button (bottom right)
- Exports JSON with full week data
- Ready for AI analysis

## Day Types Explained

- **⚔️ Soldier Days (Mon-Thu)**: Full routine with gym, run, work, project
- **✨ Golden Day (Fri)**: WFH day with early gym and deep project work
- **🏃 Weekend (Sat)**: Long run + PlayStation League planning
- **😴 Rest Day (Sun)**: Rest and recovery, minimal activities

## Tips

1. **Start activities on time** - This is crucial for streak tracking
2. **Don't add missed activities as regular logs** - Use "History" button instead
3. **Check notifications** - They remind you when activities should start
4. **Export weekly** - Use the export button every Sunday for analysis

## Troubleshooting

**Notifications not working?**
- Check browser notification permissions
- Some browsers require HTTPS (use localhost for development)

**Service Worker not registering?**
- Make sure you're using a web server (not file://)
- Check browser console for errors

**Data not persisting?**
- Check browser IndexedDB in DevTools
- Clear site data if needed (will reset all data)

## Next Steps

1. Customize activities in `app.js` → `loadActivities()`
2. Adjust time windows to match your schedule
3. Set up weekly AI analysis with exported JSON data
4. Add more achievements/badges as needed

Enjoy tracking your time budget! 🎯
