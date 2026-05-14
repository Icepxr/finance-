/* ============================================================
   VITA — AI Engine (Local heuristic + Backend bridge)
   - Estimates calories/macros from free-text meal descriptions
   - Suggests healthier alternatives
   - Generates weekly insights from logged data
   ============================================================ */

window.VITA = window.VITA || {};

// Lightweight on-device food database for offline estimation
const FOOD_DB = [
    // [keyword(s), kcal_per_serving, protein, carbs, fat, hydration_ml]
    { re: /oat|oatmeal|granola|muesli/i,                     cal: 320, p: 12, c: 54, f: 6,  w: 0 },
    { re: /rice|risotto|pilaf|fried rice/i,                  cal: 380, p: 8,  c: 78, f: 4,  w: 0 },
    { re: /pasta|spaghetti|noodle|ramen|udon|pad thai/i,     cal: 480, p: 14, c: 70, f: 12, w: 0 },
    { re: /chicken|grilled chicken|chicken breast/i,         cal: 420, p: 52, c: 6,  f: 18, w: 0 },
    { re: /beef|steak|burger/i,                              cal: 620, p: 42, c: 18, f: 38, w: 0 },
    { re: /pork|bacon|ham/i,                                 cal: 540, p: 36, c: 4,  f: 36, w: 0 },
    { re: /salmon|tuna|fish|sushi|sashimi/i,                 cal: 460, p: 38, c: 24, f: 22, w: 0 },
    { re: /shrimp|prawn|seafood/i,                           cal: 320, p: 36, c: 8,  f: 12, w: 0 },
    { re: /tofu|tempeh/i,                                    cal: 320, p: 24, c: 16, f: 16, w: 0 },
    { re: /egg|omelette|omelet|scramble/i,                   cal: 280, p: 22, c: 4,  f: 18, w: 0 },
    { re: /salad|greens|vegetable|veggie|spinach|kale/i,     cal: 220, p: 8,  c: 16, f: 14, w: 100 },
    { re: /yogurt|greek yogurt/i,                            cal: 180, p: 18, c: 16, f: 4,  w: 80 },
    { re: /milk|latte|cappuccino/i,                          cal: 160, p: 9,  c: 14, f: 8,  w: 200 },
    { re: /smoothie|shake|protein shake/i,                   cal: 320, p: 28, c: 38, f: 6,  w: 150 },
    { re: /sandwich|wrap|toast|burrito/i,                    cal: 480, p: 22, c: 52, f: 18, w: 0 },
    { re: /pizza/i,                                          cal: 720, p: 28, c: 78, f: 32, w: 0 },
    { re: /soup|broth|stew/i,                                cal: 240, p: 12, c: 22, f: 10, w: 180 },
    { re: /fruit|apple|banana|orange|berry|berries/i,        cal: 120, p: 2,  c: 28, f: 1,  w: 80 },
    { re: /nut|almond|peanut|walnut|cashew/i,                cal: 220, p: 8,  c: 8,  f: 18, w: 0 },
    { re: /chocolate|cake|cookie|dessert|ice cream/i,        cal: 420, p: 4,  c: 52, f: 22, w: 0 },
    { re: /water|น้ำเปล่า/i,                                  cal: 0,   p: 0,  c: 0,  f: 0,  w: 250 },
    { re: /coffee|americano|espresso/i,                      cal: 10,  p: 0,  c: 2,  f: 0,  w: 180 },
    { re: /tea|matcha|green tea/i,                           cal: 5,   p: 0,  c: 1,  f: 0,  w: 200 },
    { re: /soda|cola|juice|sweet drink/i,                    cal: 180, p: 0,  c: 44, f: 0,  w: 250 },
    { re: /chip|crisps|fries|snack/i,                        cal: 360, p: 4,  c: 42, f: 22, w: 0 }
];

const PORTION_HINTS = [
    { re: /half|small|light/i, mult: 0.6 },
    { re: /large|big|double|extra|hearty/i, mult: 1.5 },
    { re: /huge|massive|feast/i, mult: 2.0 }
];

