const parseConfig = () => {
  const element = document.getElementById('site-auth-config');
  if (!element) return {};
  try {
    const parsed = JSON.parse(element.textContent);
    return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
  } catch (_error) {
    return {};
  }
};

const config = parseConfig();
const configured = Boolean(config.url && config.publishableKey);
const authState = {
  configured,
  client: null,
  session: null,
  user: null,
  role: 'visitor',
  isAdmin: false,
  profile: null,
  accountUrl: config.accountUrl || '/account/'
};

const finishAuth = () => {
  window.siteAuth = authState;
  document.documentElement.dataset.siteAccess = authState.isAdmin
    ? 'admin'
    : authState.user ? 'member' : 'visitor';
  updateNavigation();
  window.resolveSiteAuth?.(authState);
  window.dispatchEvent(new CustomEvent('site-auth-change', { detail: authState }));
};

const updateNavigation = () => {
  const links = document.querySelectorAll('a[href$="/account/"], a[href$="/account"]');
  const label = authState.isAdmin ? '管理员' : authState.user ? '我的账户' : '登录';
  links.forEach((link) => {
    const text = link.querySelector('p') || link;
    text.textContent = label;
    link.dataset.authNav = authState.role;
  });
};

const showNotice = (message, type = 'info') => {
  const notice = document.querySelector('[data-auth-notice]');
  if (!notice) return;
  notice.textContent = message;
  notice.dataset.type = type;
};

const loadIdentity = async (session) => {
  authState.session = session;
  authState.user = session?.user || null;
  authState.role = authState.user ? 'member' : 'visitor';
  authState.isAdmin = false;
  authState.profile = null;
  if (!authState.user) return;

  const [roleResult, profileResult] = await Promise.all([
    authState.client.from('user_roles').select('role').eq('user_id', authState.user.id).maybeSingle(),
    authState.client.from('profiles').select('display_name, avatar_url').eq('id', authState.user.id).maybeSingle()
  ]);
  if (!roleResult.error && roleResult.data?.role === 'admin') {
    authState.role = 'admin';
    authState.isAdmin = true;
  }
  if (!profileResult.error) authState.profile = profileResult.data;
};

const scanLocalStudyData = () => {
  const days = [];
  const reviews = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    try {
      if (key.startsWith('study-check-')) {
        const value = JSON.parse(localStorage.getItem(key) || '{}');
        days.push({
          owner_id: authState.user.id,
          plan_date: key.replace('study-check-', ''),
          english: Boolean(value.english),
          japanese: Boolean(value.japanese),
          output: Boolean(value.output),
          note: String(value.note || '').slice(0, 5000)
        });
      }
      if (key.startsWith('study-week-review-')) {
        const value = JSON.parse(localStorage.getItem(key) || '{}');
        reviews.push({
          owner_id: authState.user.id,
          week_key: key.replace('study-week-review-', ''),
          wins: String(value.wins || '').slice(0, 5000),
          blocks: String(value.blocks || '').slice(0, 5000),
          next_steps: String(value.next || '').slice(0, 5000)
        });
      }
    } catch (_error) {
      // Ignore malformed legacy entries and preserve them for manual recovery.
    }
  }
  return { days, reviews };
};

const setupMigration = () => {
  const panel = document.querySelector('[data-study-migration]');
  if (!panel || !authState.isAdmin) return;
  panel.hidden = false;
  const marker = `study-supabase-migration-v1:${authState.user.id}`;
  const summary = panel.querySelector('[data-migration-summary]');
  const button = panel.querySelector('[data-migrate-study]');
  const records = scanLocalStudyData();

  if (localStorage.getItem(marker)) {
    summary.textContent = '当前浏览器的学习记录已经导入过。旧数据仍保留在本地。';
    button.hidden = true;
    return;
  }
  summary.textContent = `发现 ${records.days.length} 条每日记录和 ${records.reviews.length} 条周复盘。导入成功前不会删除本地数据。`;
  button.disabled = records.days.length + records.reviews.length === 0;
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = '正在导入...';
    const operations = [];
    if (records.days.length) operations.push(authState.client.from('study_days').upsert(records.days, { onConflict: 'owner_id,plan_date' }));
    if (records.reviews.length) operations.push(authState.client.from('weekly_reviews').upsert(records.reviews, { onConflict: 'owner_id,week_key' }));
    const results = await Promise.all(operations);
    const failed = results.find((result) => result.error);
    if (failed) {
      summary.textContent = `导入失败：${failed.error.message}`;
      button.disabled = false;
      button.textContent = '重新导入';
      return;
    }
    localStorage.setItem(marker, new Date().toISOString());
    summary.textContent = '导入成功。旧数据仍保留在当前浏览器，可确认云端记录后再手动清理。';
    button.hidden = true;
    window.dispatchEvent(new CustomEvent('site-study-updated'));
  });
};

