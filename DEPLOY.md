# Hugo Blog 阿里云自动化部署指南

## 一、服务器初始化（在服务器上执行）

### 1. 连接服务器
```bash
ssh root@你的服务器IP
```

### 2. 更新系统并安装 Nginx
```bash
apt update && apt upgrade -y
apt install nginx -y
systemctl enable nginx
systemctl start nginx
```

### 3. 创建网站目录
```bash
mkdir -p /var/www/blog
chown -R www-data:www-data /var/www/blog
```

### 4. 创建部署用户（用于 GitHub Actions）
```bash
# 创建用户
useradd -m -s /bin/bash deploy

# 设置目录权限
chown -R deploy:deploy /var/www/blog

# 切换到 deploy 用户生成 SSH 密钥
su - deploy
ssh-keygen -t ed25519 -C "deploy@blog" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 复制私钥（稍后需要添加到 GitHub Secrets）
cat ~/.ssh/id_ed25519
exit
```

---

## 二、配置 Nginx

### 1. 创建站点配置
```bash
nano /etc/nginx/sites-available/blog
```

### 2. 粘贴以下内容：
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name jacksu.xyz www.jacksu.xyz;
    root /var/www/blog;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # 静态资源缓存
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

### 3. 启用站点
```bash
ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

---

## 三、配置 HTTPS（免费证书）

```bash
# 安装 Certbot
apt install certbot python3-certbot-nginx -y

# 申请证书（确保域名已解析到服务器）
certbot --nginx -d jacksu.xyz -d www.jacksu.xyz

# 自动续期测试
certbot renew --dry-run
```

---

## 四、配置 GitHub

### 1. 创建 GitHub 仓库
- 在 GitHub 创建新仓库，如 `my-blog`
- 设置为 Private（推荐）或 Public

### 2. 添加 Secrets
在仓库 Settings → Secrets and variables → Actions 添加：

| Name | Value |
|------|-------|
| `SERVER_HOST` | 你的服务器 IP |
| `SERVER_USER` | `deploy` |
| `SERVER_SSH_KEY` | 服务器上 deploy 用户的私钥内容 |

### 3. 推送代码
```bash
cd c:\Users\Administrator\Desktop\note\hugo\my-blog
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/my-blog.git
git push -u origin main
```

---

## 五、验证部署

1. 推送后查看 GitHub Actions 运行状态
2. 访问 https://jacksu.xyz 确认网站上线
3. 以后更新文章只需：
   ```bash
   git add .
   git commit -m "新文章"
   git push
   ```

---

## 常用命令

| 操作 | 命令 |
|------|------|
| 查看 Nginx 状态 | `systemctl status nginx` |
| 重载 Nginx 配置 | `systemctl reload nginx` |
| 查看网站目录 | `ls -la /var/www/blog` |
| 查看证书状态 | `certbot certificates` |
