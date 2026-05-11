<div align="center">

# 💜 FinanceOS

**แอปจัดการการเงินส่วนตัว — ใช้งานได้ทันที ไม่ต้องติดตั้ง**

[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-7c3aed?style=for-the-badge&logo=github)](https://icepxr.github.io/finance-/)
![Single File](https://img.shields.io/badge/Single%20File-HTML-a78bfa?style=for-the-badge)
![No Backend](https://img.shields.io/badge/No%20Backend%20Required-✓-34d399?style=for-the-badge)

<img src="https://img.shields.io/badge/Tailwind%20CSS-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white">
<img src="https://img.shields.io/badge/Chart.js-ff6384?style=flat-square&logo=chartdotjs&logoColor=white">
<img src="https://img.shields.io/badge/Google%20Gemini-4285F4?style=flat-square&logo=google&logoColor=white">
<img src="https://img.shields.io/badge/Finnhub-00c805?style=flat-square">
<img src="https://img.shields.io/badge/Google%20Sheets-34A853?style=flat-square&logo=googlesheets&logoColor=white">

</div>

---

## ✨ ฟีเจอร์หลัก

| ฟีเจอร์ | รายละเอียด |
|---|---|
| 📊 **Dashboard** | ยอดคงเหลือ, รายรับ-รายจ่าย, กราฟแนวโน้ม |
| 💸 **Transactions** | บันทึก/แก้ไข/ลบรายรับ-รายจ่าย พร้อม Category |
| 📷 **Scan Slip** | อ่านสลิปธนาคารด้วย AI (Gemini Vision) — กรอกข้อมูลอัตโนมัติ |
| 📈 **Investments** | ติดตามพอร์ตหุ้น พร้อมราคา real-time จาก Finnhub |
| 🎯 **Goals** | ตั้งเป้าหมายการออมและติดตามความคืบหน้า |
| 📉 **Analytics** | กราฟวิเคราะห์รายจ่ายตาม Category และแนวโน้มรายเดือน |
| ☁️ **Google Sheets Sync** | ซิงค์ข้อมูลทั้งหมดกับ Google Sheets แบบ real-time |
| 🌙 **Dark Mode** | ธีมมืดสบายตา พร้อม PWA — ติดตั้งได้บนมือถือ |

---

## 🚀 เริ่มใช้งาน

### วิธีที่ 1 — เปิดใช้ทันที (ไม่ต้อง setup)

เปิดไฟล์ `index.html` ในเบราว์เซอร์ หรือเข้าผ่าน GitHub Pages แล้วกด **Load Demo Data** เพื่อดูตัวอย่างข้อมูล

### วิธีที่ 2 — ใช้งานเต็มรูปแบบ (แนะนำ)

ทำตามขั้นตอนด้านล่างเพื่อปลดล็อคฟีเจอร์ทั้งหมด

---

## ⚙️ การตั้งค่า API Keys

ไปที่เมนู **Settings** (ไอคอนเฟืองด้านซ้าย) แล้วกรอก:

### 1. 🤖 Gemini API Key — สำหรับ Scan Slip

ใช้อ่านสลิปธนาคารด้วย AI **ฟรี 1,500 ครั้ง/วัน**

1. ไปที่ [aistudio.google.com](https://aistudio.google.com) → **Get API Key**
2. สร้าง API Key ใหม่
3. วางใน Settings → **Gemini API Key**

### 2. 📈 Finnhub API Key — สำหรับราคาหุ้น real-time

**ฟรี** สำหรับการใช้งานส่วนตัว

1. สมัครที่ [finnhub.io](https://finnhub.io) → **Free API Key**
2. คัดลอก API Key
3. วางใน Settings → **Finnhub API Key**

### 3. ☁️ Google Sheets Sync — สำหรับ backup ข้อมูล

<details>
<summary>คลิกเพื่อดูวิธีติดตั้ง Apps Script</summary>

1. เปิด [Google Sheets](https://sheets.google.com) สร้าง Spreadsheet ใหม่
2. ไปที่ **Extensions → Apps Script**
3. วางโค้ด Apps Script (ดูในไฟล์ `apps-script.gs` หรือขอจากผู้พัฒนา)
4. กด **Deploy → New Deployment → Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. คัดลอก URL ที่ได้
6. วางใน Settings → **Apps Script URL**

</details>

---

## 📷 วิธีใช้ Scan Slip

แทนที่จะพิมพ์ข้อมูลเอง ถ่ายรูปสลิปแล้วให้ AI กรอกให้อัตโนมัติ

```
1. กดปุ่ม "Scan Slip" (ไอคอนกล้อง ด้านขวาบน)
2. เลือกรูปจาก:
   🖼  คลังรูปภาพ  — เลือกรูปสลิปที่บันทึกไว้
   📷  กล้อง       — ถ่ายรูปสลิปทันที
   🖱  Drag & Drop — ลากไฟล์รูปมาวางในกรอบ
3. กด "วิเคราะห์" — AI จะอ่านข้อมูลจากสลิป
4. ตรวจสอบข้อมูลที่อ่านได้
5. กด "ใช้ข้อมูลนี้" — กรอกฟอร์มอัตโนมัติ
6. กด "Add Transaction" เพื่อบันทึก
```

> ต้องใส่ **Gemini API Key** ใน Settings ก่อนใช้งาน

---

## 💸 วิธีบันทึกรายรับ-รายจ่าย

```
1. กดปุ่ม "+" (มุมขวาบน) หรือ "Add Transaction"
2. เลือกประเภท: Income / Expense
3. เลือก Category (อาหาร, เดินทาง, ช้อปปิ้ง ฯลฯ)
4. กรอกจำนวนเงินและวันที่
5. กด "Add Transaction"
```

**แก้ไขรายการ:** กดไอคอน ✏️ ที่รายการนั้น  
**ลบรายการ:** กดไอคอน ✕ ที่รายการนั้น

---

## 📈 วิธีติดตาม Investment

```
1. ไปหน้า "Investments"
2. กด "Add Investment"
3. กรอก: ชื่อ, จำนวนเงินที่ลงทุน, วันที่
4. ใส่ Ticker symbol ใน Note เช่น "NVDA 10 shares"
   เพื่อดูราคา real-time จาก Finnhub
```

หุ้นที่รองรับ real-time: `NVDA`, `TSM`, `SPTE` และหุ้นอื่นๆ จาก Finnhub

---

## 🎯 วิธีตั้ง Goal

```
1. ไปหน้า "Goals"
2. กด "Add Goal"
3. ตั้งชื่อเป้าหมาย + ยอดเงินที่ต้องการ + วันเป้าหมาย
4. ระบบจะคำนวณความคืบหน้าให้อัตโนมัติ
```

---

## 🏗️ Tech Stack

```
Frontend    : HTML + Tailwind CSS (CDN) + Vanilla JavaScript
Charts      : Chart.js 4.4
AI OCR      : Google Gemini 2.5 Flash Vision
Stock Data  : Finnhub API
Cloud Sync  : Google Apps Script → Google Sheets
Storage     : localStorage (ไม่มี server ไม่มี database)
```

---

## 📁 โครงสร้างไฟล์

```
finance-/
├── index.html      ← แอปทั้งหมดอยู่ในไฟล์เดียว
├── manifest.json   ← PWA manifest (ติดตั้งบนมือถือได้)
└── README.md
```

---

## 🔒 ความเป็นส่วนตัว

- ข้อมูลทั้งหมดเก็บใน **localStorage** ของเบราว์เซอร์ท่าน
- ไม่มี server, ไม่มี database, ไม่มีการส่งข้อมูลไปที่ไหน
- Google Sheets Sync เป็นตัวเลือก — ท่านเป็นเจ้าของ Spreadsheet เอง
- API Keys เก็บใน localStorage เครื่องท่านเท่านั้น

---

<div align="center">

Made with 💜 by Icepxr

</div>
