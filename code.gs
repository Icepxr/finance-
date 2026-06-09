// ============================================================
// FinanceOS — Google Apps Script Backend
// Deploy as: Web App > Execute as: Me > Who has access: Anyone
// ============================================================

const SPREADSHEET_ID = '11YucgCCLEhuQ8Iao_BJlk-jn4cK1q7Q-QE5e-c0ifGM';
const API_KEY = '092548iii'; // change this!

// ────────────────────────────────────────────────────────────
// API KEYS — รวบมาไว้ที่เดียว ใส่ครั้งเดียวที่นี่ ฝั่งแอปไม่ต้องตั้งค่าอีก
// ────────────────────────────────────────────────────────────
const FINNHUB_API_KEY = '';   // ← วาง Finnhub key (finnhub.io → Get free API Key)
const GROQ_API_KEY    = '';   // ← วาง Groq key (console.groq.com/keys)
const GROQ_TEXT_MODEL   = 'llama-3.3-70b-versatile';                 // วิเคราะห์หุ้น (text)
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'; // อ่านสลิป (vision/OCR)

const SHEETS = {
  transactions: 'transactions',
  investments: 'investments',
  goals: 'goals',
  settings: 'settings'
};

// ============================================================
// ENTRY POINTS
// ============================================================
function doGet(e) {
  const params = e.parameter;
  if (!validateKey(params.key)) return error('Unauthorized', 401);

  const action = params.action;
  try {
    if (action === 'getTransactions') return success(getTransactions());
    if (action === 'getInvestments')  return success(getInvestments());
    if (action === 'getGoals')        return success(getGoals());
    if (action === 'getSettings')     return success(getSettings());
    // ── Proxy (key อยู่ใน backend) ──
    if (action === 'quote')           return success(finnhubQuote(params.symbol));
    if (action === 'candle')          return success(finnhubCandle(params.symbol, params.from, params.to));
    if (action === 'fxRates')         return success(finnhubFx(params.base || 'USD'));
    return error('Unknown action');
  } catch (err) {
    return error(err.message);
  }
}

function doPost(e) {
  const params = e.parameter;
  if (!validateKey(params.key)) return error('Unauthorized', 401);

  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (_) { return error('Invalid JSON body'); }

  const action = body.action;
  try {
    if (action === 'addTransaction')    return success(addTransaction(body));
    if (action === 'updateTransaction') return success(updateTransaction(body));  // ← เพิ่มบรรทัดนี้
    if (action === 'updateInvestment') return success(updateInvestment(body));  // ← เพิ่มบรรทัดนี้
    if (action === 'deleteTransaction') return success(deleteRow(SHEETS.transactions, body.id));
    if (action === 'addInvestment')     return success(addInvestment(body));
    if (action === 'addGoal')           return success(addGoal(body));
    if (action === 'updateGoal')        return success(updateGoal(body));
    if (action === 'deleteGoal')        return success(deleteRow(SHEETS.goals, body.id));
    // ── AI proxy (Groq key อยู่ใน backend) ──
    if (action === 'aiText')            return success(groqText(body.prompt));
    if (action === 'aiVision')          return success(groqVision(body.prompt, body.imageBase64, body.mimeType));
    return error('Unknown action');
  } catch (err) {
    return error(err.message);
  }
}

function updateTransaction(data) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('transactions'); // เปลี่ยนชื่อ sheet ให้ตรง
    var rows  = sheet.getDataRange().getValues();
    var headers = rows[0];

    var idCol       = headers.indexOf('id');
    var typeCol     = headers.indexOf('type');
    var categoryCol = headers.indexOf('category');
    var amountCol   = headers.indexOf('amount');
    var dateCol     = headers.indexOf('date');
    var noteCol     = headers.indexOf('note');

    for (var i = 1; i < rows.length; i++) {
      if (rows[i][idCol] === data.id) {
        var row = i + 1; // row index (1-based)
        if (typeCol     >= 0) sheet.getRange(row, typeCol     + 1).setValue(data.type);
        if (categoryCol >= 0) sheet.getRange(row, categoryCol + 1).setValue(data.category);
        if (amountCol   >= 0) sheet.getRange(row, amountCol   + 1).setValue(Number(data.amount));
        if (dateCol     >= 0) sheet.getRange(row, dateCol     + 1).setValue(data.date);
        if (noteCol     >= 0) sheet.getRange(row, noteCol     + 1).setValue(data.note || '');
        return { success: true };
      }
    }
    return { success: false, error: 'ID not found' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}
