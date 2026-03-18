/**
 * Calendar Module - Month view with task dots
 */
(function () {
    const FG = window.FocusGuard = window.FocusGuard || {};

    const Calendar = {
        currentYear: new Date().getFullYear(),
        currentMonth: new Date().getMonth(),

        render(container, onDateSelect) {
            container.innerHTML = '';
            container.className = 'fg-calendar';
            const year = this.currentYear;
            const month = this.currentMonth;
            const today = FG.DataStore.today();
            const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
            const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const allTasks = FG.Tasks.getAll();
            const taskDates = new Set(allTasks.map(t => t.calendarDate).filter(Boolean));

            container.innerHTML = `
                <div class="fg-calendar-header">
                    <button class="fg-calendar-nav fg-calendar-prev">&lt;</button>
                    <span class="fg-calendar-title">${year}年 ${monthNames[month]}</span>
                    <button class="fg-calendar-nav fg-calendar-next">&gt;</button>
                </div>
                <div class="fg-calendar-days-header">
                    ${dayNames.map(d => `<div class="fg-calendar-day-name">${d}</div>`).join('')}
                </div>
                <div class="fg-calendar-grid">${this._renderDays(year, month, firstDay, daysInMonth, today, taskDates)}</div>`;

            container.querySelector('.fg-calendar-prev')?.addEventListener('click', () => {
                this.currentMonth--;
                if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
                this.render(container, onDateSelect);
            });
            container.querySelector('.fg-calendar-next')?.addEventListener('click', () => {
                this.currentMonth++;
                if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
                this.render(container, onDateSelect);
            });
            container.querySelectorAll('.fg-calendar-day[data-date]').forEach(el => {
                el.addEventListener('click', () => { if (onDateSelect) onDateSelect(el.dataset.date); });
            });
        },

        _renderDays(year, month, firstDay, daysInMonth, today, taskDates) {
            let html = '';
            for (let i = 0; i < firstDay; i++) html += '<div class="fg-calendar-day fg-calendar-day-empty"></div>';
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isToday = dateStr === today;
                const hasTasks = taskDates.has(dateStr);
                html += `<div class="fg-calendar-day ${isToday ? 'fg-calendar-day-today' : ''} ${hasTasks ? 'fg-calendar-day-has-tasks' : ''}" data-date="${dateStr}">
                    <span class="fg-calendar-day-number">${d}</span>
                    ${hasTasks ? '<span class="fg-calendar-day-dot"></span>' : ''}</div>`;
            }
            return html;
        },
    };

    FG.Calendar = Calendar;
})();
