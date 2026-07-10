(() => {
  const safeJson = (element, fallback = []) => {
    if (!element) return fallback;
    try {
      const parsed = JSON.parse(element.textContent);
      return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    } catch (_error) {
      return fallback;
    }
  };

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const localDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const readDay = (date) => {
    try {
      return JSON.parse(localStorage.getItem(`study-check-${date}`) || '{}');
    } catch (_error) {
      return {};
    }
  };

  const dayIsDone = (date) => {
    const saved = readDay(date);
    return Boolean(saved.done || (saved.english && saved.japanese && saved.output));
  };

  const calculateStudyStats = (plans) => {
    const ordered = [...plans].sort((a, b) => a.date.localeCompare(b.date));
    const completed = ordered.filter((plan) => dayIsDone(plan.date));
    const completedMinutes = completed.reduce((sum, plan) => sum + Number(plan.minutes || 0), 0);
    const plannedMinutes = ordered.reduce((sum, plan) => sum + Number(plan.minutes || 0), 0);
    let streak = 0;

    for (let index = completed.length - 1; index >= 0; index -= 1) {
      const current = completed[index];
      if (!dayIsDone(current.date)) break;
      if (index < completed.length - 1) {
        const newer = new Date(`${completed[index + 1].date}T00:00:00`);
        const older = new Date(`${current.date}T00:00:00`);
        if ((newer - older) / 86400000 !== 1) break;
      }
      streak += 1;
    }

    return {
      completedDays: completed.length,
      totalDays: ordered.length,
      completedMinutes,
      plannedMinutes,
      rate: ordered.length ? Math.round((completed.length / ordered.length) * 100) : 0,
      streak
    };
  };

  const pickActivePlan = (plans) => {
    const today = localDateString(new Date());
    return plans.find((plan) => plan.date === today)
      || plans.find((plan) => plan.date > today)
      || [...plans].reverse().find((plan) => !dayIsDone(plan.date))
      || plans[plans.length - 1];
  };

  const renderHomeDashboard = (plans) => {
    const dashboard = document.querySelector('[data-study-dashboard]');
    if (!dashboard || !plans.length) return;

    const active = pickActivePlan(plans);
    const activeWeek = plans.filter((plan) => plan.week === active.week);
    const stats = calculateStudyStats(activeWeek);
    const today = localDateString(new Date());
    const label = active.date === today ? '今日计划' : active.date > today ? '下一项计划' : '待完成计划';

    dashboard.querySelector('[data-study-rate]').textContent = `${stats.rate}%`;
    dashboard.querySelector('[data-study-days]').textContent = stats.completedDays;
    dashboard.querySelector('[data-study-total-days]').textContent = stats.totalDays;
    dashboard.querySelector('[data-study-minutes]').textContent = stats.completedMinutes;
    dashboard.querySelector('[data-study-streak]').textContent = stats.streak;
    dashboard.querySelector('[data-study-progress]').style.width = `${stats.rate}%`;
    dashboard.querySelector('[data-study-next-label]').textContent = `${label} · ${active.date}`;
    dashboard.querySelector('[data-study-next-title]').textContent = `${active.week} ${active.weekday} · ${active.minutes} 分钟`;
    dashboard.querySelector('[data-study-next-detail]').textContent = `托业 ${active.englishMinutes} 分钟，日语 ${active.japaneseMinutes} 分钟`;
  };

  const renderStudyPage = (plans) => {
    const todayCard = document.getElementById('study-today-card');
    if (!todayCard || !plans.length) return;

    const plan = pickActivePlan(plans);
    const todayMeta = document.getElementById('study-today-meta');
    const renderStatus = () => {
      const saved = readDay(plan.date);
      const done = Boolean(saved.done || (saved.english && saved.japanese && saved.output));
      const badge = todayCard.querySelector('[data-today-status]');
      if (badge) {
        badge.textContent = done ? '已完成' : '待打卡';
        badge.dataset.done = String(done);
      }
      updateStudySummaries(plans);
    };

    const saved = readDay(plan.date);
    todayMeta.textContent = `${plan.week} · ${plan.weekday} · ${plan.fitness}`;
    todayCard.innerHTML = `
      <div class="study-today-main">
        <div>
          <span>${escapeHtml(plan.date)}</span>
          <h3>${Number(plan.minutes)} 分钟学习目标</h3>
          <p>托业 ${Number(plan.englishMinutes)}m · 日语 ${Number(plan.japaneseMinutes)}m</p>
        </div>
        <strong data-today-status></strong>
      </div>
      <label class="study-check-row">
        <input type="checkbox" data-study-check="english" ${saved.english ? 'checked' : ''}>
        <span>托业：${escapeHtml(plan.english)}</span>
      </label>
      <label class="study-check-row">
        <input type="checkbox" data-study-check="japanese" ${saved.japanese ? 'checked' : ''}>
        <span>日语：${escapeHtml(plan.japanese)}</span>
      </label>
      <label class="study-check-row">
        <input type="checkbox" data-study-check="output" ${saved.output ? 'checked' : ''}>
        <span>输出：${escapeHtml(plan.output)}</span>
      </label>
      <textarea id="study-note" placeholder="今天的完成情况、错题、体感和明天调整..." rows="4"></textarea>
    `;
    todayCard.querySelector('#study-note').value = saved.note || '';

    const save = () => {
      const next = {
        english: todayCard.querySelector('[data-study-check="english"]').checked,
        japanese: todayCard.querySelector('[data-study-check="japanese"]').checked,
        output: todayCard.querySelector('[data-study-check="output"]').checked,
        note: todayCard.querySelector('#study-note').value
      };
      next.done = next.english && next.japanese && next.output;
      localStorage.setItem(`study-check-${plan.date}`, JSON.stringify(next));
      renderStatus();
    };

    todayCard.querySelectorAll('[data-study-check]').forEach((input) => input.addEventListener('change', save));
    todayCard.querySelector('#study-note').addEventListener('input', save);
    renderStatus();
    setupWeeklyReview(plan.week);
  };

  const updateStudySummaries = (plans) => {
    const active = pickActivePlan(plans);
    const weekPlans = plans.filter((plan) => plan.week === active.week);
    const stats = calculateStudyStats(weekPlans);
    const values = {
      '[data-week-rate]': `${stats.rate}%`,
      '[data-week-days]': `${stats.completedDays}/${stats.totalDays}`,
      '[data-week-minutes]': `${stats.completedMinutes}/${stats.plannedMinutes}`,
      '[data-week-streak]': `${stats.streak} 天`
    };
    Object.entries(values).forEach(([selector, value]) => {
      const element = document.querySelector(selector);
      if (element) element.textContent = value;
    });
    document.querySelectorAll('[data-study-day-status]').forEach((badge) => {
      const done = dayIsDone(badge.dataset.studyDayStatus);
      badge.textContent = done ? '已完成' : '未打卡';
      badge.dataset.done = String(done);
    });
  };

  const setupWeeklyReview = (week) => {
    const form = document.querySelector('[data-weekly-review]');
    if (!form) return;
    const key = `study-week-review-${week}`;
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(key) || '{}');
    } catch (_error) {
      saved = {};
    }
    const status = form.querySelector('[data-review-status]');
    form.querySelectorAll('[data-review-field]').forEach((field) => {
      field.value = saved[field.dataset.reviewField] || '';
      field.addEventListener('input', () => {
        const next = {};
        form.querySelectorAll('[data-review-field]').forEach((input) => {
          next[input.dataset.reviewField] = input.value;
        });
        localStorage.setItem(key, JSON.stringify(next));
        status.textContent = '已自动保存';
      });
    });
  };

  const setupReadingExperience = () => {
    const article = document.querySelector('.article-content');
    const track = document.getElementById('reading-progress-track');
    const value = document.getElementById('reading-progress-value');
    if (article && track && value) {
      document.body.classList.add('reading-experience-active');
      const update = () => {
        const start = article.getBoundingClientRect().top + window.scrollY - 120;
        const end = start + article.offsetHeight - window.innerHeight * 0.55;
        const rate = end > start ? Math.min(1, Math.max(0, (window.scrollY - start) / (end - start))) : 0;
        value.style.width = `${Math.round(rate * 100)}%`;
      };
      update();
      window.addEventListener('scroll', update, { passive: true });

      article.querySelectorAll('pre').forEach((block) => {
        if (block.querySelector('.code-copy-button')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'code-copy-button';
        button.textContent = '复制';
        button.addEventListener('click', async () => {
          const code = block.querySelector('code')?.innerText || block.innerText;
          try {
            await navigator.clipboard.writeText(code.replace(/^复制\s*/, ''));
            button.textContent = '已复制';
          } catch (_error) {
            button.textContent = '复制失败';
          }
          window.setTimeout(() => { button.textContent = '复制'; }, 1600);
        });
        block.appendChild(button);
      });
    }
  };

  const setupSiteTools = () => {
    const randomButton = document.getElementById('random-explore');
    const topButton = document.getElementById('back-to-top');
    const items = safeJson(document.getElementById('site-explore-data'));

    randomButton?.addEventListener('click', () => {
      const current = window.location.pathname.replace(/\/$/, '');
      const choices = items.filter((item) => item.url.replace(/\/$/, '') !== current);
      if (!choices.length) return;
      const target = choices[Math.floor(Math.random() * choices.length)];
      window.location.assign(target.url);
    });

    const toggleTopButton = () => topButton?.classList.toggle('is-visible', window.scrollY > 480);
    topButton?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    toggleTopButton();
    window.addEventListener('scroll', toggleTopButton, { passive: true });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const plans = safeJson(document.querySelector('.study-plan-data'));
    renderHomeDashboard(plans);
    renderStudyPage(plans);
    setupReadingExperience();
    setupSiteTools();
  });
})();