function updateInvestment(data) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('investments'); // เปลี่ยนชื่อ sheet ให้ตรง
    var rows  = sheet.getDataRange().getValues();
    var headers = rows[0];

    var idCol       = headers.indexOf('id');
    var assetCol = headers.indexOf('asset');
    var amountCol   = headers.indexOf('amount');
    var dateCol     = headers.indexOf('date');
    var noteCol     = headers.indexOf('note');

    for (var i = 1; i < rows.length; i++) {
      if (rows[i][idCol] === data.id) {
        var row = i + 1; // row index (1-based)
        if (assetCol >= 0) sheet.getRange(row, assetCol + 1).setValue(data.asset);
        if (amountCol   >= 0) sheet.getRange(row, amountCol   + 1).setValue(Number(data.amount));
        if (dateCol     >= 0) sheet.getRange(row, dateCol     + 1).setValue(data.date);
        if (noteCol     >= 0) sheet.getRange(row, noteCol     + 1).setValue(data.note || '');
        return { success: true };
      }
    }
    return { success: false, error: 'ID not found' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// VALIDATION & SECURITY
// ============================================================
function validateKey(key) {
  return key === API_KEY;
}

function sanitize(str) {
  if (typeof str !== 'string') return String(str || '');
  // Prevent formula injection
  return str.replace(/^[=+\-@\t\r]/, "'").replace(/<[^>]*>/g, '');
}

function validateAmount(val) {
  const n = parseFloat(val);
  if (isNaN(n) || n <= 0 || n > 999999999) throw new Error('Invalid amount');
  return Math.round(n * 100) / 100;
}

function validateDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) throw new Error('Invalid date format');
  return str;
}

// ============================================================
// HELPERS
// ============================================================
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function sheetToObjects(sheet, headers) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function success(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify({ success: true, data }))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

function error(msg, code = 400) {
  const output = ContentService
    .createTextOutput(JSON.stringify({ success: false, error: msg, code }))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// รับ preflight OPTIONS request จาก browser
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function uid() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

// ============================================================
// TRANSACTIONS
// ============================================================
const TX_HEADERS = ['id','created_at','date','type','category','amount','note'];
const VALID_TYPES = ['Income','Expense'];
const VALID_CATS  = ['Food','Transport','Shopping','Bills','Education','Salary','Freelance','Investment','Entertainment','Other'];

function getTransactions() {
  const sheet = getSheet(SHEETS.transactions);
  return sheetToObjects(sheet, TX_HEADERS);
}

function addTransaction(body) {
  const type = sanitize(body.type);
  if (!VALID_TYPES.includes(type)) throw new Error('Invalid type');

  const cat = sanitize(body.category);
  if (!VALID_CATS.includes(cat)) throw new Error('Invalid category');

  const row = [
    uid(),
    new Date().toISOString(),
    validateDate(body.date),
    type,
    cat,
    validateAmount(body.amount),
    sanitize(body.note || '').slice(0, 200)
  ];

  const sheet = getSheet(SHEETS.transactions);
  if (sheet.getLastRow() === 0) sheet.appendRow(TX_HEADERS);
  sheet.appendRow(row);
  return { id: row[0] };
}

// ============================================================
// INVESTMENTS
// ============================================================
const INV_HEADERS = ['id','created_at','date','asset','amount','note'];
const VALID_ASSETS = ['Bitcoin','ETF','Gold','Stock','Savings'];

function getInvestments() {
  return sheetToObjects(getSheet(SHEETS.investments), INV_HEADERS);
}

function addInvestment(body) {
  const asset = sanitize(body.asset);
  if (!VALID_ASSETS.includes(asset)) throw new Error('Invalid asset');

  const row = [
    uid(),
    new Date().toISOString(),
    validateDate(body.date),
    asset,
    validateAmount(body.amount),
    sanitize(body.note || '').slice(0, 200)
  ];

  const sheet = getSheet(SHEETS.investments);
  if (sheet.getLastRow() === 0) sheet.appendRow(INV_HEADERS);
  sheet.appendRow(row);
  return { id: row[0] };
}

// ============================================================
// GOALS
// ============================================================
const GOAL_HEADERS = ['id','goal_name','target_amount','current_amount','deadline'];

function getGoals() {
  return sheetToObjects(getSheet(SHEETS.goals), GOAL_HEADERS);
}

function addGoal(body) {
  const name = sanitize(body.goal_name || '').slice(0, 100);
  if (!name) throw new Error('Goal name required');

  const row = [
    uid(),
    name,
    validateAmount(body.target_amount),
    parseFloat(body.current_amount) || 0,
    body.deadline ? validateDate(body.deadline) : ''
  ];

  const sheet = getSheet(SHEETS.goals);
  if (sheet.getLastRow() === 0) sheet.appendRow(GOAL_HEADERS);
  sheet.appendRow(row);
  return { id: row[0] };
}

function updateGoal(body) {
  const sheet = getSheet(SHEETS.goals);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.id) {
      sheet.getRange(i + 1, 4).setValue(validateAmount(body.current_amount));
      return { updated: true };
    }
  }
  throw new Error('Goal not found');
}

