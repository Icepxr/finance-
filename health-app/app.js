/* ========================================
   Health Tracker - Main App Logic
   ======================================== */

// ----- Utilities -----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const todayISO = () => new Date().toISOString().slice(0, 10);

function fmtThaiDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtLongThaiDate(date = new Date()) {
    return date.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function toast(msg, type = '') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}

function calcBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm) return null;
    const h = heightCm / 100;
    return +(weightKg / (h * h)).toFixed(1);
}

// Compress image to base64 (for sending to Apps Script / Gemini Vision)
async function compressImage(file, maxDim = 900, quality = 0.78) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = e => { img.src = e.target.result; };
        reader.onerror = reject;
        img.onload = () => {
            let { width, height } = img;
            const scale = Math.min(1, maxDim / Math.max(width, height));
            width = Math.round(width * scale);
            height = Math.round(height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve({
                mime: 'image/jpeg',
                base64: dataUrl.split(',')[1]
            });
        };
        img.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function bmiCategory(bmi) {
    if (bmi == null) return { label: '', cls: '' };
    if (bmi < 18.5) return { label: 'ผอม', cls: 'under' };
    if (bmi < 23) return { label: 'ปกติ', cls: 'normal' };
    if (bmi < 25) return { label: 'น้ำหนักเกิน', cls: 'over' };
    return { label: 'อ้วน', cls: 'obese' };
}

// ----- View management -----
function switchView(name) {
    $$('.topnav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    const titles = {
        dashboard: 'BIO MONITOR',
        food: 'NUTRITION LOG',
        exercise: 'TRAINING DECK',
        weight: 'BODY STATS',
        wellness: 'RECOVERY SYSTEMS',
        insights: 'AI INSIGHTS',
        settings: 'CONSOLE'
    };
    $('#pageTitle').textContent = titles[name] || '';
    if (name === 'insights') renderInsights();
    if (name === 'dashboard') renderDashboard();
    if (name === 'food') renderFood();
    if (name === 'exercise') renderExercise();
    if (name === 'weight') renderWeight();
    if (name === 'wellness') renderWellness();
    if (name === 'settings') renderSettings();
}

// ----- Stat & Quest System -----
function getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }
    return days;
}

function computeStats() {
    const today = todayISO();
    const last7 = getLast7Days();

    // HP — Health from sleep (last night + last 7 days avg)
    const recentSleep = Storage.getAll('sleep').filter(x => last7.includes(x.date));
    const avgSleep = recentSleep.length ? recentSleep.reduce((s, x) => s + (+x.hours || 0), 0) / recentSleep.length : 0;
    // Score: 8h = 100, scale linearly, cap
    const hp = Math.round(Math.max(0, Math.min(100, (avgSleep / 8) * 100)));

    // STA — Stamina from water today
    const totalWater = Storage.getAll('water').filter(x => x.date === today).reduce((s, x) => s + (+x.amount || 0), 0);
    const sta = Math.round(Math.max(0, Math.min(100, (totalWater / Storage.config.goalWater) * 100)));

    // MP — Mana from calories vs goal (closest to goal = highest, going over reduces it)
    const totalCal = Storage.getAll('food').filter(x => x.date === today).reduce((s, x) => s + (+x.calories || 0), 0);
    const ratio = totalCal / Storage.config.goalCalories;
    let mp;
    if (ratio === 0) mp = 0;
    else if (ratio <= 1) mp = Math.round(ratio * 100);
    else mp = Math.round(Math.max(0, 100 - (ratio - 1) * 100));

    // STR — Strength from this week's exercise minutes (WHO recommends 150 min/week)
    const weekEx = Storage.getAll('exercise').filter(x => last7.includes(x.date));
    const weekExMin = weekEx.reduce((s, x) => s + (+x.duration || 0), 0);
    const str = Math.round(Math.max(0, Math.min(100, (weekExMin / 150) * 100)));

    // VIT — Vitality from BMI (closer to normal range 18.5-23 = higher)
    const weight = Storage.getAll('weight').slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    let vit = 0;
    if (weight) {
        const bmi = calcBMI(+weight.weight, +weight.height);
        if (bmi != null) {
            if (bmi >= 18.5 && bmi <= 23) vit = 100;
            else if (bmi < 18.5) vit = Math.round(Math.max(0, 100 - (18.5 - bmi) * 15));
            else vit = Math.round(Math.max(0, 100 - (bmi - 23) * 8));
        }
    }

    // INT — Discipline (how many days in last 7 had any logging activity)
    const allCats = ['food', 'exercise', 'water', 'sleep', 'weight'];
    const loggedDays = new Set();
    allCats.forEach(c => Storage.getAll(c).forEach(x => { if (last7.includes(x.date)) loggedDays.add(x.date); }));
    const int = Math.round((loggedDays.size / 7) * 100);

    return { hp, sta, mp, str, vit, int, weekExMin, avgSleep, totalCal, totalWater, loggedDays: loggedDays.size };
}

function getQuests(today) {
    const foods = Storage.getAll('food').filter(x => x.date === today);
    const ex = Storage.getAll('exercise').filter(x => x.date === today);
    const water = Storage.getAll('water').filter(x => x.date === today);
    const sleep = Storage.getAll('sleep').filter(x => x.date === today);
    const weight = Storage.getAll('weight').filter(x => x.date === today);

    const totalCal = foods.reduce((s, x) => s + (+x.calories || 0), 0);
    const totalWater = water.reduce((s, x) => s + (+x.amount || 0), 0);
    const totalExMin = ex.reduce((s, x) => s + (+x.duration || 0), 0);
    const sleepHrs = sleep.reduce((s, x) => s + (+x.hours || 0), 0);
    const mealsLogged = new Set(foods.map(f => f.meal)).size;

    return [
        {
            id: 'water',
            name: `ดื่มน้ำให้ครบเป้าหมาย (${Storage.config.goalWater} ml)`,
            current: totalWater,
            target: Storage.config.goalWater,
            xp: 50,
            unit: 'ml'
        },
        {
            id: 'exercise',
            name: 'ออกกำลังกายอย่างน้อย 30 นาที',
            current: totalExMin,
            target: 30,
            xp: 100,
            unit: 'นาที'
        },
        {
            id: 'meals',
            name: 'บันทึกอาหาร 3 มื้อ',
            current: mealsLogged,
            target: 3,
            xp: 50,
            unit: 'มื้อ'
        },
        {
            id: 'sleep',
            name: 'นอนพักผ่อนอย่างน้อย 7 ชั่วโมง',
            current: sleepHrs,
            target: 7,
            xp: 75,
            unit: 'ชม.'
        },
        {
            id: 'weigh',
            name: 'ชั่งน้ำหนักประจำวัน',
            current: weight.length > 0 ? 1 : 0,
            target: 1,
            xp: 25,
            unit: 'ครั้ง'
        }
    ];
}

function computeXP() {
    // XP = sum of completed quests for every past day in log history
    const allDates = new Set();
    ['food', 'exercise', 'water', 'sleep', 'weight'].forEach(c => {
        Storage.getAll(c).forEach(x => { if (x.date) allDates.add(x.date); });
    });
    let totalXP = 0;
    [...allDates].forEach(date => {
        const quests = getQuests(date);
        quests.forEach(q => { if (q.current >= q.target) totalXP += q.xp; });
    });
    return totalXP;
}

function xpForLevel(level) {
    // Level 1->2: 200, Level n->n+1: 200 + (n-1)*100
    return 200 + (level - 1) * 100;
}

function computeLevel(totalXP) {
    let level = 1;
    let xpUsed = 0;
    while (true) {
        const need = xpForLevel(level);
        if (xpUsed + need > totalXP) break;
        xpUsed += need;
        level++;
        if (level > 100) break;
    }
    return { level, xpInLevel: totalXP - xpUsed, xpNeeded: xpForLevel(level) };
}

function getClassTitle(level) {
    if (level >= 50) return 'TRANSCENDENT';
    if (level >= 30) return 'ASCENDED';
    if (level >= 20) return 'ELITE OPERATOR';
    if (level >= 10) return 'BIONIC ATHLETE';
    if (level >= 5)  return 'ENHANCED USER';
    return 'INITIATE';
}

// ===== Streak / Achievements / Buffs helpers =====
function _allLoggedDates() {
    const s = new Set();
    ['food', 'exercise', 'water', 'sleep', 'weight'].forEach(c => {
        Storage.getAll(c).forEach(x => { if (x.date) s.add(x.date); });
    });
    return s;
}

