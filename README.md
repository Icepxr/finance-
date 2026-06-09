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
| 📊 **Dashboard** | สรุปรายเดือน + เลื่อนดูเดือนย้อนหลัง + เทียบกับเดือนก่อน (% เพิ่ม/ลด), กราฟแนวโน้ม |
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

## ⚙️ การตั้งค่า (ตั้งครั้งเดียว)

> 💡 API key ทั้งหมดอยู่ใน `code.gs` (backend) แล้ว — ในแอปกรอกแค่ **Backend URL ช่องเดียว**

### 1. ตั้งค่า key ใน `code.gs`

เปิด **Google Sheets → Extensions → Apps Script** วางโค้ดจาก `code.gs` แล้วเติม key ที่ด้านบนไฟล์:

```js
const FINNHUB_API_KEY = '...';  // finnhub.io → Get free API Key (ราคาหุ้น)
const GEMINI_API_KEY  = '...';  // aistudio.google.com → Get API Key (อ่านสลิป + AI)
```

- **Finnhub** ฟรี 60 calls/นาที — [finnhub.io](https://finnhub.io)
- **Gemini** ฟรี 1,500 ครั้ง/วัน — [aistudio.google.com](https://aistudio.google.com)

> ใส่ไว้ใน backend ปลอดภัยกว่า (ไม่โผล่ในเบราว์เซอร์ผู้ใช้)

### 2. Deploy แล้วเอา URL มาวาง

1. กด **Deploy → New Deployment → Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
2. คัดลอก URL (ลงท้าย `/exec`)
3. เปิดแอป → **ตั้งค่า** → วางใน **Backend URL** → บันทึก

เท่านี้ทุกฟีเจอร์ (sync · ราคาหุ้น · อ่านสลิป · AI วิเคราะห์) ทำงานผ่านลิงก์เดียว

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

> ต้องเชื่อมต่อ **Backend URL** ในหน้าตั้งค่าก่อน (key อยู่ใน `code.gs`)

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
├── index.html      ← โครงหน้า (markup)
├── styles.css      ← ธีมดำขอบม่วง · flat · glass
├── app.js          ← ตรรกะแอปทั้งหมด
├── code.gs         ← Google Apps Script backend
├── manifest.json   ← PWA manifest (ติดตั้งบนมือถือได้)
├── assets/
│   └── m4.jpg      ← วางรูปพื้นหลัง BMW M4 ของคุณตรงนี้ (ไม่ใส่ก็ได้ → พื้นดำ)
└── README.md
```

> โครงสร้างแยก HTML / CSS / JS เสิร์ฟบน GitHub Pages ได้ทันที ไม่ต้อง build

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
