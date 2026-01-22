// Time Budget Tracker - Advanced PWA
// Day-aware, time-filtered, streak-based tracking system

class TimeBudgetTracker {
    constructor() {
        this.db = null;
        this.activities = [];
        this.currentDayType = null;
        this.todayLog = {};
        this.timers = {};
        this.timerInterval = null;
        this.pendingStopId = null;
        this.pendingHistoryId = null;
        this.streaks = {};
        this.notifications = [];
        this.achievements = [];
        this.badges = {};
        
        this.init();
    }

    async init() {
        await this.initDB();
        this.setupDayType();
        this.loadActivities();
        await this.loadTodayLog();
        await this.calculateStreaks();
        await this.checkAchievements();
        this.setupNotifications();
        this.render();
        this.startTimerUpdates();
        this.setupAutoEndTimers();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('TimeBudgetDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('logs')) {
                    const logsStore = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
                    logsStore.createIndex('date', 'date', { unique: false });
                    logsStore.createIndex('activityId', 'activityId', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('streaks')) {
                    const streaksStore = db.createObjectStore('streaks', { keyPath: 'activityId' });
                }
                
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                
                if (!db.objectStoreNames.contains('achievements')) {
                    db.createObjectStore('achievements', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    setupDayType() {
        const today = new Date();
        const day = today.getDay();
        
        if (day === 0) {
            this.currentDayType = 'sunday';
        } else if (day === 6) {
            this.currentDayType = 'saturday';
        } else if (day === 5) {
            this.currentDayType = 'friday';
        } else {
            this.currentDayType = 'soldier';
        }
        
        const dayNames = {
            'soldier': '⚔️ Soldier Day',
            'friday': '✨ Golden Day',
            'saturday': '🏃 Weekend',
            'sunday': '😴 Rest Day'
        };
        
        document.getElementById('dayBadge').textContent = dayNames[this.currentDayType];
    }

    loadActivities() {
        // Day-aware activity definitions
        const baseActivities = {
            sleep: { name: 'Sleep', icon: '😴', planned: 420, cal: 0.9, startTime: '23:00', endTime: '06:00' },
            windup: { name: 'Wind Up', icon: '☀️', planned: 30, cal: 1.5, startTime: '06:00', endTime: '06:30' },
            run: { name: 'Run', icon: '🏃', planned: 40, cal: 10, startTime: '06:30', endTime: '07:10' },
            commute_am: { name: 'Commute AM', icon: '🚗', planned: 60, cal: 1.2, startTime: '08:00', endTime: '09:00' },
            work: { name: 'Work', icon: '💼', planned: 480, cal: 1.5, startTime: '09:00', endTime: '17:00' },
            commute_pm: { name: 'Commute PM', icon: '🚙', planned: 80, cal: 1.2, startTime: '17:00', endTime: '18:20' },
            gym: { name: 'Gym', icon: '💪', planned: 60, cal: 8, startTime: '18:30', endTime: '19:30' },
            walk: { name: 'Walk', icon: '🚶', planned: 30, cal: 4, startTime: '20:00', endTime: '20:30' },
            meals: { name: 'Meals', icon: '🍽️', planned: 60, cal: 1.0, startTime: '19:00', endTime: '20:00' },
            project: { name: 'Project Work', icon: '📊', planned: 120, cal: 1.8, startTime: '20:30', endTime: '22:30' },
            winddown: { name: 'Wind Down', icon: '🌙', planned: 30, cal: 1.0, startTime: '22:30', endTime: '23:00' },
            leisure: { name: 'Leisure', icon: '🎮', planned: 60, cal: 1.2, startTime: '21:00', endTime: '22:00' }
        };

        // Filter activities based on day type
        if (this.currentDayType === 'sunday') {
            this.activities = [
                baseActivities.sleep,
                baseActivities.windup,
                baseActivities.meals,
                baseActivities.leisure,
                baseActivities.winddown
            ].map((a, i) => ({ ...a, id: Object.keys(baseActivities)[i] }));
        } else if (this.currentDayType === 'saturday') {
            this.activities = [
                baseActivities.sleep,
                baseActivities.windup,
                { ...baseActivities.run, planned: 60, name: 'Long Run' },
                baseActivities.meals,
                { ...baseActivities.project, name: 'PlayStation League', icon: '🎮' },
                baseActivities.leisure,
                baseActivities.winddown
            ].map((a, i) => ({ ...a, id: `sat_${i}` }));
        } else if (this.currentDayType === 'friday') {
            this.activities = [
                baseActivities.sleep,
                baseActivities.windup,
                baseActivities.run,
                { ...baseActivities.work, planned: 360, name: 'Work (WFH)' },
                { ...baseActivities.gym, startTime: '14:00', endTime: '15:00' },
                baseActivities.meals,
                { ...baseActivities.project, planned: 180, name: 'Deep Project Work', startTime: '19:00', endTime: '22:00' },
                baseActivities.winddown
            ].map((a, i) => ({ ...a, id: `fri_${i}` }));
        } else {
            // Soldier days (Mon-Thu)
            this.activities = [
                baseActivities.sleep,
                baseActivities.windup,
                baseActivities.run,
                baseActivities.commute_am,
                baseActivities.work,
                baseActivities.commute_pm,
                baseActivities.gym,
                baseActivities.meals,
                baseActivities.walk,
                baseActivities.project,
                baseActivities.winddown
            ].map((a, i) => ({ ...a, id: Object.keys(baseActivities)[i] }));
        }

        // Add IDs if missing
        this.activities.forEach((a, i) => {
            if (!a.id) a.id = `activity_${i}`;
        });
    }

    getCurrentTime() {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    }

    timeToMinutes(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    isActivityAvailable(activity) {
        const now = this.getCurrentTime();
        const start = this.timeToMinutes(activity.startTime);
        const end = this.timeToMinutes(activity.endTime);
        
        // Handle overnight activities (like sleep)
        if (end < start) {
            return now >= start || now < end;
        }
        return now >= start && now < end;
    }

    isActivityMissed(activity) {
        const now = this.getCurrentTime();
        const end = this.timeToMinutes(activity.endTime);
        const start = this.timeToMinutes(activity.startTime);
        
        // Handle overnight activities
        if (end < start) {
            return now > end && now < start;
        }
        return now > end;
    }

    getActivityStatus(activity) {
        if (this.timers[activity.id]) return 'active';
        if (this.todayLog[activity.id] && this.todayLog[activity.id] > 0) return 'completed';
        if (this.isActivityMissed(activity)) return 'missed';
        if (this.isActivityAvailable(activity)) return 'upcoming';
        return 'upcoming';
    }

    async loadTodayLog() {
        const today = new Date().toISOString().split('T')[0];
        const logs = await this.getLogsForDate(today);
        
        this.todayLog = {};
        logs.forEach(log => {
            if (!this.todayLog[log.activityId]) {
                this.todayLog[log.activityId] = 0;
            }
            this.todayLog[log.activityId] += log.minutes;
        });
    }

    async getLogsForDate(date) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['logs'], 'readonly');
            const store = transaction.objectStore('logs');
            const index = store.index('date');
            const request = index.getAll(date);
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async saveLog(activityId, minutes, isHistory = false) {
        const today = new Date().toISOString().split('T')[0];
        const log = {
            date: today,
            activityId,
            minutes,
            timestamp: Date.now(),
            isHistory
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['logs'], 'readwrite');
            const store = transaction.objectStore('logs');
            const request = store.add(log);
            
            request.onsuccess = () => {
                this.todayLog[activityId] = (this.todayLog[activityId] || 0) + minutes;
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async calculateStreaks() {
        const today = new Date();
        this.streaks = {};

        for (const activity of this.activities) {
            let streak = 0;
            let broken = false;

            for (let i = 0; i < 365; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                
                const logs = await this.getLogsForDate(dateStr);
                const activityLogs = logs.filter(l => l.activityId === activity.id && !l.isHistory);
                
                if (activityLogs.length > 0) {
                    const totalMinutes = activityLogs.reduce((sum, l) => sum + l.minutes, 0);
                    const planned = activity.planned;
                    
                    // Check if activity was completed during its time window
                    const wasInWindow = activityLogs.some(log => {
                        const logTime = new Date(log.timestamp);
                        const logHour = logTime.getHours();
                        const logMin = logTime.getMinutes();
                        const logTotal = logHour * 60 + logMin;
                        const start = this.timeToMinutes(activity.startTime);
                        const end = this.timeToMinutes(activity.endTime);
                        
                        if (end < start) {
                            return logTotal >= start || logTotal < end;
                        }
                        return logTotal >= start && logTotal < end;
                    });

                    if (totalMinutes >= planned * 0.8 && wasInWindow) {
                        if (i === 0) streak++;
                        else if (!broken) streak++;
                    } else {
                        broken = true;
                        if (i > 0) break;
                    }
                } else {
                    broken = true;
                    if (i > 0) break;
                }
            }

            this.streaks[activity.id] = streak;
        }
    }

    startTimer(activityId) {
        const activity = this.activities.find(a => a.id === activityId);
        if (!activity) return;

        this.timers[activityId] = {
            start: Date.now(),
            elapsed: 0,
            activity
        };

        if (!this.timerInterval) {
            this.timerInterval = setInterval(() => this.updateTimers(), 1000);
        }

        this.render();
        this.showNotification(`Started: ${activity.name}`, activity.icon);
    }

    stopTimer(activityId) {
        this.pendingStopId = activityId;
        document.getElementById('confirmModal').classList.add('show');
    }

    async confirmStop() {
        if (!this.pendingStopId) return;

        const timer = this.timers[this.pendingStopId];
        if (timer) {
            const minutes = Math.round(timer.elapsed / 60000);
            if (minutes > 0) {
                await this.saveLog(this.pendingStopId, minutes, false);
                await this.calculateStreaks();
            }
            delete this.timers[this.pendingStopId];

            if (Object.keys(this.timers).length === 0 && this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        }

        this.closeModal();
        await this.calculateStreaks();
        await this.checkAchievements();
        this.render();
        this.celebrateIfStreak();
    }

    updateTimers() {
        Object.keys(this.timers).forEach(id => {
            this.timers[id].elapsed = Date.now() - this.timers[id].start;
        });
        this.render();
    }

    setupAutoEndTimers() {
        // Check every minute for activities that should auto-end
        setInterval(() => {
            const now = this.getCurrentTime();
            
            Object.keys(this.timers).forEach(activityId => {
                const timer = this.timers[activityId];
                const activity = timer.activity;
                const endTime = this.timeToMinutes(activity.endTime);
                const startTime = this.timeToMinutes(activity.startTime);
                
                // Handle overnight activities
                if (endTime < startTime) {
                    if (now >= endTime && now < startTime) {
                        this.confirmStop();
                    }
                } else {
                    if (now >= endTime) {
                        this.confirmStop();
                    }
                }
            });
        }, 60000);
    }

    openHistoryModal(activityId) {
        this.pendingHistoryId = activityId;
        document.getElementById('historyMinutes').value = '';
        document.getElementById('historyModal').classList.add('show');
    }

    async saveHistory() {
        const minutes = parseInt(document.getElementById('historyMinutes').value);
        if (minutes && this.pendingHistoryId) {
            await this.saveLog(this.pendingHistoryId, minutes, true);
        }
        this.closeModal();
        this.render();
    }

    closeModal() {
        document.getElementById('confirmModal').classList.remove('show');
        document.getElementById('historyModal').classList.remove('show');
        this.pendingStopId = null;
        this.pendingHistoryId = null;
    }

    formatTime(mins) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    formatTimer(ms) {
        const sec = Math.floor(ms / 1000);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    getVariance(activityId) {
        const activity = this.activities.find(a => a.id === activityId);
        if (!activity) return 0;
        const actual = this.todayLog[activityId] || 0;
        return actual - activity.planned;
    }

    updateStats() {
        const totalVar = this.activities.reduce((sum, a) => sum + this.getVariance(a.id), 0);
        const totalCal = Math.round(this.activities.reduce((sum, a) => {
            const actual = this.todayLog[a.id] || 0;
            return sum + (actual * a.cal);
        }, 0));

        const totalStreak = Math.max(...Object.values(this.streaks), 0);
        const completed = this.activities.filter(a => {
            const actual = this.todayLog[a.id] || 0;
            return actual >= a.planned * 0.8;
        }).length;
        const completionRate = Math.round((completed / this.activities.length) * 100);

        document.getElementById('totalVariance').textContent = (totalVar > 0 ? '+' : '') + totalVar + 'm';
        document.getElementById('totalCalories').textContent = totalCal;
        document.getElementById('streakCount').textContent = totalStreak;
        document.getElementById('completionRate').textContent = completionRate + '%';
    }

    setupNotifications() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Schedule notifications for each activity
        this.activities.forEach(activity => {
            const [h, m] = activity.startTime.split(':').map(Number);
            const now = new Date();
            const notifyTime = new Date();
            notifyTime.setHours(h, m, 0, 0);
            
            if (notifyTime <= now) {
                notifyTime.setDate(notifyTime.getDate() + 1);
            }

            const delay = notifyTime - now;
            if (delay > 0 && delay < 86400000) { // Only schedule if within 24 hours
                setTimeout(() => {
                    this.showNotification(`Time to start: ${activity.name}`, activity.icon);
                }, delay);
            }
        });
    }

    showNotification(title, icon = '⏰') {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`${icon} ${title}`, {
                body: 'Stay on track with your time budget!',
                icon: '/icon-192.png',
                badge: '/icon-192.png'
            });
        }
    }

    async checkAchievements() {
        const achievements = [];
        
        // Check streak achievements
        Object.entries(this.streaks).forEach(([id, streak]) => {
            if (streak >= 10 && streak < 20 && !this.badges[`streak_10_${id}`]) {
                achievements.push({ type: 'streak', value: 10, activityId: id, message: `🔥 10-day streak! Keep it up!` });
                this.badges[`streak_10_${id}`] = true;
            }
            if (streak >= 30 && !this.badges[`streak_30_${id}`]) {
                achievements.push({ type: 'streak', value: 30, activityId: id, message: `🏆 30-day streak! You're a legend!` });
                this.badges[`streak_30_${id}`] = true;
            }
            if (streak >= 100 && !this.badges[`streak_100_${id}`]) {
                achievements.push({ type: 'streak', value: 100, activityId: id, message: `👑 100-day streak! Unstoppable!` });
                this.badges[`streak_100_${id}`] = true;
            }
        });
        
        // Check completion achievements
        const completed = this.activities.filter(a => {
            const actual = this.todayLog[a.id] || 0;
            return actual >= a.planned * 0.8;
        }).length;
        const completionRate = Math.round((completed / this.activities.length) * 100);
        
        if (completionRate === 100 && !this.badges['perfect_day']) {
            achievements.push({ type: 'completion', value: 100, message: `⭐ Perfect Day! You nailed it!` });
            this.badges['perfect_day'] = true;
        }
        
        // Show achievements
        achievements.forEach(achievement => {
            this.showAchievement(achievement.message);
            this.saveAchievement(achievement);
        });
    }

    async saveAchievement(achievement) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['achievements'], 'readwrite');
            const store = transaction.objectStore('achievements');
            const request = store.add({
                ...achievement,
                timestamp: Date.now(),
                date: new Date().toISOString().split('T')[0]
            });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    showAchievement(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #f59e0b, #ef4444);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            font-weight: 700;
            z-index: 2000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideDown 0.5s;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.5s';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }

    celebrateIfStreak() {
        const maxStreak = Math.max(...Object.values(this.streaks), 0);
        if (maxStreak > 0 && maxStreak % 10 === 0) {
            this.showCelebration();
        }
    }

    showCelebration() {
        const emojis = ['🎉', '🔥', '💪', '⭐', '🏆'];
        const container = document.createElement('div');
        container.className = 'celebration';
        
        for (let i = 0; i < 20; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            container.appendChild(confetti);
        }
        
        document.body.appendChild(container);
        setTimeout(() => container.remove(), 3000);
    }

    render() {
        this.updateStats();
        
        const now = this.getCurrentTime();
        const availableActivities = this.activities.filter(a => {
            const end = this.timeToMinutes(a.endTime);
            const start = this.timeToMinutes(a.startTime);
            
            // Handle overnight activities
            if (end < start) {
                return now < end || now >= start;
            }
            return now < end; // Only show activities that haven't ended yet
        });

        const container = document.getElementById('container');
        
        if (availableActivities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🌙</div>
                    <div>All activities completed for today!</div>
                </div>
            `;
            return;
        }

        let html = '';
        
        // Show regret message if streak was broken after 10+ days
        const brokenStreaks = Object.entries(this.streaks).filter(([id, streak]) => {
            const activity = this.activities.find(a => a.id === id);
            if (!activity) return false;
            const status = this.getActivityStatus(activity);
            return streak >= 10 && status === 'missed';
        });

        if (brokenStreaks.length > 0) {
            html += `
                <div class="regret-message">
                    😔 You broke a ${brokenStreaks[0][1]}-day streak! Get back on track tomorrow!
                </div>
            `;
        }

        availableActivities.forEach(activity => {
            const actual = this.todayLog[activity.id] || 0;
            const variance = this.getVariance(activity.id);
            const timer = this.timers[activity.id];
            const status = this.getActivityStatus(activity);
            const streak = this.streaks[activity.id] || 0;
            const progress = Math.min((actual / activity.planned) * 100, 100);
            const calories = Math.round(actual * activity.cal);
            const varClass = variance > 0 ? 'positive' : variance < 0 ? 'negative' : 'zero';

            html += `
                <div class="card ${status}" data-activity-id="${activity.id}">
                    ${streak >= 10 ? `<div class="streak-badge">🔥 ${streak} day streak!</div>` : ''}
                    <div class="card-header">
                        <div class="card-title">
                            <div class="card-icon">${activity.icon}</div>
                            <div class="card-info">
                                <div class="card-name">${activity.name}</div>
                                <div class="card-time">${activity.startTime} - ${activity.endTime}</div>
                            </div>
                        </div>
                        <div class="card-status status-${status}">${status.toUpperCase()}</div>
                    </div>
                    <div class="card-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                    </div>
                    <div class="card-stats">
                        <span>${this.formatTime(actual)} / ${this.formatTime(activity.planned)}</span>
                        <span class="variance ${varClass}">${variance > 0 ? '+' : ''}${variance}m</span>
                        <span>🔥 ${calories} cal</span>
                    </div>
                    <div class="card-actions">
                        ${status === 'active' ? `
                            <button class="btn btn-stop" onclick="tracker.stopTimer('${activity.id}')">
                                ⏹️ Stop (${this.formatTimer(timer.elapsed)})
                            </button>
                        ` : status === 'upcoming' || status === 'missed' ? `
                            <button class="btn btn-start" onclick="tracker.startTimer('${activity.id}')">
                                ▶️ Start
                            </button>
                            ${status === 'missed' ? `
                                <button class="btn btn-disabled" onclick="tracker.openHistoryModal('${activity.id}')">
                                    📝 History
                                </button>
                            ` : ''}
                        ` : `
                            <button class="btn btn-disabled" disabled>✅ Done</button>
                        `}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    startTimerUpdates() {
        if (!this.timerInterval) {
            this.timerInterval = setInterval(() => this.updateTimers(), 1000);
        }
    }

    async exportWeek() {
        const today = new Date();
        const logs = [];
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayLogs = await this.getLogsForDate(dateStr);
            
            const dayData = {
                date: dateStr,
                day: d.toLocaleDateString('en-US', { weekday: 'long' }),
                activities: {}
            };
            
            this.activities.forEach(activity => {
                const activityLogs = dayLogs.filter(l => l.activityId === activity.id);
                const totalMinutes = activityLogs.reduce((sum, l) => sum + l.minutes, 0);
                const historyMinutes = activityLogs.filter(l => l.isHistory).reduce((sum, l) => sum + l.minutes, 0);
                const streakMinutes = totalMinutes - historyMinutes;
                
                dayData.activities[activity.id] = {
                    name: activity.name,
                    planned: activity.planned,
                    actual: totalMinutes,
                    streakMinutes: streakMinutes,
                    historyMinutes: historyMinutes,
                    variance: totalMinutes - activity.planned,
                    calories: Math.round(totalMinutes * activity.cal),
                    completed: streakMinutes >= activity.planned * 0.8
                };
            });
            
            logs.push(dayData);
        }
        
        const exportData = {
            week_ending: today.toISOString().split('T')[0],
            day_type: this.currentDayType,
            daily_logs: logs,
            summary: {
                total_variance: logs.reduce((sum, day) => 
                    sum + Object.values(day.activities).reduce((s, a) => s + a.variance, 0), 0
                ),
                total_calories: logs.reduce((sum, day) => 
                    sum + Object.values(day.activities).reduce((s, a) => s + a.calories, 0), 0
                ),
                completion_rate: Math.round(
                    logs.reduce((sum, day) => 
                        sum + Object.values(day.activities).filter(a => a.completed).length, 0
                    ) / (logs.length * this.activities.length) * 100
                )
            }
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `time_budget_${exportData.week_ending}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Initialize tracker
let tracker;
document.addEventListener('DOMContentLoaded', () => {
    tracker = new TimeBudgetTracker();
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed:', err));
    });
}

// Global functions for modal
function closeModal() {
    if (tracker) tracker.closeModal();
}

function confirmStop() {
    if (tracker) tracker.confirmStop();
}

function saveHistory() {
    if (tracker) tracker.saveHistory();
}

// Add these methods to the TimeBudgetTracker class in app.js

showView(view) {
    document.getElementById('trackView').style.display = view === 'track' ? 'block' : 'none';
    document.getElementById('historyView').style.display = view === 'history' ? 'block' : 'none';
    if (view === 'history') this.renderHistory();
}

async renderHistory() {
    const today = new Date().toISOString().split('T')[0];
    const logs = await this.getLogsForDate(today);
    const historyList = document.getElementById('historyList');
    
    if (logs.length === 0) {
        historyList.innerHTML = '<div class="empty-state">No logs for today yet.</div>';
        return;
    }

    historyList.innerHTML = logs.reverse().map(log => {
        const activity = this.activities.find(a => a.id === log.activityId);
        return `
            <div class="card completed" style="padding: 12px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>${activity ? activity.icon : ''} <b>${activity ? activity.name : 'Unknown'}</b></span>
                    <span style="color: var(--success);">${log.minutes} mins</span>
                </div>
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 5px;">
                    ${new Date(log.timestamp).toLocaleTimeString()} ${log.isHistory ? '(Manual Entry)' : ''}
                </div>
            </div>
        `;
    }).join('');
}

openManualStart(activityId) {
    this.pendingManualId = activityId;
    const now = new Date();
    document.getElementById('manualStartTime').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    document.getElementById('manualStartModal').classList.add('show');
}

confirmManualStart() {
    const timeVal = document.getElementById('manualStartTime').value;
    if (!timeVal || !this.pendingManualId) return;

    const [hours, minutes] = timeVal.split(':').map(Number);
    const startTime = new Date();
    startTime.setHours(hours, minutes, 0, 0);

    this.timers[this.pendingManualId] = {
        start: startTime.getTime(),
        elapsed: Date.now() - startTime.getTime(),
        activity: this.activities.find(a => a.id === this.pendingManualId)
    };

    this.closeModal();
    this.render();
}

// Update the render() function's action buttons to include a manual start option
// Replace the 'Start' button HTML in your render loop with:
/*
<div style="display: flex; gap: 5px; width: 100%;">
    <button class="btn btn-start" onclick="tracker.startTimer('${activity.id}')" style="flex: 3;">▶️ Start</button>
    <button class="btn btn-disabled" onclick="tracker.openManualStart('${activity.id}')" style="flex: 1;">🕒</button>
</div>
*/

