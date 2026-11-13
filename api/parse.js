const { authed } = require('./_store');

const GROUPS = {
  'мкск251': 'ksk-25-1', 'мкск252': 'ksk-25-2',
  'мбу251': 'bu-25-1', 'мбуп251': 'bup-25-1',
  'миспр251': 'ispr-25-1', 'миспр252': 'ispr-25-2', 'миспр253': 'ispr-25-3',
  'мспр251': 'spr-25-1', 'мспр252': 'spr-25-2',
  'мср251': 'spr-25-1', 'мср252': 'spr-25-2',
  'мсп251': 'spr-25-1', 'мсп252': 'spr-25-2',
  'ммтоэ251': 'mtoe-25-1', 'ммтоэ252': 'mtoe-25-2',
  'ммто3251': 'mtoe-25-1', 'ммто3252': 'mtoe-25-2',
  'мтмт251': 'tmt-25-1', 'мтмт252': 'tmt-25-2',
  'мтм251': 'tmt-25-1', 'мтм252': 'tmt-25-2',
  'мруп261': 'rup-26-1', 'мруп262': 'rup-26-2',
  'мбу261': 'bu-26-1', 'мбуп261': 'bup-26-1',
  'мкск261': 'ksk-26-1', 'мкск262': 'ksk-26-2',
  'мтоап261': 'toap-26-1',
  'ммтоэ261': 'mtoe-26-1', 'ммтоэ262': 'mtoe-26-2',
  'мспр261': 'spr-26-1', 'мспр262': 'spr-26-2',
  'мтмт261': 'tmt-26-1', 'мтмт262': 'tmt-26-2', 'мтмт263': 'tmt-26-3',
};

const LAT = {
  k: 'к', c: 'с', m: 'м', p: 'р', t: 'т',
  o: 'о', e: 'е', a: 'а', y: 'у', x: 'х',
  h: 'н', b: 'в', n: 'п', s: 'с'
};

const norm = (s) => String(s || '').toLowerCase()
  .replace(/[kcmptoeayxhbsn]/g, (ch) => LAT[ch])
  .replace(/[^а-яё0-9]/g, '');

const PROMPT = `Задача: распознать таблицу ЗАМЕН в расписании колледжа с фото.

ЗАПРЕЩЕНО:
- придумывать текст, которого нет на фото;
- заполнять пустые ячейки фразой «Пары нет»;
- переносить предмет/преподавателя/аудиторию из соседней строки;
- пропускать строки таблицы;
- добавлять строки, которых нет на фото;
- писать что-либо кроме JSON.

СТРУКТУРА ТАБЛИЦЫ (слева направо):
1. № пары — римская цифра I, II, III, IV, V, VI. Часто в ОБЪЕДИНЁННОЙ ячейке на несколько строк.
2. Группа — например мКСК-25-1, мИСПр-25-2, мТМТ-26-3.
3. п/г старого занятия — 1, 2 или пусто (вся группа).
4. Старое занятие — дисциплина, ФИО преподавателя, аудитория (могут быть в 1–3 строки внутри ячейки).
5. п/г нового занятия — 1, 2 или пусто.
6. Новое занятие — дисциплина, ФИО, аудитория ИЛИ явно «Пары нет».
7. Подпись / примечание — ИГНОРИРУЙ.

ФОРМАТ ОТВЕТА — только JSON:
{"rows":[
  {
    "group":"мКСК-25-2",
    "pair":5,
    "sub":0,
    "from":{"subject":"Математика","teacher":"Иванов И.И.","room":"201"},
    "to":{"subject":"Физика","teacher":"Петров П.П.","room":"105"}
  }
]}

ПРАВИЛА ПОЛЯМ:

pair:
- целое 1..6; I=1, II=2, III=3, IV=4, V=5, VI=6;
- если ячейка пары объединена на N строк — одно и то же pair у всех этих строк;
- если цифру нельзя уверенно прочитать — null.

group:
- как на фото, с дефисами и регистром букв (мКСК-25-1, мИСПр-25-2);
- не нормализуй и не сокращай.

sub:
- номер подгруппы СТАРОГО занятия: 1, 2 или 0 (если п/г нет / вся группа);
- если старое = «Пары нет», бери п/г из нового;
- если неясно — 0.

from (старое занятие):
- subject, teacher, room — только видимый текст;
- если в ячейке явно «Пары нет» → {"subject":"","teacher":"","room":""};
- пустая ячейка / прочерк → пустые строки, НЕ «Пары нет»;
- teacher в виде «Фамилия И.О.» если так на фото;
- room: склеивай переносы («20»+«1» → «201», «12-»+«05» → «12-05»).

to (новое занятие):
- если явно «Пары нет» / «пары нет» → null;
- иначе тот же формат, что from;
- не ставь null, если просто плохо видно — тогда пустые строки внутри объекта.

ПОРЯДОК:
- иди сверху вниз, по одной физической строке таблицы;
- не объединяй разные группы в одну запись;
- одна строка таблицы = один объект в rows.

Верни ТОЛЬКО валидный JSON-объект {"rows":[...]}, без markdown и комментариев.`;

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };

