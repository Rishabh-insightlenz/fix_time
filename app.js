// Time Budget Tracker v2 - Complete Rewrite
// Features: Swipeable Cards, Heatmap, Insights, Quick Actions, Templates

class TimeBudgetTracker {
    constructor() {
        this.db = null;
        this.activities = [];
        this.currentDayType = null;
        this.todayLog = {};
        this.timers = {};
        this.timer Interval = null;
        this.currentCardIndex = 0;
        this.pendingStopId = null;
        this.pendingHistoryId = null;
        this.pendingManualId = null;
        this.pendingTemplate = null;
        this.streaks = {};
        this.weeklyData = [];
        this.insights = [];
        this.deviations = [];
        this.currentView = 'cards';
        this.notificationsEnabled = false;
        this.reminderMinutes = 5;
        
        this.init();
    }

    async init() {
        await this.initDB();
        this.loadSettings();
        this.setupDayType();
        this.loadActivities();
        await this.loadTodayLog();
        await this.loadWeeklyData();
        await this.calculateStreaks();
        await this.generateInsights();
        await this.checkDeviations();
        this.setupNotifications();
        this.setupSwipeCards();
        this.render();
        this.startTimerUpdates();
        this.updateQuickWidget();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('TimeBudgetDB', 2);
            
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
                
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    loadSettings() {
        const notifEnabled = localStorage.getItem('notificationsEnabled');
        const reminderMins = localStorage.getItem('reminderMinutes');
        
        this.notificationsEnabled = notifEnabled === 'true';
        this.reminderMinutes = reminderMins ? parseInt(reminderMins) : 5;
        
        if (document.getElementById('notificationsToggle')) {
            document.getElementById('notificationsToggle').checked = this.notificationsEnabled;
        }
        if (document.getElementById('reminderMinutes')) {
            document.getElementById('reminderMinutes').value = this.reminderMinutes;
        }
    }

    setupDayType() {
        const today = new Date();
        const day = today.getDay();
        
        if (day === 0) this.currentDayType = 'sunday';
        else if (day === 6) this.currentDayType = 'saturday';
        else if (day === 5) this.currentDayType = 'friday';
        else this.currentDayType = 'soldier';
        
        const dayNames = {
            'soldier': '⚔️ Soldier Day',
            'friday': '✨ Golden Day',
            'saturday': '🏃 Weekend',
            'sunday': '😴 Rest Day'
        };
        
        document.getElementById('dayBadge').textContent = dayNames[this.currentDayType];
    }

    loadActivities() {
        const saved = localStorage.getItem('customActivities');
        if (saved) {
            this.activities = JSON.parse(saved);
            return;
        }

        const baseActivities = {
            sleep: { name: 'Sleep', icon: '😴', planned: 420, cal: 0.9, startTime: '23:00', endTime: '06:00', enabled: true },
            windup: { name: 'Wind Up', icon: '☀️', planned: 30, cal: 1.5, startTime: '06:00', endTime: '06:30', enabled: true },
            run: { name: 'Run', icon: '🏃', planned: 40, cal: 10, startTime: '06:30', endTime: '07:10', enabled: true },
            commute_am: { name: 'Commute AM', icon: '🚗', planned: 60, cal: 1.2, startTime: '08:00', endTime: '09:00', enabled: true },
            work: { name: 'Work', icon: '💼', planned: 480, cal: 1.5, startTime: '09:00', endTime: '17:00', enabled: true },
            commute_pm: { name: 'Commute PM', icon: '🚙', planned: 80, cal: 1.2, startTime: '17:00', endTime: '18:20', enabled: true },
            gym: { name: 'Gym', icon: '💪', planned: 60, cal: 8, startTime: '18:30', endTime: '19:30', enabled: true },
            walk: { name: 'Walk', icon: '🚶', planned: 30, cal: 4, startTime: '20:00', endTime: '20:30', enabled: true },
            meals: { name: 'Meals', icon: '🍽️', planned: 60, cal: 1.0, startTime: '19:00', endTime: '20:00', enabled: true },
            project: { name: 'Project Work', icon: '📊', planned: 120, cal: 1.8, startTime: '20:30', endTime: '22:30', enabled: true },
            winddown: { name: 'Wind Down', icon: '🌙', planned: 30, cal: 1.0, startTime: '22:30', endTime: '23:00', enabled: true },
            leisure: { name: 'Leisure', icon: '🎮', planned: 60, cal: 1.2, startTime: '21:00', endTime: '22:00', enabled: true }
        };

        // Filter based on day type and add IDs
        const activityKeys = Object.keys(baseActivities);
        this.activities = activityKeys.map(key => ({
            id: key,
            ...baseActivities[key]
        })).filter(a => a.enabled);

        this.saveActivities();
    }

    saveActivities() {
        localStorage.setItem('customActivities', JSON.stringify(this.activities));
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

    async loadWeeklyData() {
        const today = new Date();
        this.weeklyData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const logs = await this.getLogsForDate(dateStr);
            
            const dayData = {
                date: dateStr,
                day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                activities: {}
            };
            
            this.activities.forEach(activity => {
                const activityLogs = logs.filter(l => l.activityId === activity.id);
                const totalMinutes = activityLogs.reduce((sum, l) => sum + l.minutes, 0);
                const historyMinutes = activityLogs.filter(l => l.isHistory).reduce((sum, l) => sum + l.minutes, 0);
                const streakMinutes = totalMinutes - historyMinutes;
                
                dayData.activities[activity.id] = {
                    total: totalMinutes,
                    streak: streakMinutes,
                    history: historyMinutes,
                    completed: streakMinutes >= activity.planned * 0.8
                };
            });
            
            this.weeklyData.push(dayData);
        }
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
                    if (totalMinutes >= activity.planned * 0.8) {
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

    async generateInsights() {
        this.insights = [];
        
        // Consistency insights
        this.activities.forEach(activity => {
            const weekCompletions = this.weeklyData.filter(day => 
                day.activities[activity.id]?.completed
            ).length;
            const consistencyRate = Math.round((weekCompletions / 7) * 100);
            
            if (consistencyRate >= 85) {
                this.insights.push({
                    type: 'success',
                    icon: '🎯',
                    title: `${activity.name} Mastery`,
                    message: `You're ${consistencyRate}% consistent this week. Keep it up!`
                });
            } else if (consistencyRate < 50 && weekCompletions > 0) {
                this.insights.push({
                    type: 'warning',
                    icon: '⚠️',
                    title: `${activity.name} Needs Attention`,
                    message: `Only ${consistencyRate}% completion rate. Try to be more consistent.`
                });
            }
        });

        // Streak insights
        Object.entries(this.streaks).forEach(([id, streak]) => {
            const activity = this.activities.find(a => a.id === id);
            if (streak >= 10) {
                this.insights.push({
                    type: 'success',
                    icon: '🔥',
                    title: `${streak}-Day Streak!`,
                    message: `${activity.name} is on fire! You're ${20 - (streak % 20)} days from the next milestone.`
                });
            }
        });

        // Best time insights
        const activityTimes = {};
        for (const activity of this.activities) {
            const logs = await this.getLogsForDate(new Date().toISOString().split('T')[0]);
            const activityLogs = logs.filter(l => l.activityId === activity.id);
            if (activityLogs.length > 0) {
                const avgTime = activityLogs.reduce((sum, l) => {
                    const logHour = new Date(l.timestamp).getHours();
                    return sum + logHour;
                }, 0) / activityLogs.length;
                activityTimes[activity.id] = Math.round(avgTime);
            }
        }

        // Overall completion rate
        const totalCompleted = this.weeklyData.reduce((sum, day) => {
            return sum + Object.values(day.activities).filter(a => a.completed).length;
        }, 0);
        const totalPossible = this.weeklyData.length * this.activities.length;
        const overallRate = Math.round((totalCompleted / totalPossible) * 100);
        
        this.insights.push({
            type: 'info',
            icon: '📊',
            title: 'Weekly Performance',
            message: `You've completed ${overallRate}% of your planned activities this week.`
        });
    }

    async checkDeviations() {
        this.deviations = [];
        
        // Check for consistent over/under patterns
        this.activities.forEach(activity => {
            const weeklyVariances = this.weeklyData.map(day => {
                const actual = day.activities[activity.id]?.total || 0;
                return actual - activity.planned;
            }).filter(v => v !== -activity.planned); // Filter out completely missed days
            
            if (weeklyVariances.length >= 3) {
                const avgVariance = weeklyVariances.reduce((sum, v) => sum + v, 0) / weeklyVariances.length;
                
                if (avgVariance > 20) {
                    this.deviations.push({
                        activityId: activity.id,
                        type: 'over',
                        message: `You're averaging +${Math.round(avgVariance)} mins on ${activity.name}. Consider adjusting your plan.`
                    });
                } else if (avgVariance < -20) {
                    this.deviations.push({
                        activityId: activity.id,
                        type: 'under',
                        message: `You're averaging ${Math.round(avgVariance)} mins on ${activity.name}. Need more time?`
                    });
                }
            }
            
            // Check for missed days
            const missedDays = this.weeklyData.filter(day => 
                !day.activities[activity.id]?.completed && 
                (day.activities[activity.id]?.total || 0) === 0
            ).length;
            
            if (missedDays >= 4) {
                this.deviations.push({
                    activityId: activity.id,
                    type: 'missed',
                    message: `${activity.name} missed ${missedDays} times this week. Getting back on track?`
                });
            }
        });
    }

    setupNotifications() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                this.notificationsEnabled = permission === 'granted';
                localStorage.setItem('notificationsEnabled', this.notificationsEnabled);
            });
        } else if (Notification.permission === 'granted') {
            this.notificationsEnabled = true;
        }
    }

    toggleNotifications(enabled) {
        this.notificationsEnabled = enabled;
        localStorage.setItem('notificationsEnabled', enabled);
        
        if (enabled && Notification.permission !== 'granted') {
            Notification.requestPermission().then(permission => {
                this.notificationsEnabled = permission === 'granted';
                localStorage.setItem('notificationsEnabled', this.notificationsEnabled);
                document.getElementById('notificationsToggle').checked = this.notificationsEnabled;
            });
        }
    }

    updateReminderTime(minutes) {
        this.reminderMinutes = parseInt(minutes);
        localStorage.setItem('reminderMinutes', this.reminderMinutes);
    }

    setupSwipeCards() {
        const container = document.getElementById('cardsContainer');
        let startX = 0;
        let currentX = 0;
        let isDragging = false;

        container.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
        });

        container.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentX = e.touches[0].clientX;
            const diff = currentX - startX;
            container.style.transform = `translateX(${diff}px)`;
        });

        container.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            isDragging = false;
            
            const diff = currentX - startX;
            const threshold = 100;

            if (diff > threshold && this.currentCardIndex > 0) {
                this.currentCardIndex--;
            } else if (diff < -threshold && this.currentCardIndex < this.activities.length - 1) {
                this.currentCardIndex++;
            }

            container.style.transform = '';
            this.renderCards();
        });

        // Mouse events for desktop
        container.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            isDragging = true;
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            currentX = e.clientX;
            const diff = currentX - startX;
            container.style.transform = `translateX(${diff}px)`;
        });

        container.addEventListener('mouseup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            
            const diff = currentX - startX;
            const threshold = 100;

            if (diff > threshold && this.currentCardIndex > 0) {
                this.currentCardIndex--;
            } else if (diff < -threshold && this.currentCardIndex < this.activities.length - 1) {
                this.currentCardIndex++;
            }

            container.style.transform = '';
            this.renderCards();
        });
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
        this.updateQuickWidget();
        
        if (this.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`▶️ Started: ${activity.name}`, {
                body: 'Timer is running',
                icon: '/icon-192.png'
            });
        }
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
                await this.loadWeeklyData();
                await this.calculateStreaks();
                await this.generateInsights();
                await this.checkDeviations();
            }
            delete this.timers[this.pendingStopId];

            if (Object.keys(this.timers).length === 0 && this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        }

        this.closeModal();
        this.render();
        this.updateQuickWidget();
    }

    updateTimers() {
        Object.keys(this.timers).forEach(id => {
            this.timers[id].elapsed = Date.now() - this.timers[id].start;
        });
        this.render();
        this.updateQuickWidget();
    }

    startTimerUpdates() {
        if (!this.timerInterval && Object.keys(this.timers).length > 0) {
            this.timerInterval = setInterval(() => this.updateTimers(), 1000);
        }
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
            await this.loadWeeklyData();
        }
        this.closeModal();
        this.render();
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
        this.updateQuickWidget();
    }

    closeModal() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
        this.pendingStopId = null;
        this.pendingHistoryId = null;
        this.pendingManualId = null;
        this.pendingTemplate = null;
    }

    formatTime(mins) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    formatTimerLong(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
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

        const maxStreak = Math.max(...Object.values(this.streaks), 0);
        const completed = this.activities.filter(a => {
            const actual = this.todayLog[a.id] || 0;
            return actual >= a.planned * 0.8;
        }).length;
        const completionRate = Math.round((completed / this.activities.length) * 100);

        document.getElementById('totalVariance').textContent = (totalVar > 0 ? '+' : '') + totalVar + 'm';
        document.getElementById('totalCalories').textContent = totalCal;
        document.getElementById('streakCount').textContent = maxStreak;
        document.getElementById('completionRate').textContent = completionRate + '%';
    }

    showView(view) {
        this.currentView = view;
        
        // Hide all views
        document.querySelectorAll('.view-container').forEach(v => v.style.display = 'none');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        
        // Show selected view
        document.getElementById(`${view}View`).style.display = 'block';
        document.getElementById(`nav${view.charAt(0).toUpperCase() + view.slice(1)}`).classList.add('active');
        
        // Render view-specific content
        if (view === 'heatmap') this.renderHeatmap();
        else if (view === 'insights') this.renderInsights();
        else if (view === 'settings') this.renderSettings();
        else if (view === 'cards') this.renderCards();
    }

    renderCards() {
        const container = document.getElementById('cardsContainer');
        const dotsContainer = document.getElementById('cardDots');
        
        if (this.activities.length === 0) {
            container.innerHTML = '<div class="card-loading">No activities</div>';
            return;
        }

        const activity = this.activities[this.currentCardIndex];
        const actual = this.todayLog[activity.id] || 0;
        const variance = this.getVariance(activity.id);
        const timer = this.timers[activity.id];
        const isRunning = !!timer;
        const streak = this.streaks[activity.id] || 0;
        const progress = Math.min((actual / activity.planned) * 100, 100);
        const calories = Math.round(actual * activity.cal);
        const varClass = variance > 0 ? 'positive' : variance < 0 ? 'negative' : 'zero';

        container.innerHTML = `
            <div class="activity-card ${isRunning ? 'running' : ''}">
                ${streak >= 10 ? `<div class="streak-badge">🔥 ${streak} days</div>` : ''}
                <div class="card-icon-large">${activity.icon}</div>
                <h2 class="card-name-large">${activity.name}</h2>
                <div class="card-time-range">${activity.startTime} - ${activity.endTime}</div>
                
                <div class="timer-display">
                    ${isRunning ? `
                        <div class="timer-running">${this.formatTimerLong(timer.elapsed)}</div>
                        <div class="timer-label">Running...</div>
                    ` : `
                        <div class="timer-static">${this.formatTime(actual)}</div>
                        <div class="timer-label">of ${this.formatTime(activity.planned)}</div>
                    `}
                </div>

                <div class="progress-ring">
                    <svg width="200" height="200">
                        <circle cx="100" cy="100" r="90" fill="none" stroke="var(--border)" stroke-width="12"/>
                        <circle cx="100" cy="100" r="90" fill="none" stroke="var(--primary)" stroke-width="12"
                                stroke-dasharray="${progress * 5.65} 565" 
                                stroke-dashoffset="0" 
                                transform="rotate(-90 100 100)"
                                style="transition: stroke-dasharray 0.3s;"/>
                    </svg>
                    <div class="progress-text">${Math.round(progress)}%</div>
                </div>

                <div class="card-stats-large">
                    <div class="stat-item">
                        <span class="stat-label">Variance</span>
                        <span class="stat-value variance ${varClass}">${variance > 0 ? '+' : ''}${variance}m</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Calories</span>
                        <span class="stat-value">🔥 ${calories}</span>
                    </div>
                </div>

                <div class="card-actions-large">
                    ${isRunning ? `
                        <button class="action-btn danger" onclick="tracker.stopTimer('${activity.id}')">
                            ⏹️ Stop Timer
                        </button>
                    ` : `
                        <button class="action-btn primary" onclick="tracker.startTimer('${activity.id}')">
                            ▶️ Start Now
                        </button>
                        <button class="action-btn secondary" onclick="tracker.openManualStart('${activity.id}')">
                            🕐 Manual Start
                        </button>
                    `}
                </div>
            </div>
        `;

        // Render dots
        dotsContainer.innerHTML = this.activities.map((_, i) => 
            `<span class="dot ${i === this.currentCardIndex ? 'active' : ''}"></span>`
        ).join('');
    }

    renderHeatmap() {
        const grid = document.getElementById('heatmapGrid');
        let html = '<div class="heatmap-row"><div class="heatmap-cell header"></div>';
        
        // Header row with day names
        this.weeklyData.forEach(day => {
            html += `<div class="heatmap-cell header">${day.day}</div>`;
        });
        html += '</div>';

        // Activity rows
        this.activities.forEach(activity => {
            html += `<div class="heatmap-row">`;
            html += `<div class="heatmap-cell activity-label">${activity.icon} ${activity.name}</div>`;
            
            this.weeklyData.forEach(day => {
                const data = day.activities[activity.id];
                let status = 'empty';
                let tooltip = 'Not tracked';
                
                if (data) {
                    if (data.completed) {
                        status = 'complete';
                        tooltip = `✓ ${data.total}m (${Math.round((data.total/activity.planned)*100)}%)`;
                    } else if (data.total > 0) {
                        status = 'partial';
                        tooltip = `~ ${data.total}m (${Math.round((data.total/activity.planned)*100)}%)`;
                    } else {
                        status = 'missed';
                        tooltip = '✗ Missed';
                    }
                }
                
                html += `<div class="heatmap-cell ${status}" title="${tooltip}"></div>`;
            });
            
            html += '</div>';
        });

        grid.innerHTML = html;
    }

    renderInsights() {
        const list = document.getElementById('insightsList');
        
        if (this.insights.length === 0) {
            list.innerHTML = '<div class="empty-state">No insights yet. Keep tracking!</div>';
            return;
        }

        list.innerHTML = this.insights.map(insight => `
            <div class="insight-card ${insight.type}">
                <div class="insight-icon">${insight.icon}</div>
                <div class="insight-content">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-message">${insight.message}</div>
                </div>
            </div>
        `).join('');
    }

    renderSettings() {
        const container = document.getElementById('activitySettings');
        
        container.innerHTML = this.activities.map(activity => `
            <div class="setting-card">
                <div class="setting-header">
                    <span class="setting-icon">${activity.icon}</span>
                    <span class="setting-name">${activity.name}</span>
                    <label class="toggle-switch">
                        <input type="checkbox" ${activity.enabled ? 'checked' : ''} 
                               onchange="tracker.toggleActivity('${activity.id}', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="setting-fields">
                    <div class="field-group">
                        <label>Planned (mins)</label>
                        <input type="number" value="${activity.planned}" 
                               onchange="tracker.updateActivity('${activity.id}', 'planned', this.value)">
                    </div>
                    <div class="field-group">
                        <label>Start Time</label>
                        <input type="time" value="${activity.startTime}" 
                               onchange="tracker.updateActivity('${activity.id}', 'startTime', this.value)">
                    </div>
                    <div class="field-group">
                        <label>End Time</label>
                        <input type="time" value="${activity.endTime}" 
                               onchange="tracker.updateActivity('${activity.id}', 'endTime', this.value)">
                    </div>
                    <div class="field-group">
                        <label>Cal/Min</label>
                        <input type="number" step="0.1" value="${activity.cal}" 
                               onchange="tracker.updateActivity('${activity.id}', 'cal', this.value)">
                    </div>
                </div>
            </div>
        `).join('');
    }

    toggleActivity(id, enabled) {
        const activity = this.activities.find(a => a.id === id);
        if (activity) {
            activity.enabled = enabled;
            this.saveActivities();
        }
    }

    updateActivity(id, field, value) {
        const activity = this.activities.find(a => a.id === id);
        if (activity) {
            if (field === 'planned' || field === 'cal') {
                activity[field] = parseFloat(value);
            } else {
                activity[field] = value;
            }
            this.saveActivities();
        }
    }

    applyTemplate(templateName) {
        this.pendingTemplate = templateName;
        const messages = {
            'sick': 'Apply Sick Day template? This will disable most activities except rest.',
            'travel': 'Apply Travel Day template? This will adjust for travel schedule.',
            'holiday': 'Apply Holiday template? This will enable only leisure activities.',
            'reset': 'Reset to default schedule? This will restore original settings.'
        };
        
        document.getElementById('templateConfirmText').textContent = messages[templateName];
        document.getElementById('templateConfirmModal').classList.add('show');
    }

    confirmTemplate() {
        if (!this.pendingTemplate) return;
        
        switch(this.pendingTemplate) {
            case 'sick':
                this.activities.forEach(a => {
                    a.enabled = ['sleep', 'meals', 'winddown'].includes(a.id);
                });
                break;
            case 'travel':
                this.activities.forEach(a => {
                    a.enabled = !['gym', 'walk', 'project'].includes(a.id);
                });
                break;
            case 'holiday':
                this.activities.forEach(a => {
                    a.enabled = ['sleep', 'meals', 'leisure', 'winddown'].includes(a.id);
                });
                break;
            case 'reset':
                localStorage.removeItem('customActivities');
                this.loadActivities();
                break;
        }
        
        this.saveActivities();
        this.closeModal();
        this.render();
    }

    updateQuickWidget() {
        const activeTimer = Object.values(this.timers)[0];
        const quickIcon = document.getElementById('quickIcon');
        const quickName = document.getElementById('quickName');
        const quickTimer = document.getElementById('quickTimer');
        const quickBtn = document.getElementById('quickBtn');
        
        if (activeTimer) {
            quickIcon.textContent = activeTimer.activity.icon;
            quickName.textContent = activeTimer.activity.name;
            quickTimer.textContent = this.formatTimerLong(activeTimer.elapsed);
            quickBtn.textContent = 'Stop';
            quickBtn.onclick = () => this.stopTimer(Object.keys(this.timers)[0]);
            quickBtn.className = 'quick-widget-btn danger';
        } else {
            const nextActivity = this.activities[this.currentCardIndex];
            if (nextActivity) {
                quickIcon.textContent = nextActivity.icon;
                quickName.textContent = nextActivity.name;
                quickTimer.textContent = '--:--:--';
                quickBtn.textContent = 'Start';
                quickBtn.onclick = () => this.startTimer(nextActivity.id);
                quickBtn.className = 'quick-widget-btn primary';
            }
        }
    }

    quickAction() {
        const activeTimer = Object.values(this.timers)[0];
        if (activeTimer) {
            this.stopTimer(Object.keys(this.timers)[0]);
        } else {
            const nextActivity = this.activities[this.currentCardIndex];
            if (nextActivity) {
                this.startTimer(nextActivity.id);
            }
        }
    }

    renderDeviationAlerts() {
        const container = document.getElementById('alertsContainer');
        if (this.deviations.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = this.deviations.map(dev => `
            <div class="deviation-alert ${dev.type}">
                ${dev.message}
                <button onclick="this.parentElement.remove()">×</button>
            </div>
        `).join('');
    }

    async exportWeek() {
        const data = {
            week_ending: new Date().toISOString().split('T')[0],
            day_type: this.currentDayType,
            daily_logs: this.weeklyData,
            summary: {
                total_variance: this.activities.reduce((sum, a) => sum + this.getVariance(a.id), 0),
                total_calories: Math.round(this.activities.reduce((sum, a) => {
                    const actual = this.todayLog[a.id] || 0;
                    return sum + (actual * a.cal);
                }, 0)),
                streaks: this.streaks,
                insights: this.insights,
                deviations: this.deviations
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `time_budget_${data.week_ending}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async clearAllData() {
        if (!confirm('Are you sure? This will delete ALL your tracking data!')) return;
        
        const transaction = this.db.transaction(['logs'], 'readwrite');
        const store = transaction.objectStore('logs');
        store.clear();
        
        localStorage.clear();
        
        alert('All data cleared! Reloading...');
        location.reload();
    }

    render() {
        this.updateStats();
        this.renderDeviationAlerts();
        
        if (this.currentView === 'cards') {
            this.renderCards();
        } else if (this.currentView === 'heatmap') {
            this.renderHeatmap();
        } else if (this.currentView === 'insights') {
            this.renderInsights();
        } else if (this.currentView === 'settings') {
            this.renderSettings();
        }
    }
}

// Initialize
let tracker;
document.addEventListener('DOMContentLoaded', () => {
    tracker = new TimeBudgetTracker();
});

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js');
    });
}
