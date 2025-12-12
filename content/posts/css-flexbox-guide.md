---
title: "CSS Flexbox 布局完全指南"
date: 2024-03-08
draft: false
description: "掌握 Flexbox 弹性盒子布局，轻松实现各种页面布局"
tags: ["CSS", "Flexbox", "前端", "教程"]
categories: ["技术"]
toc: true
---

Flexbox 是现代 CSS 布局的基石，能够轻松实现各种复杂布局。

## 基本概念

Flexbox 包含两个核心概念：
- **Flex 容器**：设置 `display: flex` 的父元素
- **Flex 项目**：容器内的子元素

```css
.container {
  display: flex;
}
```

## 容器属性

### flex-direction

定义主轴方向：

```css
.container {
  flex-direction: row;        /* 水平（默认） */
  flex-direction: column;     /* 垂直 */
  flex-direction: row-reverse;
  flex-direction: column-reverse;
}
```

### justify-content

主轴对齐方式：

```css
.container {
  justify-content: flex-start;   /* 起点对齐 */
  justify-content: flex-end;     /* 终点对齐 */
  justify-content: center;       /* 居中 */
  justify-content: space-between;/* 两端对齐 */
  justify-content: space-around; /* 均匀分布 */
}
```

### align-items

交叉轴对齐方式：

```css
.container {
  align-items: stretch;    /* 拉伸（默认） */
  align-items: flex-start; /* 顶部对齐 */
  align-items: center;     /* 居中 */
  align-items: flex-end;   /* 底部对齐 */
}
```

## 项目属性

### flex-grow

定义项目的放大比例：

```css
.item {
  flex-grow: 1; /* 平分剩余空间 */
}
```

### flex-shrink

定义项目的缩小比例：

```css
.item {
  flex-shrink: 0; /* 不缩小 */
}
```

---

掌握 Flexbox，布局将不再是难题！
