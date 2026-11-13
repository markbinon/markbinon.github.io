const { authed } = require('./_store');

// Название группы из таблицы -> id группы на сайте
const GROUPS = {
  'мкск251': 'ksk-25-1', 'мкск252': 'ksk-25-2',
  'мбу251': 'bu-25-1', 'мбуп251': 'bup-25-1',

  'миспр251': 'ispr-25-1', 'миспр252': 'ispr-25-2', 'миспр253': 'ispr-25-3',

  // мСПР 2 курс
  'мспр251': 'spr-25-1',
  'мспр252': 'spr-25-2',

  // Fallback для кривого OCR: МС门P, МСnP, МCПP и т.п.
  'мср251': 'spr-25-1',
  'мср252': 'spr-25-2',
  'мсп251': 'spr-25-1',
  'мсп252': 'spr-25-2',

  'ммтоэ251': 'mtoe-25-1', 'ммтоэ252': 'mtoe-25-2',

  // Fallback для OCR вида MMTO3-25-1
  'ммто3251': 'mtoe-25-1',
  'ммто3252': 'mtoe-25-2',

  // мТМТ 2 курс
  'мтмт251': 'tmt-25-1',
  'мтмт252': 'tmt-25-2',

  // Fallback, если потерялась одна буква Т
  'мтм251': 'tmt-25-1',
  'мтм252': 'tmt-25-2',

  'мруп261': 'rup-26-1', 'мруп262': 'rup-26-2',
  'мбу261': 'bu-26-1',
  'мбуп261': 'bup-26-1',
  'мкск261': 'ksk-26-1',
  'мкск262': 'ksk-26-2',
  'мтоап261': 'toap-26-1',
  'ммтоэ261': 'mtoe-26-1',
  'ммтоэ262': 'mtoe-26-2',
  'мспр261': 'spr-26-1',
  'мспр262': 'spr-26-2',
  'мтмт261': 'tmt-26-1',
  'мтмт262': 'tmt-26-2',
  'мтмт263': 'tmt-26-3',
};

// латиница, похожая на кириллицу (ошибки распознавания) -> кириллица
const LAT = {
  k: 'к',
  c: 'с',
  m: 'м',
  p: 'р',
  t: 'т',
  o: 'о',
  e: 'е',
  a: 'а',
  y: 'у',
  x: 'х',
  h: 'н',
  b: 'в',
  n: 'п',
  s: 'с'
};

const norm = (s) => String(s || '').toLowerCase()
  .replace(/[kcmptoeayxhbsn]/g, (ch) => LAT[ch])
  .replace(/[^а-яё0-9]/g, '');

// Красивые названия групп (для промпта): id -> «мКСК-25-1»
// Транслитерация id группы в красивое кириллическое название: 'ksk-25-1' -> «мКСК-25-1»
const TRANSLIT = { k: 'к', s: 'с', c: 'с', b: 'б', u: 'у', i: 'и', p: 'п', r: 'р', m: 'м', t: 'т', o: 'о', e: 'э', a: 'а', x: 'х', y: 'у', h: 'н', v: 'в', n: 'п' };
const GROUP_LIST = [...new Set(Object.values(GROUPS))].map((id) => {
  const m = id.match(/^([a-z]+)-(\d+)-(\d+)$/);
  return m ? `м${[...m[1]].map((ch) => TRANSLIT[ch] || ch).join('').toUpperCase()}-${m[2]}-${m[3]}` : id;
});

