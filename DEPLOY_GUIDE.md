# MyLink.asia - Serverga Deploy Qilish Qo'llanmasi

Bu qo'llanma MyLink loyihasini Contabo VPS serverga deploy qilish uchun to'liq ko'rsatmalarni o'z ichiga oladi.

## 📋 Umumiy Ma'lumot

| Komponent | Texnologiya | URL |
|-----------|-------------|-----|
| Frontend | React + Nginx | `https://mylink.asia` |
| Backend API | Django + Gunicorn + Nginx | `https://api.mylink.asia` |
| Database | PostgreSQL | localhost:5432 |

---

## 1-QADAM: DNS SOZLAMALARI (Ahost)

Ahost paneliga kiring va quyidagi DNS yozuvlarini qo'shing:

| Turi | Nomi | Qiymati | TTL |
|------|------|---------|-----|
| A | @ | `SERVER_IP_MANZILINGIZ` | 3600 |
| A | api | `SERVER_IP_MANZILINGIZ` | 3600 |
| A | www | `SERVER_IP_MANZILINGIZ` | 3600 |

> ⚠️ `SERVER_IP_MANZILINGIZ` ni Contabo'dan olgan IP manzilingiz bilan almashtiring.

DNS tarqalishi 5-30 daqiqa vaqt olishi mumkin.

---

## 2-QADAM: SERVERGA SSH ORQALI KIRISH

Windows PowerShell yoki Terminal'da:

```bash
ssh root@SERVER_IP_MANZILINGIZ
```

Parolni kiriting.

---

## 3-QADAM: SERVERNI TAYYORLASH

Serverda quyidagi buyruqlarni ketma-ket bajaring:

### 3.1 Tizimni yangilash

```bash
apt update && apt upgrade -y
```

### 3.2 Kerakli dasturlarni o'rnatish

```bash
apt install -y python3 python3-pip python3-venv nginx postgresql postgresql-contrib git curl nodejs npm certbot python3-certbot-nginx
```

### 3.3 Node.js LTS versiyasini o'rnatish

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

---

## 4-QADAM: POSTGRESQL MA'LUMOTLAR BAZASINI SOZLASH

```bash
sudo -u postgres psql
```

PostgreSQL ichida quyidagi buyruqlarni bajaring:

```sql
CREATE DATABASE mylink_db;
CREATE USER mylink_user WITH PASSWORD 'KUCHLI_PAROL_TANLANG';
ALTER ROLE mylink_user SET client_encoding TO 'utf8';
ALTER ROLE mylink_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE mylink_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE mylink_db TO mylink_user;
\q
```

> ⚠️ `KUCHLI_PAROL_TANLANG` ni o'zingizning kuchli parolingiz bilan almashtiring!

---

## 5-QADAM: LOYIHA FAYLLARINI YUKLASH

### 5.1 Papka yaratish

```bash
mkdir -p /var/www
cd /var/www
```

### 5.2 Loyihani Git orqali klonlash (agar GitHub'da bo'lsa)

```bash
git clone https://github.com/USERNAME/MyLink.git mylink
```

**YOKI** loyihani WinSCP orqali yuklash:
- WinSCP dasturini yuklab oling: https://winscp.net/
- Serverga ulaning (IP, root, parol)
- `C:\Users\burxo\OneDrive\Documents\Py projects\MyLink` papkasini `/var/www/mylink` ga ko'chiring

---

## 6-QADAM: BACKEND SOZLAMALARI

### 6.1 Virtual muhit yaratish

```bash
cd /var/www/mylink/backend
python3 -m venv venv
source venv/bin/activate
```

### 6.2 Paketlarni o'rnatish

```bash
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn psycopg2-binary
```

### 6.3 .env faylini yaratish

```bash
nano .env
```

Quyidagilarni kiriting:

```env
# Django Settings
DEBUG=False
SECRET_KEY=juda-uzun-va-murakkab-kalit-yarating-123456789
ALLOWED_HOSTS=mylink.asia,api.mylink.asia,www.mylink.asia,SERVER_IP

# Database
DATABASE_URL=postgres://mylink_user:KUCHLI_PAROL_TANLANG@localhost:5432/mylink_db

# Eskiz SMS
ESKIZ_EMAIL=primqulovmurod@gmail.com
ESKIZ_PASSWORD=xxCF6dQerhFViDF00cuXU6YQE6hPpTEoD3grgeIA
```

Saqlash: `Ctrl+O`, `Enter`, `Ctrl+X`

### 6.4 Django settings.py faylini production uchun yangilash

Serverda `settings.py` faylini tahrirlang:

```bash
nano /var/www/mylink/backend/config/settings.py
```

Quyidagi o'zgarishlarni qiling:

```python
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Production settings
DEBUG = os.getenv('DEBUG', 'False') == 'True'
SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key')
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost').split(',')

# Database - PostgreSQL for production
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'mylink_db',
        'USER': 'mylink_user',
        'PASSWORD': os.getenv('burxon123!', 'burxon123!'),
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# CORS - production URLs
CORS_ALLOWED_ORIGINS = [
    "https://mylink.asia",
    "https://www.mylink.asia",
]
CORS_ALLOW_CREDENTIALS = True

# Security settings for HTTPS
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
CSRF_TRUSTED_ORIGINS = [
    'https://mylink.asia',
    'https://api.mylink.asia',
    'https://www.mylink.asia',
]
```

