---
title: "我如何用 Hugo + Supabase 搭建自己的个人数字花园"
date: 2026-07-12T07:30:00+08:00
description: "在 GitHub Pages 静态站点上接入 Supabase Auth、RLS、评论和管理员学习记录的真实实现与安全边界。"
tags: ["Hugo", "Supabase", "GitHub Pages", "OAuth", "RLS"]
categories: ["编程实践"]
draft: false
---

我希望博客不只是一组文章，还能承载工程项目、长期学习、讨论和私人复盘。但 GitHub Pages 只能托管静态文件，评论、登录和跨设备数据都需要后端能力。

最后采用的组合是：**Hugo 负责内容，GitHub Actions 负责构建，GitHub Pages 负责分发，Supabase 负责身份、数据库和行级权限。**

## 1. 为什么保留静态站点

Hugo 把 Markdown 在构建阶段生成 HTML。公开文章不依赖数据库，Supabase 暂时不可用时仍可阅读，也没有需要维护的常驻 Web 服务器。

{{< mermaid >}}
flowchart LR
  A[Markdown 与 Hugo] --> B[GitHub Actions]
  B --> C[GitHub Pages]
  D[浏览器] --> C
  D --> E[Supabase Auth]
  D --> F[PostgreSQL + RLS]
  E --> F
{{< /mermaid >}}

动态能力是增强层，不是公开阅读的前置条件。这条边界让网站具备较好的降级能力。

## 2. GitHub Pages 子路径是第一个坑

项目站点地址包含 `/hugo-blog/`。导航、静态资源和 OAuth 回调如果写成根路径 `/account/`，部署后就可能跳到错误位置。我让 Hugo 根据 `baseURL` 生成链接，并在 Supabase 中同时登记精确的生产回调地址和 localhost 回调地址。

生产配置中的 Supabase Project URL 和 publishable key 由 GitHub Actions Repository Variables 注入。publishable key 本来就会出现在浏览器中，安全性不能依赖隐藏它；真正的秘密，如 `service_role`、GitHub Client Secret 和 SMTP 密码，绝不能进入仓库或构建产物。

## 3. 登录与角色不是同一件事

站点支持邮箱验证码和 GitHub OAuth。完成登录只证明用户身份有效，并不自动获得管理员权限。

数据库中单独维护 `user_roles` 表，角色只有 `member` 和 `admin`。我的 GitHub 账户首次登录后，也需要通过 SQL 将对应 UUID 手动授权为管理员。这样不会因为用户名相似、登录顺序或客户端参数而错误提权。

页面加载时，所有私人控件默认隐藏。浏览器恢复会话并查询角色后，管理员打卡、周复盘和审核按钮才出现。**隐藏按钮只是体验，RLS 才是权限边界。**

## 4. RLS 保护了什么

数据库包含 `profiles`、`user_roles`、`comments`、`study_days` 和 `weekly_reviews`。每张表都启用 Row Level Security：

| 数据 | 访客 | 验证用户 | 管理员 |
| --- | --- | --- | --- |
| 公开文章与可见评论 | 读取 | 读取 | 读取 |
| 自己的评论 | - | 新增、编辑、删除 | 审核 |
| 用户角色 | - | 只读自己的结果 | 受控管理 |
| 学习记录与周复盘 | - | 无权访问 | 读写 |

评论正文限制长度并按纯文本渲染，避免将用户输入直接作为 HTML 注入。所有权判断使用数据库中的 `auth.uid()`，而不是相信浏览器提交的作者 ID。

## 5. 静态页面如何获得实时状态

浏览器端脚本监听 Supabase 会话变化，并派发统一的站内认证事件。导航、账户页、讨论区和学习中心订阅同一状态源，避免每个组件各自猜测用户是否登录。

这里遇到过一个真实问题：刷新后，学习页先按访客状态渲染；稍后管理员角色恢复，但旧的异步渲染又覆盖了管理员界面。修复方式是提前注册认证监听器，并给每次渲染增加代次标记，让过期任务不能覆盖新状态。

## 6. 本地数据如何迁移到云端

旧版打卡存储在 `localStorage`。管理员首次登录时，迁移向导扫描 `study-check-*` 和 `study-week-review-*`，确认后批量 upsert 到 Supabase。只有所有记录成功后才写迁移标记，本地原始数据暂不删除。

这种策略能处理重复执行和中途失败，也给人工核对留下回退空间。云端保存后，同一管理员在不同设备上看到的是同一份记录。

## 7. 这套架构的边界

它适合以公开内容为主、动态数据规模较小的个人站点。若将来需要复杂的全文审核、付费权限、大量实时协作或服务端保密计算，就应该增加独立 API，而不是继续把所有逻辑塞进浏览器。

数字花园最重要的不是技术栈数量，而是边界清楚：文章永远可读，身份可以恢复，私人数据由数据库策略保护，后端失效时页面能够诚实地退回只读状态。
