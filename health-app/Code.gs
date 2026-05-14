/**
 * VITA Health Tracker — Google Apps Script Backend (Groq Edition)
 *
 * ใช้ Groq API แทน Gemini — เร็วกว่า + Llama 4 Scout รองรับ vision
 *
 * วิธีตั้งค่า:
 *  1. ไปที่ https://console.groq.com แล้วสร้าง API Key (ฟรี)
 *  2. ไปที่ https://script.google.com แล้วสร้างโปรเจกต์ใหม่
 *  3. ลบโค้ดเริ่มต้นออก แล้ววางโค้ดนี้ทั้งหมด
 *  4. กดไอคอน ⚙ (Project Settings) → "Script Properties" → Add script property:
 *      - Property: SECRET   | Value: your-secret-here   (อะไรก็ได้ ใส่ในเว็บแอปด้วย)
 *      - Property: GROQ_KEY | Value: gsk_xxxxxxxxxxxxx  (จาก console.groq.com)
 *  5. กด Deploy → New deployment → Type = Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 *  6. คัดลอก Web app URL ไปวางในหน้า "Console" ของ VITA
 *
 * โมเดลที่ใช้:
 *  - aiMeal (รูป+ข้อความ): meta-llama/llama-4-scout-17b-16e-instruct (vision)
 *  - aiInsight:             llama-3.3-70b-versatile (reasoning)
 *  - aiWorkoutPlan:         llama-3.3-70b-versatile (reasoning)
 *  - aiRecipe:              llama-3.1-8b-instant (fast)
 */

const MODELS = {
  vision:    'meta-llama/llama-4-scout-17b-16e-instruct',
  reasoning: 'llama-3.3-70b-versatile',
  fast:      'llama-3.1-8b-instant'
};

const SHEET_ID = '';  // ใส่ ID ของชีตที่มีอยู่ หรือเว้นว่างเพื่อสร้างใหม่

const CATEGORIES = ['food', 'exercise', 'weight', 'water', 'sleep'];
const HEADERS = {
  food:     ['id', 'date', 'meal', 'name', 'amount', 'calories', 'protein', 'carbs', 'fat', 'note', 'createdAt'],
  exercise: ['id', 'date', 'exType', 'duration', 'calories', 'note', 'createdAt'],
  weight:   ['id', 'date', 'weight', 'height', 'note', 'createdAt'],
  water:    ['id', 'date', 'amount', 'createdAt'],
  sleep:    ['id', 'date', 'hours', 'quality', 'createdAt']
};