const pairNum = (x) => {
  const v = x.pair ?? x.pair_number ?? x.num ?? x.lesson ?? x['пара'] ?? x['№'];
  const str = String(v ?? '').trim().toLowerCase()
    .replace(/[іl1]/g, (c) => (c === '1' ? '1' : 'i'))
    .replace(/[vv]/g, 'v');

  if (ROMAN[str]) return ROMAN[str];

  const m = str.match(/\d+/);
  const n = m ? parseInt(m[0], 10) : 0;
  return n >= 1 && n <= 6 ? n : 0;
};

const TEACHERS = [
  'Афанасьева Л.В.', 'Борисова М.В.', 'Брохоцкая Е.М.',
  'Бухарова Н.А.', 'Верхозин А.Д.', 'Витт Т.Л.',
  'Гаврилова Ж.Л.', 'Гуломов А.А.', 'Гурулева А.А.',
  'Данилова Т.В.', 'Ерыгина Н.С.', 'Жигунова В.В.',
  'Загоскина Е.Б.', 'Кириченко К.В.', 'Клеймёнов В.Ф.',
  'Козак Е.А.', 'Коломина И.В.', 'Куликов И.С.',
  'Лаптева Л.В.', 'Латышева Е.В.', 'Лысых А.П.',
  'Макогон С.Н.', 'Малых А.А.', 'Михалёва Г.С.',
  'Моисеева А.Д.', 'Назимова Е.В.', 'Накорякова И.Б.',
  'Немарова Ж.М.', 'Перетолчина Ю.Н.', 'Плюснина А.В.',
  'Плюснина О.М.', 'Почекунина Т.Б.', 'Родионова И.П.',
  'Савенков Д.В.', 'Сафонова Т.В.', 'Сидорук В.В.',
  'Терихов Д.А.', 'Терихова С.В.', 'Трифонова С.И.',
  'Ульянов Д.С.', 'Холева Е.А.', 'Чадаева В.В.',
  'Черкашенина Т.В.', 'Чинская В.Э.', 'Чинская И.А.',
  'Чмелёва А.С.', 'Шешалевич Ю.В.', 'Эвинур Д.В.',
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
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }

    prev = cur;
  }

  return prev[n];
};

const splitTeacher = (t) => {
  const m = String(t).trim().replace(/\s+/g, ' ')
    .match(/^([^\s.]+)\s*(.*)$/);

  const sur = (m ? m[1] : '').toLowerCase().replace(/ё/g, 'е');
  const ini = (m ? m[2] : '').toLowerCase().replace(/[^а-яё]/g, '');

  return { sur, ini };
};

const TEACHER_INDEX = TEACHERS.map((full) => ({
  full, ...splitTeacher(full)
}));

