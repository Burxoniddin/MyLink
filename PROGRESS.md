# MyLink.asia — Ish jurnali va davom ettirish qo'llanmasi (handoff)

> **Maqsad:** Ikki kompyuter o'rtasida ishni uzluksiz davom ettirish. Bu fayl `dev` branch'da turadi va git orqali sinxronlanadi.
> **Qoida:** Har ish seansidan so'ng pastdagi **§4 Holat** bo'limini yangilab, commit qilib qo'ying.

**Oxirgi yangilanish:** 2026-06-09 (2-faza tugadi: 2a toolbar/pin · 2b QR/PDF · 2c content bloklari · 2d analitika) · **Faol branch:** `dev` · **Repo:** https://github.com/Burxoniddin/MyLink (public)

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

### ✅ UX yaxshilanishlar (1b/1c'ni test qilib bo'ladigan qilish — oxirgi seans)
- [x] **Navbar → Profil** kirish nuqtasi + joriy **tarif badge** (desktop + mobil). Avval `/profile` route bor edi, lekin unga havola yo'q edi → promokod forma "yashirin" edi. Endi ochiq.
- [x] **`/pricing` jonlandi** — `Pricing.jsx` (ComingSoon o'rniga): landing'dagi 3 tarif kartochkasi, joriy tarif yashil "Joriy tarifingiz" bilan; "Sotib olish" o'rniga **"Promokod bilan faollashtirish" → Profil**; "💳 Onlayn to'lov (Click/Payme) tez orada" banneri (checkout 1a bilan keladi).
- [x] **Limit upgrade modal** — Dashboard'da limitga yetib "Yangi qo'shish"/"Faollashtirish" bosilganda inline xabar o'rniga **modal**: Tariflarni ko'rish / Promokod kiritish / Bekor qilish.
- [x] **Auth sahifa logosi** — Login/Register/Forgot'da MyLink logosi (forma ustida, chapda) → bosilsa landing'ga (`/`) qaytaradi. (Avval absolute edi → ko'k rasm ustiga tushib ko'rinmayotgandi; oddiy oqimga ko'chirildi.)
- [x] **Landing header** — faqat "Tizimga kirish" tugmasi (ortiqcha "Boshlash" olib tashlandi).

### ⏳ Navbatdagi ishlar (yo'l xaritasi tartibida)
- [ ] **1a · To'lov: Click + Payme** — ⏸️ *hozircha kechiktirildi (foydalanuvchi qarori)*. Merchant akkaunt kerak.
- [x] **1b · Promokod / lifetime** — `PromoCode`, `PromoRedemption`; `services.redeem_promo`/`grant_subscription`; `POST /api/promo/redeem/`; admin; Profile'da promokod formasi + joriy tarif (badge + muddat); `/api/me/` endi `entitlements.expires_at` qaytaradi. (Checkout chegirmasi 1a bilan keladi.)
- [x] **1c · Limitlarni qo'llash** — `Business.is_locked`; yaratishda `profile_limit` gate (403 + `reason`); `services.sync_locks` (downgrade'da eng yangilarni bloklaydi, eng eskini faol qoldiradi); toggle endpoint `POST /api/businesses/<path>/lock/` (faollashtirish limitdan oshsa rad); public sahifa bloklanganda 404; serializer `branding_removed`+`verified` flaglari; Dashboard'da N/limit + locked badge + faollashtir/o'chir; LandingPage'da branding yashirish + verified galochka. `/api/me/` `usage.active` qaytaradi.
- [x] **2a · Tepa toolbar** — `Business.is_pinned` (migration `businesses/0009`); `POST /api/businesses/<path>/pin/` toggle (tier gate yo'q); Dashboard ro'yxati `-is_pinned, -created_at` bo'yicha (qadalganlar tepada); serializer `is_pinned` (read-only); admin list+filter+editable. Frontend: BusinessDetail editor tepasida **toolbar** (Havoladan nusxa / Ulashish=Web Share API / Ko'rinish=public sahifa / Qadash=yulduzcha); Dashboard pinned kartochkada ⭐ badge. uz/ru/en. Testlar: +3 (jami 44 o'tadi).
- [x] **2b · QR + PDF** — `qrcode`+`reportlab` (requirements'ga qo'shildi). `businesses/qr.py`: QR PNG, A4 QR PDF, 85×55mm vizitka `card.pdf` (logo bo'lsa qo'shadi). Endpoint `GET /api/businesses/<path>/{qr.png,qr.pdf,card.pdf}` — owner-only, tarif gate (`qr`: none→403, png→PNG, full→hammasi). Frontend: editor toolbar'da **QR / PDF** tugma → modal (QR preview + yuklab olish; Oddiy'da PDF/vizitka 🔒Pro → /pricing; Free'da upsell). uz/ru/en. Testlar: +4 (jami 48 o'tadi).
- [x] **2c · Banner/content bloklari** — `ContentBlock` (rasm/video/matn, migration `0010`); CRUD endpointlar `GET/POST /api/businesses/<path>/blocks/`, `PATCH/DELETE /api/blocks/<id>/`, `POST .../blocks/reorder/`; tarif gate (`banners` soni + video uchun `banner_video`); video=embed YOKI fayl (≤50MB, serializer validatsiya). Public payload'da `content_blocks`. Frontend: `components/ContentBlocks.jsx` — yangi **Bloklar** tab (dnd, har blok uchun Saqlash/O'chirish, rasm/video upload, embed), Free→upsell; LandingPage'da render (matn/rasm/`<video>`/YouTube iframe). uz/ru/en. Testlar: +8 (jami 56 o'tadi). **Prod eslatma:** nginx `client_max_body_size 50M` kerak (50MB video upload uchun).
- [x] **2d · Analitika** — `Event` modeli (view/click/share/banner, migration `0011`, indexli) + read-only admin. Public `POST /api/track/` (auth yo'q, throttle 1000/soat, noma'lum/bloklangan path → 204 noop). Owner `GET /api/businesses/<path>/analytics/` — tarif gate (`analytics`: none→403, partial→7 kun, full→30 kun + top_links). Frontend: `recharts` o'rnatildi; `pages/Analytics.jsx` (`/analytics` endi ComingSoon emas) — biznes tanlash, totals kartalar, kunlik LineChart (view+click), top havolalar (Pro), Free→upsell. LandingPage: ko'rish (mount), link bosish, **Ulashish tugmasi** (Web Share API) track qiladi; `LinkButton` `onClick`. uz/ru/en. Testlar: +8 (jami 64 o'tadi).
- [ ] **3a · Shablonlar + ranglar + avatar** — `template` slug (5 yangi), `theme` JSON, `react-easy-crop` avatar
- [ ] **4a · Referral** — `ReferralCode`, `?ref=`; do'st Pro olganda +1 oy Pro (yiliga ≤12)
- [ ] **4b · NFC** — info sahifa + ariza (`NfcOrder`) + tarix; onlayn to'lovsiz (lead)
- [ ] **4c · Dashboard qidiruv + soni** — nom bo'yicha filter + "N/limit" indikator
- [ ] **4e · Biznes jamoa/rollar** — `BusinessMembership` (admin/editor/viewer); taklif; permissionlar

---

## 4.1 ✅ Tekshirilishi kerak — 1b/1c + 2-faza (2a–2d)

> Boshqa kompda: `git pull origin dev` → backend `pip install -r requirements.txt` + `python manage.py migrate` + `python manage.py createcachetable` → frontend `npm install`. **Test ma'lumotlari:** `python manage.py seed_demo` (faqat DEBUG; idempotent).

**Test akkauntlar** (sayt: parol tabida email+parol; admin: telefon+parol):
| Rol | Email | Telefon | Parol |
|---|---|---|---|
| Admin | admin@mylink.asia | +998900000000 | `admin1234` |
| Free | free@mylink.asia | +998901111111 | `test1234` |
| Pro | pro@mylink.asia | +998902222222 | `test1234` |

**Promokodlar:** `TEST1` (Pro umrbod), `PRO30` (Pro 30 kun), `ODDIY1` (Oddiy umrbod), `ONCE1` (1 martalik), `OFF1` (faolsiz).

**1b — Promokod / lifetime:**
- [ ] Profil → joriy tarif badge ko'rinadi (Free)
- [ ] `test1` (kichik harf/probel) → "Tabriklaymiz", badge **Pro · umrbod** ga o'zgaradi
- [ ] Xuddi shu kod 2-marta → "allaqachon ishlatgansiz"; `XXX` → "topilmadi"; `OFF1` → "faol emas"; `PRO30` → "Pro · <sana> gacha"
- [ ] Admin → Promokod ochilganda pastda **kim ishlatgani** (redemption) ko'rinadi

**1c — Limitlar:**
- [ ] Free user Dashboard → `1/1`, "Yangi qo'shish" o'chgan; bosilsa "limit to'ldi" xabari
- [ ] Pro user (`probiz1/2/3`) → admin'da uning **Obunasini Expired** qiling → Dashboard yangilang → `probiz1` faol, `probiz2/3` **Bloklangan**, indikator `1/1`
- [ ] Bloklanganda "Faollashtirish" → limit to'lgani uchun rad; avval faol bittasini "O'chirish" → keyin boshqasini "Faollashtirish" ishlaydi
- [ ] Public: `localhost:5173/freebiz` → "Powered by MyLink" **bor**; `localhost:5173/probiz1` → branding **yo'q** + nom yonida ✓ galochka; bloklangan biznes path → "Sahifa topilmadi" (404)

**UX (oldingi seans):** Navbar'da **Profil** + tarif badge; `/pricing` real sahifa; Dashboard limitda **upgrade modal**; Login/Register/Forgot'da logo → landing; landing header faqat "Tizimga kirish".

**2a — Toolbar + pin:** Pro user → biznes oching → tepada toolbar (📋 nusxa / 🔗 ulashish / ↗ ko'rinish / ⭐ qadash). ⭐ bosing → Dashboard'da tepaga ko'tariladi + ⭐ badge.

**2b — QR + PDF:** Pro → toolbar **QR / PDF** → modal'da PNG + PDF + Vizitka yuklab olish. Free → upsell. Oddiy (`ODDIY1` promo) → faqat PNG, PDF/vizitka 🔒Pro.

**2c — Content bloklari:** Pro → **Bloklar** tab → Rasm/Video/Matn qo'shing, tahrirlang, **Saqlash**, dnd tartiblang, o'chiring. Public sahifada ko'rinadi (matn/rasm/video/YouTube). Oddiy: 3 ta, video yo'q. Free: upsell.

**2d — Analitika:** Public sahifani oching (ko'rish track bo'ladi) → link bosing → **Ulashish** tugmasi. Pro → Navbar **Analitika** → biznes tanlang → kartalar + LineChart + top havolalar. Free → upsell. *(seed: `probiz1`da demo event'lar bor.)*

**Avtotestlar:** `python manage.py test billing users businesses` → **64 ta o'tishi kerak**. Frontend: `npm run lint` (0 error), `npm run build`. **Yangi deps:** backend `qrcode`+`reportlab`, frontend `recharts` → boshqa kompda `pip install -r requirements.txt` + `npm install` shart.

**Yangi endpointlar/migrationlar (2-faza):** `POST /businesses/<path>/pin/`, `{qr.png,qr.pdf,card.pdf}`, `blocks/` CRUD + `blocks/reorder/`, `POST /track/`, `GET /businesses/<path>/analytics/`; migrationlar `businesses/0009`(pin)`/0010`(blocks)`/0011`(event). Public payload → `content_blocks`; biznes → `is_pinned`.

**⚠️ Prod (deploy oldidan):** nginx `client_max_body_size 50M` (2c video upload uchun) + `requirements.txt` o'rnatish (qrcode/reportlab).

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
