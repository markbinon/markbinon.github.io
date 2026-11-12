const { authed } = require('./_store');

// Название группы из таблицы -> id группы на сайте
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

const PROMPT = `В каждом поле пиши ТОЛЬКО итоговое значение с картинки — без рассуждений, вариантов, извинений и пояснений.
На изображении лист замен в расписании (фото таблицы). Столбцы слева направо:
1) № пары — РИМСКАЯ цифра (I–VI) в объединённой ячейке, одна на несколько строк подряд;
2) учебная группа; 3) п/г старого занятия; 4) СТАРОЕ занятие: дисциплина, преподаватель, аудитория;
5) п/г нового занятия; 6) НОВОЕ занятие: дисциплина, преподаватель, аудитория; 7) подпись (игнорируй).
Верни ТОЛЬКО JSON-массив без пояснений и без markdown — по одному элементу на КАЖДУЮ строку таблицы, сверху вниз, ВСЕ группы подряд, ничего не пропуская:
{"group":"мКСК-25-2","pair":5,"sub":0,"from":{"subject":"","teacher":"","room":""},"to":{"subject":"","teacher":"","room":""}}
Правила:
- "pair" — целое число 1–6. Римскую цифру пары записывай ВО ВСЕХ строках, которые к ней относятся (I=1, II=2, III=3, IV=4, V=5, VI=6): когда строка визуально находится внутри объединённой ячейки, бери цифру этой ячейки. Цифра стоит по центру объединённой ячейки по высоте, поэтому строки НАД цифрой относятся к ней же, а не к предыдущей паре: границы пар — это горизонтальные линии таблицы. Внимательно различай III и IV, IV и V, VI. Если цифры не видно (верх обрезанного листа) — null.
- "sub" — подгруппа: 0 (вся группа), 1 или 2. Бери п/г старого занятия; если старое «Пары нет» — п/г нового.
- Если в новой части «Пары нет», то "to": null. Если «Пары нет» в старой части, то "from": {"subject":"","teacher":"","room":""}.
- Текст переноси точно как в таблице. Номера аудиторий, разбитые переносом строки ("21-" и "45а", "22-" и "211"), склей в одно значение ("21-45а", "22-211"). Название группы пиши с дефисами, как в таблице ("мТМТ-25-2").
- Ничего не выдумывай, пустые ячейки — пустая строка.`;

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };
const pairNum = (x) => {
  const v = x.pair ?? x.pair_number ?? x.num ?? x.lesson ?? x['пара'] ?? x['№'];
  const str = String(v ?? '').trim().toLowerCase()
    .replace(/[іl1]/g, (c) => (c === '1' ? '1' : 'i'))
    .replace(/[vv]/g, 'v');
  const rm = str.match(/^[ivx]+$/);
  if (rm && ROMAN[str]) return ROMAN[str];
  const m = str.match(/\d+/);
  const n = m ? parseInt(m[0], 10) : 0;
  return n >= 1 && n <= 6 ? n : 0;
};

// Справочник преподавателей
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
  raw = String(raw || '').trim().replace(/^ауд(итория|\.)?\s*/i, '');
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

const fixLesson = (l, warns, where) => {
  if (!l || typeof l !== 'object') return l || null;
  const t = fixTeacher(l.teacher);
  if (t.warn) warns.push(`${where}: ${t.warn}`);
  return {
    subject: String(l.subject || '').trim(),
    teacher: t.value,
    room: fixRoom(l.room)
  };
};

// ---------- Вызов модели ----------
const ROW_SCHEMA = {
  type: 'object',
  properties: {
    group: { type: 'string' },
    pair: { type: 'integer', nullable: true },
    sub: { type: 'integer' },
    from: {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        teacher: { type: 'string' },
        room: { type: 'string' }
      }
    },
    to: {
      type: 'object',
      nullable: true,
      properties: {
        subject: { type: 'string' },
        teacher: { type: 'string' },
        room: { type: 'string' }
      }
    }
  },
  required: ['group', 'sub']
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const extractJson = (text) => {
  const t = String(text || '').replace(/```json|```/g, '').trim();
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  return JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t);
};

