/* ============================================================
   VITA — LocalStorage Cache + Sync Coordinator
   ============================================================ */

window.VITA = window.VITA || {};

const STORAGE_KEY = 'vita_data_v1';
const PROFILE_KEY = 'vita_profile_v1';
const SEED_FLAG   = 'vita_seeded_v1';

const DEFAULT_PROFILE = {
    name: 'OPERATOR',
    age: 28,
    sex: 'male',
    weight: 72,
    height: 175,
    activity: 'moderate',
    goal_calories: 2200,
    goal_protein: 120,
    goal_water: 2500,
    goal_steps: 8000,
    goal_sleep: 7.5
};

const DEFAULT_DATA = {
    meals: [],
    workouts: [],
    body_status: [],
    quests_completed: {}   // date -> [questId, ...]
};

VITA.Store = {
    data: structuredClone(DEFAULT_DATA),
    profile: structuredClone(DEFAULT_PROFILE),

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) this.data = { ...structuredClone(DEFAULT_DATA), ...JSON.parse(raw) };
            const p = localStorage.getItem(PROFILE_KEY);
            if (p) this.profile = { ...DEFAULT_PROFILE, ...JSON.parse(p) };
        } catch (e) { console.warn('Store load failed', e); }
    },

    save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) { console.warn(e); } },
    saveProfile() { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile)); } catch (e) {} },

    seedIfEmpty() {
        if (localStorage.getItem(SEED_FLAG)) return;
        if (this.data.meals.length || this.data.workouts.length) return;
        localStorage.setItem(SEED_FLAG, '1');
        this.seedDemo();
    },

    seedDemo() {
        const today = new Date();
        const iso = (offset) => {
            const d = new Date(today); d.setDate(d.getDate() - offset);
            return d.toISOString().slice(0, 10);
        };
        const isoT = (offset, h, m) => {
            const d = new Date(today); d.setDate(d.getDate() - offset);
            d.setHours(h, m, 0, 0);
            return d.toISOString();
        };

        const sampleMeals = [
            { d: 0, m: 'Breakfast', name: 'Oats + Banana + Whey', cal: 420, p: 32, c: 58, f: 9, h: 6, t: 8 },
            { d: 0, m: 'Lunch',     name: 'Chicken Rice Bowl',    cal: 680, p: 48, c: 72, f: 18, h: 12, t: 12 },
            { d: 0, m: 'Snack',     name: 'Greek Yogurt + Almonds', cal: 240, p: 18, c: 14, f: 12, h: 15, t: 30 },
            { d: 1, m: 'Breakfast', name: 'Avocado Toast + Eggs', cal: 510, p: 24, c: 38, f: 28, h: 7, t: 30 },
            { d: 1, m: 'Lunch',     name: 'Salmon Salad',         cal: 620, p: 42, c: 22, f: 36, h: 12, t: 45 },
            { d: 1, m: 'Dinner',    name: 'Tofu Stir-fry',        cal: 560, p: 32, c: 48, f: 22, h: 19, t: 15 },
            { d: 2, m: 'Breakfast', name: 'Protein Smoothie',     cal: 380, p: 38, c: 42, f: 6, h: 8, t: 0 },
            { d: 2, m: 'Lunch',     name: 'Turkey Wrap',          cal: 540, p: 36, c: 52, f: 16, h: 12, t: 30 },
            { d: 2, m: 'Dinner',    name: 'Beef + Sweet Potato',  cal: 720, p: 52, c: 64, f: 24, h: 19, t: 0 },
            { d: 3, m: 'Lunch',     name: 'Sushi Set',            cal: 640, p: 32, c: 88, f: 14, h: 12, t: 30 },
            { d: 3, m: 'Dinner',    name: 'Grilled Chicken',      cal: 520, p: 48, c: 38, f: 14, h: 19, t: 0 }
        ];
        this.data.meals = sampleMeals.map(s => ({
            id: VITA.uid(),
            created_at: isoT(s.d, s.t === 0 ? 19 : Math.floor(s.t / 60) + 7, s.t % 60 * 0 || 30),
            date: iso(s.d),
            meal_type: s.m,
            food_name: s.name,
            calories: s.cal,
            protein: s.p,
            carbs: s.c,
            fat: s.f,
            water: 0,
            ai_analysis: '',
            note: ''
        }));

        const sampleWorkouts = [
            { d: 0, name: 'Upper Body Strength', dur: 45, cal: 320, grp: 'chest', int: 'high' },
            { d: 1, name: 'Morning Run',         dur: 32, cal: 290, grp: 'legs',  int: 'moderate' },
            { d: 2, name: 'Core Circuit',        dur: 25, cal: 180, grp: 'core',  int: 'high' },
            { d: 2, name: 'Evening Walk',        dur: 40, cal: 160, grp: 'legs',  int: 'low' },
            { d: 4, name: 'Pull Day',            dur: 50, cal: 340, grp: 'back',  int: 'high' },
            { d: 5, name: 'HIIT',                dur: 20, cal: 240, grp: 'core',  int: 'high' },
            { d: 6, name: 'Yoga Recovery',       dur: 35, cal: 110, grp: 'core',  int: 'low' }
        ];
        this.data.workouts = sampleWorkouts.map(s => ({
            id: VITA.uid(),
            created_at: isoT(s.d, 18, 30),
            date: iso(s.d),
            workout_name: s.name,
            duration: s.dur,
            calories_burned: s.cal,
            muscle_group: s.grp,
            intensity: s.int,
            note: ''
        }));

        const samples = [
            { d: 0, w: 72.1, bf: 18.2, sl: 7.5, hy: 2100, en: 78, rc: 82 },
            { d: 1, w: 72.3, bf: 18.3, sl: 6.5, hy: 1800, en: 65, rc: 70 },
            { d: 2, w: 72.5, bf: 18.4, sl: 7.0, hy: 2300, en: 72, rc: 75 },
            { d: 3, w: 72.6, bf: 18.5, sl: 8.0, hy: 2500, en: 84, rc: 88 },
            { d: 5, w: 72.8, bf: 18.6, sl: 7.2, hy: 2200, en: 76, rc: 78 },
            { d: 7, w: 73.0, bf: 18.7, sl: 6.0, hy: 1900, en: 60, rc: 65 }
        ];
        this.data.body_status = samples.map(s => ({
            date: iso(s.d),
            weight: s.w,
            body_fat: s.bf,
            sleep_hours: s.sl,
            hydration: s.hy,
            energy_level: s.en,
            recovery_score: s.rc
        }));

        this.save();
    },

    add(category, entry) {
        if (!this.data[category]) this.data[category] = [];
        if (Array.isArray(this.data[category])) {
            entry.id = entry.id || VITA.uid();
            entry.created_at = entry.created_at || new Date().toISOString();
            this.data[category].push(entry);
        }
        this.save();
        // optional auto-sync
        if (window.VITA_CONFIG.API_URL && VITA.API) {
            VITA.API.add(category, entry).catch(e => console.warn('sync failed', e));
        }
        return entry;
    },

    update(category, id, patch) {
        const arr = this.data[category];
        if (!Array.isArray(arr)) return;
        const idx = arr.findIndex(x => x.id === id);
        if (idx >= 0) {
            arr[idx] = { ...arr[idx], ...patch };
            this.save();
        }
    },

    remove(category, id) {
        if (!Array.isArray(this.data[category])) return;
        this.data[category] = this.data[category].filter(x => x.id !== id);
        this.save();
        if (window.VITA_CONFIG.API_URL && VITA.API) {
            VITA.API.remove(category, id).catch(e => console.warn(e));
        }
    },

    getAll(cat) { return this.data[cat] || []; },

    completeQuest(date, questId) {
        if (!this.data.quests_completed[date]) this.data.quests_completed[date] = [];
        if (!this.data.quests_completed[date].includes(questId)) {
            this.data.quests_completed[date].push(questId);
            this.save();
            return true;
        }
        return false;
    },

    isQuestComplete(date, questId) {
        return (this.data.quests_completed[date] || []).includes(questId);
    },

    getCompletedQuests(date) {
        return this.data.quests_completed[date] || [];
    },

    exportJSON() {
        return JSON.stringify({ data: this.data, profile: this.profile, v: 1, ts: Date.now() }, null, 2);
    },

    importJSON(json) {
        const p = JSON.parse(json);
        if (p.data) { this.data = { ...DEFAULT_DATA, ...p.data }; this.save(); }
        if (p.profile) { this.profile = { ...DEFAULT_PROFILE, ...p.profile }; this.saveProfile(); }
    },

    clearAll() {
        this.data = structuredClone(DEFAULT_DATA);
        this.save();
    }
};