// ============================================================
// DELETE (shared)
// ============================================================
function deleteRow(sheetName, id) {
  if (!id) throw new Error('ID required');
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) { sheet.deleteRow(i + 1); return { deleted: true }; }
  }
  throw new Error('Row not found');
}

// ============================================================
// SETTINGS
// ============================================================
function getSettings() {
  const sheet = getSheet(SHEETS.settings);
  const data = sheet.getDataRange().getValues();
  const result = {};
  data.forEach(row => { if (row[0]) result[row[0]] = row[1]; });
  return result;
}

// ============================================================
// PROXY — Finnhub (ราคาหุ้น) · key เก็บใน backend
// ============================================================
function fhGet(path) {
  if (!FINNHUB_API_KEY) throw new Error('ยังไม่ได้ตั้ง FINNHUB_API_KEY ใน code.gs');
  const sep = path.indexOf('?') >= 0 ? '&' : '?';
  const url = 'https://finnhub.io/api/v1/' + path + sep + 'token=' + FINNHUB_API_KEY;
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  return JSON.parse(res.getContentText() || '{}');
}
function finnhubQuote(symbol) {
  if (!symbol) throw new Error('symbol required');
  return fhGet('quote?symbol=' + encodeURIComponent(symbol));
}
function finnhubCandle(symbol, from, to) {
  if (!symbol) throw new Error('symbol required');
  return fhGet('stock/candle?symbol=' + encodeURIComponent(symbol) +
    '&resolution=D&from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
}
function finnhubFx(base) {
  return fhGet('forex/rates?base=' + encodeURIComponent(base || 'USD'));
}

// ============================================================
// PROXY — Groq (อ่านสลิป + วิเคราะห์หุ้น) · OpenAI-compatible · key ใน backend
// ============================================================
function groqChat(messages, model) {
  if (!GROQ_API_KEY) throw new Error('ยังไม่ได้ตั้ง GROQ_API_KEY ใน code.gs');
  const res = UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + GROQ_API_KEY },
    payload: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.4,
      max_completion_tokens: 2048,
      response_format: { type: 'json_object' }   // บังคับให้ตอบเป็น JSON ล้วน
    })
  });
  const data = JSON.parse(res.getContentText() || '{}');
  if (data.error) throw new Error((data.error && data.error.message) || 'Groq API error');
  const msg = (((data.choices || [])[0] || {}).message || {}).content;
  return { text: msg || '' };
}
function groqText(prompt) {
  if (!prompt) throw new Error('prompt required');
  return groqChat([{ role: 'user', content: prompt }], GROQ_TEXT_MODEL);
}
function groqVision(prompt, imageBase64, mimeType) {
  if (!prompt || !imageBase64) throw new Error('prompt + image required');
  return groqChat([{
    role: 'user',
    content: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: 'data:' + (mimeType || 'image/jpeg') + ';base64,' + imageBase64 } }
    ]
  }], GROQ_VISION_MODEL);
}

// ============================================================
// AUTHORIZE — รันฟังก์ชันนี้ครั้งเดียวใน editor เพื่อขอสิทธิ์ external request
// (จำเป็นเพราะ Finnhub/Groq ใช้ UrlFetchApp) แล้วค่อย Deploy เวอร์ชันใหม่
// ============================================================
function authorizeExternal() {
  const res = UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true });
  Logger.log('External request OK — HTTP ' + res.getResponseCode());
  return res.getResponseCode();
}

// ============================================================
// SETUP — run once manually to create sheet headers
// ============================================================
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const setup = [
    { name: 'transactions', headers: TX_HEADERS },
    { name: 'investments',  headers: INV_HEADERS },
    { name: 'goals',        headers: GOAL_HEADERS },
    { name: 'settings',     headers: ['key','value'] }
  ];
  setup.forEach(({ name, headers }) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  });
  Logger.log('✅ Sheets setup complete!');
}