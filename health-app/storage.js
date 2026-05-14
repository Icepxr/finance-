/* ========================================
   Storage Layer
   - Primary: LocalStorage
   - Optional sync: Google Apps Script Web App
   ======================================== */

const STORAGE_KEY = 'health_tracker_v1';
const CONFIG_KEY = 'health_tracker_config_v1';

const defaultData = {
    food: [],
    exercise: [],
    weight: [],
    water: [],
    sleep: []
};

const defaultConfig = {
    sheetUrl: '',
    sheetSecret: '',
    goalCalories: 2000,
    goalWater: 2000,
    defaultHeight: 170,
    userName: 'UCHIDA',
    lastSync: null
};

const Storage = {
    data: { ...defaultData },
    config: { ...defaultConfig },

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.data = { ...defaultData, ...parsed };
            }
            const rawConfig = localStorage.getItem(CONFIG_KEY);
            if (rawConfig) {
                this.config = { ...defaultConfig, ...JSON.parse(rawConfig) };
            }
        } catch (e) {
            console.error('Storage load failed:', e);
        }
    },

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error('Storage save failed:', e);
        }
    },

    saveConfig() {
        try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
        } catch (e) {
            console.error('Config save failed:', e);
        }
    },

    add(category, entry) {
        if (!this.data[category]) this.data[category] = [];
        entry.id = entry.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
        entry.createdAt = entry.createdAt || new Date().toISOString();
        this.data[category].push(entry);
        this.save();
        // Optional auto-sync
        if (this.config.sheetUrl) {
            this.syncEntry(category, entry).catch(err => console.warn('Auto-sync failed:', err));
        }
        return entry;
    },

    remove(category, id) {
        if (!this.data[category]) return;
        this.data[category] = this.data[category].filter(x => x.id !== id);
        this.save();
        if (this.config.sheetUrl) {
            this.syncDelete(category, id).catch(err => console.warn('Auto-sync failed:', err));
        }
    },

    getAll(category) {
        return this.data[category] || [];
    },

    clear() {
        this.data = { ...defaultData };
        this.save();
    },

    exportJSON() {
        return JSON.stringify({ data: this.data, config: this.config, exportedAt: new Date().toISOString() }, null, 2);
    },

    importJSON(json) {
        const parsed = JSON.parse(json);
        if (parsed.data) {
            this.data = { ...defaultData, ...parsed.data };
            this.save();
        }
        if (parsed.config) {
            this.config = { ...defaultConfig, ...parsed.config };
            this.saveConfig();
        }
    },

    // ===== Google Sheets sync =====
    async _request(action, payload = {}) {
        if (!this.config.sheetUrl) throw new Error('ยังไม่ได้ตั้งค่า URL ของ Google Apps Script');
        const body = {
            action,
            secret: this.config.sheetSecret || '',
            payload
        };
        const res = await fetch(this.config.sheetUrl, {
            method: 'POST',
            // Use text/plain to avoid preflight (Apps Script handles parsing)
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body),
            redirect: 'follow'
        });
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } catch (e) {
            throw new Error('การตอบกลับไม่ใช่ JSON: ' + text.slice(0, 120));
        }
        if (!json.ok) throw new Error(json.error || 'Unknown error');
        return json;
    },

    async testConnection() {
        const res = await this._request('ping');
        this.config.lastSync = new Date().toISOString();
        this.saveConfig();
        return res;
    },

    async syncEntry(category, entry) {
        return this._request('add', { category, entry });
    },

    async syncDelete(category, id) {
        return this._request('delete', { category, id });
    },

    async pushAll() {
        const res = await this._request('replaceAll', { data: this.data });
        this.config.lastSync = new Date().toISOString();
        this.saveConfig();
        return res;
    },

    async pullAll() {
        const res = await this._request('readAll');
        if (res.data) {
            this.data = { ...defaultData, ...res.data };
            this.save();
        }
        this.config.lastSync = new Date().toISOString();
        this.saveConfig();
        return res;
    },

    // ===== Gemini AI =====
    async aiMeal(input) {
        // input can be a string (legacy) or an object { description, note, image, mime }
        const payload = (typeof input === 'string') ? { description: input } : input;
        return this._request('aiMeal', payload);
    },

    async aiInsight(weeklyData) {
        return this._request('aiInsight', { weekly: weeklyData });
    },

    async aiRecipe(remainingMacros) {
        return this._request('aiRecipe', { remaining: remainingMacros });
    },

    async aiWorkoutPlan(opts) {
        return this._request('aiWorkoutPlan', { opts });
    }
};

