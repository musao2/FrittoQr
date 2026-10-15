# FRITTO — QR davomat ekrani (kiosk)

Ish joyidagi planshet yoki monitorda ochiladigan ekran. Unda katta QR kod turadi.
Xodim kelganda va ketganda shu QR kodni telefon kamerasi bilan skanerlaydi:

- **1-skanerlash** → "Keldi" (ish vaqti hisoblana boshlaydi)
- **2-skanerlash** → "Ketdi" (ishlagan vaqti va topgan puli hisoblanadi)

## Nega QR kod har 15 soniyada o'zgaradi?

Xodim ekran oldida turishi shart bo'lishi uchun. Har bir QR kod faqat 45 soniya amal qiladi,
shuning uchun uni rasmga olib boshqaga yuborish yoki uydan skanerlash ishlamaydi.
Telefon kamerasi QR kodni odatda 2 metrdan yaqin masofadan o'qiydi.

## Birinchi marta sozlash

1. Supabase → **SQL Editor** da quyidagi fayllarni tartib bilan ishga tushiring
   (ular admin loyihasida turibdi):
   - `DavomatCrmFritto/supabase/migrations/002_qr_attendance.sql`
   - `DavomatCrmFritto/supabase/migrations/003_qr_kiosk_asosiy.sql`
   - `DavomatCrmFritto/supabase/migrations/006_kiosk_login.sql`
2. `.env` faylida Supabase manzili va xodimlar sayti manzili bor.
3. QR ekran ochilganda **email va parol** so'raladi (boshlang'ich email: `fritto@fritto.uz`).
   Email va parolni admin panel → **Sozlamalar** → "QR ekranga kirish" bo'limida o'zgartirasiz.
   Parol o'zgarsa, barcha QR ekranlardan chiqarib yuboriladi.
4. Ishga tushirish:

```bash
npm install
npm run dev
```

Ekran: http://localhost:5175 (planshetdan: http://<kompyuter-IP>:5175, masalan http://192.168.1.20:5175)

## Muhim

- QR ichidagi havola (`VITE_USER_APP_URL=auto`) kompyuterning **hozirgi** Wi-Fi manziliga
  avtomatik yo'naltiriladi (IP o'zgarsa ham server qayta ishga tushganda o'zi yangilanadi).
  Telefon va kompyuter **bitta Wi-Fi** da bo'lishi kerak.
  Saytni internetga joylaganingizda `VITE_USER_APP_URL` ga haqiqiy domenni yozing.
- 5 marta noto'g'ri parol kiritilsa, QR ekranga kirish 5 daqiqaga bloklanadi.
- Xodim endi davomatni tugma bilan yoza olmaydi — faqat QR orqali.
  Admin avvalgidek "Davomat" bo'limida tuzata oladi.
# FrittoQr
