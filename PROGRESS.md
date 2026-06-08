# MyLink.asia — Ish jurnali va davom ettirish qo'llanmasi (handoff)

> **Maqsad:** Ikki kompyuter o'rtasida ishni uzluksiz davom ettirish. Bu fayl `dev` branch'da turadi va git orqali sinxronlanadi.
> **Qoida:** Har ish seansidan so'ng pastdagi **§4 Holat** bo'limini yangilab, commit qilib qo'ying.

**Oxirgi yangilanish:** 2026-06-08 · **Faol branch:** `dev` · **Repo:** https://github.com/Burxoniddin/MyLink (public)

---

## 1. Tez sinxronlash (har kundalik)

**Kompyuter A da — ishni tugatib, yuborish:**
```bash
git add -A
git commit -m "qisqa izoh"
git push origin dev
```

**Kompyuter B da — ishni boshlashdan oldin, olish:**
```bash
git checkout dev
git pull origin dev
```

> ⚠️ **`main` ga HECH QACHON push qilmang** — bu prodga avtomatik deploy qiladi (`.github/workflows/deploy.yml`). Barcha ish `dev` da boradi. Faza tayyor bo'lganda `main` ga ataylab merge qilamiz (= bitta deploy).

> 💡 `.env` fayllar git'da **yo'q** (sir). Ular ikkala kompyuterda alohida turadi — §3 ga qarang. Ya'ni kod sinxron bo'ladi, sirlar esa qo'lda ko'chiriladi (bir marta).

---

## 2. Birinchi marta kompyuter B ni sozlash

```powershell
# 1) Klonlash (agar repo yo'q bo'lsa)
git clone https://github.com/Burxoniddin/MyLink.git
cd MyLink
git checkout dev

# 2) Backend (Windows, PowerShell)
cd backend
py -3.14 -m venv env                 # Python 3.14 SHART (3.11 ishlamaydi)
.\env\Scripts\Activate.ps1
pip install -r requirements.txt
#  >>> backend\.env faylini yarating (§3) <<<
python manage.py migrate
python manage.py createcachetable    # OTP/rate-limit DB cache uchun shart
python manage.py createsuperuser
python manage.py runserver           # http://127.0.0.1:8000

# 3) Frontend (yangi terminal)
cd frontend
npm install
#  >>> frontend\.env faylini yarating (§3) <<<
npm run dev                          # http://localhost:5173
```

---

## 3. `.env` fayllar (git'da YO'Q — qo'lda ko'chiring)

> ⚠️ Repo **public** — sirlar bu yerga yozilmaydi. Haqiqiy qiymatlarni **kompyuter A dan xavfsiz** ko'chiring (USB, parol menejeri yoki o'zingizga shifrlangan xabar). `<...>` joylarini to'ldiring.

**`backend/.env`:**
```
DEBUG=True
SECRET_KEY=<kompyuter A dagi qiymat>
# DATABASE_URL=postgres://...        # bo'sh qoldirilsa SQLite ishlatiladi
ESKIZ_EMAIL=<eskiz login>
ESKIZ_PASSWORD=<eskiz parol>
GOOGLE_CLIENT_ID=<google oauth client id>
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
EMAIL_HOST_USER=<gmail manzil>
EMAIL_HOST_PASSWORD=<gmail APP password — 16 belgi, oddiy parol emas>
DEFAULT_FROM_EMAIL=MyLink <gmail manzil>
FRONTEND_URL=http://localhost:5173
TOKEN_EXPIRE_DAYS=7
```

**`frontend/.env`:**
```
VITE_GOOGLE_CLIENT_ID=<google oauth client id — backend bilan bir xil>
```

> Eslatma: Vite `.env` ni faqat **ishga tushganda** o'qiydi — o'zgartirsangiz `npm run dev` ni qayta ishga tushiring.
> Telegram bot token va chat id `.env` da emas — ular **adminka → SiteSettings** da saqlanadi (DB), shuning uchun ikkala kompyuterda bir xil DB bo'lmasa, qayta kiritiladi.

---

## 4. Holat (DONE / TODO) — ⬅️ shu bo'limni yangilab boring

### ✅ Bajarilgan — Phase 0 (poydevor) + qo'shimchalar
- [x] **0a · i18n** — `i18next`/`react-i18next`, `src/locales/{uz,ru,en}/translation.json`, `<LanguageSwitcher>`, til `localStorage['mylink-lang']` (default uz)
- [x] **0b · Auth + sessiya** — email/parol + telefon/OTP + Google login; 7-kunlik sliding token (`users/auth.ExpiringTokenAuthentication`); kod orqali parol tiklash → **avto-login**; `PasswordInput` ko'zcha-toggle
- [x] **0c · Entitlement engine** — `billing` app: `PlanPrice`, `Subscription`, `entitlements.FEATURES` matritsa, `services.effective_tier/get_entitlements`; `GET /api/me/` flaglarni qaytaradi; frontend `EntitlementContext`
- [x] **0d · Landing** — `HomePage` (kirish nuqtasi `/`), variant-c dizayn, real statistika
- [x] **Statistika** — public `businesses/links/users` sonlari landing'da
- [x] **SiteSettings** — adminkadan kontakt/telegram sozlamalari + public endpoint
- [x] **Aloqa (Contact)** — forma → backend → **Telegram guruhga forward** + adminka; userga "qabul qilindi" xabari
- [x] **CMS sahifalar** — About/Blog/Privacy/Terms (`StaticPage`/`BlogPost`, adminkadan)
- [x] **Help CTA** — past-o'ng burchakda Telegram tugmasi (jivo uslubida)