const FIO_RE = /[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?\s+[А-ЯЁ]\.\s?[А-ЯЁ]\./g;

const fixTeacher = (raw) => {
  let t = String(raw || '').trim();

  if (t.length > 30 || /[?!]|извин|или |нет,/i.test(t)) {
    const all = t.match(FIO_RE);
    if (all) t = all[all.length - 1].replace(/\s+/g, ' ');
  }

  if (!t || t === '-' || t === '--') return { value: '' };

  const r = splitTeacher(t);
  if (!r.sur) return { value: t };

  const exact = TEACHER_INDEX.filter((k) =>
    k.sur === r.sur && (!r.ini || k.ini === r.ini)
  );

  if (exact.length === 1) return { value: exact[0].full };
  if (exact.length > 1) return { value: t };

  const maxD = r.sur.length >= 8 ? 2 : 1;

  const cand = TEACHER_INDEX
    .map((k) => ({ k, d: lev(r.sur, k.sur) }))
    .filter((x) => x.d <= maxD && (!r.ini || x.k.ini === r.ini))
    .sort((a, b) => a.d - b.d);

  if (cand.length && (cand.length === 1 || cand[0].d < cand[1].d)) {
    return { value: cand[0].k.full };
  }

  return { value: t, warn: `неизвестный преподаватель: ${t}` };
};

const fixRoom = (raw) => {
  raw = String(raw || '').trim()
    .replace(/^ауд(итория|\.)?\s*/i, '');

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

  return text;
};

// Проверяем, действительно ли модель написала «Пары нет»
const isNoPairs = (lesson) => {
  if (!lesson || typeof lesson !== 'object') return false;

  const fields = [
    lesson.subject,
    lesson.teacher,
    lesson.room
  ];

  return fields.some((value) =>
    /^пары?\s+нет[.!]?$/i.test(String(value || '').trim())
  );
};

const emptyLesson = () => ({
  subject: '',
  teacher: '',
  room: ''
});

const fixLesson = (l, warns, where) => {
  if (!l || typeof l !== 'object') return emptyLesson();

  const t = fixTeacher(l.teacher);
  if (t.warn) warns.push(`${where}: ${t.warn}`);

  return {
    subject: String(l.subject || '').trim(),
    teacher: t.value,
    room: fixRoom(l.room)
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (headers, errorMessage, attempt) => {
  const resetHeader =
    headers?.get?.('x-ratelimit-reset-tokens') ||
    headers?.get?.('retry-after');

  let seconds = NaN;

  if (resetHeader) {
    const match = String(resetHeader).match(/[\d.]+/);
    if (match) seconds = Number(match[0]);
  }

  if (!Number.isFinite(seconds)) {
    const match = String(errorMessage || '')
      .match(/try again in\s+([\d.]+)\s*s/i);

    if (match) seconds = Number(match[1]);
  }

  if (!Number.isFinite(seconds) || seconds <= 0) {
    seconds = Math.min(3 * (attempt + 1), 15);
  }

  return Math.min(30000, Math.max(1000, seconds * 1000 + 1000));
};

const extractJson = (text) => {
  const t = String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');

  const source = start >= 0 && end > start
    ? t.slice(start, end + 1)
    : t;

  const parsed = JSON.parse(source);

  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.rows)) return parsed.rows;

  throw new Error('В ответе нет массива rows');
};


/**
 * Vision: Groq Llama 4 Scout (бесплатно)
 */
async function callVision(imageBase64, mediaType, extra) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return {
      ok: false,
      status: 500,
      error: 'Не задан GROQ_API_KEY. Возьми бесплатный ключ на https://console.groq.com/keys'
    };
  }

  const model = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';
  const prompt = extra ? `${PROMPT}\n\n${extra}` : PROMPT;
  const dataUrl = `data:${mediaType || 'image/jpeg'};base64,${imageBase64}`;

  const body = {
    model,
    max_completion_tokens: 8000,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }]
  };

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify(body)
  });

  const data = await r.json().catch(() => ({}));
  const content = data.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map((p) => p.text || '').join('')
    : (typeof content === 'string' ? content : '');

  return {
    ok: r.ok,
    status: r.status,
    error: data.error?.message || data.message || 'Ошибка Groq API',
    text,
    model,
    retryAfterMs: getRetryDelay(r.headers, data.error?.message, 0)
  };
}