function computeStreak() {
    const dates = _allLoggedDates();
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
        const iso = d.toISOString().slice(0, 10);
        if (dates.has(iso)) { streak++; d.setDate(d.getDate() - 1); }
        else if (i === 0)  { d.setDate(d.getDate() - 1); }  // grace for today
        else break;
    }
    return streak;
}

function totalLogs() {
    return ['food', 'exercise', 'water', 'sleep', 'weight']
        .reduce((s, c) => s + Storage.getAll(c).length, 0);
}

function waterOnDay(iso) {
    return Storage.getAll('water').filter(x => x.date === iso).reduce((s, x) => s + (+x.amount || 0), 0);
}
function sleepOnDay(iso) {
    return Storage.getAll('sleep').filter(x => x.date === iso).reduce((s, x) => s + (+x.hours || 0), 0);
}
function burnOnDay(iso) {
    return Storage.getAll('exercise').filter(x => x.date === iso).reduce((s, x) => s + (+x.calories || 0), 0);
}
function maxBurnInAnyDay() {
    const days = new Set();
    Storage.getAll('exercise').forEach(x => days.add(x.date));
    let m = 0; days.forEach(d => { m = Math.max(m, burnOnDay(d)); });
    return m;
}
function countDaysWhere(predicate) {
    const days = _allLoggedDates();
    let c = 0; days.forEach(d => { if (predicate(d)) c++; });
    return c;
}
function weeklyWorkoutDays() {
    const last7 = getLast7Days();
    const ex = new Set();
    Storage.getAll('exercise').forEach(x => { if (last7.includes(x.date)) ex.add(x.date); });
    return ex.size;
}
function hasPerfectDay() {
    const dates = _allLoggedDates();
    for (const d of dates) {
        const qs = getQuests(d);
        if (qs.every(q => q.current >= q.target)) return true;
    }
    return false;
}

// ===== Achievement Definitions =====
const ACHIEVEMENTS = [
    { id: 'first_step',    icon: '🚀', name: 'First Step',     desc: 'บันทึกครั้งแรก',           check: () => totalLogs() >= 1 },
    { id: 'first_workout', icon: '🏋', name: 'First Workout',  desc: 'ออกกำลังครั้งแรก',         check: () => Storage.getAll('exercise').length >= 1 },
    { id: 'streak_3',      icon: '🔥', name: 'On Fire',        desc: '3 วันติดต่อกัน',           check: () => computeStreak() >= 3 },
    { id: 'streak_7',      icon: '💎', name: '7-Day Warrior',  desc: '7 วันติดต่อกัน',           check: () => computeStreak() >= 7 },
    { id: 'streak_30',     icon: '👑', name: 'Iron Disciple',  desc: '30 วันติดต่อกัน',          check: () => computeStreak() >= 30 },
    { id: 'hydro_master',  icon: '💧', name: 'Hydration Master', desc: 'ครบเป้าน้ำ 7 วัน',       check: () => countDaysWhere(d => waterOnDay(d) >= Storage.config.goalWater) >= 7 },
    { id: 'sleep_champ',   icon: '🌙', name: 'Sleep Champion', desc: 'นอน 7+ ชม. 7 วัน',         check: () => countDaysWhere(d => sleepOnDay(d) >= 7) >= 7 },
    { id: 'perfect',       icon: '⭐', name: 'Perfect Day',    desc: 'ทำครบทุกเควสใน 1 วัน',    check: () => hasPerfectDay() },
    { id: 'iron_will',     icon: '⚔', name: 'Iron Will',      desc: 'ออกกำลัง 5 วัน/สัปดาห์',  check: () => weeklyWorkoutDays() >= 5 },
    { id: 'centurion',     icon: '🛡', name: 'Centurion',      desc: 'บันทึกอาหาร 100 รายการ',  check: () => Storage.getAll('food').length >= 100 },
    { id: 'level_10',      icon: '🏆', name: 'Bionic',         desc: 'ถึง Level 10',             check: () => computeLevel(computeXP()).level >= 10 },
    { id: 'burn_1000',     icon: '💥', name: 'Calorie Crusher', desc: 'เผาผลาญ 1000+ kcal/วัน',  check: () => maxBurnInAnyDay() >= 1000 }
];

// ===== Buffs/Debuffs =====
function computeBuffs(stats) {
    const buffs = [];
    const today = todayISO();
    const exMinToday = Storage.getAll('exercise').filter(x => x.date === today).reduce((s, x) => s + (+x.duration || 0), 0);
    const streak = computeStreak();

    // Sleep buffs
    if (stats.avgSleep >= 8)       buffs.push({ type: 'buff',   icon: '✨', name: 'Well-Rested', value: '+20% HP REGEN' });
    else if (stats.avgSleep > 0 && stats.avgSleep < 6) buffs.push({ type: 'debuff', icon: '💤', name: 'Sleep Debt', value: '-15% HP' });

    // Water
    if (stats.sta >= 80) buffs.push({ type: 'buff', icon: '💧', name: 'Hydrated', value: '+10% MP' });
    else if (stats.sta > 0 && stats.sta < 30) buffs.push({ type: 'debuff', icon: '🏜', name: 'Dehydrated', value: '-10% STA' });

    // Nutrition
    if (stats.mp >= 80) buffs.push({ type: 'buff', icon: '🍱', name: 'Fueled', value: '+5% ALL' });
    else if (stats.mp > 0 && stats.mp < 30) buffs.push({ type: 'debuff', icon: '📉', name: 'Underfed', value: '-10% MP' });

    // Exercise today
    if (exMinToday >= 60) buffs.push({ type: 'buff', icon: '💪', name: 'Strong Day', value: '+5 STR' });
    else if (exMinToday >= 30) buffs.push({ type: 'neutral', icon: '🏃', name: 'Active', value: '+2 STR' });

    // Streak buff
    if (streak >= 30)      buffs.push({ type: 'buff', icon: '👑', name: 'Iron Disciple', value: '+30% XP' });
    else if (streak >= 7)  buffs.push({ type: 'buff', icon: '🔥', name: `${streak}d Streak`, value: '+15% XP' });
    else if (streak >= 3)  buffs.push({ type: 'neutral', icon: '🔥', name: `${streak}d Streak`, value: '+5% XP' });

    // BMI warning
    if (stats.vit > 0 && stats.vit < 40) buffs.push({ type: 'debuff', icon: '⚠', name: 'BMI Off-Range', value: 'check stats' });

    return buffs;
}

function renderBuffs(buffs) {
    const bar = $('#buffBar');
    if (!bar) return;
    if (!buffs.length) { bar.innerHTML = ''; return; }
    bar.innerHTML = buffs.map(b => `
        <div class="buff-chip ${b.type}">
            <span class="buff-icon">${b.icon}</span>
            <span class="buff-name">${b.name}</span>
            <span class="buff-value">${b.value}</span>
        </div>
    `).join('');
}

// ===== Badges =====
function renderBadges() {
    const grid = $('#badgesGrid');
    if (!grid) return;
    let unlocked = 0;
    grid.innerHTML = ACHIEVEMENTS.map(a => {
        let ok = false;
        try { ok = a.check(); } catch (e) { ok = false; }
        if (ok) unlocked++;
        return `
            <div class="badge ${ok ? 'unlocked' : ''}" title="${a.desc}">
                <div class="badge-icon">${a.icon}</div>
                <div class="badge-name">${a.name}</div>
                <div class="badge-desc">${a.desc}</div>
            </div>
        `;
    }).join('');
    $('#badgesUnlocked').textContent = unlocked;
    $('#badgesTotal').textContent = ACHIEVEMENTS.length;
}

// ===== Activity Heatmap =====
function activityLevel(n) {
    if (n === 0) return 0;
    if (n < 2) return 1;
    if (n < 4) return 2;
    if (n < 7) return 3;
    return 4;
}

function renderHeatmap() {
    const container = $('#heatmap');
    if (!container) return;
    const days = 35; // 5 rows × 7 cols ≈ 1 month compact
    const cells = [];
    let activeDays = 0, totalActivity = 0;
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        let activity = 0;
        activity += Storage.getAll('food').filter(x => x.date === iso).length;
        activity += Storage.getAll('exercise').filter(x => x.date === iso).length * 2;
        activity += Storage.getAll('water').filter(x => x.date === iso).length > 0 ? 1 : 0;
        activity += Storage.getAll('sleep').filter(x => x.date === iso).length;
        activity += Storage.getAll('weight').filter(x => x.date === iso).length;
        if (activity > 0) activeDays++;
        totalActivity += activity;
        cells.push({ iso, activity });
    }
    container.innerHTML = cells.map(c => {
        const lvl = activityLevel(c.activity);
        return `<div class="heatmap-cell lvl-${lvl}" title="${fmtThaiDate(c.iso)} — ${c.activity} actions"></div>`;
    }).join('');
    const sumA = $('#hmActiveDays'), sumB = $('#hmAvgActivity');
    if (sumA) sumA.textContent = activeDays + '/' + days;
    if (sumB) sumB.textContent = (totalActivity / days).toFixed(1);
}

