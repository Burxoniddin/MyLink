# MyLink.asia — Tekshirish ro'yxati (testplan)

> Soha bo'yicha tartiblangan, dublikatsiz. Ikki qism:
> - **A. Avto-tekshirilgan** — kod darajasida (117 avtotest + jonli API) tasdiqlangan. Qayta qo'lda tekshirish shart emas; xohlasangiz spot-check qiling.
> - **B. Qo'lda tekshirish** — vizual / UI / klik oqimlari (avtomatlashtirib bo'lmaydi). `[ ]` ni belgilab boring.
>
> Oxirgi yangilanish: 2026-06-16.

---

## 0. Tayyorgarlik (bir marta)

```powershell
# Backend (backend/)
git pull origin dev
.\env\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate            # businesses 0015–0017, billing 0005–0007
python manage.py createcachetable
python manage.py seed_demo          # DEBUG only; idempotent
python manage.py runserver          # http://127.0.0.1:8000

# Frontend (frontend/)
npm install
npm run dev                         # http://localhost:5173
```

**Akkauntlar** (sayt: email+parol · admin: telefon+parol):

| Rol | Email | Telefon | Parol |
|---|---|---|---|
| Admin | admin@mylink.asia | +998900000000 | `admin1234` |
| Free | free@mylink.asia | +998901111111 | `test1234` |
| Pro | pro@mylink.asia | +998902222222 | `test1234` |

**Promokodlar:** `TEST1` (Pro umrbod) · `PRO30` (Pro 30 kun) · `ODDIY1` (Oddiy umrbod) · `ONCE1` (1 martalik) · `OFF1` (faolsiz)

**Demo public sahifalar:** `/probiz1` restoran · `/probiz2` moda · `/probiz3` klinika · `/motorhub` avto · `/pulsegym` fitnes · `/freebiz` classic

---

## A. Avto-tekshirilgan ✅ (kod darajasida tasdiqlangan)

> Quyidagilar **117 backend avtotest + jonli API tekshiruvlari** bilan tasdiqlangan. Bular asosan backend mantiq/huquqlar — qo'lda qayta tekshirish shart emas.

```powershell
python manage.py test billing users businesses   # → 117 OK
npm run lint    # 0 error (faqat mount-only warning)
npm run build   # OK
```

