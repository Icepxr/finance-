/* ============================================================
   VITA — Google Apps Script API Client
   Communicates with the backend deployed as a Web App.
   ============================================================ */

window.VITA = window.VITA || {};

VITA.API = {
    async _post(action, payload = {}) {
        const url = window.VITA_CONFIG.API_URL;
        if (!url) throw new Error('API_URL not configured');
        const body = {
            action,
            token: window.VITA_CONFIG.API_TOKEN || '',
            payload
        };
        const res = await fetch(url, {
            method: 'POST',
            // text/plain avoids CORS preflight to Apps Script
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body),
            redirect: 'follow'
        });
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); }
        catch (e) { throw new Error('Invalid JSON response: ' + text.slice(0, 120)); }
        if (!json.ok) throw new Error(json.error || 'API error');
        return json;
    },

    ping()             { return this._post('ping'); },
    add(category, e)   { return this._post('add', { category, entry: e }); },
    remove(cat, id)    { return this._post('delete', { category: cat, id }); },
    pushAll(data)      { return this._post('replaceAll', { data }); },
    pullAll()          { return this._post('readAll'); },
    aiMeal(input)      { return this._post('aiMeal', { input }); },
    aiInsight(weekly)  { return this._post('aiInsight', { weekly }); }
};