async function recognize(image, mt) {
  const debug = {
    stage: 'start',
    model: process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
    attempts: 0,
    lastError: null,
    lastRaw: '',
    imageLen: image?.length || 0
  };

  let extra = '';
  let lastErr = null;
  let lastText = '';

  for (let attempt = 0; attempt < 4; attempt++) {
    debug.attempts = attempt + 1;
    let result;

    try {
      result = await callVision(image, mt, extra);
    } catch (e) {
      lastErr = { status: 502, error: 'Сеть (Groq): ' + e.message };
      debug.lastError = lastErr.error;
      await sleep(1500 * (attempt + 1));
      continue;
    }

    if (!result.ok) {
      lastErr = result;
      debug.lastError = result.error;
      console.error('[DEBUG] Groq error:', result.status, result.error);

      if (result.status === 429) {
        const wait = getRetryDelay(null, result.error, attempt);
        await sleep(wait + Math.floor(Math.random() * 500));
        continue;
      }
      if (result.status >= 500) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      return { error: result.error, status: result.status || 502, debug };
    }

    lastText = result.text;
    debug.lastRaw = String(result.text || '').slice(0, 1000);
    debug.model = result.model;

    try {
      const all = extractJson(result.text);
      console.log('[DEBUG] rows:', all.length);
      return { all, debug };
    } catch (e) {
      console.error('[DEBUG] JSON parse:', e.message, result.text?.slice(0, 400));
      debug.lastJsonError = e.message;
      extra = `Предыдущий ответ не JSON. Верни строго {"rows":[...]}. Без пояснений.`;
    }
  }

  return lastText
    ? { error: 'Не удалось разобрать ответ модели', status: 502, raw: lastText, debug }
    : { error: lastErr?.error || 'Ошибка API', status: 502, debug };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!authed(req)) return res.status(401).json({ error: 'Неверный пароль' });

  const { image, media_type } = req.body || {};
  if (!image) {
    return res.status(400).json({ error: 'Нет изображения' });
  }

  const out = await recognize(image, media_type || 'image/jpeg');

  if (out.error) {
    return res.status(out.status || 502).json({
      error: out.error,
      raw: out.raw || null,
      debug: out.debug || null
    });
  }

  let all = out.all;
  if (!Array.isArray(all)) all = Array.isArray(all?.rows) ? all.rows : [];
  all = all.filter((x) => x && typeof x === 'object');

  const nums = all.map((x) => pairNum(x));
  const known_i = nums.map((n, i) => (n ? i : -1)).filter((i) => i >= 0);

  all.forEach((x, i) => {
    if (nums[i]) { x._pair = nums[i]; return; }
    const prev = known_i.filter((k) => k < i).pop();
    const next = known_i.find((k) => k > i);
    if (prev === undefined && next === undefined) { x._pair = 0; return; }
    if (prev === undefined) { x._pair = nums[next]; return; }
    if (next === undefined) { x._pair = nums[prev]; return; }
    x._pair = (i - prev) <= (next - i) ? nums[prev] : nums[next];
  });

  const warnings = [];
  const known = all.filter((x) => GROUPS[norm(x.group)]);
  const unknownGroups = all
    .filter((x) => !GROUPS[norm(x.group)])
    .map((x) => x.group)
    .filter(Boolean);

  const rows = known
    .map((x) => {
      const group = GROUPS[norm(x.group)];
      const where = `${group}, пара ${x._pair}`;
      const fromNoPairs = isNoPairs(x.from);
      const toNoPairs = isNoPairs(x.to);
      const from = fromNoPairs ? emptyLesson() : fixLesson(x.from, warnings, where);
      const to = toNoPairs || !x.to ? null : fixLesson(x.to, warnings, where);
      return { group, pair: x._pair, sub: Number(x.sub) || 0, from, to };
    })
    .filter((r) => r.pair > 0);

  const debugInfo = {
    ...(out.debug || {}),
    stage: 'done',
    parsedRows: all.length,
    knownGroups: known.length,
    finalRows: rows.length,
    unknownGroups: [...new Set(unknownGroups)].slice(0, 10),
    pairsFound: nums.filter(Boolean).length,
    scriptVersion: 'groq-llama4-scout-v1'
  };

  if (rows.length === 0) {
    const reason = [
      `model=${debugInfo.model}`,
      `parsed=${debugInfo.parsedRows}`,
      `known=${debugInfo.knownGroups}`,
      `pairs=${debugInfo.pairsFound}`,
      debugInfo.unknownGroups?.length ? `unknown=${debugInfo.unknownGroups.join(',')}` : null,
      debugInfo.lastError ? `err=${debugInfo.lastError}` : null,
      debugInfo.lastRaw ? `raw=${String(debugInfo.lastRaw).slice(0, 120)}` : null
    ].filter(Boolean).join(' | ');

    return res.status(422).json({
      error: '[groq-v1] Не удалось распознать ни одной строки. ' + reason,
      rows: [],
      total: all.length,
      sample: all.slice(0, 8),
      debug: debugInfo,
      warnings: [...new Set(warnings)]
    });
  }

  res.status(200).json({
    rows,
    total: all.length,
    skipped: known.length - rows.length,
    warnings: [...new Set(warnings)],
    sample: all.slice(0, 5),
    debug: debugInfo
  });
};