VITA.AI = {
    /**
     * Estimate nutrition from free text description.
     * @returns { calories, protein, carbs, fat, water, ai_analysis, items: string[] }
     */
    estimateMeal(text) {
        if (!text || typeof text !== 'string') {
            return { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0, ai_analysis: 'No input', items: [] };
        }

        // Allow backend AI to override
        if (window.VITA_CONFIG.AI_PROVIDER === 'backend' && window.VITA_CONFIG.API_URL) {
            // Caller can await aiMeal separately; here we return a quick local estimate
        }

        let items = [];
        let cal = 0, p = 0, c = 0, f = 0, w = 0;
        let mult = 1;

        PORTION_HINTS.forEach(h => { if (h.re.test(text)) mult *= h.mult; });

        FOOD_DB.forEach(food => {
            if (food.re.test(text)) {
                cal += food.cal; p += food.p; c += food.c; f += food.f; w += food.w;
                items.push(food.re.toString().slice(1).split('|')[0].replace(/\/[gi]+$/, ''));
            }
        });

        // Quantity multiplier (e.g. "2 servings", "3 pieces")
        const qty = text.match(/\b(\d+(?:\.\d+)?)\s*(serving|portion|piece|slice|cup|bowl|plate)?/i);
        if (qty) {
            const n = parseFloat(qty[1]);
            if (n > 1 && n < 12) mult *= Math.min(3, n / 1.5);
        }

        cal = Math.round(cal * mult);
        p = Math.round(p * mult);
        c = Math.round(c * mult);
        f = Math.round(f * mult);
        w = Math.round(w * mult);

        // Fallback: rough estimate if nothing matched
        if (items.length === 0) {
            const wordCount = text.trim().split(/\s+/).length;
            cal = 250 + wordCount * 40;
            p = Math.round(cal * 0.18 / 4);
            c = Math.round(cal * 0.5 / 4);
            f = Math.round(cal * 0.32 / 9);
            items.push('unidentified meal');
        }

        let analysis = '';
        const proteinPct = (p * 4) / Math.max(1, cal);
        if (proteinPct > 0.3) analysis = '⚡ High-protein meal — great for recovery.';
        else if (proteinPct < 0.12) analysis = '⚠ Low protein. Consider adding chicken, eggs, or tofu.';
        else analysis = '✓ Balanced macro distribution.';

        if (cal > 800) analysis += ' ⚠ Calorie-dense.';
        if (f > 35) analysis += ' Watch the fat content.';

        return { calories: cal, protein: p, carbs: c, fat: f, water: w, ai_analysis: analysis, items };
    },

    /**
     * Suggest healthier alternative
     */
    suggestAlternative(meal) {
        if (meal.calories > 700) return 'Try a half-portion or swap rice for cauliflower rice.';
        if (meal.protein < 15)   return 'Add a side of egg whites, beans, or whey for more protein.';
        if (meal.fat > 30)       return 'Grill or steam instead of frying to reduce fat by ~30%.';
        return 'Solid choice — keep it up.';
    },

    /**
     * Weekly insight from aggregated stats
     */
    weeklyInsight({ avgCalories, avgProtein, avgWater, totalWorkoutMin, avgSleep, calGoal, proteinGoal, waterGoal }) {
        const lines = [];
        if (avgCalories < calGoal * 0.8) lines.push('🟣 You\'re consistently under calorie target — energy systems may be running lean.');
        else if (avgCalories > calGoal * 1.15) lines.push('🔴 Calorie surplus detected. Recommend cardio or portion adjustment.');
        else lines.push('🟢 Calorie balance is on-spec.');

        if (avgProtein < proteinGoal * 0.8) lines.push('🟣 Protein intake below target. Muscle synthesis under-fueled.');
        else lines.push('🟢 Protein intake locked in.');

        if (avgWater < waterGoal * 0.8) lines.push('🔵 Hydration low. Increase by ~500ml/day for optimal cognitive function.');
        else lines.push('🟢 Hydration nominal.');

        if (totalWorkoutMin < 120) lines.push('🟡 Training volume light (<120 min/week). Aim for 150+.');
        else lines.push('🟢 Training volume on-target.');

        if (avgSleep < 7) lines.push('🟡 Sleep debt accumulating. Recovery compromised.');
        else lines.push('🟢 Sleep quality stable.');

        return lines;
    },

    /**
     * Vision-based meal analysis (requires backend with image AI)
     * Falls back to "uploaded photo" estimate
     */
    async analyzeImage(file) {
        if (window.VITA_CONFIG.AI_PROVIDER === 'backend' && window.VITA_CONFIG.API_URL) {
            const base64 = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(r.result.split(',')[1]);
                r.onerror = rej;
                r.readAsDataURL(file);
            });
            try {
                const r = await VITA.API.aiMeal({ image: base64, mime: file.type });
                if (r.estimate) return r.estimate;
            } catch (e) { console.warn('AI image failed, falling back', e); }
        }
        // Fallback heuristic — return a generic estimate
        return {
            calories: 480, protein: 24, carbs: 56, fat: 18, water: 0,
            ai_analysis: '📷 Image analysis (local fallback). Connect backend AI for precise detection.',
            items: ['uploaded meal']
        };
    }
};
