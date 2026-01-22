# Time Budget Tracker 🎯

An advanced, mobile-first Progressive Web App (PWA) for tracking your daily time budget with intelligent day-aware scheduling, streak tracking, and gamification features.

## Features

### 🎯 Core Features
- **Day-Aware Scheduling**: Automatically adjusts activities based on day type (Soldier Days, Golden Day, Weekend)
- **Time-Filtered Cards**: Only shows activities available at current time
- **Smart Streak System**: Tracks streaks only when activities are completed during their time window
- **Auto-End Timers**: Automatically stops activities at their scheduled end time
- **Notification System**: Push notifications to remind you when activities should start

### 🔥 Gamification
- **Streak Badges**: Visual fire badges for activities with 10+ day streaks
- **Regret Mechanism**: Shows regret message when you break a 10+ day streak
- **Celebration Animations**: Confetti animations for milestone achievements
- **Progress Visualization**: Real-time progress bars and variance tracking

### 📊 Analytics
- **Variance Tracking**: Real-time calculation of actual vs planned time
- **Calorie Tracking**: Active calorie burn estimation
- **Completion Rate**: Daily completion percentage
- **Full History**: All data stored in IndexedDB for comprehensive analysis

### 💾 Data Management
- **IndexedDB Storage**: Robust local storage for all history
- **History vs Streak**: Missed activities can be added as history (doesn't count toward streaks)
- **Export Ready**: Data structure ready for weekly exports

## Day Types

### ⚔️ Soldier Days (Mon-Thu)
- Run in morning
- Full work day (09:00-17:00)
- Gym in evening
- Project work (20:30-22:30)
- Post-dinner walk

### ✨ Golden Day (Friday)
- Work from home (6 hours)
- Gym done early (afternoon)
- Deep project work in evening

### 🏃 Weekend (Saturday)
- Long run
- PlayStation League planning
- No gym

### 😴 Rest Day (Sunday)
- Rest and recovery
- No gym, no run

## Installation

1. Clone or download this repository
2. Serve the files using a local web server (required for PWA features)
3. Open in browser and install as PWA
4. Grant notification permissions when prompted

## Usage

1. **Start Activity**: Tap "Start" when an activity's time window begins
2. **Stop Activity**: Tap "Stop" to save your session
3. **Missed Activities**: Tap "History" to add missed activities (won't count toward streak)
4. **View Streaks**: See your fire badges for activities with 10+ day streaks

## Technical Stack

- **PWA**: Progressive Web App with Service Worker
- **IndexedDB**: Client-side database for history
- **Web Notifications**: Push notifications for activity reminders
- **Modern CSS**: Dark theme with gradient accents
- **Vanilla JavaScript**: No frameworks, pure performance

## Browser Support

- Chrome/Edge (recommended)
- Safari (iOS 11.3+)
- Firefox
- Requires HTTPS for full PWA features (or localhost for development)

## License

MIT License - Feel free to customize for your needs!
