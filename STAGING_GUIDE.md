# MyLink — Staging (dev.mylink.asia) o'rnatish qo'llanmasi

> Maqsad: mijoz testlashi uchun **dev branch**'dan alohida muhit. Prod bilan bir xil
> Contabo VPS'da, lekin **alohida papka / DB / media / service** — prod'ga tegmaydi.
>
> - Frontend: **https://dev.mylink.asia** (mijozga beriladigan havola)
> - Backend: **https://api-dev.mylink.asia** (+ `/admin/`)
> - Deploy: `dev` branch'ga har push → GitHub Actions avto-yangilaydi (`deploy-dev.yml`)
>
> Bir marta o'rnatiladi (~20–30 daqiqa). Keyin hammasi avtomatik.

---

## 0-QADAM: DNS (Cloudflare / domen panelida)

Ikkita **A-yozuv** qo'shing (prod bilan bir xil IP):

| Turi | Nomi | Qiymati |
|---|---|---|
| A | `dev` | `161.97.176.239` |
| A | `api-dev` | `161.97.176.239` |

> Cloudflare ishlatsangiz, certbot uchun dastlab proxy'ni **DNS only** (kulrang bulut) qiling.

---

## 1-QADAM: Kodni klonlash (serverda)

```bash
cd /var/www
git clone https://github.com/Burxoniddin/MyLink.git mylink-dev
cd mylink-dev
git checkout dev
```

## 2-QADAM: Backend muhiti

```bash
cd /var/www/mylink-dev/backend
python3 -m venv venv                # prod bilan bir xil nom: venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
```

### 2.1 `.env` — proddan nusxa olib, staging uchun moslash

```bash
cp /var/www/mylink/backend/.env /var/www/mylink-dev/backend/.env
nano /var/www/mylink-dev/backend/.env
```

O'zgartirishlar:

```
DEBUG=False
FRONTEND_URL=https://dev.mylink.asia
# DATABASE_URL qatorini O'CHIRING yoki komment qiling!
#   (bo'sh qolsa SQLite ishlatiladi — staging o'z alohida bazasida ishlaydi.
#    Qoldirsangiz mijoz test ma'lumotlari PROD bazaga yoziladi!)
```

Qolganlari (SECRET_KEY, **ESKIZ_EMAIL/ESKIZ_PASSWORD** — real SMS ketadi,
EMAIL_*, GOOGLE_CLIENT_ID) proddagidek qoladi.

> ⚠️ **Google login eslatmasi:** Google Cloud Console → OAuth client →
> Authorized JavaScript origins ga `https://dev.mylink.asia` qo'shing,
> aks holda staging'da Google tugmasi ishlamaydi.

### 2.2 Baza va statiklar

```bash
cd /var/www/mylink-dev/backend
source venv/bin/activate
python manage.py migrate
python manage.py createcachetable
python manage.py collectstatic --noinput
python manage.py createsuperuser
# Demo ma'lumotlar (test akkauntlar/promokodlar/shablon demolari) — ixtiyoriy:
DEBUG=True python manage.py seed_demo    # buyruq vaqtida DEBUG=True, .env o'zgarmaydi
deactivate
```

> `seed_demo` test parollari bilan akkauntlar yaratadi (admin1234/test1234) —
> staging tashqariga chiqqani uchun keyin admin parolini kuchliroq qilib qo'ying.

## 3-QADAM: Gunicorn service (alohida: `gunicorn-dev`)

```bash
nano /etc/systemd/system/gunicorn-dev.service
```

```ini
[Unit]
Description=Gunicorn daemon for MyLink STAGING (dev branch)
After=network.target

[Service]
User=root
Group=www-data
WorkingDirectory=/var/www/mylink-dev/backend
Environment="PATH=/var/www/mylink-dev/backend/venv/bin"
ExecStart=/var/www/mylink-dev/backend/venv/bin/gunicorn --access-logfile - --workers 2 --bind unix:/var/www/mylink-dev/backend/gunicorn.sock config.wsgi:application

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl start gunicorn-dev
systemctl enable gunicorn-dev
systemctl status gunicorn-dev
```

## 4-QADAM: Frontend build

```bash
cd /var/www/mylink-dev/frontend
npm install
npm run build
```

> `api.js` hostname bo'yicha o'zi tanlaydi: `dev.mylink.asia` → `api-dev.mylink.asia`.
> Hech narsani qo'lda o'zgartirish kerak emas.

## 5-QADAM: Nginx

### 5.1 Backend (api-dev)

```bash
nano /etc/nginx/sites-available/api-dev.mylink.asia
```

```nginx
server {
    listen 80;
    server_name api-dev.mylink.asia;

    client_max_body_size 50M;   # media/video upload (kontent bloklar)
    add_header X-Robots-Tag "noindex, nofollow" always;   # qidiruvga chiqmasin

    location = /favicon.ico { access_log off; log_not_found off; }

    location /static/ {
        alias /var/www/mylink-dev/backend/staticfiles/;
    }

    location /media/ {
        alias /var/www/mylink-dev/backend/media/;
    }

    location / {
        include proxy_params;
        proxy_pass http://unix:/var/www/mylink-dev/backend/gunicorn.sock;
    }
}
```

### 5.2 Frontend (dev)

```bash
nano /etc/nginx/sites-available/dev.mylink.asia
```

```nginx
server {
    listen 80;
    server_name dev.mylink.asia;

    root /var/www/mylink-dev/frontend/dist;
    index index.html;

    add_header X-Robots-Tag "noindex, nofollow" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1h;
        add_header Cache-Control "public";
    }
}
```

> Staging'da JS/CSS kesh 1 soat (prod'dagi 1 yil emas) — mijoz har deploy'dan
> keyin yangi versiyani tez ko'rsin.

### 5.3 Yoqish + SSL

```bash
ln -s /etc/nginx/sites-available/api-dev.mylink.asia /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/dev.mylink.asia /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

certbot --nginx -d dev.mylink.asia -d api-dev.mylink.asia
```

## 6-QADAM: Tekshirish

```bash
curl -s https://api-dev.mylink.asia/api/public/stats/     # → JSON
```

Brauzerda:
- `https://dev.mylink.asia` — sayt ochiladi, ro'yxatdan o'tish/kirish ishlaydi
- `https://api-dev.mylink.asia/admin/` — adminka
- DevTools → Network: so'rovlar **api-dev**.mylink.asia'ga ketayotganini tasdiqlang
  (api.mylink.asia'ga EMAS — bu prod!)

## 7-QADAM: Avto-deploy

Hech narsa sozlash shart emas — `deploy-dev.yml` prod bilan **bir xil GitHub
secrets**'lardan foydalanadi (bir xil server). `dev`'ga keyingi push'dan boshlab
avtomatik ishlaydi. Holat: GitHub → Actions → "Deploy to Staging (dev)".

---

## Kundalik oqim

```
kod → git push origin dev → (avto) dev.mylink.asia yangilanadi → mijoz testlaydi
                                      ↓ test OK
                        dev → main merge → (avto) PROD deploy
```

## Staging'ni o'chirish (test tugagach, ixtiyoriy)

```bash
systemctl disable --now gunicorn-dev
rm /etc/nginx/sites-enabled/dev.mylink.asia /etc/nginx/sites-enabled/api-dev.mylink.asia
nginx -t && systemctl reload nginx
# xohlasangiz: rm -rf /var/www/mylink-dev  va DNS A-yozuvlarni o'chiring
```