const PROMPT = `В каждом поле пиши ТОЛЬКО итоговое значение с картинки — без рассуждений, вариантов, извинений и пояснений.
На изображении лист замен в расписании (фото таблицы). Столбцы слева направо:
1) № пары — РИМСКАЯ цифра (I–VI) в объединённой ячейке, одна на несколько строк подряд;
2) учебная группа; 3) п/г старого занятия; 4) СТАРОЕ занятие: дисциплина, преподаватель, аудитория;
5) п/г нового занятия; 6) НОВОЕ занятие: дисциплина, преподаватель, аудитория; 7) подпись (игнорируй).
Верни ТОЛЬКО JSON-массив без пояснений и без markdown — по одному элементу на КАЖДУЮ строку таблицы, сверху вниз, ВСЕ группы подряд, ничего не пропуская:
{"group":"мКСК-25-2","pair":5,"sub":0,"from":{"subject":"","teacher":"","room":""},"to":{"subject":"","teacher":"","room":""}}
В таблице могут быть группы НЕ из этого списка (другие курсы) — такие названия пиши ровно как в таблице, ни к чему не приводи:
${GROUP_LIST.join(', ')}
Правила:
- "pair" — целое число 1–6. Римскую цифру пары записывай ВО ВСЕХ строках, которые к ней относятся (I=1, II=2, III=3, IV=4, V=5, VI=6): когда строка визуально находится внутри объединённой ячейки, бери цифру этой ячейки. Цифра стоит по центру объединённой ячейки по высоте, поэтому строки НАД цифрой относятся к ней же, а не к предыдущей паре: границы пар — это горизонтальные линии таблицы. Внимательно различай III и IV, IV и V, VI. Если цифры не видно (верх обрезанного листа) — null.
- "group" — название группы из колонки 2 ровно как в таблице (с дефисами: «мТМТ-25-2»); исправляй буквы только на очевидные опечатки распознавания внутри той же группы, курс и номер группы не меняй.
- "sub" — подгруппа: 0 (вся группа), 1 или 2. Бери п/г старого занятия; если старое «Пары нет» — п/г нового.
- Если в новой части «Пары нет», то "to": null. Если «Пары нет» в старой части, то "from": {"subject":"","teacher":"","room":""}.
- Текст переноси посимвольно точно как в таблице, сохраняя дефисы, ё и орфографию — ничего не исправляй и не сокращай. Номера аудиторий, разбитые переносом строки ("21-" и "45а", "22-" и "211"), склей в одно значение ("21-45а", "22-211").
- Ничего не выдумывай, пустые ячейки — пустая строка.`;

// Римские цифры и обычные числа -> 1..6
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };
const pairNum = (x) => {
  const v = x.pair ?? x.pair_number ?? x.num ?? x.lesson ?? x['пара'] ?? x['№'];
  const str = String(v ?? '').trim().toLowerCase()
    .replace(/[іl1]/g, (c) => (c === '1' ? '1' : 'i')) // кириллическая/латинская I, l -> i
    .replace(/[vv]/g, 'v');
  const rm = str.match(/^[ivx]+$/);
  if (rm && ROMAN[str]) return ROMAN[str];
  const m = str.match(/\d+/);
  const n = m ? parseInt(m[0], 10) : 0;
  return n >= 1 && n <= 6 ? n : 0;
};

// ---------- Справочник преподавателей (для исправления ошибок распознавания) ----------
// Дополняйте список новыми фамилиями. Совпадение ищется по фамилии с допуском на 1–2 опечатки.
const TEACHERS = [
  'Афанасьева Л.В.',
  'Борисова М.В.',
  'Брохоцкая Е.М.',
  'Бухарова Н.А.',
  'Верхозин А.Д.',
  'Витт Т.Л.',
  'Гаврилова Ж.Л.',
  'Гуломов А.А.',
  'Гурулева А.А.',
  'Данилова Т.В.',
  'Ерыгина Н.С.',
  'Жигунова В.В.',
  'Загоскина Е.Б.',
  'Кириченко К.В.',
  'Клеймёнов В.Ф.',
  'Козак Е.А.',
  'Коломина И.В.',
  'Куликов И.С.',
  'Лаптева Л.В.',
  'Латышева Е.В.',
  'Лысых А.П.',
  'Макогон С.Н.',
  'Макогон П.М.',
  'Малых А.А.',
  'Михалёва Г.С.',
  'Моисеева А.Д.',
  'Назимова Е.В.',
  'Накорякова И.Б.',
  'Немарова Ж.М.',
  'Перетолчина Ю.Н.',
  'Плюснина А.В.',
  'Плюснина О.М.',
  'Почекунина Т.Б.',
  'Родионова И.П.',
  'Савенков Д.В.',
  'Сафонова Т.В.',
  'Сенотрусова Т.А.',
  'Сидорук В.В.',
  'Терихов Д.А.',
  'Терихова С.В.',
  'Трифонова С.И.',
  'Ульянов Д.С.',
  'Холева Е.А.',
  'Чадаева В.В.',
  'Черкашенина Т.В.',
  'Чинская В.Э.',
  'Чинская И.А.',
  'Чмелёва А.С.',
  'Шешалевич Ю.В.',
  'Шкилёва В.Е.',
  'Эвинур Д.В.',
  'Юрченко Т.В.',
];

