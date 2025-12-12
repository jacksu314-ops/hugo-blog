---
title: "JavaScript ES6 新特性详解"
date: 2024-06-15
draft: false
description: "深入了解 ES6 的箭头函数、解构赋值、Promise 等新特性"
tags: ["JavaScript", "ES6", "前端", "教程"]
categories: ["技术"]
toc: true
---

ES6（ECMAScript 2015）为 JavaScript 带来了许多激动人心的新特性。本文将详细介绍最常用的几个。

## 箭头函数

箭头函数是 ES6 中最受欢迎的特性之一：

```javascript
// 传统函数
const add = function(a, b) {
  return a + b;
};

// 箭头函数
const addArrow = (a, b) => a + b;
```

## 解构赋值

从数组或对象中提取值变得更加简洁：

```javascript
// 数组解构
const [first, second] = [1, 2];

// 对象解构
const { name, age } = { name: 'Alice', age: 25 };
```

## Promise

Promise 让异步编程更加优雅：

```javascript
const fetchData = () => {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve('数据加载完成'), 1000);
  });
};

fetchData().then(data => console.log(data));
```

## 模板字符串

使用反引号创建多行字符串和嵌入表达式：

```javascript
const name = 'World';
const greeting = `Hello, ${name}!
Welcome to ES6.`;
```

---

ES6 还有更多强大的特性，如 `class`、`let/const`、`Map/Set` 等，值得深入学习。