// Один запрос к выбранному провайдеру
async function callModel(image, mt, extra, structured) {
  const prompt = extra ? `${PROMPT}\n${extra}` : PROMPT;

  // OpenCode Console API (OpenAI-compatible Chat Completions)
  if (process.env.OPENCODE_API_KEY) {
    const baseUrl = (process.env.OPENCODE_BASE_URL ||
      'https://opencode.ai/inference').replace(/\/+$/, '');
    const model = process.env.OPENCODE_MODEL || 'deepseek-v4.1-flash';
    const headers = {
      'content-type': 'application/json',
      Authorization: `Bearer ${process.env.OPENCODE_API_KEY}`
    };

    // Для OpenCode Go задайте постоянный OPENCODE_SESSION_ID.
    if (process.env.OPENCODE_SESSION_ID) {
      headers['x-opencode-session'] = process.env.OPENCODE_SESSION_ID;
    }

    const body = {
      model,
      max_tokens: 8000,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mt};base64,${image}`,
              detail: 'high'
            }
          }
        ]
      }]
    };

    const r = await fetch(
      `${baseUrl}/openai/v1/chat/completions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      }
    );

    const data = await r.json().catch(() => ({}));
    const content = data.choices?.[0]?.message?.content;
    const text = Array.isArray(content)
      ? content.map((part) => part.text || '').join('')
      : (typeof content === 'string' ? content : '');

    return {
      ok: r.ok,
      status: r.status,
      error: data.error?.message || data.message || 'Ошибка OpenCode API',
      text
    };
                                   }  
  
  // OpenRouter — резервный провайдер
  if (process.env.OPENROUTER_API_KEY) {
    const body = {
      model: process.env.OPENROUTER_MODEL ||
        'nvidia/nemotron-3.5-super-vl:free',
      max_tokens: 8000,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mt};base64,${image}`,
              detail: 'high'
            }
          }
        ]
      }]
    };

    if (structured) {
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'replacement_rows',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              rows: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    group: { type: 'string' },
                    pair: { type: ['integer', 'null'] },
                    sub: { type: 'integer' },
                    from: {
                      type: ['object', 'null'],
                      properties: {
                        subject: { type: 'string' },
                        teacher: { type: 'string' },
                        room: { type: 'string' }
                      },
                      required: ['subject', 'teacher', 'room'],
                      additionalProperties: false
                    },
                    to: {
                      type: ['object', 'null'],
                      properties: {
                        subject: { type: 'string' },
                        teacher: { type: 'string' },
                        room: { type: 'string' }
                      },
                      required: ['subject', 'teacher', 'room'],
                      additionalProperties: false
                    }
                  },
                  required: ['group', 'pair', 'sub', 'from', 'to'],
                  additionalProperties: false
                }
              }
            },
            required: ['rows'],
            additionalProperties: false
          }
        }
      };
    }

    const r = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer':
            process.env.OPENROUTER_SITE_URL || 'https://markbinon.io',
          'X-Title': process.env.OPENROUTER_SITE_NAME || 'Markbinon'
        },
        body: JSON.stringify(body)
      }
    );

    const data = await r.json();

    return {
      ok: r.ok,
      status: r.status,
      error: data.error?.message || 'Ошибка OpenRouter API',
      text: data.choices?.[0]?.message?.content || ''
    };
  }

  // OpenAI
  if (process.env.OPENAI_API_KEY) {
    const body = {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_completion_tokens: 6000,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mt};base64,${image}`,
              detail: 'high'
            }
          }
        ]
      }]
    };

    if (structured) {
      body.response_format = { type: 'json_object' };
    }

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const data = await r.json();

    return {
      ok: r.ok,
      status: r.status,
      error: data.error?.message || 'Ошибка OpenAI API',
      text: data.choices?.[0]?.message?.content || ''
    };
  }

  // Gemini
  if (process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const generationConfig = { temperature: 0 };

    if (structured) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = {
        type: 'array',
        items: ROW_SCHEMA
      };
    }

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: mt, data: image } },
              { text: prompt }
            ]
          }],
          generationConfig
        })
      }
    );

    const data = await r.json();

    return {
      ok: r.ok,
      status: r.status,
      error: data.error?.message || 'Ошибка Gemini API',
      text: (data.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || '').join('')
    };
  }

  // Anthropic
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      status: 500,
      error: 'Не задан API-ключ: добавь OPENCODE_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY или ANTHROPIC_API_KEY в Vercel'
    };
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mt,
              data: image
            }
          },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });

  const data = await r.json();

  return {
    ok: r.ok,
    status: r.status,
    error: data.error?.message || 'Ошибка API',
    text: (data.content || []).map((b) => b.text || '').join('')
  };
  }