### ⏳ Navbatdagi ishlar (yo'l xaritasi tartibida)
- [ ] **1a · To'lov: Click + Payme** — ⏸️ *hozircha kechiktirildi (foydalanuvchi qarori)*. Merchant akkaunt kerak.
- [ ] **1b · Promokod / lifetime** — `PromoCode`, `PromoRedemption`; checkout'da chegirma; lifetime-free grant
- [ ] **1c · Limitlarni qo'llash** — `profile_limit` tekshiruvi; `Business.is_locked` (downgrade'da egasi N tani tanlaydi); branding olib tashlash; verified galochka
- [ ] **2a · Tepa toolbar** — copy / share / preview / star (`is_pinned`)
- [ ] **2b · QR + PDF** — `qrcode`/`reportlab`: `qr.png` (Oddiy), `qr.pdf` + vizitka `card.pdf` (Pro)
- [ ] **2c · Banner/content bloklari** — `ContentBlock` (rasm/video/matn); video = embed + fayl yuklash (≤50MB); dnd tartiblash
- [ ] **2d · Analitika** — `Event` (view/click/share/banner); `POST /api/track/`; `recharts` grafiklar; landing stats shunga ulanadi
- [ ] **3a · Shablonlar + ranglar + avatar** — `template` slug (5 yangi), `theme` JSON, `react-easy-crop` avatar
- [ ] **4a · Referral** — `ReferralCode`, `?ref=`; do'st Pro olganda +1 oy Pro (yiliga ≤12)
- [ ] **4b · NFC** — info sahifa + ariza (`NfcOrder`) + tarix; onlayn to'lovsiz (lead)
- [ ] **4c · Dashboard qidiruv + soni** — nom bo'yicha filter + "N/limit" indikator
- [ ] **4e · Biznes jamoa/rollar** — `BusinessMembership` (admin/editor/viewer); taklif; permissionlar

---

## 5. Muhim qarorlar (locked — o'zgartirilmaydi)

| Mavzu | Qaror |
|---|---|
| To'lov | **Qo'lda yangilash** (recurring yo'q), muddat tugashidan oldin eslatma |
| Rollar | **Biznes bo'yicha jamoa**: admin / editor / viewer |
| Auth | **Parol ixtiyoriy + OTP qoladi** (eski userlar uzilmaydi) |
| Downgrade | Ortiqcha sahifalar **bloklanadi**, egasi qaysini faol qoldirishni tanlaydi |
| Video | **Embed + fayl yuklash** (≤50MB) |
| Landing | `mylink.asia` → avval landing; "Boshlash" → login/register |
| Django | **6.0.6 ga pin** (Python 3.14 uchun; 5.2 ishlamaydi) |

### Tarif/feature matritsasi (entitlement asosi)
| flag | Free | Oddiy (19k, 1 martalik) | Pro (39k/oy · 179k/6oy · 299k/yil) |
|---|---|---|---|
| profile_limit | 1 | 5 | 20 |
| templates | 1 | 3 | 6 (barchasi) |
| color_edit | ✗ | ✓ | ✓ |
| banners | ✗ | rasm×3 | rasm+video×10 |
| analytics | ✗ | qisman | to'liq |
| qr_vizitka | ✗ | PNG | PNG+PDF+vizitka |
| branding_removed | ✗ | ✓ | ✓ |
| verified_badge | ✗ | ✗ | ✓ |

---

## 6. Muhit (environment) — diqqat
- **Python 3.14.4** majburiy (`py -3.14`). Eski `backend/env` venv boshqa mashinada (Python 3.11) yaratilgan edi — **buzilgan**, qayta yarating.
- **Django 6.0.6** (5.2 → 3.14 da ishlamaydi). Jazzmin uchun 5.2 patch `config/jazzmin_patch.py` da, 6.0 da ham yuklanadi.
- Dev DB = **SQLite** (DATABASE_URL bo'sh bo'lsa). Cache = **DatabaseCache** → `createcachetable` shart. Testlarda LocMemCache (override).
- Faollashtirmasdan ishlatish: `& '.\env\Scripts\python.exe' manage.py <cmd>`

## 7. Git qoidalari va konventsiyalar
- **Branch:** ish `dev` da. `main` = prod (push = deploy). Kelajak fazalar → alohida branch → `dev`/`main` ga merge.
- **Git'ga tushmaydi** (gitignore/ataylab): `.env`/`*.env`, `backend/env/` (venv), `db.sqlite3`, `media/`, `node_modules/`, hamda biznes hujjatlar `MyLink-Scope-Taklif.md` / `MyLink-Tijoriy-Taklif.xlsx` (public repo uchun chetda).
- **Lint:** 0 xato shart. Mount-only `useEffect([])` ogohlantirishlari — mavjud pattern, qabul qilinadi.
- **Test:** `python manage.py test users billing` — yangi auth/entitlement testlari shu yerda.
- **O'lik fayllar** (qurmang): `frontend/src/layouts/MainLayout.jsx`, `pages/BusinessEditor.jsx`, `pages/BusinessPreview.jsx` — route qilinmagan.
- **Windows:** `git add` da `LF→CRLF` ogohlantirishi — zararsiz (repo LF saqlaydi).

---

## 8. Tezkor havolalar
- Repo: https://github.com/Burxoniddin/MyLink · Branch: https://github.com/Burxoniddin/MyLink/tree/dev
- PR ochish (xohlasangiz): https://github.com/Burxoniddin/MyLink/pull/new/dev
- Prod: https://mylink.asia · API: https://api.mylink.asia/api/ · Adminka: `/admin/`