const setupAccount = () => {
  const page = document.querySelector('[data-account-page]');
  if (!page) return;
  const signedOut = page.querySelector('[data-auth-signed-out]');
  const signedIn = page.querySelector('[data-auth-signed-in]');
  if (!configured) {
    showNotice('认证服务尚未配置。网站仍可公开阅读，但登录、讨论和云端学习记录暂不可用。', 'warning');
    signedOut.hidden = true;
    signedIn.hidden = true;
    return;
  }

  signedOut.hidden = Boolean(authState.user);
  signedIn.hidden = !authState.user;
  if (authState.user) {
    showNotice(authState.isAdmin ? '管理员身份已验证。' : '邮箱已验证，可以参与公开讨论。', 'success');
    page.querySelector('[data-account-heading]').textContent = authState.isAdmin ? '管理员账户' : '我的账户';
    page.querySelector('[data-account-role]').textContent = authState.isAdmin ? '管理员' : '普通用户';
    page.querySelector('[data-account-email]').textContent = authState.user.email || 'GitHub 账户';
    page.querySelector('[data-account-id]').textContent = authState.user.id;
    page.querySelector('[data-profile-form] input').value = authState.profile?.display_name || authState.user.user_metadata?.user_name || '';
    setupMigration();
  } else {
    showNotice('输入邮箱获取验证码，或使用 GitHub 登录管理员账户。');
  }

  const requestForm = page.querySelector('[data-email-request-form]');
  const verifyForm = page.querySelector('[data-email-verify-form]');
  const emailInput = requestForm.querySelector('[name="email"]');
  let pendingEmail = sessionStorage.getItem('pending-auth-email') || '';
  let cooldownTimer = null;

  requestForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = requestForm.querySelector('[data-send-code]');
    pendingEmail = emailInput.value.trim().toLowerCase();
    button.disabled = true;
    const { error } = await authState.client.auth.signInWithOtp({
      email: pendingEmail,
      options: { shouldCreateUser: true }
    });
    if (error) {
      showNotice(`验证码发送失败：${error.message}`, 'error');
      button.disabled = false;
      return;
    }
    sessionStorage.setItem('pending-auth-email', pendingEmail);
    requestForm.hidden = true;
    verifyForm.hidden = false;
    showNotice(`验证码已发送到 ${pendingEmail}，请检查收件箱和垃圾邮件。`, 'success');
    let remaining = 60;
    button.textContent = `${remaining} 秒后可重发`;
    cooldownTimer = window.setInterval(() => {
      remaining -= 1;
      button.textContent = remaining > 0 ? `${remaining} 秒后可重发` : '发送验证码';
      if (remaining <= 0) {
        window.clearInterval(cooldownTimer);
        button.disabled = false;
      }
    }, 1000);
  });

  verifyForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = verifyForm.querySelector('[data-verify-code]');
    button.disabled = true;
    const token = verifyForm.querySelector('[name="token"]').value.trim();
    const { data, error } = await authState.client.auth.verifyOtp({ email: pendingEmail, token, type: 'email' });
    if (error) {
      showNotice(`验证失败：${error.message}`, 'error');
      button.disabled = false;
      return;
    }
    sessionStorage.removeItem('pending-auth-email');
    await loadIdentity(data.session);
    finishAuth();
    window.location.reload();
  });

  page.querySelector('[data-change-email]').addEventListener('click', () => {
    verifyForm.hidden = true;
    requestForm.hidden = false;
    requestForm.querySelector('[data-send-code]').disabled = false;
  });

  page.querySelector('[data-github-login]').addEventListener('click', async () => {
    const { error } = await authState.client.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: config.callbackUrl }
    });
    if (error) showNotice(`GitHub 登录失败：${error.message}`, 'error');
  });

  page.querySelector('[data-sign-out]').addEventListener('click', async () => {
    await authState.client.auth.signOut();
    window.location.reload();
  });

  page.querySelector('[data-profile-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const displayName = event.currentTarget.elements.displayName.value.trim();
    const { error } = await authState.client.from('profiles').update({ display_name: displayName }).eq('id', authState.user.id);
    showNotice(error ? `昵称保存失败：${error.message}` : '公开昵称已保存。', error ? 'error' : 'success');
  });
};

const handleCallback = async () => {
  const page = document.querySelector('[data-auth-callback]');
  if (!page) return false;
  const status = page.querySelector('[data-callback-status]');
  const link = page.querySelector('[data-callback-link]');
  if (!configured) {
    status.textContent = '认证服务尚未配置。';
    link.hidden = false;
    finishAuth();
    return true;
  }
  const errorDescription = new URLSearchParams(window.location.search).get('error_description');
  if (errorDescription) {
    status.textContent = `登录失败：${errorDescription}`;
    link.hidden = false;
    finishAuth();
    return true;
  }
  const code = new URLSearchParams(window.location.search).get('code');
  if (!code) {
    status.textContent = '登录回调缺少授权代码，请重新登录。';
    link.hidden = false;
    finishAuth();
    return true;
  }
  const { error } = await authState.client.auth.exchangeCodeForSession(code);
  if (error) {
    status.textContent = `登录验证失败：${error.message}`;
    link.hidden = false;
    finishAuth();
    return true;
  }
  window.location.replace(config.accountUrl);
  return true;
};

if (!configured) {
  finishAuth();
  setupAccount();
  handleCallback();
} else {
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    authState.client = createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' }
    });
    if (!await handleCallback()) {
      const { data } = await authState.client.auth.getSession();
      await loadIdentity(data.session);
      finishAuth();
      setupAccount();
      authState.client.auth.onAuthStateChange(async (_event, session) => {
        await loadIdentity(session);
        finishAuth();
      });
    }
  } catch (error) {
    authState.configured = false;
    authState.error = error.message;
    finishAuth();
    setupAccount();
  }
}