function _getProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const SECRET = _getProp('SECRET');
    if (SECRET && body.secret !== SECRET) {
      return _json({ ok: false, error: 'Unauthorized: secret ไม่ถูกต้อง' });
    }
    const action = body.action;
    const payload = body.payload || {};

    // AI actions don't need spreadsheet
    if (action === 'aiMeal')    return _json({ ok: true, estimate: _aiMeal(payload) });
    if (action === 'aiInsight') return _json({ ok: true, insights: _aiInsight(payload.weekly) });
    if (action === 'aiRecipe')  return _json({ ok: true, recipes:  _aiRecipe(payload.remaining) });
    if (action === 'aiWorkoutPlan') {
      var out = _aiWorkoutPlan(payload.opts || {});
      return _json({ ok: true, plan: out.plan, tips: out.tips });
    }

    const ss = _getSpreadsheet();

    switch (action) {
      case 'ping':
        return _json({ ok: true, message: 'เชื่อมต่อสำเร็จกับ ' + ss.getName() + (_getProp('GROQ_KEY') ? ' (Groq ✓)' : ' (Groq ✗)') });
      case 'add':
        _addEntry(ss, payload.category, payload.entry);
        return _json({ ok: true });
      case 'delete':
        _deleteEntry(ss, payload.category, payload.id);
        return _json({ ok: true });
      case 'readAll':
        return _json({ ok: true, data: _readAll(ss) });
      case 'replaceAll':
        _replaceAll(ss, payload.data);
        return _json({ ok: true });
      default:
        return _json({ ok: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return _json({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return _json({ ok: true, message: 'VITA Health Tracker API (Groq). Use POST.' });
}

// ================================================================
//   GROQ AI
// ================================================================

/**
 * Call Groq chat completions (OpenAI-compatible API).
 * @param {Array} messages - [{role, content}] where content may be string or array (multimodal)
 * @param {string} model - model id from MODELS
 * @param {object} opts - { jsonMode: bool, temperature: number, maxTokens: number }
 * @returns {string} generated text
 */
function _callGroq(messages, model, opts) {
  opts = opts || {};
  const apiKey = _getProp('GROQ_KEY');
  if (!apiKey) throw new Error('GROQ_KEY not set in Script Properties');

  const payload = {
    model: model,
    messages: messages,
    temperature: opts.temperature != null ? opts.temperature : 0.4,
    max_tokens: opts.maxTokens || 1500
  };
  if (opts.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const res = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const text = res.getContentText();
  const json = JSON.parse(text);
  if (json.error) throw new Error('Groq error: ' + (json.error.message || JSON.stringify(json.error)));
  if (!json.choices || !json.choices.length) throw new Error('Empty response from Groq');
  return json.choices[0].message.content || '';
}

// Helper: extract JSON object from possibly-wrapped response
function _parseJSON(text) {
  if (!text) throw new Error('Empty response');
  // Try direct parse first
  try { return JSON.parse(text); } catch (e) {}
  // Extract first {...} block
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response: ' + String(text).slice(0, 120));
  return JSON.parse(match[0]);
}

/**
 * Accepts payload:
 *   { description: string, note: string, image: base64 (optional), mime: string (optional) }
 */
function _aiMeal(payload) {
  const description = String(payload.description || '').trim();
  const note        = String(payload.note || '').trim();
  const image       = payload.image || null;
  const mime        = payload.mime || 'image/jpeg';

  if (!description && !image) throw new Error('Empty input — need description or image');

  const sysPrompt = 'คุณคือนักโภชนาการ AI ที่เชี่ยวชาญด้านอาหารไทยและสากล ตอบเป็น JSON เท่านั้น';

  const userText =
    (image ? 'วิเคราะห์รูปอาหารต่อไปนี้ ระบุชื่ออาหารที่เห็น และประมาณค่าโภชนาการรวม' : 'วิเคราะห์อาหารตามคำอธิบายต่อไปนี้แล้วประมาณค่าโภชนาการ') +
    (description ? '\n\nคำอธิบายจากผู้ใช้: "' + description + '"' : '') +
    (note ? '\nหมายเหตุเพิ่มเติม: "' + note + '"' : '') +
    '\n\nตอบเป็น JSON object เท่านั้น รูปแบบ:\n' +
    '{\n' +
    '  "items": ["ชื่ออาหารที่ตรวจพบ", ...],\n' +
    '  "calories": <kcal>,\n' +
    '  "protein": <g>,\n' +
    '  "carbs": <g>,\n' +
    '  "fat": <g>,\n' +
    '  "analysis": "<คำแนะนำสั้นๆ ภาษาไทย 1-2 ประโยค>"\n' +
    '}';

  let userContent;
  if (image) {
    userContent = [
      { type: 'text', text: userText },
      { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + image } }
    ];
  } else {
    userContent = userText;
  }

  const messages = [
    { role: 'system', content: sysPrompt },
    { role: 'user',   content: userContent }
  ];

  const out = _callGroq(messages, MODELS.vision, { jsonMode: true, temperature: 0.3, maxTokens: 800 });
  const parsed = _parseJSON(out);

  return {
    items:    Array.isArray(parsed.items) ? parsed.items.slice(0, 10).map(String) : [],
    calories: Math.round(Number(parsed.calories) || 0),
    protein:  Math.round(Number(parsed.protein) || 0),
    carbs:    Math.round(Number(parsed.carbs) || 0),
    fat:      Math.round(Number(parsed.fat) || 0),
    analysis: String(parsed.analysis || 'วิเคราะห์เสร็จสิ้น').slice(0, 400)
  };
}

function _aiInsight(weekly) {
  if (!weekly) throw new Error('Empty weekly data');
  const sysPrompt = 'คุณคือ AI Health Coach ตอบเป็น JSON เท่านั้น';
  const userText =
    'วิเคราะห์ข้อมูลสุขภาพรายสัปดาห์แล้วให้คำแนะนำ\n\n' +
    'ข้อมูล 7 วันที่ผ่านมา:\n' +
    '- แคลอรี่เฉลี่ย/วัน: ' + weekly.avgCalories + ' kcal (เป้า: ' + weekly.calGoal + ')\n' +
    '- เวลาออกกำลังกายรวม: ' + weekly.totalWorkoutMin + ' นาที (WHO 150+ นาที/สัปดาห์)\n' +
    '- น้ำดื่มเฉลี่ย/วัน: ' + weekly.avgWater + ' ml (เป้า: ' + weekly.waterGoal + ')\n' +
    '- ชั่วโมงนอนเฉลี่ย: ' + weekly.avgSleep + ' ชม. (แนะนำ 7-9)\n\n' +
    'ตอบเป็น JSON object รูปแบบ:\n' +
    '{\n' +
    '  "insights": [\n' +
    '    "🟢 ... (ดี)",\n' +
    '    "🟡 ... (ระวัง)",\n' +
    '    "🔴 ... (แย่)",\n' +
    '    "🟣 ... (แนะนำ)",\n' +
    '    "🔵 ... (น้ำ)"\n' +
    '  ]\n' +
    '}\nมี 4-6 ข้อ insights สั้นๆ ภาษาไทย เริ่มด้วย emoji สีตามสถานะ';

  const messages = [
    { role: 'system', content: sysPrompt },
    { role: 'user',   content: userText }
  ];

  const out = _callGroq(messages, MODELS.reasoning, { jsonMode: true, temperature: 0.5, maxTokens: 600 });
  const parsed = _parseJSON(out);
  return parsed.insights || [];
}

function _aiRecipe(remaining) {
  remaining = remaining || {};
  const cal = Number(remaining.calories || 0);
  const sysPrompt = 'คุณคือ AI Health Coach ตอบเป็น JSON เท่านั้น';
  const userText =
    'แนะนำเมนูอาหารไทย/สากล 3 เมนู ที่เหมาะกับคนที่เหลือพลังงานประมาณ ' + cal + ' kcal ในวันนี้\n' +
    'เน้น: โปรตีนสูง, สมดุลสารอาหาร, ทำง่าย, หาวัตถุดิบได้ในไทย\n\n' +
    'ตอบเป็น JSON object รูปแบบ:\n' +
    '{\n' +
    '  "recipes": [\n' +
    '    {\n' +
    '      "name": "ชื่อเมนูภาษาไทย",\n' +
    '      "calories": <kcal>,\n' +
    '      "protein": <g>,\n' +
    '      "carbs": <g>,\n' +
    '      "fat": <g>,\n' +
    '      "desc": "วิธีทำ/ส่วนประกอบ 1-2 ประโยค ภาษาไทย"\n' +
    '    }\n' +
    '  ]\n' +
    '}\nต้องมี 3 รายการ';

  const messages = [
    { role: 'system', content: sysPrompt },
    { role: 'user',   content: userText }
  ];

  const out = _callGroq(messages, MODELS.fast, { jsonMode: true, temperature: 0.7, maxTokens: 700 });
  const parsed = _parseJSON(out);
  return parsed.recipes || [];
}

function _aiWorkoutPlan(opts) {
  opts = opts || {};
  const sysPrompt = 'คุณคือ AI Personal Trainer ที่ออกแบบโปรแกรมออกกำลังกายให้เหมาะกับเป้าหมายและสภาพร่างกายของแต่ละคน ตอบเป็น JSON เท่านั้น';
  const userText =
    'ออกแบบตารางออกกำลังกาย 7 วันสำหรับผู้ใช้:\n' +
    '- เป้าหมาย/หุ่นที่อยากได้: ' + (opts.goal || 'สุขภาพดี') + '\n' +
    '- สถานที่/อุปกรณ์: ' + (opts.place || 'บ้าน') + '\n' +
    '- ออกกำลัง: ' + (opts.daysPerWeek || 4) + ' วัน/สัปดาห์\n' +
    '- ระดับความสามารถ: ' + (opts.level || 'ปานกลาง') + '\n' +
    (opts.note ? '- หมายเหตุพิเศษ: ' + opts.note + '\n' : '') +
    '\nออกแบบตาราง 7 วัน (จันทร์-อาทิตย์) วันที่ไม่ได้ออกให้ใส่ "Rest" หรือ "Active Recovery"\n' +
    'แต่ละวันออกกำลังมี 3-5 ท่า ระบุ ชื่อท่า, sets, reps (ช่วงเช่น "8-12" หรือ "30 sec"), note (optional)\n' +
    '\nตอบเป็น JSON object รูปแบบ:\n' +
    '{\n' +
    '  "plan": [\n' +
    '    {\n' +
    '      "day": "จันทร์",\n' +
    '      "focus": "Push (อก/ไหล่/แขนหลัง)",\n' +
    '      "exercises": [\n' +
    '        { "name": "ชื่อท่า", "sets": 3, "reps": "10-12", "note": "เคล็ดลับสั้นๆ" }\n' +
    '      ]\n' +
    '    }\n' +
    '  ],\n' +
    '  "tips": ["คำแนะนำสำคัญ 3-4 ข้อ ภาษาไทย"]\n' +
    '}';

  const messages = [
    { role: 'system', content: sysPrompt },
    { role: 'user',   content: userText }
  ];

  const out = _callGroq(messages, MODELS.reasoning, { jsonMode: true, temperature: 0.5, maxTokens: 2000 });
  const parsed = _parseJSON(out);
  return { plan: parsed.plan || [], tips: parsed.tips || [] };
}

// ================================================================
//   SPREADSHEET HELPERS
// ================================================================
function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _getSpreadsheet() {
  let ss;
  if (SHEET_ID) {
    ss = SpreadsheetApp.openById(SHEET_ID);
  } else {
    const stored = _getProp('SHEET_ID');
    if (stored) {
      ss = SpreadsheetApp.openById(stored);
    } else {
      ss = SpreadsheetApp.create('VITA Health Tracker Data');
      PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
    }
  }
  CATEGORIES.forEach(cat => _ensureSheet(ss, cat));
  return ss;
}

function _ensureSheet(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS[name]);
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS[name]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _sanitize(v) {
  if (typeof v !== 'string') return v;
  if (/^[=+\-@]/.test(v)) return "'" + v;   // prevent formula injection
  return v;
}

function _addEntry(ss, category, entry) {
  if (!CATEGORIES.includes(category)) throw new Error('Invalid category');
  const sh = _ensureSheet(ss, category);
  const row = HEADERS[category].map(h => _sanitize(entry[h] != null ? entry[h] : ''));
  sh.appendRow(row);
}

function _deleteEntry(ss, category, id) {
  if (!CATEGORIES.includes(category)) throw new Error('Invalid category');
  const sh = _ensureSheet(ss, category);
  const data = sh.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(id)) sh.deleteRow(i + 1);
  }
}

function _readAll(ss) {
  const out = {};
  CATEGORIES.forEach(cat => {
    const sh = _ensureSheet(ss, cat);
    const data = sh.getDataRange().getValues();
    const headers = data[0];
    out[cat] = data.slice(1).filter(r => r[0]).map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i]; });
      if (obj.date instanceof Date) {
        obj.date = Utilities.formatDate(obj.date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      if (obj.createdAt instanceof Date) {
        obj.createdAt = obj.createdAt.toISOString();
      }
      return obj;
    });
  });
  return out;
}

function _replaceAll(ss, data) {
  CATEGORIES.forEach(cat => {
    const sh = _ensureSheet(ss, cat);
    sh.clear();
    sh.appendRow(HEADERS[cat]);
    sh.setFrozenRows(1);
    const rows = (data[cat] || []).map(e => HEADERS[cat].map(h => _sanitize(e[h] != null ? e[h] : '')));
    if (rows.length) {
      sh.getRange(2, 1, rows.length, HEADERS[cat].length).setValues(rows);
    }
  });
}
