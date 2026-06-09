#!/usr/bin/env bash
# ============================================================
#  push.sh — อัปเดตเว็บขึ้น GitHub ด้วยคำสั่งเดียว
#  วิธีใช้:  bash push.sh
#           bash push.sh "ข้อความ commit ของคุณ"
# ============================================================
cd "$(dirname "$0")" || exit 1

echo "🧹 ลบไฟล์ lock ค้าง (ถ้ามี)..."
rm -f .git/*.lock .git/refs/heads/*.lock 2>/dev/null

echo "🔗 ตั้งค่า remote ให้ตรง repo..."
git remote set-url origin https://github.com/Icepxr/finance-.git 2>/dev/null \
  || git remote add origin https://github.com/Icepxr/finance-.git

# ── ให้ branch ปัจจุบันชื่อ main ──
cur=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
if [ "$cur" != "main" ]; then
  echo "🔀 เปลี่ยนชื่อ branch '$cur' → main..."
  git branch -m main 2>/dev/null
fi

echo "🔄 เติมเลขเวอร์ชันท้าย css/js (กันเบราว์เซอร์ cache ของเก่า)..."
ver=$(date +%s)
sed -i '' -E "s#(href=\"styles\.css)(\?v=[0-9]+)?(\")#\1?v=$ver\3#; s#(src=\"app\.js)(\?v=[0-9]+)?(\")#\1?v=$ver\3#" index.html 2>/dev/null \
  || sed -i -E "s#(href=\"styles\.css)(\?v=[0-9]+)?(\")#\1?v=$ver\3#; s#(src=\"app\.js)(\?v=[0-9]+)?(\")#\1?v=$ver\3#" index.html 2>/dev/null

echo "📦 เก็บงานล่าสุดเข้า commit..."
git add -A
if git diff --cached --quiet; then
  echo "   (ไม่มีไฟล์เปลี่ยน — ข้าม commit)"
else
  msg="${1:-update $(date '+%Y-%m-%d %H:%M')}"
  git commit -m "$msg"
fi

echo "🚀 ส่งขึ้น GitHub (branch main)..."
if ! git push -u origin main --force; then
  echo "❌ push ไม่สำเร็จ — มักเป็นเรื่อง login GitHub"
  echo "   ลองรันใหม่ แล้วใส่ username + Personal Access Token ตอนถาม"
  exit 1
fi

echo "🧽 ลบ branch master เก่าบน GitHub (ถ้ามี)..."
git push origin --delete master 2>/dev/null \
  && echo "   ลบ master เรียบร้อย" \
  || echo "   (ไม่มี master หรือมันเป็น default branch — ข้าม ไม่เป็นไร)"

git branch -u origin/main 2>/dev/null

echo ""
echo "✅ เสร็จแล้ว! เว็บ icepxr.github.io/finance- จะอัปเดตใน ~1 นาที"
echo "   ครั้งต่อไปแก้อะไรเสร็จ แค่รัน:  bash push.sh"
