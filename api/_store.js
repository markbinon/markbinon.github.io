const find = (re) => {
  const k = Object.keys(process.env).find((n) => re.test(n));
  return k ? process.env[k] : undefined;
};
const URL_ = find(/REST(_API)?_URL$/);
const TOKEN = find(/REST(_API)?_TOKEN$/) ;
const KEY = 'schedule-replacements';
const NOTICE_KEY = 'site-notice';

async function load() {
  if (!URL_ || !TOKEN) throw new Error('Redis не подключён: нет переменных REST_URL и REST_TOKEN');
  const r = await fetch(`${URL_}/get/${KEY}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const j = await r.json();
  try { return j.result ? JSON.parse(j.result) : {}; } catch { return {}; }
}

async function save(obj) {
  if (!URL_ || !TOKEN) throw new Error('Redis не подключён: нет переменных REST_URL и REST_TOKEN');
  const r = await fetch(`${URL_}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(obj),
  });
  if (!r.ok) throw new Error('storage ' + r.status);
}

async function loadNotice() {
  if (!URL_ || !TOKEN) throw new Error('Redis не подключён: нет переменных REST_URL и REST_TOKEN');
  const r = await fetch(`${URL_}/get/${NOTICE_KEY}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const j = await r.json();
  try {
    return j.result ? JSON.parse(j.result) : {
      show: false,
      title: 'Временно не работает',
      sub: 'Ведутся технические работы. Загляните позже.'
    };
  } catch {
    return { show: false, title: 'Временно не работает', sub: 'Ведутся технические работы. Загляните позже.' };
  }
}

async function saveNotice(notice) {
  if (!URL_ || !TOKEN) throw new Error('Redis не подключён: нет переменных REST_URL и REST_TOKEN');
  const r = await fetch(`${URL_}/set/${NOTICE_KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(notice),
  });
  if (!r.ok) throw new Error('storage ' + r.status);
}

function authed(req) {
  const p = process.env.ADMIN_PASSWORD;
  return Boolean(p) && req.headers['x-admin-password'] === p;
}

module.exports = { load, save, loadNotice, saveNotice, authed };