// ===== Local heuristic AI (fallback when Gemini not configured) =====
const LocalAI = {
    foodDB: [
        { re: /ข้าวผัด|fried rice/i,    cal: 520, p: 14, c: 75, f: 18 },
        { re: /ข้าวมันไก่|chicken rice/i, cal: 580, p: 28, c: 70, f: 20 },
        { re: /ผัดไทย|pad thai/i,        cal: 480, p: 18, c: 60, f: 16 },
        { re: /ส้มตำ|som tam|papaya/i,   cal: 180, p: 4,  c: 30, f: 4 },
        { re: /ต้มยำ|tom yum/i,          cal: 220, p: 16, c: 18, f: 10 },
        { re: /ก๋วยเตี๋ยว|noodle|ราเมง|ramen/i, cal: 480, p: 22, c: 64, f: 14 },
        { re: /สเต็ก|steak|beef/i,       cal: 620, p: 48, c: 8,  f: 42 },
        { re: /ไก่|chicken|grilled/i,    cal: 380, p: 42, c: 4,  f: 18 },
        { re: /หมู|pork|bacon/i,         cal: 480, p: 32, c: 6,  f: 32 },
        { re: /ปลา|salmon|fish|sushi/i,  cal: 320, p: 36, c: 8,  f: 16 },
        { re: /กุ้ง|shrimp|prawn/i,      cal: 240, p: 32, c: 6,  f: 8 },
        { re: /ไข่|egg|omelette/i,       cal: 180, p: 14, c: 2,  f: 12 },
        { re: /สลัด|salad|vegetable/i,    cal: 180, p: 6,  c: 14, f: 12 },
        { re: /ผลไม้|fruit|apple|banana/i, cal: 100, p: 1,  c: 24, f: 1 },
        { re: /โยเกิร์ต|yogurt/i,        cal: 160, p: 12, c: 18, f: 4 },
        { re: /นม|milk|latte/i,          cal: 140, p: 8,  c: 12, f: 8 },
        { re: /กาแฟ|coffee|americano/i,  cal: 10,  p: 0,  c: 2,  f: 0 },
        { re: /ชา|tea|green tea/i,       cal: 5,   p: 0,  c: 1,  f: 0 },
        { re: /พิซซ่า|pizza/i,           cal: 680, p: 26, c: 72, f: 30 },
        { re: /เบอร์เกอร์|burger/i,      cal: 560, p: 28, c: 48, f: 30 },
        { re: /ขนมปัง|sandwich|toast/i,  cal: 320, p: 12, c: 44, f: 12 },
        { re: /ของหวาน|cake|cookie|ice cream|ไอติม/i, cal: 380, p: 4, c: 50, f: 18 }
    ],

    estimate(text) {
        if (!text) return null;
        let cal = 0, p = 0, c = 0, f = 0;
        let matches = [];
        this.foodDB.forEach(food => {
            if (food.re.test(text)) {
                cal += food.cal; p += food.p; c += food.c; f += food.f;
                matches.push(food.re.toString().split('|')[0].slice(1));
            }
        });
        // Portion multiplier
        let mult = 1;
        if (/half|ครึ่ง|เบา/i.test(text)) mult *= 0.6;
        if (/large|ใหญ่|เยอะ|2|two/i.test(text)) mult *= 1.5;
        const qty = text.match(/\b(\d+(?:\.\d+)?)\s*(จาน|ที่|ชาม|แก้ว|ชิ้น)?/);
        if (qty) {
            const n = parseFloat(qty[1]);
            if (n > 1 && n < 10) mult *= n / 1.2;
        }
        if (matches.length === 0) {
            const wc = text.trim().split(/\s+/).length;
            cal = 280 + wc * 30;
            p = Math.round(cal * 0.18 / 4);
            c = Math.round(cal * 0.5 / 4);
            f = Math.round(cal * 0.32 / 9);
            matches = ['unidentified meal'];
        }
        cal = Math.round(cal * mult);
        p = Math.round(p * mult);
        c = Math.round(c * mult);
        f = Math.round(f * mult);
        let analysis = '';
        const pPct = (p * 4) / Math.max(1, cal);
        if (pPct > 0.30) analysis = '⚡ มื้อนี้โปรตีนสูง — เหมาะกับการฟื้นฟูกล้ามเนื้อ';
        else if (pPct < 0.12) analysis = '⚠ โปรตีนต่ำ ลองเพิ่มไข่ ไก่ หรือเต้าหู้';
        else analysis = '✓ สัดส่วนสารอาหารสมดุล';
        if (cal > 700) analysis += ' • ⚠ แคลอรี่ค่อนข้างสูง';
        if (f > 35) analysis += ' • ระวังไขมัน';
        return { calories: cal, protein: p, carbs: c, fat: f, analysis, items: matches };
    }
};
window.LocalAI = LocalAI;