const lev = (a, b) => {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
};

const splitTeacher = (t) => {
  const m = String(t).trim().replace(/\s+/g, ' ').match(/^([^\s.]+)\s*(.*)$/);
  const sur = (m ? m[1] : '').toLowerCase().replace(/ё/g, 'е');
  const ini = (m ? m[2] : '').toLowerCase().replace(/[^а-яё]/g, '');
  return { sur, ini };
};
const TEACHER_INDEX = TEACHERS.map((full) => ({ full, ...splitTeacher(full) }));

// Возвращает { value, warn }: исправленное ФИО или исходное с пометкой, если не узнали
const FIO_RE = /[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?\s+[А-ЯЁ]\.\s?[А-ЯЁ]\./g;
const fixTeacher = (raw) => {
  let t = String(raw || '').trim();
  // Модель иногда пишет в поле рассуждения вместо значения: берём последнее «Фамилия И.О.»
  if (t.length > 30 || /[?!]|извин|или |нет,/i.test(t)) {
    const all = t.match(FIO_RE);
    if (all) t = all[all.length - 1].replace(/\s+/g, ' ');
  }
  if (!t || t === '-' || t === '--') return { value: '' };
  const r = splitTeacher(t);
  if (!r.sur) return { value: t };
  const exact = TEACHER_INDEX.filter((k) => k.sur === r.sur && (!r.ini || k.ini === r.ini));
  if (exact.length === 1) return { value: exact[0].full };
  if (exact.length > 1) return { value: t }; // однофамильцы: оставляем как распознано
  const maxD = r.sur.length >= 8 ? 2 : 1;
  const cand = TEACHER_INDEX
    .map((k) => ({ k, d: lev(r.sur, k.sur) }))
    .filter((x) => x.d <= maxD && (!r.ini || x.k.ini === r.ini))
    .sort((a, b) => a.d - b.d);
  if (cand.length && (cand.length === 1 || cand[0].d < cand[1].d)) return { value: cand[0].k.full };
  return { value: t, warn: `неизвестный преподаватель: ${t}` };
};

// Fallback-ключи для кривого OCR — при равном расстоянии уступают каноническим
const GROUP_FALLBACK = new Set(['мср251', 'мср252', 'мсп251', 'мсп252', 'ммто3251', 'ммто3252', 'мтм251', 'мтм252']);
const GROUP_INDEX = Object.keys(GROUPS).map((k) => ({
  k,
  digits: (k.match(/\d+/g) || []).join(''),
  fallback: GROUP_FALLBACK.has(k),
}));

// Группа: точное совпадение по справочнику, иначе ближайшее по опечаткам (1–2 символа).
// Возвращает id группы ('ksk-25-1') или null, если строка вообще не похожа на известную группу.
// Порядок приоритета кандидатов: расстояние, каноничность (не OCR-fallback)
const cmpGroup = (a, b) => a.d - b.d || a.fallback - b.fallback;
const pickGroup = (raw, warns) => {
  const where = String(raw || '').trim();
  const key = norm(where);
  if (GROUPS[key]) return GROUPS[key];
  const digits = (key.match(/\d+/g) || []).join('');
  const maxD = key.length >= 8 ? 2 : 1;
  // Исправляем опечатки только внутри той же группы (цифры курса/номера совпадают точно):
  // 'мск252' -> 'мкск252', но 'мкск242' (другой курс) не должен превращаться в 'мкск252'.
  const best = GROUP_INDEX
    .filter((g) => g.digits === digits)
    .map((g) => ({ ...g, d: lev(key, g.k) }))
    .sort((a, b) => a.d - b.d || a.fallback - b.fallback);
  if (best[0] && best[0].d <= maxD && (!best[1] || cmpGroup(best[0], best[1]) !== 0)) {
    warns.push(`группа «${where}» исправлена на ${GROUP_LIST.find((g) => norm(g) === best[0].k) || best[0].k}`);
    return GROUPS[best[0].k];
  }
  warns.push(`неизвестная группа: ${where}`);
  return null;
};

// Аудитория: чиним формат (тире, пробелы, похожие буквы), но номер НЕ подменяем по справочнику
const fixRoom = (raw) => {
  raw = String(raw || '').trim().replace(/^ауд(итория|\.)?\s*/i, '');
  // В поле попали рассуждения модели (а не просто номер): берём последний номер вида 21-45а.
  // Обычные значения («Спортзал (21-001)», «п/г 1: 21-17 | п/г 2: 21-34») не трогаем.
  if (raw.length > 14 && /[?!]|извин|нет,|или |смотрим/i.test(raw)) {
    const all = raw.match(/\b\d{2}\s?-\s?\d{2,3}[а-яa-z]?(?![а-яa-z\d])/gi);
    if (all) raw = all[all.length - 1];
  }
  const text = raw.replace(/[–—−]/g, '-').replace(/\s+/g, ' ').trim();
  let s = text.replace(/\s*-\s*/g, '-').replace(/\s+/g, '');
  if (!s || /^-+$/.test(s)) return '';
  const m = s.match(/^([0-9OoIl]{2})-([0-9OoIl]{2,3})([A-Za-zА-Яа-я]?)$/);
  if (m) {
    const dig = (x) => x.replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
    const suf = m[3].toLowerCase().replace('a', 'а');
    return `${dig(m[1])}-${dig(m[2])}${suf}`;
  }
  return text; // составные значения («Спортзал (21-001)», «п/г 1: … | п/г 2: …») оставляем как есть
};

const fixLesson = (l, warns, where) => {
  if (!l || typeof l !== 'object') return l || null;
  const t = fixTeacher(l.teacher);
  if (t.warn) warns.push(`${where}: ${t.warn}`);
  return { subject: String(l.subject || '').trim(), teacher: t.value, room: fixRoom(l.room) };
};

// ---------- Вызов модели ----------
const ROW_SCHEMA = {
  type: 'object',
  properties: {
    group: { type: 'string' },
    pair: { type: 'integer', nullable: true },
    sub: { type: 'integer' },
    from: { type: 'object', properties: { subject: { type: 'string' }, teacher: { type: 'string' }, room: { type: 'string' } } },
    to: { type: 'object', nullable: true, properties: { subject: { type: 'string' }, teacher: { type: 'string' }, room: { type: 'string' } } },
  },
  required: ['group', 'sub'],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const extractJson = (text) => {
  const t = String(text || '').replace(/```json|```/g, '').trim();
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  return JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t);
};

// Один запрос к выбранному провайдеру; structured=true включает режим «строго JSON» там, где он есть
async function callModel(image, mt, extra, structured) {
  const prompt = extra ? `${PROMPT}\n${extra}` : PROMPT;
  if (process.env.OPENAI_API_KEY) {
    const body = {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_completion_tokens: 6000,
      temperature: 0,
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mt};base64,${image}`, detail: 'high' } },
      ] }],
    };
    if (structured) body.response_format = { type: 'json_object' };
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    return { ok: r.ok, status: r.status, error: data.error?.message || 'Ошибка OpenAI API', text: data.choices?.[0]?.message?.content || '' };
  }
  if (process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const generationConfig = { temperature: 0, maxOutputTokens: 16000 };
    if (structured) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = { type: 'array', items: ROW_SCHEMA };
    }
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ inlineData: { mimeType: mt, data: image } }, { text: prompt }] }],
        generationConfig,
      }),
    });
    const data = await r.json();
    return { ok: r.ok, status: r.status, error: data.error?.message || 'Ошибка Gemini API', text: (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('') };
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: 8000,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mt, data: image } },
        { type: 'text', text: prompt },
      ] }],
    }),
  });
  const data = await r.json();
  return { ok: r.ok, status: r.status, error: data.error?.message || 'Ошибка API', text: (data.content || []).map((b) => b.text || '').join('') };
}

// До 3 попыток: при сбое сети/лимите (429, 5xx) — пауза и повтор; при плохом JSON — повтор с напоминанием;
// если провайдер не принял режим «строго JSON» (400) — повтор без него.
async function recognize(image, mt) {
  let structured = true, extra = '', lastErr = null, lastText = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try { res = await callModel(image, mt, extra, structured); } catch (e) { lastErr = { status: 502, error: 'Сеть: ' + e.message }; await sleep(800 * (attempt + 1)); continue; }
    if (!res.ok) {
      lastErr = res;
      if (res.status === 400 && structured) { structured = false; continue; }
      if (res.status === 429 || res.status >= 500) { await sleep(1200 * (attempt + 1)); continue; }
      return { error: res.error, status: 502 };
    }
    lastText = res.text;
    try { return { all: extractJson(res.text) }; } catch { extra = 'ВАЖНО: верни только валидный JSON-массив, без текста до и после него.'; }
  }
  return lastText
    ? { error: 'Не удалось разобрать ответ', status: 502, raw: lastText }
    : { error: lastErr?.error || 'Ошибка API', status: 502 };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!authed(req)) return res.status(401).json({ error: 'Неверный пароль' });
  const { image, media_type } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Нет изображения' });

  const out = await recognize(image, media_type || 'image/jpeg');
  if (out.error) return res.status(out.status || 502).json({ error: out.error, raw: out.raw });

  let all = out.all;
  if (!Array.isArray(all)) all = Array.isArray(all?.rows) ? all.rows : [];
  all = all.filter((x) => x && typeof x === 'object');

  // Номер пары в листе замен — объединённая ячейка (I, II, ...), цифра стоит по центру ячейки по высоте.
  // Если модель оставила номер пустым, строка может быть и выше цифры (своей пары), и ниже неё.
  // Поэтому пропуски между двумя известными номерами делим пополам: первая половина — к предыдущему
  // номеру, вторая — к следующему (раньше всё отдавалось предыдущему, отсюда сдвиг на одну пару).
  const nums = all.map((x) => pairNum(x));
  const known_i = nums.map((n, i) => (n ? i : -1)).filter((i) => i >= 0);
  all.forEach((x, i) => {
    if (nums[i]) { x._pair = nums[i]; return; }
    const prev = known_i.filter((k) => k < i).pop();
    const next = known_i.find((k) => k > i);
    if (prev === undefined && next === undefined) { x._pair = 0; return; }
    if (prev === undefined) { x._pair = nums[next]; return; }
    if (next === undefined) { x._pair = nums[prev]; return; }
    // номер строки внутри пропуска: ближе к prev — берём prev, ближе к next — next
    x._pair = (i - prev) <= (next - i) ? nums[prev] : nums[next];
  });

  const warnings = [];
  // Контроль порядка пар: в листе номера идут сверху вниз и не убывают.
  // Нарушение монотонности или дубль «группа+пара+п/г» — признак ошибки модели.
  let lastPair = 0;
  const seen = new Set();
  all.forEach((x) => {
    if (x._pair && lastPair && x._pair < lastPair) warnings.push(`порядок пар нарушен: ${x._pair} после ${lastPair} (строка группы «${x.group}»)`);
    if (x._pair) lastPair = x._pair;
    const dupKey = `${GROUPS[norm(x.group)] || x.group}|${x._pair}|${Number(x.sub) || 0}`;
    if (GROUPS[norm(x.group)]) {
      if (seen.has(dupKey)) {
        const [g, p, s] = dupKey.split('|');
        warnings.push(`дубль строки: ${g}, пара ${p}${s !== '0' ? ', п/г ' + s : ''} — проверьте вручную`);
      }
      seen.add(dupKey);
    }
  });
  const known = all
    .map((x) => ({ x, group: pickGroup(x.group, warnings) }))
    .filter((y) => y.group);
  const rows = known
    .map(({ x, group }) => {
      const where = `${group}, пара ${x._pair}`;
      return {
        group,
        pair: x._pair,
        sub: Number(x.sub) || 0,
        from: fixLesson(x.from, warnings, where),
        to: x.to ? fixLesson(x.to, warnings, where) : null,
      };
    })
    .filter((r) => r.pair > 0);

  // sample — первые сырые элементы ответа модели, чтобы быстро увидеть, что пришло
  res.status(200).json({
    rows,
    total: all.length,
    skipped: known.length - rows.length,
    warnings: [...new Set(warnings)],
    sample: all.slice(0, 3),
  });
};