- ✅ **Entitlement / tariflar:** free→Free, promokod→tier o'zgaradi; `branding_removed`/`verified` flaglari (Free=yo'q, Pro=bor); public sahifada egasining email/telefoni yashirin (PII).
- ✅ **Dinamik tariflar:** `/api/plans/` 3 tarifni qaytaradi; Plan funksiyasini tahrirlash darrov ta'sir qiladi; yangi tarif (rank bilan) eng kuchlisi g'olib; `is_default` bitta tarifda.
- ✅ **Faollik limiti / lock:** har tarif istalgancha biznes yaratadi (limitdan oshsa nofaol keladi); faollashtirish limitda rad; downgrade'da ortiqchalar bloklanadi; bloklangan public → 404.
- ✅ **QR / PDF / vizitka generatsiyasi:** tarif gate (Free yo'q / Oddiy PNG / Pro PNG+PDF+vizitka); vizitka kontaktlari (telefon/Telegram/Instagram linklardan); IG story rasm baytlari.
- ✅ **Media kontent (bloklar):** soni limiti, video faqat Pro, ≤50MB validatsiya.
- ✅ **Analitika:** tarif gate (Free yo'q / Oddiy 7 kun / Pro 30 kun + top havolalar); track endpoint.
- ✅ **Jamoa / rollar (4e):** owner/admin/editor/viewer huquqlari; pending taklif → ro'yxatdan o'tganda ulanadi; shared sahifa egasining tarifiga bog'liq; Free egasi → gate.
- ✅ **Referral:** do'st Pro olganda referrer'ga +1 oy; 1 do'st 1 marta; yillik cap.
- ✅ **NFC:** soni 1–1000 validatsiya; o'z buyurtmalari ro'yxati.
- ✅ **Register oldindan tekshiruv:** mavjud email/telefon + `mode=register` → 400 (kod yuborilmaydi).
- ✅ **CMS:** bo'sh body → public 404 (frontend "tez orada"); matnli → 200.

---

## B. Qo'lda tekshirish (UI / vizual)

### B1 · Til (i18n)
- [ ] Til almashtirgich UZ/RU/EN → matnlar darrov o'zgaradi; F5 dan keyin saqlanadi; standart UZ.

### B2 · Auth — kirish / ro'yxatdan o'tish
- [ ] **Dizayn:** Login/Register/Forgot/Reset — landing uslubidagi yangi dizayn; input/tugma/Google **bir xil normal balandlikda** (ingichka emas); chap rasm yo'q.
- [ ] **Email+parol:** ro'yxat (kod → parol) va kirish ishlaydi. **Telefon+OTP:** kod (DEBUG'da backend konsolida) → kirish.
- [ ] **Google bilan kirish** ishlaydi; ism Google'dan olinadi.
- [ ] **Register precheck (UI):** mavjud `free@mylink.asia` / `90 111 11 11` → "Kod yuborish" → **darrov xato** (kod kelmaydi); **yangi** email/telefon → kod keladi, 2-bosqichga o'tadi.
- [ ] **Ism familiya** maydoni (2-bosqich, majburiy) → keyin navbar'da ism ko'rinadi; Profil'da tahrirlanadi.
- [ ] 2-bosqichda kod/parol maydonlariga brauzer **avto-to'ldirmaydi**; parol **ko'zcha** toggle ishlaydi.
- [ ] **Parolni tiklash:** Forgot → kod → yangi parol → **avtomatik kiradi**.
- [ ] Logo (Login/Register/Forgot) bosilsa `/` ga qaytaradi.

### B3 · Landing (`/`)
- [ ] Marketing landing chiqadi (login emas); header **sticky**; faqat "Tizimga kirish" tugmasi.
- [ ] **Statistika:** faqat Foydalanuvchilar + Bizneslar — katta raqamlar, count-up animatsiya.
- [ ] **"Bizning mijozlar" karuseli:** demo bizneslar ko'rinadi (probiz1..pulsegym); cheksiz harakat; **hover'da to'xtaydi va karta to'liq ko'rinadi** (chegaraga kirib ketmaydi); bosilsa sahifa ochiladi.
- [ ] **Aloqa formasi:** ism + telefon + email; telefon YOKI email majburiy (ikkalasi bo'sh → toast xato) → yuborilsa toast "qabul qilindi".
- [ ] **Help tugmasi** (past-o'ng): yumaloq, ping animatsiya, hover'da yorliq; Telegram ochadi.
- [ ] **Footer + header** blog/about/privacy/terms sahifalarida ham bor; `/#about` menyusi ishlaydi.
- [ ] **Toast** xabarlar tepa-o'ngda, ~4s da yo'qoladi (Profil/Dashboard/saqlash/aloqa).

### B4 · Dashboard va biznes limiti
- [ ] Navbar'da **Profil** + joriy **tarif badge** (desktop + mobil).
- [ ] **Istalgan tarif istalgancha biznes yaratadi** — "Yangi qo'shish" hech qachon o'chmaydi.
- [ ] Limit to'lganda yangi sahifa **nofaol** keladi (toast ogohlantiradi); kartada **Faol/Nofaol switch**; limitda yoqishga urinish → **upgrade modal**.
- [ ] Nofaol sahifa public'da 404; "Ko'rish" o'chiq.
- [ ] **Qidiruv** (2+ biznesda): nom/path bo'yicha filter; topilmasa "topilmadi".

### B5 · Biznes muharriri
- [ ] **Yangi biznes wizard:** 1-qadam (path tekshiruvi + nom + tavsif + logo kvadrat-crop) → 2-qadam (chapda shablon + (classic'da) rang palitra, **o'ngda jonli telefon preview**) → "Yaratish" → muharrirga o'tadi; band path → 1-qadamga xato.
- [ ] **Tepa toolbar:** 📋 nusxa / 🔗 Ulashish / ↗ ko'rinish / ⭐ qadash. ⭐ → Dashboard'da tepaga + badge.
- [ ] **Ulashish menyusi:** Instagram Story / Havolani nusxalash / Boshqa ilovaga. **Story** → modalda 9:16 rasm (gradient, logo/bosh harf, nom, tavsif, "Sahifamni oching", QR+path, MyLink watermark); Saqlash → mobilda tizim ulashish, desktopda PNG yuklash + toast. **Free'da ham ishlaydi.**
- [ ] **QR / PDF modal:** Pro → PNG + **Vizitka (card.pdf)** + QR PDF yuklanadi. Vizitka 2 bet: *old* — logo/bosh harf + nom + **telefon / @telegram / @instagram** (rangli nuqtalar), *orqa* — QR panel + "Skanerlang". Oddiy → faqat PNG. Free → upsell.
- [ ] **Media kontent** tab (oldingi "Bloklar"): rasm/video/matn qo'shish + Saqlash + dnd tartiblash; **o'chirishda tasdiq oynasi** (bir marta). Public sahifada render (matn/rasm/video/YouTube). Oddiy 3 ta, video yo'q; Free upsell.
- [ ] **Shablonlar** (Sozlash tab): classic + 5 soha; tanlash → public o'zgaradi; har public'da light/dark toggle; hamma tarifga ochiq.
- [ ] **Avatar crop:** logo yuklash → kvadrat crop modali (pan/zoom) → kesilgan logo.
- [ ] **Rang palitra** (classic): default/ocean/forest/noir/rose/sunset; Free → 🔒 Pro; Oddiy/Pro ishlaydi; sektor shablonlar o'z rangida.

### B6 · Tariflar va to'lov
- [ ] **`/pricing`** — **`/api/plans/`** dan dinamik; joriy tarif yashil "Joriy tarifingiz"; "Promokod bilan faollashtirish" → Profil; "Onlayn to'lov tez orada" banner.
- [ ] **Promokod (Profil):** `test1` → "Tabriklaymiz" → badge Pro·umrbod; 2-marta → "allaqachon"; `XXX` → topilmadi; `OFF1` → faol emas; `PRO30` → sana gacha.
- [ ] **Dinamik tarif (admin) ⭐:** `/admin/` → Billing → **Tariflar (Plans)** → funksiyani yoqib saqlash (mas. Oddiy'ga `team`) → foydalanuvchida darrov ta'sir; **yangi tarif** (slug/rank/funksiyalar) qo'shsa → `/pricing` da chiqadi; PromoCode/Subscription/PlanPrice'da tarif **dropdown**.
- [ ] Admin → PromoCode ochilganda pastda **kim ishlatgani** (redemption) ko'rinadi.

### B7 · Jamoa / rollar
- [ ] Pro biznes → **Jamoa** tab (owner/admin). Mavjud foydalanuvchini taklif → darrov faol; akkauntsiz email → **"Kutilmoqda"**; u ro'yxatdan o'tgach avto-ulanadi.
- [ ] **Viewer** → sahifa rol badge bilan, faqat-ko'rish (Saqlash yo'q). **Editor** → tahrir, Jamoa tab yo'q, o'chira olmaydi. **Admin** → +Jamoa boshqaruvi, o'chira olmaydi. **Owner** → rol o'zgartirish + o'chirish.
- [ ] **Free egasi** Jamoa'da → upsell (Pro kerak).

### B8 · Analitika
- [ ] Pro → Navbar **Analitika** → biznes tanlash → kartalar + LineChart (view+click) + top havolalar. Oddiy → 7 kun, top yo'q. Free → upsell. (Public sahifada ko'rish/bosish/ulashish track bo'ladi.)

### B9 · Referral va NFC
- [ ] **Referral:** `/referral` → kod + havola + statistika; nusxa/ulashish; `?ref=` orqali kelgan do'st Pro olsa → referrer badge muddati uzayadi.
- [ ] **NFC:** `/nfc` → ariza forma → toast "qabul qilindi" + Buyurtmalarim tarixi (status badge).

### B10 · CMS (admin matni)
- [ ] Admin → Statik sahifa/Blog post — `title`/`body` endi **majburiy emas**, bo'sh saqlash mumkin.
- [ ] Bo'sh body sahifa → `/about` `/privacy` `/terms` / bo'sh `/blog` → **"Tez orada"** (admin matni yo'q).
- [ ] Blog **Tartib (order)** — kichik raqam birinchi chiqadi.

---

## Yakuniy
- [ ] 117 backend test yashil, lint 0 error, build OK (A bo'lim).
- [ ] Hech bir public sahifa konsolda xato bermaydi.
- [ ] ⚠️ Prod deploy oldidan: nginx `client_max_body_size 50M` + `pip install -r requirements.txt`.
