/* ============================================================
   VITA — Calculation Engine
   - BMR / TDEE
   - Protein / Water target
   - Recovery / Sleep score
   - XP & Level
   - Streaks
   ============================================================ */

window.VITA = window.VITA || {};

// ----- BMR (Mifflin-St Jeor) -----
VITA.calcBMR = ({ weight, height, age, sex = 'male' }) => {
    if (!weight || !height || !age) return 0;
    const base = 10 * weight + 6.25 * height - 5 * age;
    return Math.round(base + (sex === 'male' ? 5 : -161));
};

// ----- TDEE -----
VITA.calcTDEE = ({ bmr, activity = 'moderate' }) => {
    const factors = window.VITA_CONFIG.ACTIVITY_FACTORS;
    return Math.round(bmr * (factors[activity] || factors.moderate));
};

// ----- Targets -----
VITA.calcProteinTarget = (weight, level = 'moderate') => {
    const perKg = { low: 1.2, moderate: 1.6, high: 2.0 };
    return Math.round(weight * (perKg[level] || perKg.moderate));
};

VITA.calcWaterTarget = (weight) => Math.round(weight * 35); // ml

// ----- BMI -----
VITA.calcBMI = (weight, heightCm) => {
    if (!weight || !heightCm) return null;
    const h = heightCm / 100;
    return +(weight / (h * h)).toFixed(1);
};

VITA.bmiCategory = (bmi) => {
    if (bmi == null) return { label: '—', cls: 'neutral' };
    if (bmi < 18.5) return { label: 'UNDERWEIGHT', cls: 'low' };
    if (bmi < 23)   return { label: 'OPTIMAL',     cls: 'good' };
    if (bmi < 25)   return { label: 'ELEVATED',    cls: 'mid' };
    return { label: 'CRITICAL', cls: 'high' };
};

// ----- Recovery score (0-100) -----
VITA.calcRecoveryScore = ({ sleepHours, workoutMinutesYesterday, hydrationPct }) => {
    const sleepScore = Math.min(100, (sleepHours / 8) * 100);
    const restPenalty = Math.min(40, workoutMinutesYesterday / 3); // hard yesterday → lower recovery
    const hydroBoost = (hydrationPct - 50) * 0.3;
    return Math.max(0, Math.min(100, Math.round(sleepScore - restPenalty + hydroBoost)));
};

// ----- Sleep score -----
VITA.calcSleepScore = (hours) => {
    if (!hours) return 0;
    if (hours >= 7 && hours <= 9) return 100;
    if (hours < 7)  return Math.round((hours / 7) * 100);
    return Math.round(Math.max(0, 100 - (hours - 9) * 12));
};

// ----- Energy score -----
VITA.calcEnergyScore = ({ sleepScore, caloriePct, hydrationPct }) => {
    return Math.round((sleepScore * 0.45) + (Math.min(100, caloriePct) * 0.3) + (Math.min(100, hydrationPct) * 0.25));
};

// ----- XP / Level -----
VITA.xpForLevel = (level) => {
    const C = window.VITA_CONFIG;
    return C.LEVEL_BASE_XP + (level - 1) * C.LEVEL_GROWTH;
};

VITA.computeLevel = (totalXP) => {
    let level = 1, xpUsed = 0;
    while (level < 200) {
        const need = VITA.xpForLevel(level);
        if (xpUsed + need > totalXP) break;
        xpUsed += need; level++;
    }
    return { level, xpInLevel: totalXP - xpUsed, xpNeeded: VITA.xpForLevel(level) };
};

VITA.titleForLevel = (level) => {
    if (level >= 50) return 'TRANSCENDENT';
    if (level >= 30) return 'ASCENDED';
    if (level >= 20) return 'ELITE OPERATOR';
    if (level >= 10) return 'BIONIC ATHLETE';
    if (level >= 5)  return 'ENHANCED USER';
    return 'INITIATE';
};

// ----- Streak (consecutive days with any log) -----
VITA.calcStreak = (allDates /* Set or string[] */) => {
    const set = new Set(allDates);
    let streak = 0;
    let d = new Date();
    for (let i = 0; i < 365; i++) {
        const iso = d.toISOString().slice(0, 10);
        if (set.has(iso)) { streak++; d.setDate(d.getDate() - 1); }
        else if (i === 0) { d.setDate(d.getDate() - 1); }  // give grace for today
        else break;
    }
    return streak;
};

// ----- Body status from recent data -----
VITA.bodyStatus = ({ workoutsByGroup, sleepHours, hydrationPct, energyScore }) => {
    // workoutsByGroup: { arms: minutesLast7Days, chest, legs, core, back }
    const out = {};
    const recoveryThreshold = sleepHours >= 7 ? 60 : 30;
    ['arms', 'chest', 'legs', 'core', 'back'].forEach(group => {
        const mins = workoutsByGroup[group] || 0;
        if (mins === 0) out[group] = 'undertrained';
        else if (mins > recoveryThreshold) out[group] = 'fatigued';
        else out[group] = 'recovered';
    });
    out.hydration = hydrationPct >= 70 ? 'hydrated' : 'undertrained';
    out.energy = energyScore >= 70 ? 'energized' : (energyScore >= 40 ? 'recovered' : 'fatigued');
    return out;
};
