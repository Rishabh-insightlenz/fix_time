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
        this.pendingManualId = null;
        this.streaks = {};
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
                    db.createObjectStore('streaks', { keyPath: 'activityId' });
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
        this.currentDayType = day === 0 ? 'sunday' : day === 6 ? 'saturday' : day === 5 ? 'friday' : 'soldier';
        const dayNames = {
            'soldier': '⚔️ Soldier Day',
            'friday': '✨ Golden Day',
            'saturday': '🏃 Weekend',
            'sunday': '😴 Rest Day'
        };
        document.getElementById('dayBadge').textContent = dayNames[this.currentDayType];
    }

    loadActivities() {
        const base = {
            sleep: { id: 'sleep', name: 'Sleep', icon: '😴', planned: 420, cal: 0.9, startTime: '23:00', endTime: '06:00' },
            windup: { id: 'windup', name: 'Wind Up', icon: '☀️', planned: 30, cal: 1.5, startTime: '06:00', endTime: '06:30' },
            run: { id: 'run', name: 'Run', icon: '🏃', planned: 40, cal: 10, startTime: '06:30', endTime: '07:10' },
            commute_am: { id: 'commute_am', name: 'Commute AM', icon: '🚗', planned: 60, cal: 1.2, startTime: '08:00', endTime: '09:00' },
            work: { id: 'work', name: 'Work', icon: '💼', planned: 480, cal: 1.5, startTime: '09:00', endTime: '17:00' },
            commute_pm: { id: 'commute_pm', name: 'Commute PM', icon: '🚙', planned: 80, cal: 1.2, startTime: '17:00', endTime: '18:20' },
            gym: { id: 'gym', name: 'Gym', icon: '💪', planned: 60, cal: 8, startTime: '18:30', endTime: '19:30' },
            walk: { id: 'walk', name: 'Walk', icon: '🚶', planned: 30, cal: 4, startTime: '20:00', endTime: '20:30' },
            meals: { id: 'meals', name: 'Meals', icon: '🍽️', planned: 60, cal: 1.0, startTime: '19:00', endTime: '20:00' },
            project: { id: 'project', name: 'Project Work', icon: '📊', planned: 120, cal: 1.8, startTime: '20:30', endTime: '22:30' },
            winddown: { id: 'winddown', name: 'Wind Down', icon: '🌙', planned: 30, cal: 1.0, startTime: '22:30', endTime: '23:00' },
            leisure: { id: 'leisure', name: 'Leisure', icon: '🎮', planned: 60, cal: 1.2, startTime: '21:00', endTime: '22:00' }
        };

        if (this.currentDayType === 'sunday') {
            this.activities = [base.sleep, base.windup, base.meals, base.leisure, base.winddown];
        } else if (this.currentDayType === 'saturday') {
            this.activities = [base.sleep, base.windup, { ...base.run, planned: 60, name: 'Long Run' }, base.meals, { ...base.project, name: 'PlayStation League', icon: '🎮' }, base.leisure, base.winddown];
        } else if (this.currentDayType === 'friday') {
            this.activities = [base.sleep, base.windup, base.run, { ...base.work, planned: 360, name: 'Work (WFH)' }, { ...base.gym, startTime: '14:00', endTime: '15:00' }, base.meals, { ...base.project, planned: 180, name: 'Deep Project Work', startTime: '19:00', endTime: '22:00' }, base.winddown];
        } else {
            this.activities = [base.sleep, base.windup, base.run, base.commute_am, base.work, base.commute_pm, base.gym, base.meals, base.walk, base.project, base.winddown];
        }
    }

    // --- VIEW & NAVIGATION ---
    showView(view) {
        document.getElementById('trackView').style.display = view === 'track' ? 'block' : 'none';
        document.getElementById('historyView').style.display = view === 'history' ? 'block' : 'none';
        
        document.getElementById('navTrack').classList.toggle('active', view === 'track');
        document.getElementById('navHistory').classList.toggle('active', view === 'history');

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
                        <span>${activity ? activity.icon : '❓'} <b>${activity ? activity.name : 'Unknown Activity'}</b></span>
                        <span style="color: var(--success); font-weight: bold;">${log.minutes} mins</span>
                    </div>
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 5px;">
                        ${new Date(log.timestamp).toLocaleTimeString()} ${log.isHistory ? '(Manual Entry)' : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // --- TIMER & MANUAL START ---
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

        if (!this.timerInterval) this.timerInterval = setInterval(() => this.updateTimers(), 1000);
        this.closeModal();
        this.render();
    }

    // --- CORE ACTIVITY LOGIC ---
    startTimer(activityId) {
        const activity = this.activities.find(a => a.id === activityId);
        if (!activity) return;
        this.timers[activityId] = { start: Date.now(), elapsed: 0, activity };
        if (!this.timerInterval) this.timerInterval = setInterval(() => this.updateTimers(), 1000);
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
            const minutes = Math.max(1, Math.round(timer.elapsed / 60000));
            await this.saveLog(this.pendingStopId, minutes, false);
            delete this.timers[this.pendingStopId];
            if (Object.keys(this.timers).length === 0) {
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

    async saveLog(activityId, minutes, isHistory = false) {
        const today = new Date().toISOString().split('T')[0];
        const log = { date: today, activityId, minutes, timestamp: Date.now(), isHistory };
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['logs'], 'readwrite');
            transaction.objectStore('logs').add(log);
            transaction.oncomplete = () => {
                this.todayLog[activityId] = (this.todayLog[activityId] || 0) + minutes;
                resolve();
            };
        });
    }

    // --- UTILITIES & STATS ---
    async loadTodayLog() {
        const today = new Date().toISOString().split('T')[0];
        const logs = await this.getLogsForDate(today);
        this.todayLog = {};
        logs.forEach(log => this.todayLog[log.activityId] = (this.todayLog[log.activityId] || 0) + log.minutes);
    }

    async getLogsForDate(date) {
        return new Promise((resolve) => {
            const index = this.db.transaction(['logs'], 'readonly').objectStore('logs').index('date');
            const request = index.getAll(date);
            request.onsuccess = () => resolve(request.result || []);
        });
    }

    getCurrentTime() { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); }
    timeToMinutes(str) { const [h, m] = str.split(':').map(Number); return h * 60 + m; }

    isActivityAvailable(a) {
        const now = this.getCurrentTime();
        const start = this.timeToMinutes(a.startTime);
        const end = this.timeToMinutes(a.endTime);
        return end < start ? (now >= start || now < end) : (now >= start && now < end);
    }

    isActivityMissed(a) {
        const now = this.getCurrentTime();
        const end = this.timeToMinutes(a.endTime);
        const start = this.timeToMinutes(a.startTime);
        return end < start ? (now > end && now < start) : (now > end);
    }

    getActivityStatus(a) {
        if (this.timers[a.id]) return 'active';
        if (this.todayLog[a.id] > 0) return 'completed';
        if (this.isActivityMissed(a)) return 'missed';
        return 'upcoming';
    }

    updateTimers() {
        Object.keys(this.timers).forEach(id => { this.timers[id].elapsed = Date.now() - this.timers[id].start; });
        this.render();
    }

    render() {
        this.updateStats();
        const now = this.getCurrentTime();
        const container = document.getElementById('container');
        
        const available = this.activities.filter(a => {
            const end = this.timeToMinutes(a.endTime);
            const start = this.timeToMinutes(a.startTime);
            return end < start ? (now < end || now >= start) : (now < end);
        });

        if (available.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🌙</div><div>All activities done!</div></div>`;
            return;
        }

        container.innerHTML = available.map(activity => {
            const actual = this.todayLog[activity.id] || 0;
            const timer = this.timers[activity.id];
            const status = this.getActivityStatus(activity);
            const streak = this.streaks[activity.id] || 0;
            const progress = Math.min((actual / activity.planned) * 100, 100);
            
            return `
                <div class="card ${status}">
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
                    <div class="card-progress"><div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div></div>
                    <div class="card-stats">
                        <span>${this.formatTime(actual)} / ${this.formatTime(activity.planned)}</span>
                        <span>🔥 ${Math.round(actual * activity.cal)} cal</span>
                    </div>
                    <div class="card-actions">
                        ${status === 'active' ? `
                            <button class="btn btn-stop" onclick="tracker.stopTimer('${activity.id}')">⏹️ Stop (${this.formatTimer(timer.elapsed)})</button>
                        ` : status === 'upcoming' || status === 'missed' ? `
                            <div style="display: flex; gap: 5px; width: 100%;">
                                <button class="btn btn-start" onclick="tracker.startTimer('${activity.id}')" style="flex: 3;">▶️ Start</button>
                                <button class="btn btn-manual" onclick="tracker.openManualStart('${activity.id}')" style="flex: 1; background: var(--primary); color: white;">🕒</button>
                            </div>
                            ${status === 'missed' ? `<button class="btn btn-disabled" onclick="tracker.openHistoryModal('${activity.id}')" style="margin-top: 8px;">📝 History</button>` : ''}
                        ` : `<button class="btn btn-disabled" disabled>✅ Done</button>`}
                    </div>
                </div>`;
        }).join('');
    }

    // --- REUSE EXISTING LOGIC ---
    updateStats() {
        const totalVar = this.activities.reduce((sum, a) => sum + ((this.todayLog[a.id] || 0) - a.planned), 0);
        const totalCal = Math.round(this.activities.reduce((sum, a) => sum + ((this.todayLog[a.id] || 0) * a.cal), 0));
        const totalStreak = Math.max(...Object.values(this.streaks), 0);
        const completed = this.activities.filter(a => (this.todayLog[a.id] || 0) >= a.planned * 0.8).length;
        
        document.getElementById('totalVariance').textContent = (totalVar > 0 ? '+' : '') + totalVar + 'm';
        document.getElementById('totalCalories').textContent = totalCal;
        document.getElementById('streakCount').textContent = totalStreak;
        document.getElementById('completionRate').textContent = Math.round((completed / this.activities.length) * 100) + '%';
    }

    async calculateStreaks() { /* ... existing logic ... */ }
    async checkAchievements() { /* ... existing logic ... */ }
    setupNotifications() { /* ... existing logic ... */ }
    showNotification(t, i) { /* ... existing logic ... */ }
    formatTime(m) { return m > 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`; }
    formatTimer(ms) { const s = Math.floor(ms/1000); return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`; }
    setupAutoEndTimers() { setInterval(() => { /* check end times */ }, 60000); }
    closeModal() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
        this.pendingStopId = this.pendingHistoryId = this.pendingManualId = null;
    }
    async openHistoryModal(id) { this.pendingHistoryId = id; document.getElementById('historyMinutes').value = ''; document.getElementById('historyModal').classList.add('show'); }
    async saveHistory() { const m = parseInt(document.getElementById('historyMinutes').value); if(m) await this.saveLog(this.pendingHistoryId, m, true); this.closeModal(); this.render(); }
    openSettings() { document.getElementById('settingsModal').classList.add('show'); }
}

// Global initialization
let tracker;
document.addEventListener('DOMContentLoaded', () => { tracker = new TimeBudgetTracker(); });
function closeModal() { if(tracker) tracker.closeModal(); }
function confirmStop() { if(tracker) tracker.confirmStop(); }
function saveHistory() { if(tracker) tracker.saveHistory(); }

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(() => console.log('SW registered'));
    });
}
