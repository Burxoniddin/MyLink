# GitHub Actions CI/CD Sozlash Qo'llanmasi

Bu qo'llanma GitHub-ga push qilganingizda avtomatik deploy qilish uchun zarur sozlamalarni o'z ichiga oladi.

## 1-QADAM: SSH Kalit Yaratish (Bir marta)

Windows PowerShell-da quyidagi buyruqni bajaring:

```powershell
ssh-keygen -t ed25519 -C "github-deploy" -f C:\Users\$env:USERNAME\.ssh\github_deploy
```

Bu ikkita fayl yaratadi:
- `C:\Users\USERNAME\.ssh\github_deploy` - **Private key** (maxfiy, faqat GitHub-ga qo'yasiz)
- `C:\Users\USERNAME\.ssh\github_deploy.pub` - **Public key** (serverga qo'yasiz)

---

## 2-QADAM: Public Key-ni Serverga Qo'shish

1. PowerShell-da public key-ni ko'ring:

```powershell
Get-Content C:\Users\$env:USERNAME\.ssh\github_deploy.pub
```

2. Serverga SSH orqali kiring va authorized_keys-ga qo'shing:

```bash
ssh root@YOUR_SERVER_IP
nano ~/.ssh/authorized_keys
```

3. Ko'chirilgan public key-ni fayl oxiriga qo'shib saqlang (`Ctrl+O`, `Enter`, `Ctrl+X`)

---

## 3-QADAM: GitHub Secrets Sozlash

GitHub repository-ga boring va **Settings → Secrets and variables → Actions → New repository secret** bosing.

Quyidagi 3 ta secret qo'shing:

### 1. `SERVER_HOST`
**Value**: Serveringizning IP manzili (masalan: `123.45.67.89`)

### 2. `SERVER_USER`
**Value**: `root`

### 3. `SSH_PRIVATE_KEY`
**Value**: Private key-ning to'liq matni

PowerShell-da private key-ni ko'ring va nusxa oling:

```powershell
Get-Content C:\Users\$env:USERNAME\.ssh\github_deploy
```

> ⚠️ **Muhim**: To'liq matnni nusxa oling, shu jumladan:
> ```
> -----BEGIN OPENSSH PRIVATE KEY-----
> ...
> -----END OPENSSH PRIVATE KEY-----
> ```

---

## 4-QADAM: Ishlatish

Endi har safar `main` branch-ga push qilganingizda, GitHub Actions avtomatik ravishda:

1. ✅ Serverga SSH orqali ulanadi
2. ✅ `git pull` qiladi
3. ✅ Backend dependencies-ni yangilaydi
4. ✅ Django migrations va collectstatic bajaradi
5. ✅ Frontend-ni build qiladi
6. ✅ Gunicorn va Nginx-ni qayta ishga tushiradi

### Qo'lda ishga tushirish

GitHub repository → **Actions** → **Deploy to Production** → **Run workflow** tugmasini bosing.

---

## 📊 Deploy Holatini Ko'rish

GitHub repository → **Actions** tabiga o'ting. U yerda har bir deploy jarayonini ko'rishingiz mumkin:

- 🟢 **Yashil** = Muvaffaqiyatli
- 🔴 **Qizil** = Xato (loglarni tekshiring)
- 🟡 **Sariq** = Bajarilmoqda

---

## 🔧 Muammolar va Yechimlari

### SSH ulanish xatosi

1. Serverda SSH kalit qo'shilganini tekshiring:
```bash
cat ~/.ssh/authorized_keys
```

2. SSH xizmatini qayta ishga tushiring:
```bash
systemctl restart sshd
```

### "Permission denied" xatosi

Serverda loyiha papkasiga ruxsat bering:
```bash
chown -R root:root /var/www/mylink
chmod -R 755 /var/www/mylink
```

### npm/pip xatolari

Serverda qo'lda sinab ko'ring:
```bash
cd /var/www/mylink/backend
source venv/bin/activate
pip install -r requirements.txt

cd ../frontend
npm install
npm run build
```

---

## 🎯 Qo'shimcha Sozlamalar

### Faqat backend yoki frontend deploy qilish

`.github/workflows/deploy.yml` faylini o'zgartiring:

```yaml
# Faqat backend uchun
on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

# Faqat frontend uchun
on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'
```

### Staging server qo'shish

Yangi workflow yarating: `.github/workflows/staging.yml` va boshqa branch/server sozlang.

---

Muvaffaqiyat! 🚀
