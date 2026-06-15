# MyLink.asia — To'liq qo'lda tekshirish ro'yxati (roadmap testcase)

> Maqsad: butun yo'l xaritasini (Phase 0 → 4e) bosqichma-bosqich tekshirish.
> Har bandni bajarib `[x]` belgilang. Kutilgan natija **→** dan keyin yozilgan.

---

## 0. Tayyorgarlik (bir marta)

```powershell
# Backend (backend/ ichida)
git pull origin dev
.\env\Scripts\Activate.ps1
pip install -r requirements.txt          # yangi: qrcode, reportlab, recharts emas (u frontend)
python manage.py migrate                 # 0015 jamoa migratsiyasi qo'llanadi
python manage.py createcachetable        # OTP/limit DB cache
python manage.py seed_demo               # faqat DEBUG; demo ma'lumot (idempotent)
python manage.py runserver               # http://127.0.0.1:8000

# Frontend (yangi terminal, frontend/ ichida)
npm install                              # yangi deps bo'lsa
npm run dev                              # http://localhost:5173
```

**Avtotestlar (kodga ishonch):**
```powershell
python manage.py test billing users businesses    # → 100 ta OK
npm run lint     # → 0 error (faqat mount-only warning — zararsiz)
npm run build    # → OK (chunk-size warning — zararsiz)
```

### Test akkauntlar (sayt: email+parol; admin: telefon+parol)
| Rol | Email | Telefon | Parol |
|---|---|---|---|
| Admin | admin@mylink.asia | +998900000000 | `admin1234` |
| Free | free@mylink.asia | +998901111111 | `test1234` |
| Pro | pro@mylink.asia | +998902222222 | `test1234` |

### Promokodlar
`TEST1` (Pro umrbod) · `PRO30` (Pro 30 kun) · `ODDIY1` (Oddiy umrbod) · `ONCE1` (1 martalik) · `OFF1` (faolsiz)

### Demo public sahifalar (seed_demo)
`/probiz1` restoran · `/probiz2` moda · `/probiz3` klinika · `/motorhub` avto · `/pulsegym` fitnes · `/freebiz` classic

---

## Phase 0 — Poydevor

### 0a · i18n (tillar)
- [ ] Header/Navbar'dagi til almashtirgich → UZ / RU / EN → matnlar darrov o'zgaradi.
- [ ] Sahifani yangilang (F5) → tanlangan til saqlanib qoladi (`localStorage['mylink-lang']`).
- [ ] Standart til — birinchi tashrifda **UZ**.

