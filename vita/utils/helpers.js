/* ============================================================
   VITA — Helpers / DOM utilities
   ============================================================ */

window.VITA = window.VITA || {};

VITA.$  = (s, root = document) => root.querySelector(s);
VITA.$$ = (s, root = document) => [...root.querySelectorAll(s)];

VITA.todayISO = () => new Date().toISOString().slice(0, 10);

VITA.fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

VITA.fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

VITA.fmtTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

VITA.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

VITA.clamp = (v, min, max) => Math.max(min, Math.min(max, v));

VITA.sanitize = (str) => {
    if (typeof str !== 'string') return str;
    // Prevent formula injection in Google Sheets
    if (/^[=+\-@]/.test(str)) return "'" + str;
    return str.replace(/<[^>]*>/g, '').slice(0, 1000);
};

VITA.toast = (msg, type = '') => {
    let el = VITA.$('#vita-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'vita-toast';
        el.className = 'toast';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'toast show ' + (type || '');
    clearTimeout(VITA.toast._t);
    VITA.toast._t = setTimeout(() => el.classList.remove('show'), 3000);
};

VITA.lastN = (n) => {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        out.push(d.toISOString().slice(0, 10));
    }
    return out;
};

VITA.sumBy = (arr, key) => arr.reduce((s, x) => s + (+x[key] || 0), 0);

VITA.debounce = (fn, ms = 300) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

// Mark active nav based on current page
VITA.setActiveNav = () => {
    const path = location.pathname.split('/').pop() || 'index.html';
    VITA.$$('.circular-nav-item').forEach(el => {
        const href = (el.getAttribute('href') || '').split('/').pop();
        el.classList.toggle('active', href === path || (path === '' && href === 'index.html'));
    });
};
