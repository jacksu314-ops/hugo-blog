const auth = await window.siteAuthReady;

const formatTime = (value) => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
}).format(new Date(value));

document.querySelectorAll('[data-discussion]').forEach(async (panel) => {
  const state = panel.querySelector('[data-discussion-state]');
  const form = panel.querySelector('[data-discussion-form]');
  const body = panel.querySelector('[data-discussion-body]');
  const counter = panel.querySelector('[data-discussion-counter]');
  const list = panel.querySelector('[data-discussion-list]');
  const template = panel.querySelector('[data-comment-template]');
  const replying = panel.querySelector('[data-discussion-replying]');
  const cancelReply = panel.querySelector('[data-discussion-cancel-reply]');
  const pageKey = panel.dataset.pageKey;
  let comments = [];
  let parentId = null;

  const setState = (message, type = 'info') => {
    state.textContent = message;
    state.dataset.type = type;
    if (auth.configured && !auth.user) {
      const link = document.createElement('a');
      link.href = auth.accountUrl || '/account/';
      link.textContent = '登录后参与讨论';
      state.append(link);
    }
  };

  const setReply = (comment = null) => {
    parentId = comment?.id || null;
    replying.hidden = !comment;
    cancelReply.hidden = !comment;
    replying.textContent = comment ? `正在回复 ${comment.profiles?.display_name || '用户'}` : '';
    body.placeholder = comment ? '写下你的回复...' : '友善交流，分享你的建议或问题...';
    if (comment) body.focus();
  };

  const actionButton = (label, action, className = '') => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.className = className;
    button.addEventListener('click', action);
    return button;
  };

  const mutateComment = async (comment, operation) => {
    if (operation === 'edit') {
      const nextBody = window.prompt('修改评论', comment.body);
      if (!nextBody || nextBody.trim() === comment.body || nextBody.trim().length > 2000) return;
      const { error } = await auth.client.from('comments').update({ body: nextBody.trim(), updated_at: new Date().toISOString() }).eq('id', comment.id);
      if (error) setState(`修改失败：${error.message}`, 'error');
    }
    if (operation === 'hide' || operation === 'restore') {
      const status = operation === 'hide' ? 'hidden' : 'visible';
      const { error } = await auth.client.from('comments').update({ status, updated_at: new Date().toISOString() }).eq('id', comment.id);
      if (error) setState(`审核失败：${error.message}`, 'error');
    }
    if (operation === 'delete') {
      if (!window.confirm('确定永久删除这条评论吗？')) return;
      const { error } = await auth.client.from('comments').delete().eq('id', comment.id);
      if (error) setState(`删除失败：${error.message}`, 'error');
    }
    await loadComments();
  };

  const renderComment = (comment, depth = 0) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.commentId = comment.id;
    node.style.setProperty('--comment-depth', String(Math.min(depth, 2)));
    node.querySelector('[data-comment-author]').textContent = comment.profiles?.display_name || '已验证用户';
    node.querySelector('[data-comment-time]').textContent = formatTime(comment.created_at);
    node.querySelector('[data-comment-time]').dateTime = comment.created_at;
    node.querySelector('[data-comment-body]').textContent = comment.body;
    const statusBadge = node.querySelector('[data-comment-status]');
    statusBadge.textContent = comment.status === 'hidden' ? '已隐藏' : '';
    statusBadge.hidden = comment.status !== 'hidden';

    const actions = node.querySelector('[data-comment-actions]');
    if (auth.user && comment.status === 'visible') actions.append(actionButton('回复', () => setReply(comment)));
    if (auth.user?.id === comment.author_id) actions.append(actionButton('编辑', () => mutateComment(comment, 'edit')));
    if (auth.isAdmin) {
      actions.append(actionButton(comment.status === 'hidden' ? '恢复' : '隐藏', () => mutateComment(comment, comment.status === 'hidden' ? 'restore' : 'hide')));
    }
    if (auth.isAdmin || auth.user?.id === comment.author_id) {
      actions.append(actionButton('删除', () => mutateComment(comment, 'delete'), 'is-danger'));
    }
    list.append(node);
    comments.filter((reply) => reply.parent_id === comment.id).forEach((reply) => renderComment(reply, depth + 1));
  };

  const renderComments = () => {
    list.replaceChildren();
    comments.filter((comment) => !comment.parent_id).forEach((comment) => renderComment(comment));
    setState(comments.length ? `共 ${comments.length} 条讨论` : '还没有评论，欢迎留下第一条建议。');
  };

  const loadComments = async () => {
    const { data, error } = await auth.client
      .from('comments')
      .select('id,parent_id,author_id,body,status,created_at,updated_at,profiles!comments_author_id_fkey(display_name,avatar_url)')
      .eq('page_key', pageKey)
      .order('created_at', { ascending: true });
    if (error) {
      setState(`讨论加载失败：${error.message}`, 'error');
      return;
    }
    comments = data || [];
    renderComments();
  };

  if (!auth.configured || !auth.client) {
    setState('讨论服务尚未配置，公开内容仍可正常阅读。', 'warning');
    return;
  }

  if (auth.user) {
    form.hidden = false;
  }

  body.addEventListener('input', () => { counter.textContent = `${body.value.length}/2000`; });
  cancelReply.addEventListener('click', () => setReply());
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = body.value.trim();
    if (!content || content.length > 2000) return;
    const submit = panel.querySelector('[data-discussion-submit]');
    submit.disabled = true;
    const { error } = await auth.client.from('comments').insert({
      page_key: pageKey,
      parent_id: parentId,
      author_id: auth.user.id,
      body: content,
      status: 'visible'
    });
    submit.disabled = false;
    if (error) {
      setState(`发布失败：${error.message}`, 'error');
      return;
    }
    body.value = '';
    counter.textContent = '0/2000';
    setReply();
    await loadComments();
  });

  await loadComments();
});
