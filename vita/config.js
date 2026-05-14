/* ============================================================
   VITA — Configuration
   ⚠ NEVER commit secrets here. Use this file for non-secret
   configuration only. Secrets (API keys, etc.) belong in your
   Google Apps Script backend or via env-protected deployment.
   ============================================================ */

window.VITA_CONFIG = {
    // Google Apps Script Web App URL (after deploying backend/Code.gs)
    // Example: https://script.google.com/macros/s/AKfycb.../exec
    API_URL: '',

    // API access token — set the same value in Code.gs SECRET
    // This is sent in every request to authorize access
    API_TOKEN: '',

    // App version
    VERSION: '1.0.0',

    // Daily goals (defaults — user can override in Settings)
    DEFAULTS: {
        calories: 2200,
        protein: 120,           // grams
        water: 2500,            // ml
        steps: 8000,
        sleep: 7.5,             // hours
        workouts_per_week: 4
    },

    // BMR / TDEE
    ACTIVITY_FACTORS: {
        sedentary: 1.2,
        light:     1.375,
        moderate:  1.55,
        active:    1.725,
        intense:   1.9
    },

    // XP per quest completion
    XP: {
        water:     50,
        workout:   120,
        protein:   80,
        sleep:     90,
        steps:     70,
        meal_logged: 15,
        weight_logged: 25
    },

    // Level curve: XP needed for level N -> N+1
    LEVEL_BASE_XP: 250,
    LEVEL_GROWTH:  120,

    // Body region colors (cyberpunk)
    BODY_COLORS: {
        recovered:    '#22d3ee',
        fatigued:     '#f87171',
        undertrained: '#a78bfa',
        hydrated:     '#38bdf8',
        energized:    '#fbbf24'
    },

    // Whether to enable Three.js 3D body (otherwise SVG)
    ENABLE_3D_BODY: false,

    // AI provider — 'local' uses heuristics with no network call
    // 'backend' calls /Code.gs which forwards to Gemini/Claude
    AI_PROVIDER: 'local'
};