// ===== Today's Nutrition Summary =====
function renderNutritionSummary() {
    const today = todayISO();
    const foods = Storage.getAll('food').filter(x => x.date === today);
    const cal = foods.reduce((s, x) => s + (+x.calories || 0), 0);
    const p   = foods.reduce((s, x) => s + (+x.protein  || 0), 0);
    const c   = foods.reduce((s, x) => s + (+x.carbs    || 0), 0);
    const f   = foods.reduce((s, x) => s + (+x.fat      || 0), 0);
    const goalCal = Storage.config.goalCalories || 2000;
    // Macro goals: rough split — 30% protein, 45% carbs, 25% fat (in kcal terms)
    const goalP = Math.round((goalCal * 0.30) / 4);
    const goalC = Math.round((goalCal * 0.45) / 4);
    const goalF = Math.round((goalCal * 0.25) / 9);

    const setEl = (id, v) => { const e = $('#' + id); if (e) e.textContent = v; };
    setEl('nutriCal', cal);
    setEl('nutriCalGoal', goalCal);
    setEl('nutriP', p + 'g / ' + goalP + 'g');
    setEl('nutriC', c + 'g / ' + goalC + 'g');
    setEl('nutriF', f + 'g / ' + goalF + 'g');

    // Ring (circumference 2π·50 ≈ 314)
    const C = 2 * Math.PI * 50;
    const ring = $('#nutriRing');
    if (ring) {
        const pct = Math.min(1, cal / goalCal);
        ring.style.strokeDasharray = C;
        ring.style.strokeDashoffset = C * (1 - pct);
        // Color shift if over goal
        ring.style.stroke = cal > goalCal ? 'var(--neon-red)' : 'var(--neon-purple)';
        ring.style.filter = cal > goalCal ? 'drop-shadow(0 0 8px var(--neon-red))' : 'drop-shadow(0 0 8px var(--neon-purple))';
    }

    const setBar = (id, v, goal) => {
        const e = $('#' + id); if (!e) return;
        e.style.width = Math.min(100, (v / goal) * 100) + '%';
    };
    setBar('nutriPBar', p, goalP);
    setBar('nutriCBar', c, goalC);
    setBar('nutriFBar', f, goalF);
}

// Body region status calculator
function computeBodyStatus(stats) {
    const today = todayISO();
    const last7 = getLast7Days();

    // group exercise by muscle area (heuristic by exType)
    const groupMap = {
        'วิ่ง': 'leg', 'เดิน': 'leg', 'ปั่นจักรยาน': 'leg',
        'ว่ายน้ำ': 'arm', 'เวทเทรนนิ่ง': 'chest',
        'โยคะ': 'core', 'อื่นๆ': 'core'
    };
    const minutes = { 'arm-l': 0, 'arm-r': 0, 'chest': 0, 'core': 0, 'leg-l': 0, 'leg-r': 0 };
    Storage.getAll('exercise').filter(x => last7.includes(x.date)).forEach(ex => {
        const grp = groupMap[ex.exType] || 'core';
        if (grp === 'leg')   { minutes['leg-l'] += +ex.duration || 0; minutes['leg-r'] += +ex.duration || 0; }
        if (grp === 'arm')   { minutes['arm-l'] += +ex.duration || 0; minutes['arm-r'] += +ex.duration || 0; }
        if (grp === 'chest') { minutes['chest'] += +ex.duration || 0; minutes['arm-l'] += (+ex.duration || 0) * 0.5; minutes['arm-r'] += (+ex.duration || 0) * 0.5; }
        if (grp === 'core')  { minutes['core']  += +ex.duration || 0; }
    });

    // Status rules
    const heavyToday = Storage.getAll('exercise').filter(x => x.date === today).reduce((s, x) => s + (+x.duration || 0), 0);
    const sleepHrs = stats.avgSleep;

    function statusFor(group) {
        const m = minutes[group];
        if (m === 0) return 'undertrained';
        if (m > 90 && sleepHrs < 7) return 'fatigued';
        if (m > 120) return 'fatigued';
        if (m > 30) return 'recovered';
        return 'undertrained';
    }

    const regions = {
        'region-arm-l': statusFor('arm-l'),
        'region-arm-r': statusFor('arm-r'),
        'region-chest': statusFor('chest'),
        'region-core':  statusFor('core'),
        'region-leg-l': statusFor('leg-l'),
        'region-leg-r': statusFor('leg-r')
    };

    // Special overrides
    if (stats.sta >= 80) {
        // hydration boost
        regions['region-core'] = regions['region-core'] === 'undertrained' ? 'hydrated' : regions['region-core'];
    }
    if (sleepHrs >= 7.5 && heavyToday < 30) {
        regions['region-chest'] = regions['region-chest'] === 'undertrained' ? 'energized' : regions['region-chest'];
    }

    Object.entries(regions).forEach(([id, status]) => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('class', 'body-region ' + status);
    });
}

// ----- Dashboard -----
let caloriesChart, weightChart, weightFullChart;
let _prevLevel = null;