// До 3 попыток при ошибках API или плохом JSON
async function recognize(image, mt) {
  let structured = true;
  let extra = '';
  let lastErr = null;
  let lastText = '';

  for (let attempt = 0; attempt < 3; attempt++) {
    let res;

    try {
      res = await callModel(image, mt, extra, structured);
    } catch (e) {
      lastErr = {
        status: 502,
        error: 'Сеть: ' + e.message
      };
      await sleep(800 * (attempt + 1));
      continue;
    }

    if (!res.ok) {
      lastErr = res;

      if (res.status === 400 && structured) {
        structured = false;
        continue;
      }

      if (res.status === 429 || res.status >= 500) {
        await sleep(1200 * (attempt + 1));
        continue;
      }

      return { error: res.error, status: 502 };
    }

    lastText = res.text;

    try {
      return { all: extractJson(res.text) };
    } catch {
      extra =
        'ВАЖНО: верни только валидный JSON-массив, без текста до и после него.';
    }
  }

  return lastText
    ? {
        error: 'Не удалось разобрать ответ',
        status: 502,
        raw: lastText
      }
    : {
        error: lastErr?.error || 'Ошибка API',
        status: 502
      };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  if (!authed(req)) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }

  const { image, media_type } = req.body || {};

  if (!image) {
    return res.status(400).json({ error: 'Нет изображения' });
  }

  const out = await recognize(image, media_type || 'image/jpeg');

  if (out.error) {
    return res.status(out.status || 502).json({
      error: out.error,
      raw: out.raw
    });
  }

  let all = out.all;

  if (!Array.isArray(all)) {
    all = Array.isArray(all?.rows) ? all.rows : [];
  }

  all = all.filter((x) => x && typeof x === 'object');

  // Восстановление номера пары в объединённых ячейках
  const nums = all.map((x) => pairNum(x));
  const known_i = nums
    .map((n, i) => (n ? i : -1))
    .filter((i) => i >= 0);

  all.forEach((x, i) => {
    if (nums[i]) {
      x._pair = nums[i];
      return;
    }

    const prev = known_i.filter((k) => k < i).pop();
    const next = known_i.find((k) => k > i);

    if (prev === undefined && next === undefined) {
      x._pair = 0;
      return;
    }

    if (prev === undefined) {
      x._pair = nums[next];
      return;
    }

    if (next === undefined) {
      x._pair = nums[prev];
      return;
    }

    x._pair = (i - prev) <= (next - i)
      ? nums[prev]
      : nums[next];
  });

  const warnings = [];
  const known = all.filter((x) => GROUPS[norm(x.group)]);

  const rows = known
    .map((x) => {
      const group = GROUPS[norm(x.group)];
      const where = `${group}, пара ${x._pair}`;

      return {
        group,
        pair: x._pair,
        sub: Number(x.sub) || 0,
        from: fixLesson(x.from, warnings, where),
        to: x.to ? fixLesson(x.to, warnings, where) : null
      };
    })
    .filter((r) => r.pair > 0);

  res.status(200).json({
    rows,
    total: all.length,
    skipped: known.length - rows.length,
    warnings: [...new Set(warnings)],
    sample: all.slice(0, 3)
  });
};