### 0b · Auth (kirish / ro'yxat)
- [ ] **Email + parol ro'yxat:** `/register` → email → kod (DEBUG'da konsolda yoki emailga) → parol → kirdi.
- [ ] **Email + parol kirish:** `/login` parol tabida email+parol → kirdi.
- [ ] **Telefon + OTP:** telefon → SMS kod (DEBUG'da serverda konsolga chiqadi) → kirdi.
- [ ] **Google bilan kirish:** Google tugmasi → akkaunt tanlash → kirdi (GOOGLE_CLIENT_ID sozlangan bo'lsa).
- [ ] **Parolni tiklash (kod orqali):** Forgot → kod → yangi parol → **avtomatik kirib** ketadi.
- [ ] Parol maydonidagi **ko'zcha** tugmasi parolni ko'rsatadi/yashiradi.
- [ ] 7 kun ichida qayta kirsangiz token amal qiladi (sliding); chiqib qaytadan kirmaysiz.

### 0c · Entitlement (tarif tizimi)
- [ ] Free akkaunt → `/api/me/` (yoki UI badge) `tier: free`, `profile_limit: 1`.
- [ ] Pro promokoddan keyin tier `pro`, `profile_limit: 20` ga o'zgaradi.

### 0d · Landing + statistika
- [ ] `/` ochilganda marketing landing chiqadi (login/dashboard emas).
- [ ] Landing'da **real statistika** (bizneslar / havolalar / foydalanuvchilar soni) ko'rinadi.
- [ ] Header'da faqat **"Tizimga kirish"** tugmasi (ortiqcha "Boshlash" yo'q).

### Qo'shimcha (Phase 0)
- [ ] **Aloqa forma** (landing pastida) → yuborildi → "qabul qilindi"; admin SiteSettings to'g'ri bo'lsa Telegram guruhga tushadi.
- [ ] **CMS:** `/about`, `/privacy`, `/terms`, `/blog` ochiladi (admin'dan StaticPage/BlogPost tahrirlanadi).
- [ ] **Help tugmasi** past-o'ng burchakda (Telegram) ko'rinadi va ochiladi.

### UX yaxshilanishlar
- [ ] **Navbar → Profil** havolasi + joriy **tarif badge** (desktop + mobil).
- [ ] **`/pricing`** real sahifa: 3 tarif, joriy tarif yashil "Joriy tarifingiz"; "Promokod bilan faollashtirish" → Profil; "Onlayn to'lov tez orada" banneri.
- [ ] **Auth logosi:** Login/Register/Forgot'da MyLink logosi → bosilsa `/` ga qaytaradi.

---

## Phase 1 — Billing

### 1b · Promokod / lifetime
- [ ] Free akkaunt → Profil → tarif badge **Free**.
- [ ] `test1` (kichik harf/probel ham) → "Tabriklaymiz" → badge **Pro · umrbod**.
- [ ] Xuddi shu kod 2-marta → "allaqachon ishlatgansiz".
- [ ] `XXX` → "topilmadi"; `OFF1` → "faol emas"; `PRO30` → "Pro · <sana> gacha".
- [ ] Admin → PromoCode ochilganda pastda **kim ishlatgani** (redemption) ko'rinadi.

### 1c · Limitlar
- [ ] Free → Dashboard `1/1`, "Yangi qo'shish" o'chiq; bosilsa **upgrade modal**.
- [ ] Pro userning Obunasini admin'da **Expired** qiling → Dashboard yangilang → eng eski faol, ortiqchalari **Bloklangan**, indikator `1/1`.
- [ ] Bloklangan sahifani "Faollashtirish" → limit to'lgani uchun rad; avval bittasini "O'chirish" → keyin boshqasini faollashtirish ishlaydi.
- [ ] Public: `/freebiz` → "Powered by MyLink" **bor**; `/probiz1` → branding **yo'q** + nom yonida **✓ galochka**.
- [ ] Bloklangan sahifa pathi public'da → **404**.

---

## Phase 2 — Pro funksiyalar

### 2a · Toolbar + pin
- [ ] Pro → biznes oching → tepada toolbar: 📋 nusxa / 🔗 ulashish / ↗ ko'rinish / ⭐ qadash.
- [ ] ⭐ bosing → Dashboard'da tepaga ko'tariladi + ⭐ badge.

### 2b · QR + PDF + vizitka
- [ ] Pro → toolbar **QR / PDF** → modal'da PNG + PDF + Vizitka yuklab olish ishlaydi.
- [ ] Free → upsell (faqat reklama, yuklab olish yo'q).
- [ ] Oddiy (`ODDIY1`) → faqat **PNG**; PDF/vizitka **🔒 Pro**.

### 2c · Kontent bloklari
- [ ] Pro → **Bloklar** tab → Rasm/Video/Matn qo'shing, tahrirlang, **Saqlash**, dnd bilan tartiblang, o'chiring.
- [ ] Public sahifada bloklar ko'rinadi (matn / rasm / `<video>` / YouTube iframe).
- [ ] Oddiy → 3 ta blok, video yo'q. Free → upsell.
- [ ] Video > 50MB → "hajmi 50MB dan oshmasligi kerak".

### 2d · Analitika
- [ ] Public sahifa oching → **ko'rish** track bo'ladi; link bosing → **bosish**; **Ulashish** tugmasi → share.
- [ ] Pro → Navbar **Analitika** → biznes tanlang → kartalar + LineChart (view+click) + top havolalar.
- [ ] Oddiy → 7 kunlik, top havolalarsiz. Free → upsell.

---

## Phase 3 — Dizayn

### 3a · Shablonlar + ranglar + avatar
- [ ] Editor → **Sozlash** tab → shablon tanlang (classic + 5 soha) → **Saqlash** → public sahifa o'zgaradi.
- [ ] Bio / logo / linklar har shablonda to'g'ri ko'rinadi; har public sahifada light/dark toggle + ulashish.
- [ ] Shablonlar **hamma tarifga ochiq** (gate yo'q).
- [ ] **Avatar crop:** logo yuklash/drop → kvadrat crop modali (pan/zoom, dumaloq ko'rinish) → "Tayyor" → kesilgan logo saqlanadi.
- [ ] **Rang palitrasi:** classic shablonda Sozlash'da palitra (default/ocean/forest/noir/rose/sunset). Oddiy/Pro → ishlaydi; **Free → 🔒 Pro upsell**.
- [ ] Sektor shablonlari o'z rangida qoladi (palitra faqat classic'ga ta'sir qiladi).

---

## Phase 4 — Kengaytmalar

### 4a · Referral
- [ ] `/referral` → taklif kod + havola + statistika (taklif qilingan / Pro bo'lgan / shu yilgi oylar).
- [ ] Havoladan **nusxa / ulashish** ishlaydi.
- [ ] Yangi akkauntni `?ref=<kod>` havola orqali ro'yxatdan o'tkazing → u Pro promokod oladi → **referrer'ga +1 oy Pro** qo'shiladi (Profil badge muddati uzayadi).
- [ ] Bir do'st faqat 1 marta mukofot beradi; yiliga ≤12 oy.

### 4b · NFC
- [ ] `/nfc` (Navbar havola) → info hero + **ariza forma** (ism/tel/soni/izoh) → yuborildi → "qabul qilindi" + Telegram guruhga (sozlangan bo'lsa).
- [ ] Pastda **Buyurtmalarim** tarixi + status badge.
- [ ] Soni 0 yoki >1000 → rad.

### 4c · Dashboard qidiruv
- [ ] 2+ biznesda Dashboard'da **qidiruv** maydoni paydo bo'ladi.
- [ ] Nom yoki path bo'yicha filter ishlaydi; topilmasa "Hech narsa topilmadi".

### 4e · Jamoa / rollar ⭐ (yangi)

**Tayyorgarlik:** Pro akkaunt (`pro@mylink.asia` yoki `TEST1` promokod) bilan kiring, bitta biznesingiz bo'lsin.

**Taklif qilish (owner, Pro):**
- [ ] Biznes oching → **Jamoa** tab ko'rinadi (faqat owner/admin uchun).
- [ ] **Mavjud foydalanuvchini** taklif qiling (masalan `free@mylink.asia`, rol = Muharrir) → darrov ro'yxatga qo'shiladi (status faol).
- [ ] **Akkauntsiz** email/telefonni taklif qiling (masalan `yangi@test.com`) → ro'yxatda **"Kutilmoqda"** (pending) badge bilan turadi.
- [ ] O'sha `yangi@test.com` bilan ro'yxatdan o'ting → keyin owner Jamoa tab'ni yangilasa, a'zo **avtomatik faol** bo'lgan.
- [ ] O'zingizni (owner) taklif → "sahifa egasi" xatosi; ikki marta bir xil → "allaqachon a'zo / taklif yuborilgan".

**Rollar (boshqa akkaunt bilan kirib tekshiring):**
- [ ] **Viewer** a'zo → Dashboard'da sahifa **rol badge** bilan ko'rinadi; ochsa **faqat-ko'rish** (Saqlash tugmasi yo'q, "faqat ko'rish huquqi" eslatmasi).
- [ ] **Editor** a'zo → sahifa/linklar/bloklarni tahrirlay oladi; lekin **Jamoa** tab yo'q; biznesni **o'chira olmaydi**.
- [ ] **Admin** a'zo → tahrir + **Jamoa** tab (a'zo qo'shish/rolini o'zgartirish/olib tashlash); lekin biznesni **o'chira olmaydi** (faqat owner).
- [ ] Owner a'zo rolini **o'zgartiradi** (Muharrir → Admin) va **olib tashlaydi** → ro'yxatdan yo'qoladi.

**Tarif gate va limit:**
- [ ] **Free egasi** Jamoa tab'da → **upsell** ("Pro tarifda mavjud"), taklif formasi yo'q.
- [ ] Shared sahifa a'zoning **o'z tarif limitiga ta'sir qilmaydi** (Free a'zo o'z sahifasini baribir yarata oladi).
- [ ] Shared sahifa uchun funksiyalar **EGA tarifiga** bog'liq: Pro egasining sahifasida viewer ham **to'liq analitika / QR** ko'radi.
- [ ] Public sahifada egasining email/telefoni **ko'rinmaydi** (PII himoyasi).

---

## UX tuzatishlar to'plami (2026-06-13)

### Auth
- [ ] **Google tugmasi** "Kirish" tugmasi bilan bir xil o'lcham/stil (oq fon, ramka, G logo) va ishlaydi.
- [ ] Register/Forgot 2-bosqichda **kod va yangi parol maydonlariga saqlangan login/parol avto-to'ldirilmaydi**.
- [ ] Register 2-bosqichda **Ism familiya** maydoni bor (majburiy) → ro'yxatdan keyin navbar'da "Profil" o'rniga **ism** ko'rinadi.
- [ ] Profil'da ism ko'rinadi va **tahrirlanadi**; Google bilan kirganda ism Google'dan olinadi.
- [ ] Login/Register/Forgot/Reset — **yangi dizayn** (landing uslubidagi fon, markaziy karta; chap rasm yo'q).

### Navbar / layout
- [ ] Faol menyu **chizig'i navbar ichida** (pastdagi kontent ustiga tushmaydi).
- [ ] **Landing header sticky** — scroll qilganda tepada qoladi.
- [ ] **Footer + header** blog/about/privacy/terms sahifalarida ham bor; menyudan bo'limlarga (`/#about`...) o'tish ishlaydi.

### Toast xabarlar
- [ ] Xabarlar **tepa-o'ng burchakda** chiqadi, ~4 soniyada o'zi yo'qoladi; sahifaning istalgan joyida ko'rinadi.
- [ ] Landing aloqa formasi, Profil, Dashboard, Biznes saqlash — hammasi toast ishlatadi.

### Landing
- [ ] Statistika: faqat **Foydalanuvchilar** va **Bizneslar** — katta raqamlar, count-up animatsiya.
- [ ] **"Bizning mijozlar"** karuseli (admin → Business → "Landing'da ko'rsatish" belgilangan): cheksiz o'ngdan-chapga, hover'da to'xtaydi, bosilsa sahifa ochiladi.
- [ ] Aloqa formasi: **telefon** maydoni (ism tagida, emaildan oldin); telefon YOKI email — bittasi majburiy (ikkalasi bo'sh → toast xato; backend ham 400).
- [ ] **Help tugmasi**: yumaloq, suzuvchi + ping halqa animatsiyasi; hover'da yorliq chiqadi.

### CMS
- [ ] `/about` `/privacy` `/terms` `/blog` bo'sh bo'lsa — **chiroyli "Tez orada" sahifa** (admin matni YO'Q).
- [ ] Blog postda **Tartib (order)** maydoni — admin kichik raqam berganlari birinchi chiqadi.

### Biznes limiti (yangi model: faollik limiti)
- [ ] **Istalgan tarif istalgancha biznes yaratadi** — "Yangi qo'shish" hech qachon o'chmaydi.
- [ ] Limit to'lganda yaratilgan yangi sahifa **nofaol** holatda keladi (toast ogohlantiradi).
- [ ] Har bir o'z kartangizda **Faol/Nofaol switch** — istalganini yoqib-o'chirish mumkin; limit to'lganda yoqishga urinish → upgrade modal.
- [ ] Nofaol sahifa public'da 404; "Ko'rish" tugmasi o'chiq.

### Yangi biznes wizard (2 bosqich)
- [ ] `/business/new` → **1-qadam**: manzil (banligi tekshiriladi) + nom + tavsif + logo (kvadrat kesish) → "Davom etish".
- [ ] **2-qadam**: chapda shablon kartalari + (classic'da) rang palitrasi; **o'ngda jonli telefon preview** — tanlov o'zgarganda darhol yangilanadi.
- [ ] "Yaratish" → sahifa yaratiladi (logo bilan) → muharrirga o'tadi; band path → 1-qadamga qaytarib xato ko'rsatadi.
- [ ] Rang palitrasi Free'da qulflangan (Pro badge), Oddiy/Pro'da ishlaydi.

---

## UX tuzatishlar — 2-to'plam (2026-06-14)

### 2A · Mijozlar karuseli hover (landing)
- [ ] `/` → "Bizning mijozlar" karuselida sichqonchani kartaga olib boring → karta **ko'tariladi va to'liq ko'rinadi**, tepa/past chegaraga **kirib ketmaydi** (oldin kesilardi).
- [ ] Hover paytida karusel **to'xtaydi**; olib ketsangiz yana harakatlanadi.

### 2B · Auth maydon o'lchamlari
- [ ] `/login` va `/register` — input maydonlar va tugmalar **normal balandlikda** (ingichka/yapaloq emas).
- [ ] Email/Telefon tab, "Kod yuborish"/"Kirish" tugmasi, Google tugmasi — barchasi bir xil bo'y-bastda, chiroyli.

### 2C · Register oldindan tekshiruv
**Tayyorgarlik:** mavjud akkaunt — `free@mylink.asia` (yoki telefon `+998901111111`).
- [ ] `/register` → Email tab → `free@mylink.asia` → "Kod yuborish" → **kod yuborilmaydi**, darrov xato: "Bu email allaqachon ro'yxatdan o'tgan…" (oldin avval kod kelib, keyin 2-bosqichda xato chiqardi).
- [ ] Telefon tab → `90 111 11 11` → xuddi shunday darrov xato (SMS ketmaydi).
- [ ] **Yangi** email/telefon → kod normal yuboriladi → 2-bosqichga o'tadi.

### 2D · Ulashish → Instagram Story
**Tayyorgarlik:** istalgan tarif (Free ham), bitta biznes.
- [ ] Biznes oching → tepa toolbar → **Ulashish** → menyu chiqadi: **Instagram Story / Havolani nusxalash / Boshqa ilovaga ulashish**.
- [ ] **Instagram Story** → modalda **tayyor 9:16 rasm** ko'rinadi: gradient fon, logo (yoki bosh harf), nom, tavsif, "Sahifamni oching", **QR + path**, pastda **MyLink.asia** watermark.
- [ ] **Ulashish / Saqlash** tugmasi: mobilda tizim ulashish oynasi (Instagram tanlanadi), desktopda **PNG yuklab olinadi** + toast eslatma.
- [ ] Free tarifda ham ishlaydi (QR gate'dan mustaqil).

### 2E · PDF vizitka redizayni (Pro)
**Tayyorgarlik:** Pro (`pro@mylink.asia` yoki `TEST1`).
- [ ] Biznes → toolbar **QR / PDF** → **Vizitka** → `card.pdf` yuklanadi.
- [ ] **2 bet**: *old* — indigo gradient, logo (yumaloq) yoki bosh harf, nom + tavsif, path, "MyLink.asia"; *orqa* — oq fon, **QR panel**, "Skanerlang va kuzating", path + MyLink.
- [ ] Logo yo'q biznesda — old betda bosh harf chiqadi (xato bermaydi).

---

## Yakuniy
- [ ] Barcha avtotestlar yashil: **110 backend**, lint 0 error, build OK.
- [ ] Hech bir public sahifa konsolda xato bermaydi.
- [ ] ⚠️ Prod deploy oldidan: nginx `client_max_body_size 50M` (2c video) + `pip install -r requirements.txt`.
