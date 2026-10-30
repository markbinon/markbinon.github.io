const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'schedule-replacements';

async function load() {
  const r = await fetch(`${URL_}/get/${KEY}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const j = await r.json();
  try { return j.result ? JSON.parse(j.result) : {}; } catch { return {}; }
}

async function save(obj) {
  const r = await fetch(`${URL_}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(obj),
  });
  if (!r.ok) throw new Error('storage ' + r.status);
}

function authed(req) {
  const p = process.env.ADMIN_PASSWORD;
  return Boolean(p) && req.headers['x-admin-password'] === p;
}

module.exports = { load, save, authed };
