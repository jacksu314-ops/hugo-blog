(() => {
  let siteAuth = { configured: false, isAdmin: false, user: null, client: null };
  const studyDays = new Map();
  const weeklyReviews = new Map();
  let studyPlans = [];
  let studyRenderGeneration = 0;
  let appliedAuthKey = '';

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
    return studyDays.get(date) || {};
  };

  const loadCloudStudyData = async () => {
    studyDays.clear();
    weeklyReviews.clear();
    if (!siteAuth.isAdmin || !siteAuth.client || !siteAuth.user) return;
    const [daysResult, reviewsResult] = await Promise.all([
      siteAuth.client.from('study_days').select('plan_date,english,japanese,output,note,updated_at').eq('owner_id', siteAuth.user.id),
      siteAuth.client.from('weekly_reviews').select('week_key,wins,blocks,next_steps,updated_at').eq('owner_id', siteAuth.user.id)
    ]);
    if (!daysResult.error) {
      studyDays.clear();
      (daysResult.data || []).forEach((row) => studyDays.set(row.plan_date, row));
    }
    if (!reviewsResult.error) {
      weeklyReviews.clear();
      (reviewsResult.data || []).forEach((row) => weeklyReviews.set(row.week_key, row));
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
    const today = localDateString(new Date());
    const label = active.date === today ? '今日计划' : active.date > today ? '下一项计划' : '最近计划';

    if (siteAuth.isAdmin) {
      const activeWeek = plans.filter((plan) => plan.week === active.week);
      const stats = calculateStudyStats(activeWeek);
      dashboard.querySelector('[data-study-rate]').textContent = `${stats.rate}%`;
      dashboard.querySelector('[data-study-days]').textContent = stats.completedDays;
      dashboard.querySelector('[data-study-total-days]').textContent = stats.totalDays;
      dashboard.querySelector('[data-study-minutes]').textContent = stats.completedMinutes;
      dashboard.querySelector('[data-study-streak]').textContent = stats.streak;
      dashboard.querySelector('[data-study-progress]').style.width = `${stats.rate}%`;
    }

    dashboard.querySelector('[data-study-next-label]').textContent = `${label} · ${active.date}`;
    dashboard.querySelector('[data-study-next-title]').textContent = `${active.week} ${active.weekday} · ${active.minutes} 分钟`;
    dashboard.querySelector('[data-study-next-detail]').textContent = `托业 ${active.englishMinutes} 分钟，日语 ${active.japaneseMinutes} 分钟`;
  };

  const renderStudyPage = (plans) => {
    const todayCard = document.getElementById('study-today-card');
    if (!todayCard || !plans.length) return;

    const plan = pickActivePlan(plans);
    const todayMeta = document.getElementById('study-today-meta');

    todayMeta.textContent = `${plan.week} · ${plan.weekday} · ${plan.fitness}`;
    if (!siteAuth.isAdmin) {
      todayCard.innerHTML = `
        <div class="study-today-main">
          <div>
            <span>${escapeHtml(plan.date)}</span>
            <h3>${Number(plan.minutes)} 分钟学习目标</h3>
            <p>托业 ${Number(plan.englishMinutes)}m · 日语 ${Number(plan.japaneseMinutes)}m</p>
          </div>
          <strong class="study-public-badge">公开计划</strong>
        </div>
        <div class="study-plan-row"><span>托业</span><p>${escapeHtml(plan.english)}</p></div>
        <div class="study-plan-row"><span>日语</span><p>${escapeHtml(plan.japanese)}</p></div>
        <div class="study-plan-row"><span>输出</span><p>${escapeHtml(plan.output)}</p></div>
      `;
      return;
    }

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

    const save = async () => {
      const next = {
        english: todayCard.querySelector('[data-study-check="english"]').checked,
        japanese: todayCard.querySelector('[data-study-check="japanese"]').checked,
        output: todayCard.querySelector('[data-study-check="output"]').checked,
        note: todayCard.querySelector('#study-note').value
      };
      next.done = next.english && next.japanese && next.output;
      studyDays.set(plan.date, next);
      renderStatus();
      const { error } = await siteAuth.client.from('study_days').upsert({
        owner_id: siteAuth.user.id,
        plan_date: plan.date,
        english: next.english,
        japanese: next.japanese,
        output: next.output,
        note: next.note.slice(0, 5000),
        updated_at: new Date().toISOString()
      }, { onConflict: 'owner_id,plan_date' });
      const status = todayCard.querySelector('[data-save-status]');
      if (status) status.textContent = error ? `保存失败：${error.message}` : '已同步到云端';
    };

    todayCard.querySelectorAll('[data-study-check]').forEach((input) => input.addEventListener('change', save));
    let noteTimer = null;
    todayCard.querySelector('#study-note').insertAdjacentHTML('afterend', '<small data-save-status>修改后自动同步到云端</small>');
    todayCard.querySelector('#study-note').addEventListener('input', () => {
      window.clearTimeout(noteTimer);
      todayCard.querySelector('[data-save-status]').textContent = '正在等待保存...';
      noteTimer = window.setTimeout(save, 650);
    });
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
    const saved = weeklyReviews.get(week) || {};
    const status = form.querySelector('[data-review-status]');
    let saveTimer = null;
    form.querySelectorAll('[data-review-field]').forEach((field) => {
      const cloudKey = field.dataset.reviewField === 'next' ? 'next_steps' : field.dataset.reviewField;
      field.value = saved[cloudKey] || '';
      field.addEventListener('input', () => {
        window.clearTimeout(saveTimer);
        status.textContent = '正在等待保存...';
        saveTimer = window.setTimeout(async () => {
          const next = { owner_id: siteAuth.user.id, week_key: week, updated_at: new Date().toISOString() };
          form.querySelectorAll('[data-review-field]').forEach((input) => {
            const key = input.dataset.reviewField === 'next' ? 'next_steps' : input.dataset.reviewField;
            next[key] = input.value.slice(0, 5000);
          });
          weeklyReviews.set(week, next);
          const { error } = await siteAuth.client.from('weekly_reviews').upsert(next, { onConflict: 'owner_id,week_key' });
          status.textContent = error ? `保存失败：${error.message}` : '已同步到云端';
        }, 650);
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

  const setupSharing = () => {
    const trigger = document.getElementById('share-page');
    const popover = document.getElementById('share-popover');
    if (!trigger || !popover) return;

    const status = document.getElementById('share-status');
    const closeButton = document.getElementById('close-share');
    const nativeButton = document.getElementById('native-share');
    const copyButton = document.getElementById('copy-page-link');
    const url = window.location.href;
    const title = document.title.replace(/\s*[·|]\s*Jack Su's Digital Garden\s*$/, '');
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    const platformUrls = {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${title}\n${url}`)}`
    };

    popover.querySelectorAll('[data-share-platform]').forEach((link) => {
      link.href = platformUrls[link.dataset.sharePlatform];
    });

    const setOpen = (open) => {
      popover.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
      if (open) closeButton.focus();
    };

    const copy = async () => {
      try {
        await navigator.clipboard.writeText(url);
        status.textContent = '链接已复制，可以粘贴到微信或其他平台。';
      } catch (_error) {
        status.textContent = '复制失败，请从地址栏复制链接。';
      }
    };

    trigger.addEventListener('click', async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title, text: title, url });
          status.textContent = '已打开系统分享。';
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }
      setOpen(popover.hidden);
    });
    closeButton.addEventListener('click', () => setOpen(false));
    copyButton.addEventListener('click', copy);
    nativeButton.addEventListener('click', async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title, text: title, url });
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }
      await copy();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !popover.hidden) setOpen(false);
    });
    document.addEventListener('click', (event) => {
      if (!popover.hidden && !popover.contains(event.target) && !trigger.contains(event.target)) setOpen(false);
    });
  };

  const setupEntrance = () => {
    const entrance = document.getElementById('site-entrance');
    if (!entrance) return;
    const key = entrance.dataset.entranceKey;
    const enterButton = document.getElementById('enter-garden');
    const skipButton = document.getElementById('skip-entrance');
    let visible = false;

    const close = () => {
      if (!visible) return;
      visible = false;
      entrance.classList.remove('is-visible');
      entrance.setAttribute('aria-hidden', 'true');
      try {
        window.sessionStorage.setItem(key, 'seen');
      } catch (_error) {
        // Storage can be unavailable in strict privacy modes.
      }
      window.setTimeout(() => { entrance.hidden = true; }, 380);
    };

    try {
      if (window.sessionStorage.getItem(key) === 'seen') {
        entrance.hidden = true;
        return;
      }
    } catch (_error) {
      // If storage is unavailable, show the entry once per page load.
    }

    entrance.hidden = false;
    window.requestAnimationFrame(() => {
      visible = true;
      entrance.classList.add('is-visible');
      entrance.setAttribute('aria-hidden', 'false');
      enterButton.focus();
    });
    enterButton.addEventListener('click', close);
    skipButton.addEventListener('click', close);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' || (event.key === 'Enter' && visible)) close();
    });
  };

  const authKey = (auth) => `${auth?.user?.id || 'visitor'}:${auth?.role || (auth?.isAdmin ? 'admin' : 'visitor')}`;

  const applyStudyAuth = async (nextAuth, force = false) => {
    const nextKey = authKey(nextAuth);
    if (!force && nextKey === appliedAuthKey) return;

    const generation = ++studyRenderGeneration;
    siteAuth = nextAuth || { configured: false, isAdmin: false, user: null, client: null };
    await loadCloudStudyData();
    if (generation !== studyRenderGeneration) return;

    appliedAuthKey = nextKey;
    renderHomeDashboard(studyPlans);
    renderStudyPage(studyPlans);
  };

  document.addEventListener('DOMContentLoaded', async () => {
    studyPlans = safeJson(document.querySelector('.study-plan-data'));
    window.addEventListener('site-auth-change', (event) => {
      void applyStudyAuth(event.detail);
    });

    const initialAuth = await window.siteAuthReady;
    await applyStudyAuth(initialAuth);
    setupReadingExperience();
    setupSiteTools();
    setupSharing();
    setupEntrance();
  });
})();