function renderDashboard() {
    const today = todayISO();

    // ----- Compute stats -----
    const stats = computeStats();
    const RING_C = 2 * Math.PI * 34;  // circumference of the stat ring (r=34)
    const setStat = (key, value, meta) => {
        const num = $('#stat' + key);
        if (num) num.textContent = value;
        const ring = $('#ring' + key);
        if (ring) {
            ring.style.strokeDasharray = RING_C;
            ring.style.strokeDashoffset = RING_C * (1 - Math.min(100, Math.max(0, value)) / 100);
        }
        const meta_el = $('#stat' + key + 'Meta');
        if (meta_el && meta) meta_el.textContent = meta;
    };
    setStat('Hp',  stats.hp,  `เฉลี่ย ${stats.avgSleep.toFixed(1)} ชม. / คืน`);
    setStat('Sta', stats.sta, `${stats.totalWater} / ${Storage.config.goalWater} ml วันนี้`);
    setStat('Mp',  stats.mp,  `${stats.totalCal} / ${Storage.config.goalCalories} kcal`);
    setStat('Str', stats.str, `${stats.weekExMin} / 150 นาที สัปดาห์นี้`);
    const weight = Storage.getAll('weight').slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    if (weight) {
        const bmi = calcBMI(+weight.weight, +weight.height);
        const cat = bmiCategory(bmi);
        setStat('Vit', stats.vit, `${weight.weight} kg · BMI ${bmi} · ${cat.label}`);
    } else {
        setStat('Vit', stats.vit, 'ยังไม่ได้บันทึกน้ำหนัก');
    }
    setStat('Int', stats.int, `บันทึก ${stats.loggedDays} / 7 วัน`);

    // ----- Body status (muscle regions) -----
    computeBodyStatus(stats);

    // ----- Streak / Buffs / Badges / Heatmap -----
    $('#streakNum').textContent = computeStreak();
    renderBuffs(computeBuffs(stats));
    renderBadges();
    renderHeatmap();

    // ----- XP & Level -----
    const totalXP = computeXP();
    const lvl = computeLevel(totalXP);
    $('#levelNum').textContent = lvl.level;
    $('#xpCurrent').textContent = lvl.xpInLevel;
    $('#xpNeeded').textContent = lvl.xpNeeded;
    $('#xpBar').style.width = Math.min(100, (lvl.xpInLevel / lvl.xpNeeded) * 100) + '%';
    $('#charClass').textContent = getClassTitle(lvl.level);

    if (_prevLevel != null && lvl.level > _prevLevel) {
        toast(`⚔ LEVEL UP! เลื่อนเป็น Lv. ${lvl.level} — ${getClassTitle(lvl.level)}`, 'levelup');
    }
    _prevLevel = lvl.level;

    // ----- Daily Quests -----
    const quests = getQuests(today);
    let done = 0;
    const questNav = {
        water: 'wellness',
        exercise: 'exercise',
        meals: 'food',
        sleep: 'wellness',
        weigh: 'weight'
    };
    const questHint = {
        water:    'แตะเพื่อเพิ่มน้ำดื่ม',
        exercise: 'แตะเพื่อบันทึกการออกกำลังกาย',
        meals:    'แตะเพื่อบันทึกอาหาร',
        sleep:    'แตะเพื่อบันทึกการนอน',
        weigh:    'แตะเพื่อชั่งน้ำหนัก'
    };
    const qList = $('#questList');
    qList.innerHTML = quests.map(q => {
        const isDone = q.current >= q.target;
        if (isDone) done++;
        const pct = Math.min(100, (q.current / q.target) * 100);
        const cur = q.unit === 'ชม.' ? (+q.current).toFixed(1) : q.current;
        const tgt = q.target;
        const hint = isDone ? '✓ เสร็จแล้ว — ทำต่อได้!' : (questHint[q.id] || 'แตะเพื่อบันทึก');
        return `
            <div class="quest-item ${isDone ? 'done' : ''}" data-quest="${q.id}" data-nav="${questNav[q.id] || ''}" role="button" tabindex="0">
                <div class="quest-check">${isDone ? '✓' : ''}</div>
                <div class="quest-body">
                    <div class="quest-name">${q.name}</div>
                    <div class="quest-meta">
                        <span>${cur} / ${tgt} ${q.unit}</span>
                        <div class="quest-mini-bar"><div class="quest-mini-fill" style="width:${pct}%"></div></div>
                        <span class="quest-hint">${hint}</span>
                    </div>
                </div>
                <div class="quest-reward">+${q.xp} XP</div>
            </div>
        `;
    }).join('');
    $('#questDone').textContent = done;
    $('#questTotal').textContent = quests.length;

    // 7-day calories chart
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        last7.push(iso);
    }
    const calData = last7.map(iso => Storage.getAll('food').filter(x => x.date === iso).reduce((s, x) => s + (+x.calories || 0), 0));
    const burnData = last7.map(iso => Storage.getAll('exercise').filter(x => x.date === iso).reduce((s, x) => s + (+x.calories || 0), 0));
    const labels7 = last7.map(iso => new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }));

    if (caloriesChart) caloriesChart.destroy();
    caloriesChart = new Chart($('#caloriesChart'), {
        type: 'bar',
        data: {
            labels: labels7,
            datasets: [
                { label: 'รับ (kcal)', data: calData, backgroundColor: '#a855f7', borderRadius: 4 },
                { label: 'เผาผลาญ (kcal)', data: burnData, backgroundColor: '#22d3ee', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, color: '#8b93c7', font: { size: 11 } } } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(45, 53, 115, 0.5)' }, ticks: { color: '#8b93c7' } },
                x: { grid: { display: false }, ticks: { color: '#8b93c7' } }
            }
        }
    });

    // 30-day weight chart
    const weights = Storage.getAll('weight').slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const last30 = weights.slice(-30);
    if (weightChart) weightChart.destroy();
    weightChart = new Chart($('#weightChart'), {
        type: 'line',
        data: {
            labels: last30.map(x => new Date(x.date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })),
            datasets: [{
                label: 'น้ำหนัก (kg)',
                data: last30.map(x => +x.weight),
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                tension: 0.3,
                fill: true,
                pointRadius: 3,
                pointBackgroundColor: '#38bdf8',
                pointBorderColor: '#22d3ee'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { grid: { color: '#f1f3f6' } }, x: { grid: { display: false } } }
        }
    });

    // Recent activity
    const all = [];
    Storage.getAll('food').slice(-5).forEach(x => all.push({ type: 'food', date: x.createdAt, text: `<strong>${x.name}</strong> (${x.meal}) — ${x.calories} kcal` }));
    Storage.getAll('exercise').slice(-5).forEach(x => all.push({ type: 'ex', date: x.createdAt, text: `<strong>${x.exType}</strong> — ${x.duration} นาที, เผาผลาญ ${x.calories} kcal` }));
    Storage.getAll('water').slice(-5).forEach(x => all.push({ type: 'water', date: x.createdAt, text: `ดื่มน้ำ <strong>${x.amount} ml</strong>` }));
    Storage.getAll('sleep').slice(-5).forEach(x => all.push({ type: 'sleep', date: x.createdAt, text: `นอน <strong>${x.hours} ชม.</strong> (${x.quality})` }));
    Storage.getAll('weight').slice(-5).forEach(x => all.push({ type: 'weight', date: x.createdAt, text: `น้ำหนัก <strong>${x.weight} kg</strong>` }));

    const recent = all.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8);
    const iconMap = { food: '🍽', ex: '🏃', water: '💧', sleep: '🌙', weight: '⚖' };
    const cont = $('#recentActivity');
    if (recent.length === 0) {
        cont.innerHTML = '<div class="empty">ยังไม่มีกิจกรรม เริ่มบันทึกข้อมูลของคุณได้เลย</div>';
    } else {
        cont.innerHTML = recent.map(a => `
            <div class="activity-item">
                <div class="activity-icon ${a.type}">${iconMap[a.type]}</div>
                <div class="activity-text">${a.text}</div>
                <div class="activity-time">${new Date(a.date).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</div>
            </div>
        `).join('');
    }
}