### 6.5 Migratsiyalarni bajarish

```bash
cd /var/www/mylink/backend
source venv/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

---

## 7-QADAM: GUNICORN SOZLAMALARI

### 7.1 Gunicorn service yaratish

```bash
nano /etc/systemd/system/gunicorn.service
```

Quyidagilarni kiriting:

```ini
[Unit]
Description=Gunicorn daemon for MyLink
After=network.target

[Service]
User=root
Group=www-data
WorkingDirectory=/var/www/mylink/backend
Environment="PATH=/var/www/mylink/backend/venv/bin"
ExecStart=/var/www/mylink/backend/venv/bin/gunicorn --access-logfile - --workers 3 --bind unix:/var/www/mylink/backend/gunicorn.sock config.wsgi:application

[Install]
WantedBy=multi-user.target
```

### 7.2 Gunicorn'ni ishga tushirish

```bash
systemctl start gunicorn
systemctl enable gunicorn
systemctl status gunicorn
```

---

## 8-QADAM: FRONTEND BUILD QILISH

### 8.1 API URL'ni o'zgartirish

```bash
nano /var/www/mylink/frontend/src/api.js
```

Quyidagicha o'zgartiring:

```javascript
import axios from 'axios';

const api = axios.create({
    baseURL: 'https://api.mylink.asia/api/',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Token ${token}`;
    }
    return config;
});

export default api;
```

### 8.2 Frontend'ni build qilish

```bash
cd /var/www/mylink/frontend
npm install
npm run build
```

Build natijasi `/var/www/mylink/frontend/dist` papkasida bo'ladi.

---

## 9-QADAM: NGINX SOZLAMALARI

### 9.1 Backend (API) uchun Nginx config

```bash
nano /etc/nginx/sites-available/api.mylink.asia
```

Quyidagilarni kiriting:

```nginx
server {
    listen 80;
    server_name api.mylink.asia;

    location = /favicon.ico { access_log off; log_not_found off; }
    
    location /static/ {
        alias /var/www/mylink/backend/staticfiles/;
    }
    
    location /media/ {
        alias /var/www/mylink/backend/media/;
    }

    location / {
        include proxy_params;
        proxy_pass http://unix:/var/www/mylink/backend/gunicorn.sock;
    }
}
```

### 9.2 Frontend uchun Nginx config

```bash
nano /etc/nginx/sites-available/mylink.asia
```

Quyidagilarni kiriting:

```nginx
server {
    listen 80;
    server_name mylink.asia www.mylink.asia;

    root /var/www/mylink/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 9.3 Nginx konfiguratsiyalarini yoqish

```bash
ln -s /etc/nginx/sites-available/api.mylink.asia /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/mylink.asia /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

---

## 10-QADAM: SSL SERTIFIKAT (HTTPS)

Let's Encrypt bilan bepul SSL sertifikat olish:

```bash
certbot --nginx -d mylink.asia -d www.mylink.asia -d api.mylink.asia
```

Email manzilingizni kiriting va shartlarga rozilik bildiring.

Sertifikat avtomatik yangilanishini tekshirish:

```bash
certbot renew --dry-run
```

---

## 11-QADAM: FIREWALL SOZLAMALARI

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

---

## ✅ TEKSHIRISH

1. **Frontend**: https://mylink.asia - Sayt ochilishi kerak
2. **Backend API**: https://api.mylink.asia/api/ - API javob berishi kerak
3. **Admin panel**: https://api.mylink.asia/admin/ - Admin panel ochilishi kerak

---

## 🔧 FOYDALI BUYRUQLAR

### Loglarni ko'rish

```bash
# Gunicorn loglari
journalctl -u gunicorn -f

# Nginx loglari
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### Xizmatlarni qayta ishga tushirish

```bash
systemctl restart gunicorn
systemctl restart nginx
```

### Django shell

```bash
cd /var/www/mylink/backend
source venv/bin/activate
python manage.py shell
```

---

## 📱 QOSHIMCHA: ESKIZ SMS TEST

Serverda SMS yuborishni test qilish:

```bash
cd /var/www/mylink/backend
source venv/bin/activate
python manage.py shell
```

```python
from users.utils import send_sms
send_sms("998943511910", "MyLink platformasiga kirish uchun tasdiqlash kodi: 12345")
```

---

## 🚨 MUAMMOLAR VA YECHIMLARI

### Gunicorn ishlamayapti

```bash
journalctl -u gunicorn -n 50
# Xatolikni o'qing va tuzating
systemctl restart gunicorn
```

### 502 Bad Gateway

```bash
# Gunicorn socket faylini tekshiring
ls -la /var/www/mylink/backend/gunicorn.sock
# Agar yo'q bo'lsa, gunicorn'ni qayta ishga tushiring
systemctl restart gunicorn
```

### Static fayllar ko'rinmayapti

```bash
cd /var/www/mylink/backend
source venv/bin/activate
python manage.py collectstatic --noinput
chown -R www-data:www-data /var/www/mylink/
```

---

Muvaffaqiyat! 🎉
