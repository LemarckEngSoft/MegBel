(() => {
  const monthNames = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
  const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Manaus', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const state = { month: new Date(`${todayISO}T12:00:00`), events: [], days: [], skipped: [], users: [], pet: null, streak: null };
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  async function getJson(path) {
    const response = await fetch(`/api${path}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Nao foi possivel atualizar o calendario.');
    return response.json();
  }

  async function loadCalendar() {
    try {
      const [calendar, history, streak, pet] = await Promise.all([getJson('/calendar'), getJson('/streak/history'), getJson('/streak'), getJson('/pet')]);
      state.events = calendar.events;
      state.days = history.days;
      state.skipped = history.skipped || [];
      state.users = streak.users;
      state.streak = streak.streak;
      state.pet = pet.pet;
      render();
    } catch (error) {
      $('#calendar-month-grid').innerHTML = `<p class="empty">${error.message}</p>`;
    }
  }

  function render() {
    const year = state.month.getFullYear();
    const month = state.month.getMonth();
    const firstDay = new Date(year, month, 1, 12);
    const numberOfDays = new Date(year, month + 1, 0).getDate();
    const attendance = new Map(state.days.map((day) => [String(day.activity_date).slice(0, 10), day]));
    const events = new Map();
    for (const event of state.events) {
      const date = String(event.event_date).slice(0, 10);
      events.set(date, [...(events.get(date) || []), event]);
    }

    $('#calendar-month-title').textContent = monthNames.format(firstDay);
    const weekdays = `<div class="calendar-weekdays">${weekdayNames.map((label) => `<span>${label}</span>`).join('')}</div>`;
    $('#calendar-month-grid').innerHTML = weekdays + Array.from({ length: firstDay.getDay() }, () => '<span class="calendar-day outside" aria-hidden="true"></span>').join('') + Array.from({ length: numberOfDays }, (_, index) => {
      const day = index + 1;
      const date = new Date(year, month, day, 12);
      const dateKey = isoDate(date);
      const activity = attendance.get(dateKey);
      const isToday = dateKey === todayISO;
      const usersAttended = [activity?.user_a_completed, activity?.user_b_completed];
      const offset = Math.floor((date - new Date(`${String(state.streak.started_on).slice(0, 10)}T12:00:00`)) / 86400000);
      const lostBefore = state.skipped.filter((skipDate) => skipDate < dateKey).length;
      const streakDay = offset >= 0 ? state.streak.initial_streak + offset - lostBefore : null;
      const dayEvents = events.get(dateKey) || [];
      const hasMilestone = Boolean(activity?.completed && activity.day_number > 0 && activity.day_number % 10 === 0);
      const milestone = hasMilestone ? `<button class="milestone-download" data-milestone="${activity.day_number}" data-date="${dateKey}">Baixar marco ${activity.day_number}</button>` : '';
      const eventMarkup = dayEvents.slice(0, 2).map((event) => `<div class="calendar-event-chip" title="${escapeHtml(event.title)}">${escapeHtml(event.title)}</div>`).join('');
      return `<div class="calendar-day ${isToday ? 'today' : ''} ${activity?.completed ? 'has-attendance' : ''}" data-date="${dateKey}"><div class="calendar-day-num"><span>${day}</span><small class="calendar-day-count">${streakDay ? `🔥 ${streakDay}` : ''}</small></div><div class="attendance-dots">${state.users.map((user, userIndex) => `<span class="attendance-dot ${usersAttended[userIndex] ? 'present' : ''}" title="${escapeHtml(user.name)} ${usersAttended[userIndex] ? 'presente' : 'sem presenca'}"></span>`).join('')}</div><div class="calendar-day-events">${eventMarkup}</div>${milestone}</div>`;
    }).join('');
  }

  function drawFlame(context, x, y, width, height) {
    const flame = new Path2D();
    flame.moveTo(x + width * .5, y);
    flame.bezierCurveTo(x + width * .58, y + height * .18, x + width * .98, y + height * .3, x + width * .94, y + height * .65);
    flame.bezierCurveTo(x + width * .9, y + height * .92, x + width * .7, y + height, x + width * .5, y + height);
    flame.bezierCurveTo(x + width * .22, y + height, x + width * .03, y + height * .83, x + width * .07, y + height * .58);
    flame.bezierCurveTo(x + width * .1, y + height * .34, x + width * .38, y + height * .26, x + width * .5, y);
    flame.closePath();
    const gradient = context.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, '#4d1979');
    gradient.addColorStop(.48, '#873dc1');
    gradient.addColorStop(1, '#e6a6fa');
    context.fillStyle = gradient;
    context.shadowColor = '#9e56d5';
    context.shadowBlur = 42;
    context.fill(flame);
    context.shadowBlur = 0;
    return { x: x + width * .5, y: y + height * .58 };
  }

  async function drawParticipant(context, user, centerX, centerY) {
    const radius = 66;
    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.closePath();
    context.clip();
    if (user.photo_url) {
      try {
        const image = new Image();
        image.src = user.photo_url;
        await image.decode();
        context.drawImage(image, centerX - radius, centerY - radius, radius * 2, radius * 2);
      } catch {
        context.fillStyle = '#dce8df';
        context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
        context.fillStyle = '#294544';
        context.font = '700 54px DM Sans, sans-serif';
        context.textAlign = 'center';
        context.fillText(user.name[0], centerX, centerY + 18);
      }
    } else {
      context.fillStyle = '#dce8df';
      context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
      context.fillStyle = '#294544';
      context.font = '700 54px DM Sans, sans-serif';
      context.textAlign = 'center';
      context.fillText(user.name[0], centerX, centerY + 18);
    }
    context.restore();
    context.strokeStyle = '#fff';
    context.lineWidth = 8;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#28262d';
    context.font = '600 30px DM Sans, sans-serif';
    context.textAlign = 'center';
    context.fillText(user.nickname || user.name, centerX, centerY + radius + 47, 300);
  }

  async function downloadMilestone(dayNumber, date) {
    const [streakData, petData] = await Promise.all([getJson('/streak'), getJson('/pet')]);
    state.users = streakData.users;
    state.pet = petData.pet;
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1000;
    const context = canvas.getContext('2d');
    const background = context.createLinearGradient(0, 0, 1200, 1000);
    background.addColorStop(0, '#fbf7ef');
    background.addColorStop(1, '#e9eee7');
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#294544';
    context.font = '700 28px DM Sans, sans-serif';
    context.textAlign = 'center';
    context.fillText('DUO DAYS · NOSSA HISTORIA', 600, 86);
    context.fillStyle = '#2e2b33';
    context.font = '600 52px Fraunces, serif';
    context.fillText('Mais um marco nosso', 600, 164);

    const petX = 315;
    const petY = 355;
    context.fillStyle = '#17171b';
    context.beginPath();
    context.ellipse(petX - 38, petY - 110, 27, 96, -.12, 0, Math.PI * 2);
    context.ellipse(petX + 38, petY - 110, 27, 96, .12, 0, Math.PI * 2);
    context.ellipse(petX, petY, 112, 138, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(petX - 35, petY - 13, 10, 0, Math.PI * 2);
    context.arc(petX + 35, petY - 13, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e7a0a5';
    context.beginPath();
    context.arc(petX, petY + 13, 12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#37313d';
    context.font = '600 31px Fraunces, serif';
    context.fillText(state.pet?.name || 'Nosso pet', petX, 550);

    const flameCenter = drawFlame(context, 605, 210, 360, 450);
    context.fillStyle = '#fff';
    context.font = '700 86px Fraunces, serif';
    context.textAlign = 'center';
    context.fillText(String(dayNumber), flameCenter.x, flameCenter.y + 30);
    context.fillStyle = '#5c5662';
    context.font = '500 23px DM Sans, sans-serif';
    context.fillText(new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR'), 600, 700);
    await Promise.all(state.users.map((user, index) => drawParticipant(context, user, 460 + index * 280, 835)));

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Nao foi possivel gerar a imagem do marco.');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `duo-days-marco-${dayNumber}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('#calendar-prev')) { state.month.setMonth(state.month.getMonth() - 1); render(); }
    if (event.target.closest('#calendar-next')) { state.month.setMonth(state.month.getMonth() + 1); render(); }
    if (event.target.closest('#calendar-today')) { state.month = new Date(`${todayISO}T12:00:00`); render(); }
    const milestone = event.target.closest('[data-milestone]');
    if (milestone) downloadMilestone(Number(milestone.dataset.milestone), milestone.dataset.date).catch((error) => window.alert(error.message));
  });

  document.addEventListener('keydown', (event) => {
    if (!document.querySelector('#view-calendar.active') || event.target.matches('input, textarea, select, button')) return;
    if (event.key === 'ArrowLeft') { state.month.setMonth(state.month.getMonth() - 1); render(); }
    if (event.key === 'ArrowRight') { state.month.setMonth(state.month.getMonth() + 1); render(); }
  });

  const eventList = $('#event-list');
  if (eventList) new MutationObserver(() => loadCalendar()).observe(eventList, { childList: true, subtree: true });
  document.addEventListener('duo:profile-updated', loadCalendar);
  document.addEventListener('duo:pet-updated', loadCalendar);
  document.addEventListener('click', (event) => { if (event.target.closest('[data-view="calendar"]')) loadCalendar(); });
  loadCalendar();
})();
