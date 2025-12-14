---
title: "Hello World - 博客搭建全攻略"
date: 2025-12-10T23:38:28+08:00
draft: false
description: "欢迎来到我的博客！本文详细介绍网站技术栈与搭建教程。"
tags: ["博客", "Hugo", "教程", "入门"]
categories: ["教程"]
toc: true
featured: true
---

欢迎来到我的博客！👋 这是我的第一篇文章，也是一份完整的博客搭建指南。

## 🛠️ 技术栈

本博客采用现代化的静态网站技术栈：

| 技术 | 说明 |
|------|------|
| **Hugo** | 超快的静态网站生成器，Go 语言编写 |
| **Paper 主题** | 简洁优雅的 Hugo 主题 |
| **GitHub Actions** | 自动化构建和部署 |
| **阿里云轻量服务器** | 托管静态文件 |
| **Nginx** | Web 服务器 |
| **Let's Encrypt** | 免费 HTTPS 证书 |
| **Giscus** | 基于 GitHub Discussions 的评论系统 |
| **Fuse.js** | 客户端模糊搜索 |

## 🚀 快速开始

### 1. 安装 Hugo

**Windows (使用 Scoop)：**
```bash
scoop install hugo-extended
```

**macOS：**
```bash
brew install hugo
```

**验证安装：**
```bash
hugo version
```

### 2. 创建网站

```bash
# 创建新站点
hugo new site my-blog
cd my-blog

# 添加 Paper 主题
git init
git submodule add https://github.com/nanxiaobei/hugo-paper themes/paper
```

### 3. 配置主题

编辑 `hugo.toml`：

```toml
baseURL = 'https://your-domain.com/'
languageCode = 'zh-cn'
title = '我的博客'
theme = 'paper'

[params]
  color = 'linen'
  avatar = 'https://example.com/avatar.jpg'
  name = 'Your Name'
  bio = 'Your bio here.'
```

### 4. 创建文章

```bash
hugo new posts/my-first-post.md
```

编辑生成的 Markdown 文件，添加内容。

### 5. 本地预览

```bash
hugo server -D
```

访问 http://localhost:1313 查看效果。

## 🎨 功能特色

本博客已实现的功能：

- ✅ **文章搜索** - 基于 Fuse.js 的模糊搜索
- ✅ **阅读进度条** - 顶部显示阅读进度
- ✅ **返回顶部** - 一键回到页面顶部
- ✅ **相关文章** - 基于标签智能推荐
- ✅ **日历热力图** - GitHub 风格的发文统计
- ✅ **归档时间线** - 按年月分组的文章归档
- ✅ **项目展示** - 卡片式项目作品集
- ✅ **评论系统** - Giscus 评论
- ✅ **深色模式** - 自动适配系统主题
- ✅ **RSS 订阅** - 支持 RSS 阅读器
- ✅ **移动端适配** - 响应式设计

## 📦 部署上线

### 方式一：GitHub Pages（免费）

1. 创建 GitHub 仓库
2. 添加 GitHub Actions 工作流
3. 推送代码自动部署

### 方式二：自有服务器

1. 购买云服务器（阿里云、腾讯云等）
2. 安装配置 Nginx
3. 配置 GitHub Actions 自动部署
4. 绑定域名并申请 HTTPS 证书

## 📝 写作建议

### Front Matter 模板

```yaml
---
title: "文章标题"
date: 2024-12-12
draft: false
description: "文章描述"
tags: ["标签1", "标签2"]
categories: ["分类"]
toc: true
---
```

### Markdown 技巧

- 使用 `##` 创建目录结构
- 用代码块展示代码
- 善用表格整理信息
- 添加 emoji 增加趣味 🎉

## 🔗 相关资源

- [Hugo 官方文档](https://gohugo.io/documentation/)
- [Paper 主题](https://github.com/nanxiaobei/hugo-paper)
- [Markdown 语法指南](https://www.markdownguide.org/)
- [Giscus 评论系统](https://giscus.app/)

---

感谢阅读！如果这篇文章对你有帮助，欢迎在下方评论交流 💬