// ----- Food -----
function renderFood() {
    renderNutritionSummary();
    const filter = $('#foodFilterDate').value;
    let rows = Storage.getAll('food').slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (filter) rows = rows.filter(r => r.date === filter);
    const tbody = $('#foodTable tbody');
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">ยังไม่มีรายการ</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(r => `
        <tr>
            <td>${fmtThaiDate(r.date)}</td>
            <td>${r.meal}</td>
            <td>${r.name}</td>
            <td>${r.amount || '-'}</td>
            <td class="num">${r.calories}</td>
            <td><button class="btn-delete" data-id="${r.id}" data-cat="food">ลบ</button></td>
        </tr>
    `).join('');
}

// ----- Exercise -----
function renderExercise() {
    const rows = Storage.getAll('exercise').slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const tbody = $('#exTable tbody');
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">ยังไม่มีรายการ</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(r => `
        <tr>
            <td>${fmtThaiDate(r.date)}</td>
            <td>${r.exType}</td>
            <td class="num">${r.duration}</td>
            <td class="num">${r.calories}</td>
            <td>${r.note || '-'}</td>
            <td><button class="btn-delete" data-id="${r.id}" data-cat="exercise">ลบ</button></td>
        </tr>
    `).join('');
}

// ----- Weight -----
function renderWeight() {
    const rows = Storage.getAll('weight').slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const tbody = $('#weightTable tbody');
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">ยังไม่มีรายการ</td></tr>';
    } else {
        tbody.innerHTML = rows.map(r => {
            const bmi = calcBMI(+r.weight, +r.height);
            const cat = bmiCategory(bmi);
            return `
                <tr>
                    <td>${fmtThaiDate(r.date)}</td>
                    <td class="num">${r.weight}</td>
                    <td class="num">${r.height}</td>
                    <td class="num">${bmi ?? '-'}</td>
                    <td><span class="bmi-badge ${cat.cls}">${cat.label}</span></td>
                    <td>${r.note || '-'}</td>
                    <td><button class="btn-delete" data-id="${r.id}" data-cat="weight">ลบ</button></td>
                </tr>
            `;
        }).join('');
    }

    // Chart
    const asc = rows.slice().reverse();
    if (weightFullChart) weightFullChart.destroy();
    weightFullChart = new Chart($('#weightFullChart'), {
        type: 'line',
        data: {
            labels: asc.map(x => new Date(x.date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })),
            datasets: [
                {
                    label: 'น้ำหนัก (kg)',
                    data: asc.map(x => +x.weight),
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    tension: 0.3,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'BMI',
                    data: asc.map(x => calcBMI(+x.weight, +x.height)),
                    borderColor: '#10b981',
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    borderDash: [4, 4],
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                y: { type: 'linear', position: 'left', grid: { color: '#f1f3f6' } },
                y1: { type: 'linear', position: 'right', grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

// ----- Wellness -----
function renderWellness() {
    // Water aggregated by day
    const waterAgg = {};
    Storage.getAll('water').forEach(r => {
        if (!waterAgg[r.date]) waterAgg[r.date] = { total: 0, count: 0 };
        waterAgg[r.date].total += +r.amount || 0;
        waterAgg[r.date].count++;
    });
    const waterRows = Object.entries(waterAgg).sort((a, b) => b[0].localeCompare(a[0]));
    const waterBody = $('#waterTable tbody');
    waterBody.innerHTML = waterRows.length === 0 ? '<tr><td colspan="3" class="empty">ยังไม่มีข้อมูล</td></tr>'
        : waterRows.map(([date, v]) => `<tr><td>${fmtThaiDate(date)}</td><td class="num">${v.total}</td><td class="num">${v.count}</td></tr>`).join('');

    const sleepRows = Storage.getAll('sleep').slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const sleepBody = $('#sleepTable tbody');
    sleepBody.innerHTML = sleepRows.length === 0 ? '<tr><td colspan="4" class="empty">ยังไม่มีข้อมูล</td></tr>'
        : sleepRows.map(r => `<tr><td>${fmtThaiDate(r.date)}</td><td class="num">${r.hours}</td><td>${r.quality}</td><td><button class="btn-delete" data-id="${r.id}" data-cat="sleep">ลบ</button></td></tr>`).join('');
}

// ----- AI Insights -----
function getWeeklyAggregate() {
    const last7 = getLast7Days();
    const foods = Storage.getAll('food').filter(x => last7.includes(x.date));
    const ex = Storage.getAll('exercise').filter(x => last7.includes(x.date));
    const water = Storage.getAll('water').filter(x => last7.includes(x.date));
    const sleep = Storage.getAll('sleep').filter(x => last7.includes(x.date));

    const calsByDay = last7.map(d => foods.filter(x => x.date === d).reduce((s, x) => s + (+x.calories || 0), 0));
    const waterByDay = last7.map(d => water.filter(x => x.date === d).reduce((s, x) => s + (+x.amount || 0), 0));
    const sleepByDay = last7.map(d => {
        const s = sleep.filter(x => x.date === d);
        return s.length ? s.reduce((acc, x) => acc + (+x.hours || 0), 0) : 0;
    });
    const validSleep = sleepByDay.filter(x => x > 0);

    return {
        avgCalories: Math.round(calsByDay.reduce((a, b) => a + b, 0) / 7),
        totalWorkoutMin: ex.reduce((s, x) => s + (+x.duration || 0), 0),
        avgWater: Math.round(waterByDay.reduce((a, b) => a + b, 0) / 7),
        avgSleep: validSleep.length ? +(validSleep.reduce((a, b) => a + b, 0) / validSleep.length).toFixed(1) : 0,
        calGoal: Storage.config.goalCalories,
        waterGoal: Storage.config.goalWater
    };
}

function renderInsights() {
    const agg = getWeeklyAggregate();
    $('#wkAvgCal').textContent     = agg.avgCalories + ' kcal';
    $('#wkTotalEx').textContent    = agg.totalWorkoutMin + ' min';
    $('#wkAvgWater').textContent   = agg.avgWater + ' ml';
    $('#wkAvgSleep').textContent   = agg.avgSleep + ' hr';
}

// ===== Workout Plan =====
function renderWorkoutPlan(planObj) {
    const container = $('#workoutPlan');
    if (!container || !planObj) return;
    const plan = planObj.plan || [];
    const tips = planObj.tips || [];

    let html = '';
    if (tips.length) {
        html += `<div class="workout-plan-tips">
            <div class="workout-plan-tips-title">✦ AI Coach Tips</div>
            <ul>${tips.map(t => `<li>${t}</li>`).join('')}</ul>
        </div>`;
    }
    html += '<div class="plan-days">';
    plan.forEach(d => {
        const isRest = !d.exercises || d.exercises.length === 0 || /rest|พัก/i.test(d.focus || '');
        html += `<div class="plan-day ${isRest ? 'rest' : ''}">
            <div class="plan-day-header">
                <div class="plan-day-name">${d.day || ''}</div>
                <div class="plan-day-focus">${d.focus || ''}</div>
            </div>`;
        if (isRest) {
            html += `<div class="plan-rest-msg">💤 พักผ่อน / Active Recovery</div>`;
        } else {
            html += '<div class="plan-exercise-list">';
            (d.exercises || []).forEach(ex => {
                html += `<div class="plan-exercise">
                    <div class="plan-exercise-name">${ex.name}</div>
                    <div class="plan-exercise-meta">${ex.sets ? ex.sets + ' sets' : ''} ${ex.reps ? '× ' + ex.reps : ''}</div>
                    ${ex.note ? `<div class="plan-exercise-note">${ex.note}</div>` : ''}
                </div>`;
            });
            html += '</div>';
        }
        html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

function localWorkoutPlan(opts) {
    // Fallback plan when no Gemini configured
    const DAYS = ['จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์','อาทิตย์'];
    const dpw = Math.min(6, Math.max(3, parseInt(opts.daysPerWeek || 4)));
    const isHome = /บ้าน/.test(opts.place || '');
    const noEquip = /ไม่มี/.test(opts.place || '');

    const pushDay = [
        { name: 'Push-up', sets: 3, reps: '10-15', note: 'ถ้าง่าย ยกเท้าบนเก้าอี้' },
        { name: 'Pike Push-up (ไหล่)', sets: 3, reps: '8-12' },
        { name: 'Tricep Dips บนเก้าอี้', sets: 3, reps: '10-12' }
    ];
    const pullDay = [
        { name: 'Inverted Row (โต๊ะ/แทง)', sets: 3, reps: '8-12' },
        { name: 'Doorway Pull-up', sets: 3, reps: 'max' },
        { name: 'Superman Hold', sets: 3, reps: '20-30 sec' }
    ];
    const legDay = [
        { name: 'Squat', sets: 4, reps: '12-15', note: 'ลงให้สะโพกต่ำกว่าเข่า' },
        { name: 'Lunge', sets: 3, reps: '10 ต่อข้าง' },
        { name: 'Calf Raise', sets: 3, reps: '15-20' }
    ];
    const coreDay = [
        { name: 'Plank', sets: 3, reps: '30-60 sec' },
        { name: 'Bicycle Crunch', sets: 3, reps: '20' },
        { name: 'Leg Raise', sets: 3, reps: '12-15' }
    ];
    const cardioDay = [
        { name: 'Jump Rope หรือ Jumping Jacks', sets: 4, reps: '60 sec' },
        { name: 'High Knees', sets: 3, reps: '45 sec' },
        { name: 'Mountain Climbers', sets: 3, reps: '40 sec' }
    ];

    const cycles = {
        3: [pushDay, legDay, pullDay],
        4: [pushDay, pullDay, legDay, coreDay],
        5: [pushDay, pullDay, legDay, coreDay, cardioDay],
        6: [pushDay, pullDay, legDay, coreDay, cardioDay, pushDay]
    };
    const used = cycles[dpw];
    const plan = [];
    let idx = 0;
    for (let i = 0; i < 7; i++) {
        if (idx < used.length && (i % Math.round(7/dpw) === 0 || (7 - i) <= (dpw - idx))) {
            plan.push({ day: DAYS[i], focus: ['Push','Pull','Legs','Core','Cardio','Push'][idx % 6], exercises: used[idx] });
            idx++;
        } else {
            plan.push({ day: DAYS[i], focus: 'Rest', exercises: [] });
        }
    }

    return {
        plan,
        tips: [
            'อบอุ่นร่างกาย 5-10 นาทีก่อนทุกครั้ง',
            'พักระหว่างเซ็ต 60-90 วินาที',
            (noEquip ? 'ทำที่บ้านโดยไม่ต้องใช้อุปกรณ์' : 'ใช้น้ำหนักที่ทำได้ 8-12 ครั้งจนล้า'),
            'ดื่มน้ำให้พอ และนอน 7+ ชั่วโมง'
        ]
    };
}

function localRecipeSuggestions(remainingCal) {
    // Pick recipes that fit the remaining calorie budget
    const ALL = [
        { name: 'อกไก่ย่าง + ข้าวกล้อง + บร็อกโคลี่',     cal: 480, p: 42, c: 52, f: 8,  desc: 'ย่างอกไก่หมักเกลือ-พริกไทย เสิร์ฟกับข้าวกล้อง 1 ทัพพี และบร็อกโคลี่ลวก' },
        { name: 'สลัดทูน่า + ไข่ต้ม',                     cal: 320, p: 36, c: 12, f: 14, desc: 'ผักสลัด ทูน่า 1 กระป๋อง ไข่ต้ม 2 ฟอง ราดน้ำสลัดน้ำใส' },
        { name: 'เต้าหู้นึ่งซีอิ๊ว + ผักโขมผัดกระเทียม', cal: 380, p: 24, c: 24, f: 18, desc: 'เต้าหู้ขาวนึ่งราดซีอิ๊ว ผักโขมผัดกระเทียมเล็กน้อย' },
        { name: 'ปลาแซลมอนย่าง + อโวคาโด',                cal: 520, p: 38, c: 8,  f: 36, desc: 'แซลมอนย่างเกลือ-มะนาว + อโวคาโดหั่นเป็นชิ้น' },
        { name: 'โอ๊ตมีลโปรตีน + กล้วย + อัลมอนด์',       cal: 380, p: 28, c: 48, f: 8,  desc: 'โอ๊ต 40g + เวย์ 1 สก๊อป + กล้วย + อัลมอนด์ 10 เม็ด' },
        { name: 'ข้าวไข่ข้น + ผักสด',                     cal: 420, p: 18, c: 56, f: 14, desc: 'ข้าว 1 ทัพพี ราดไข่ข้น เสิร์ฟกับผักสด' },
        { name: 'โยเกิร์ตกรีก + ผลไม้รวม + ถั่ว',          cal: 280, p: 22, c: 28, f: 8,  desc: 'กรีกโยเกิร์ตไม่หวาน + เบอร์รี่ + ถั่วอัลมอนด์' },
        { name: 'ต้มยำกุ้งใส่เห็ด',                       cal: 220, p: 24, c: 14, f: 6,  desc: 'ต้มยำน้ำใส กุ้ง 6-8 ตัว เห็ด สมุนไพร' },
        { name: 'หมูสันในย่าง + ผักโขม + มันหวาน',         cal: 460, p: 38, c: 38, f: 14, desc: 'หมูสันในย่างเกลือ + ผักโขมผัด + มันหวานนึ่ง' }
    ];
    // Sort by closeness to remaining cal and pick top 3
    const sorted = ALL.slice().sort((a, b) => Math.abs(a.cal - remainingCal) - Math.abs(b.cal - remainingCal));
    return sorted.slice(0, 3).map(r => ({ name: r.name, calories: r.cal, protein: r.p, carbs: r.c, fat: r.f, desc: r.desc }));
}

function localWeeklyInsights(agg) {
    const lines = [];
    if (agg.avgCalories < agg.calGoal * 0.8) lines.push('🟣 แคลอรี่ต่ำกว่าเป้าหมายติดต่อกัน — พลังงานอาจไม่เพียงพอ ลองเพิ่มมื้อย่อย');
    else if (agg.avgCalories > agg.calGoal * 1.15) lines.push('🔴 แคลอรี่เกินเป้า ลองคุมพอร์ชั่นหรือเพิ่มคาร์ดิโอ');
    else lines.push('🟢 แคลอรี่อยู่ในเกณฑ์ดี');

    if (agg.avgWater < agg.waterGoal * 0.8) lines.push('🔵 ดื่มน้ำต่ำกว่าเป้า ลองเพิ่ม ~500ml/วัน');
    else lines.push('🟢 ระดับน้ำในร่างกายดี');

    if (agg.totalWorkoutMin < 120) lines.push('🟡 ออกกำลังกายน้อย (<120 นาที/สัปดาห์) WHO แนะนำ 150+');
    else lines.push('🟢 ปริมาณการออกกำลังกายดี');

    if (agg.avgSleep > 0 && agg.avgSleep < 7) lines.push('🟡 นอนน้อยเฉลี่ย — การฟื้นฟูร่างกายอาจไม่เต็มที่');
    else if (agg.avgSleep >= 7) lines.push('🟢 คุณภาพการนอนดี');

    return lines;
}

// ----- Settings -----
function renderSettings() {
    $('#goalCalories').value = Storage.config.goalCalories;
    $('#goalWater').value = Storage.config.goalWater;
    $('#defaultHeight').value = Storage.config.defaultHeight;
    $('#sheetUrl').value = Storage.config.sheetUrl || '';
    $('#sheetSecret').value = Storage.config.sheetSecret || '';
    updateSyncStatus();
}

function updateSyncStatus() {
    const status = $('#syncStatus');
    const text = status.querySelector('.status-text');
    if (Storage.config.sheetUrl) {
        status.classList.add('connected');
        text.textContent = Storage.config.lastSync
            ? 'Synced ' + new Date(Storage.config.lastSync).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
            : 'Sheets Ready';
    } else {
        status.classList.remove('connected');
        text.textContent = 'Local Mode';
    }
}

// ----- Event handlers -----
function initEvents() {
    // Nav
    $$('.topnav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
    // Settings gear icon (in top-right)
    const settingsBtn = $('#settingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => switchView('settings'));

    // Editable character name
    const charName = $('#charName');
    if (charName) {
        charName.textContent = Storage.config.userName || 'UCHIDA';
        const saveName = () => {
            const n = charName.textContent.trim().toUpperCase().slice(0, 20) || 'OPERATOR';
            charName.textContent = n;
            Storage.config.userName = n;
            Storage.saveConfig();
            toast('บันทึกชื่อแล้ว', 'success');
        };
        charName.addEventListener('blur', saveName);
        charName.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); charName.blur(); }
            if (e.key === 'Escape') { charName.textContent = Storage.config.userName || 'UCHIDA'; charName.blur(); }
        });
    }

    // Meal pill selector (replaces select dropdown)
    $$('.meal-pill').forEach(btn => btn.addEventListener('click', () => {
        $$('.meal-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const meal = $('#foodMeal');
        if (meal) meal.value = btn.dataset.meal;
    }));

    // Set today's date
    const today = todayISO();
    $$('input[type="date"]').forEach(i => { if (!i.value) i.value = today; });

    // Set default date for food form (hidden input)
    if ($('#foodDate')) $('#foodDate').value = today;

    // Save AI result → log a meal
    $('#saveAiBtn').addEventListener('click', () => {
        if (!_lastAiResult) { toast('ยังไม่มีผลวิเคราะห์', 'error'); return; }
        const name = $('#foodName').value.trim() || (_lastAiResult.items || []).join(', ') || 'AI Meal';
        Storage.add('food', {
            date: $('#foodDate').value || today,
            meal: $('#foodMeal').value || 'เช้า',
            name,
            amount: '',
            note: $('#foodNote').value.trim(),
            calories: _lastAiResult.calories,
            protein: _lastAiResult.protein || 0,
            carbs: _lastAiResult.carbs || 0,
            fat: _lastAiResult.fat || 0
        });
        $('#foodName').value = '';
        $('#foodNote').value = '';
        $('#aiBox').classList.remove('show');
        clearPhoto();
        _lastAiResult = null;
        toast('บันทึกมื้อนี้แล้ว — ' + _lastAiResult_meta(), 'success');
        renderFood();
        renderDashboard();
    });

    // Discard AI result
    $('#discardAiBtn').addEventListener('click', () => {
        $('#aiBox').classList.remove('show');
        _lastAiResult = null;
    });

    function _lastAiResult_meta() {
        return 'XP +' + 15;
    }

    // ===== Photo handling =====
    let _currentPhoto = null;        // base64 string (no prefix)
    let _currentPhotoMime = '';
    let _lastAiResult = null;

    function clearPhoto() {
        _currentPhoto = null;
        _currentPhotoMime = '';
        const img = $('#photoPreview');
        if (img) img.src = '';
        const row = $('#photoPreviewRow');
        if (row) row.style.display = 'none';
        const drop = $('.photo-drop');
        if (drop) drop.classList.remove('has-image');
        const fileInput = $('#foodPhoto');
        if (fileInput) fileInput.value = '';
    }

    $('#foodPhoto').addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 6 * 1024 * 1024) {
            toast('ไฟล์ใหญ่เกินไป (max 6MB)', 'error');
            return;
        }
        try {
            const compressed = await compressImage(file, 900, 0.78);
            _currentPhoto = compressed.base64;
            _currentPhotoMime = compressed.mime;
            const img = $('#photoPreview');
            img.src = 'data:' + compressed.mime + ';base64,' + compressed.base64;
            const row = $('#photoPreviewRow');
            if (row) row.style.display = 'flex';
            toast('เพิ่มรูปแล้ว — กดให้ AI วิเคราะห์ได้เลย', 'success');
        } catch (err) {
            toast('โหลดรูปไม่สำเร็จ: ' + err.message, 'error');
        }
    });

    $('#clearPhotoBtn').addEventListener('click', () => { clearPhoto(); });

    // AI Analyze button — supports both text and photo
    $('#aiAnalyzeBtn').addEventListener('click', async () => {
        const desc = $('#foodName').value.trim();
        const note = ($('#foodNote') && $('#foodNote').value || '').trim();
        const hasPhoto = !!_currentPhoto;

        if (!desc && !hasPhoto) {
            toast('ใส่ชื่ออาหาร หรือถ่ายรูปก่อน', 'error');
            return;
        }

        const btn = $('#aiAnalyzeBtn');
        const box = $('#aiBox');
        const title = $('#aiBoxTitle');
        const status = $('#aiStatusBadge');
        btn.disabled = true;
        btn.innerHTML = '<span class="ai-loading"></span> AI กำลังวิเคราะห์...';
        box.classList.add('show');
        title.textContent = hasPhoto ? 'AI Vision Analysis' : 'AI Nutrition Analysis';
        if (status) status.textContent = 'PROCESSING';
        $('#aiCal').textContent = '...'; $('#aiPro').textContent = '...'; $('#aiCarb').textContent = '...'; $('#aiFat').textContent = '...';
        $('#aiText').textContent = 'กำลังวิเคราะห์...';
        $('#aiDetected').innerHTML = '';

        try {
            let result;
            if (Storage.config.sheetUrl) {
                try {
                    const payload = {
                        description: desc,
                        note,
                        image: _currentPhoto || null,
                        mime: _currentPhotoMime || null
                    };
                    const res = await Storage.aiMeal(payload);
                    result = res.estimate || res.data || res;
                    title.textContent = hasPhoto ? 'Gemini Vision ✦' : 'Gemini AI ✦';
                } catch (apiErr) {
                    console.warn('Gemini failed, fallback:', apiErr);
                    if (hasPhoto) {
                        $('#aiText').textContent = 'AI Vision ต้องใช้ Gemini API — กรุณาตั้งค่าใน Console: ' + apiErr.message;
                        throw apiErr;
                    }
                    result = window.LocalAI.estimate(desc + ' ' + note);
                    title.textContent = 'AI Analysis (Local fallback)';
                }
            } else {
                if (hasPhoto) {
                    $('#aiText').textContent = 'AI Vision ต้องเชื่อมต่อ Gemini ก่อน — ไปที่ Console เพื่อตั้งค่า';
                    throw new Error('Gemini not configured');
                }
                result = window.LocalAI.estimate(desc + ' ' + note);
                title.textContent = 'AI Analysis (Local — เชื่อมต่อ Gemini เพื่อความแม่นยำ)';
            }

            if (!result) throw new Error('No result');
            _lastAiResult = result;
            $('#aiCal').textContent  = result.calories;
            $('#aiPro').textContent  = (result.protein || 0) + 'g';
            $('#aiCarb').textContent = (result.carbs || 0) + 'g';
            $('#aiFat').textContent  = (result.fat || 0) + 'g';
            $('#aiText').textContent = result.analysis || result.ai_analysis || 'วิเคราะห์เสร็จสิ้น';

            // Show detected items as chips
            const items = result.items || result.detected || [];
            if (Array.isArray(items) && items.length) {
                $('#aiDetected').innerHTML = items.slice(0, 8).map(x => `<span class="ai-detected-chip">${x}</span>`).join('');
            }
            if (status) status.textContent = 'COMPLETE';

            // Auto-fill foodName if empty
            if (!$('#foodName').value.trim() && items && items.length) {
                $('#foodName').value = items.join(', ');
            }
        } catch (err) {
            $('#aiText').textContent = 'วิเคราะห์ล้มเหลว: ' + err.message;
            if (status) status.textContent = 'ERROR';
            toast('AI วิเคราะห์ล้มเหลว', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '✦ ให้ AI คำนวณโภชนาการให้';
        }
    });

    // ===== AI Workout Plan Generator =====
    const generateBtn = $('#generatePlanBtn');
    if (generateBtn) generateBtn.addEventListener('click', async () => {
        const opts = {
            goal: $('#wpGoal').value,
            place: $('#wpPlace').value,
            daysPerWeek: $('#wpDays').value,
            level: $('#wpLevel').value,
            note: $('#wpNote').value.trim()
        };
        const out = $('#workoutPlan');
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="ai-loading"></span> AI กำลังออกแบบตาราง...';
        out.innerHTML = '<div class="empty">AI กำลังออกแบบโปรแกรม 7 วันให้คุณ...</div>';

        try {
            let planObj;
            if (Storage.config.sheetUrl) {
                try {
                    const res = await Storage.aiWorkoutPlan(opts);
                    planObj = { plan: res.plan || [], tips: res.tips || [] };
                } catch (apiErr) {
                    console.warn('Gemini workout failed, fallback:', apiErr);
                    planObj = localWorkoutPlan(opts);
                    toast('ใช้ตารางสำเร็จรูป (Gemini ไม่ตอบ)', 'error');
                }
            } else {
                planObj = localWorkoutPlan(opts);
                toast('ใช้ตารางสำเร็จรูป — เชื่อม Gemini เพื่อให้ AI ออกแบบจริง', 'success');
            }
            renderWorkoutPlan(planObj);
        } catch (err) {
            out.innerHTML = `<div class="empty">ออกแบบล้มเหลว: ${err.message}</div>`;
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '✦ Generate Workout Plan';
        }
    });

    // AI Recipe Suggestor
    $('#aiRecipeBtn').addEventListener('click', async () => {
        const today = todayISO();
        const foods = Storage.getAll('food').filter(x => x.date === today);
        const consumed = foods.reduce((s, x) => s + (+x.calories || 0), 0);
        const remainingCal = Math.max(0, Storage.config.goalCalories - consumed);
        const list = $('#recipeList');
        const btn = $('#aiRecipeBtn');
        const remainingInfo = $('#recipeRemaining');
        remainingInfo.textContent = ` (เหลือ ~${remainingCal} kcal)`;

        btn.disabled = true;
        btn.innerHTML = '<span class="ai-loading"></span> กำลังคิด...';
        list.innerHTML = '<div class="empty">AI กำลังเลือกเมนูที่ดีที่สุดให้คุณ...</div>';

        try {
            let recipes;
            if (Storage.config.sheetUrl) {
                try {
                    const res = await Storage.aiRecipe({ calories: remainingCal });
                    recipes = res.recipes || [];
                } catch (apiErr) {
                    console.warn('Gemini recipe failed, fallback:', apiErr);
                    recipes = localRecipeSuggestions(remainingCal);
                }
            } else {
                recipes = localRecipeSuggestions(remainingCal);
            }

            if (!recipes || recipes.length === 0) {
                list.innerHTML = '<div class="empty">ไม่มีเมนูแนะนำในตอนนี้</div>';
                return;
            }

            list.innerHTML = recipes.map(r => `
                <div class="recipe-item">
                    <div class="recipe-name">${r.name}</div>
                    <div class="recipe-macros">
                        <span class="recipe-macro-pill"><strong>${r.calories || 0}</strong> kcal</span>
                        <span class="recipe-macro-pill">P <strong>${r.protein || 0}</strong>g</span>
                        <span class="recipe-macro-pill">C <strong>${r.carbs || 0}</strong>g</span>
                        <span class="recipe-macro-pill">F <strong>${r.fat || 0}</strong>g</span>
                    </div>
                    <div class="recipe-desc">${r.desc || ''}</div>
                </div>
            `).join('');
            toast('แนะนำเมนูเสร็จแล้ว', 'success');
        } catch (err) {
            list.innerHTML = `<div class="empty">วิเคราะห์ล้มเหลว: ${err.message}</div>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'แนะนำเมนู';
        }
    });

    // Mobile menu toggle
    const mobileBtn = $('#mobileMenuBtn');
    if (mobileBtn) mobileBtn.addEventListener('click', () => {
        $('.topnav-menu').classList.toggle('open');
    });

    $('#foodFilterDate').addEventListener('change', renderFood);

    // Exercise form
    $('#exerciseForm').addEventListener('submit', e => {
        e.preventDefault();
        Storage.add('exercise', {
            date: $('#exDate').value,
            exType: $('#exType').value,
            duration: +$('#exDuration').value,
            calories: +$('#exCalories').value,
            note: $('#exNote').value.trim()
        });
        e.target.reset();
        $('#exDate').value = today;
        toast('บันทึกการออกกำลังกายแล้ว', 'success');
        renderExercise();
    });

    // Weight form
    $('#weightForm').addEventListener('submit', e => {
        e.preventDefault();
        const weight = +$('#wWeight').value;
        const height = +$('#wHeight').value;
        Storage.add('weight', {
            date: $('#wDate').value,
            weight,
            height,
            note: $('#wNote').value.trim()
        });
        Storage.config.defaultHeight = height;
        Storage.saveConfig();
        e.target.reset();
        $('#wDate').value = today;
        $('#wHeight').value = Storage.config.defaultHeight;
        toast('บันทึกน้ำหนักแล้ว', 'success');
        renderWeight();
    });

    // Water form
    $('#waterForm').addEventListener('submit', e => {
        e.preventDefault();
        Storage.add('water', { date: $('#waDate').value, amount: +$('#waAmount').value });
        toast(`เพิ่มน้ำ ${$('#waAmount').value} ml`, 'success');
        renderWellness();
    });

    $$('[data-water]').forEach(btn => btn.addEventListener('click', () => {
        const amt = +btn.dataset.water;
        Storage.add('water', { date: $('#waDate').value || today, amount: amt });
        toast(`เพิ่มน้ำ ${amt} ml`, 'success');
        renderWellness();
    }));

    // Sleep form
    $('#sleepForm').addEventListener('submit', e => {
        e.preventDefault();
        Storage.add('sleep', {
            date: $('#sDate').value,
            hours: +$('#sHours').value,
            quality: $('#sQuality').value
        });
        e.target.reset();
        $('#sDate').value = today;
        $('#sQuality').value = 'ดี';
        toast('บันทึกการนอนแล้ว', 'success');
        renderWellness();
    });

    // Quest click → navigate to relevant tracking page
    document.addEventListener('click', e => {
        const quest = e.target.closest('.quest-item');
        if (quest && quest.dataset.nav) {
            const nav = quest.dataset.nav;
            switchView(nav);
            // small flash hint
            const dateInput = document.querySelector(`#view-${nav} input[type="date"]`);
            if (dateInput) dateInput.focus();
        }
    });
    // Allow keyboard activation of quests
    document.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            const quest = e.target.closest && e.target.closest('.quest-item');
            if (quest && quest.dataset.nav) {
                e.preventDefault();
                switchView(quest.dataset.nav);
            }
        }
    });

    // Delete (event delegation)
    document.addEventListener('click', e => {
        if (e.target.matches('.btn-delete')) {
            const id = e.target.dataset.id;
            const cat = e.target.dataset.cat;
            if (confirm('ลบรายการนี้ใช่ไหม?')) {
                Storage.remove(cat, id);
                toast('ลบรายการแล้ว');
                if (cat === 'food') renderFood();
                else if (cat === 'exercise') renderExercise();
                else if (cat === 'weight') renderWeight();
                else renderWellness();
            }
        }
    });

    // Goals form
    $('#goalsForm').addEventListener('submit', e => {
        e.preventDefault();
        Storage.config.goalCalories = +$('#goalCalories').value;
        Storage.config.goalWater = +$('#goalWater').value;
        Storage.config.defaultHeight = +$('#defaultHeight').value || 170;
        Storage.saveConfig();
        toast('บันทึกเป้าหมายแล้ว', 'success');
    });

    // Sheets form
    $('#sheetsForm').addEventListener('submit', e => {
        e.preventDefault();
        Storage.config.sheetUrl = $('#sheetUrl').value.trim();
        Storage.config.sheetSecret = $('#sheetSecret').value.trim();
        Storage.saveConfig();
        updateSyncStatus();
        toast('บันทึกการตั้งค่า Sheets แล้ว', 'success');
    });

    $('#testConnBtn').addEventListener('click', async () => {
        Storage.config.sheetUrl = $('#sheetUrl').value.trim();
        Storage.config.sheetSecret = $('#sheetSecret').value.trim();
        Storage.saveConfig();
        const result = $('#connResult');
        result.className = 'conn-result';
        result.textContent = 'กำลังทดสอบ...';
        const status = $('#syncStatus');
        status.classList.add('syncing');
        try {
            const res = await Storage.testConnection();
            result.className = 'conn-result success';
            result.textContent = '✓ เชื่อมต่อสำเร็จ — ' + (res.message || 'พร้อมใช้งาน');
            updateSyncStatus();
        } catch (err) {
            result.className = 'conn-result error';
            result.textContent = '✗ ' + err.message;
        } finally {
            status.classList.remove('syncing');
        }
    });

    $('#pushAllBtn').addEventListener('click', async () => {
        if (!confirm('การกระทำนี้จะแทนที่ข้อมูลทั้งหมดใน Google Sheet ดำเนินการต่อ?')) return;
        const result = $('#connResult');
        result.className = 'conn-result';
        result.textContent = 'กำลังอัปโหลด...';
        try {
            await Storage.pushAll();
            result.className = 'conn-result success';
            result.textContent = '✓ ส่งข้อมูลทั้งหมดไป Google Sheet สำเร็จ';
            updateSyncStatus();
        } catch (err) {
            result.className = 'conn-result error';
            result.textContent = '✗ ' + err.message;
        }
    });

    $('#pullAllBtn').addEventListener('click', async () => {
        if (!confirm('การกระทำนี้จะแทนที่ข้อมูลในเครื่องด้วยข้อมูลจาก Google Sheet ดำเนินการต่อ?')) return;
        const result = $('#connResult');
        result.className = 'conn-result';
        result.textContent = 'กำลังดึงข้อมูล...';
        try {
            await Storage.pullAll();
            result.className = 'conn-result success';
            result.textContent = '✓ ดึงข้อมูลสำเร็จ';
            updateSyncStatus();
            renderDashboard();
        } catch (err) {
            result.className = 'conn-result error';
            result.textContent = '✗ ' + err.message;
        }
    });

    // Export / Import / Clear
    $('#exportBtn').addEventListener('click', () => {
        const blob = new Blob([Storage.exportJSON()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `health-tracker-${todayISO()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast('ส่งออกข้อมูลแล้ว', 'success');
    });

    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            Storage.importJSON(text);
            toast('นำเข้าข้อมูลแล้ว', 'success');
            renderDashboard();
            renderSettings();
        } catch (err) {
            toast('นำเข้าล้มเหลว: ' + err.message, 'error');
        }
    });

    $('#clearBtn').addEventListener('click', () => {
        if (!confirm('ล้างข้อมูลทั้งหมดในเครื่องใช่ไหม? (ข้อมูลใน Google Sheet จะไม่ถูกลบ)')) return;
        Storage.clear();
        toast('ล้างข้อมูลแล้ว');
        renderDashboard();
    });

    // Generate AI Insights
    $('#generateInsightBtn').addEventListener('click', async () => {
        const btn = $('#generateInsightBtn');
        const list = $('#insightList');
        btn.disabled = true;
        btn.innerHTML = '<span class="ai-loading"></span> Analyzing...';
        list.innerHTML = '<div class="empty">กำลังวิเคราะห์ข้อมูลของคุณ...</div>';

        const agg = getWeeklyAggregate();
        try {
            let insights;
            if (Storage.config.sheetUrl) {
                try {
                    const res = await Storage.aiInsight(agg);
                    insights = res.insights || res.data || [];
                } catch (apiErr) {
                    console.warn('Gemini insight failed, fallback:', apiErr);
                    insights = localWeeklyInsights(agg);
                }
            } else {
                insights = localWeeklyInsights(agg);
            }

            if (!insights || insights.length === 0) insights = ['ยังมีข้อมูลไม่พอสำหรับการวิเคราะห์ — บันทึกข้อมูลให้ครบ 7 วันก่อน'];
            list.innerHTML = insights.map(t => `<div class="insight-item">${t}</div>`).join('');
            toast('Insights generated', 'success');
        } catch (err) {
            list.innerHTML = `<div class="insight-item">วิเคราะห์ล้มเหลว: ${err.message}</div>`;
            toast('AI วิเคราะห์ล้มเหลว', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '✦ Generate Insights';
        }
    });

    $('#syncBtn').addEventListener('click', async () => {
        if (!Storage.config.sheetUrl) {
            switchView('settings');
            toast('กรุณาตั้งค่า Google Sheets ก่อน', 'error');
            return;
        }
        const status = $('#syncStatus');
        status.classList.add('syncing');
        try {
            await Storage.pullAll();
            toast('ซิงค์ข้อมูลสำเร็จ', 'success');
            updateSyncStatus();
            renderDashboard();
        } catch (err) {
            toast('ซิงค์ล้มเหลว: ' + err.message, 'error');
        } finally {
            status.classList.remove('syncing');
        }
    });
}

// ----- Init -----
function init() {
    Storage.load();
    $('#currentDate').textContent = fmtLongThaiDate();
    // Set default height
    if (Storage.config.defaultHeight && $('#wHeight')) {
        $('#wHeight').value = Storage.config.defaultHeight;
    }
    initEvents();
    switchView('dashboard');
    updateSyncStatus();
}

document.addEventListener('DOMContentLoaded', init);
