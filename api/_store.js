<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Замены</title>
<style>
body{font-family:system-ui,sans-serif;background:#0d060a;color:#fff;max-width:36rem;margin:0 auto;padding:1rem}
input,button,textarea{font:inherit;width:100%;box-sizing:border-box;padding:.7rem;margin:.3rem 0;border-radius:.7rem;border:1px solid #f472b655;background:#1e0f16;color:#fff}
button{background:linear-gradient(135deg,#f472b6,#e11d48);border:0;font-weight:600}
textarea{height:12rem;font-family:monospace;font-size:.75rem}
li{margin:.3rem 0}.cx{color:#fb7185}#msg{color:#f9a8d4}
</style></head><body>
<h1>Загрузка замен</h1>
<section style="border:1px solid #f472b655;border-radius:1rem;padding:.8rem;margin:1rem 0 1.5rem">
  <h2>Технические работы</h2>
  <label style="display:flex;align-items:center;gap:.6rem"><input id="noticeShow" type="checkbox" style="width:auto"> Показывать сообщение о технических работах</label>
  <label for="noticeTitle">Заголовок</label>
  <input id="noticeTitle" value="Временно не работает" maxlength="120">
  <label for="noticeSub">Текст сообщения</label>
  <textarea id="noticeSub" style="height:5rem;font-family:system-ui,sans-serif;font-size:1rem" maxlength="500">Ведутся технические работы. Загляните позже.</textarea>
  <button id="noticeSave" type="button">Сохранить настройки</button>
  <p id="noticeMsg" aria-live="polite"></p>
</section>
<input id="pw" type="password" placeholder="Пароль">
<label>Дата, на которую действуют замены</label>
<input id="date" type="date">
<input id="file" type="file" accept="image/*">
<button id="go">Распознать</button>
<ul id="list"></ul>
<textarea id="json" hidden></textarea>
<button id="pub" hidden>Опубликовать на сайте</button>
<p id="msg"></p>
<script>
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const t = new Date(Date.now() + 864e5);
$('date').value = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
$('pw').value = sessionStorage.getItem('pw') || '';
const say = (s) => { $('msg').textContent = s; };
const noticeSay = (s) => { $('noticeMsg').textContent = s; };

// Читаем ответ как текст и только затем разбираем JSON: HTML-ошибки Vercel
// показываются понятным сообщением вместо «JSON.parse unexpected character».
async function readApiResponse(response) {
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch {
    const preview = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    throw new Error(`Сервер вернул не JSON (HTTP ${response.status})${preview ? ': ' + preview : ''}`);
  }
  if (!response.ok) throw new Error(data.error || `Ошибка сервера HTTP ${response.status}`);
  return data;
}

async function loadNoticeSettings() {
  try {
    const r = await fetch('/api/site-notice', { cache: 'no-store' });
    const notice = await readApiResponse(r);
    $('noticeShow').checked = Boolean(notice.show);
    $('noticeTitle').value = notice.title || 'Временно не работает';
    $('noticeSub').value = notice.sub || 'Ведутся технические работы. Загляните позже.';
  } catch (e) {
    noticeSay('Не удалось загрузить настройки: ' + e.message);
  }
}

$('noticeSave').onclick = async () => {
  sessionStorage.setItem('pw', $('pw').value);
  noticeSay('Сохраняю…');
  try {
    const r = await fetch('/api/site-notice', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        show: $('noticeShow').checked,
        title: $('noticeTitle').value.trim(),
        sub: $('noticeSub').value.trim()
      })
    });
    await readApiResponse(r);
    noticeSay('Настройки сохранены. Сайт обновится примерно в течение 30 секунд.');
  } catch (e) {
    noticeSay('Не удалось сохранить: ' + e.message);
  }
};

async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.76).split(',')[1];
}
const headers = () => ({ 'content-type': 'application/json', 'x-admin-password': $('pw').value });

function show(rows) {
  $('list').innerHTML = '';
  rows.forEach((r) => {
    const li = document.createElement('li');
    li.textContent = `${r.group} · пара ${r.pair}${r.sub ? ' · п/г ' + r.sub : ''}: ` +
      (r.to ? `${r.to.subject}, ${r.to.teacher || '—'}, ${r.to.room || '—'}` : 'Пары нет');
    if (!r.to) li.className = 'cx';
    $('list').appendChild(li);
  });
  if (!rows.length) say('Для ваших групп замен в списке нет.');
}

$('go').onclick = async () => {
  const f = $('file').files[0];
  if (!f) return say('Выберите фото.');
  sessionStorage.setItem('pw', $('pw').value);
  say('Распознаю…');
  try {
    const r = await fetch('/api/parse', { method: 'POST', headers: headers(), body: JSON.stringify({ image: await shrink(f), media_type: 'image/jpeg' }) });
    let j;
    try { j = await readApiResponse(r); }
    catch (e) { return say(e.message); }
    $('json').value = JSON.stringify(j.rows, null, 1);
    $('json').hidden = false; $('pub').hidden = false;
    show(j.rows);
    say(`Найдено замен: ${j.rows.length} (строк в таблице: ${j.total}). Проверьте и опубликуйте.`);
  } catch (e) { say('Ошибка: ' + e.message); }
};

$('pub').onclick = async () => {
  let rows;
  try { rows = JSON.parse($('json').value); } catch { return say('JSON некорректен.'); }
  if (!$('date').value) return say('Выберите дату.');
  say('Публикую…');
  try {
    const r = await fetch('/api/replacements', { method: 'POST', headers: headers(), body: JSON.stringify({ date: $('date').value, rows }) });
    const raw = await r.text();
    let j = {};
    try { j = JSON.parse(raw); } catch {}
    if (r.ok) return say('Опубликовано. На сайте обновится в течение минуты.');
    say(`Ошибка ${r.status}: ${j.error || raw.slice(0, 150) || 'нет ответа'}`);
  } catch (e) { say('Ошибка сети: ' + e.message); }
};
loadNoticeSettings();
</script></body></html>
