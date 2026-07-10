---
title: "Git 常用命令速查表"
date: 2024-04-10
draft: false
description: "开发者必备的 Git 命令速查手册"
tags: ["Git", "工具", "教程"]
categories: ["工具"]
toc: true
---

Git 是现代开发者必备的版本控制工具。这里整理了最常用的命令。

## 基础配置

```bash
# 设置用户名
git config --global user.name "Your Name"

# 设置邮箱
git config --global user.email "your@email.com"
```

## 仓库操作

```bash
# 初始化仓库
git init

# 克隆仓库
git clone <url>
```

## 日常操作

```bash
# 查看状态
git status

# 添加文件
git add <file>
git add .  # 添加所有

# 提交
git commit -m "commit message"

# 推送
git push origin main
```

## 分支操作

```bash
# 查看分支
git branch

# 创建分支
git branch <name>

# 切换分支
git checkout <name>

# 创建并切换
git checkout -b <name>

# 合并分支
git merge <branch>
```

## 撤销操作

```bash
# 撤销工作区修改
git checkout -- <file>

# 撤销暂存
git reset HEAD <file>

# 回退提交
git reset --hard HEAD~1
```

---

熟练掌握这些命令，Git 操作将变得得心应手！
