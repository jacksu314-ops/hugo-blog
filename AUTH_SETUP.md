# Supabase 认证上线清单

网站代码已支持 Supabase Auth、邮箱验证码、GitHub OAuth、站内讨论和管理员学习记录。未完成以下配置前，网站会安全降级为公开只读。

## 1. 创建项目与数据库

1. 在 Supabase 创建项目。
2. 打开 SQL Editor，执行 `supabase/migrations/001_auth_discussion_study.sql`。
3. 在 Authentication > Providers 中启用 Email，并保持用户注册开启。
4. 邮箱模板使用 OTP token，例如 `验证码：{{ .Token }}`。

## 2. 配置回调地址

Authentication > URL Configuration：

- Site URL：`https://jacksu314-ops.github.io/hugo-blog/`
- Redirect URL：`https://jacksu314-ops.github.io/hugo-blog/auth/callback/`
- 本地 Redirect URL：`http://localhost:1313/auth/callback/`

生产环境使用精确地址，不使用宽泛通配符。

## 3. 配置 GitHub 管理员登录

1. 在 GitHub Settings > Developer settings > OAuth Apps 创建 OAuth App。
2. Homepage URL 使用 GitHub Pages 站点地址。
3. Authorization callback URL 使用 Supabase GitHub Provider 页面显示的 callback URL，格式为 `https://<project-ref>.supabase.co/auth/v1/callback`。
4. 将 GitHub Client ID 和 Client Secret 填入 Supabase Authentication > Providers > GitHub。Secret 只保存在 Supabase。

首次使用 `jacksu314-ops` 登录后，在 Authentication > Users 复制该用户 UUID，然后执行：

```sql
update public.user_roles
set role = 'admin'
where user_id = '<你的 Supabase 用户 UUID>';
```

退出网站并重新登录，导航栏应显示“管理员”。不要按用户名或首位登录者自动授权。

## 4. 配置 Gmail SMTP

1. Gmail 账户开启两步验证并创建应用专用密码。
2. Supabase Authentication > Emails > SMTP Settings：
   - Host：`smtp.gmail.com`
   - Port：`587`
   - Username：完整 Gmail 地址
   - Password：应用专用密码
   - Sender email：同一 Gmail 地址
3. 调整 Auth 邮件发送频率，并分别测试正常收件箱和垃圾邮件目录。

Gmail 应用密码不得提交到仓库，也不得写入 GitHub Pages 构建变量。

## 5. 配置 GitHub Actions Variables

仓库 Settings > Secrets and variables > Actions > Variables 新增：

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Project Settings > API 中的 Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Project Settings > API 中的 publishable key |

这两个值用于浏览器客户端，可以公开；绝不能使用 `service_role` key。推送或手动重跑 Pages 工作流后生效。

## 6. 验收

1. 未登录访问文章、项目和学习页，确认可阅读但无私人输入框。
2. 用普通邮箱收取验证码，登录后发表评论并只能编辑自己的评论。
3. 用 GitHub 登录并完成管理员授权，确认学习打卡、周复盘和评论审核按钮出现。
4. 在账户页执行一次本地学习记录导入；导入成功后刷新学习页检查云端数据。
5. 在另一个浏览器登录管理员账户，确认学习记录跨设备同步。
