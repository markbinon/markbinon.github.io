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

const PROMPT = `Ты распознаёшь таблицу замен в расписании колледжа (ниже дан результат OCR).

ОЧЕНЬ ВАЖНО: НЕ ПРИДУМЫВАЙ ДАННЫЕ. НЕ ЗАПОЛНЯЙ ПУСТЫЕ ЯЧЕЙКИ ФРАЗОЙ «Пары нет».

Столбцы слева направо:
1) № пары — римская цифра I–VI в объединённой ячейке;
2) учебная группа;
3) п/г старого занятия;
4) СТАРОЕ занятие: дисциплина, преподаватель, аудитория;
5) п/г нового занятия;
6) НОВОЕ занятие: дисциплина, преподаватель, аудитория;
7) подпись (игнорируй).

Верни ВСЕ строки таблицы сверху вниз.

Формат ответа — строго JSON-объект:
{"rows":[{"group":"мКСК-25-2","pair":5,"sub":0,"from":{"subject":"","teacher":"","room":""},"to":{"subject":"","teacher":"","room":""}}]}

ПРАВИЛА РАСПОЗНАВАНИЯ:

1. Читай каждую строку отдельно. Не переноси предметы, преподавателей и аудитории из соседних строк.
2. Не додумывай текст по смыслу. Если текст неразборчив или ячейка пустая — оставляй соответствующее поле пустой строкой.
3. Фразу «Пары нет» разрешено использовать ТОЛЬКО если именно эти слова отчётливо присутствуют в соответствующей ячейке.
4. Пустая ячейка, прочерк, отсутствие предмета или отсутствие преподавателя НЕ означают «Пары нет».
5. Если в новой части занятия явно написано «Пары нет», тогда to: null.
6. Если в старой части занятия явно написано «Пары нет», тогда from: {"subject":"","teacher":"","room":""}.
7. Если ты не уверен, написано ли «Пары нет», НЕ используй эту фразу. Оставь поля пустыми.
8. Не заполняй все строки одной и той же фразой. Каждую ячейку проверяй отдельно.
9. Не создавай дополнительные строки, которых нет в таблице.

НОМЕР ПАРЫ:
- pair — целое число от 1 до 6.
- I=1, II=2, III=3, IV=4, V=5, VI=6.
- Номер пары записывай во ВСЕХ строках, относящихся к объединённой ячейке.
- Если цифра не видна и её нельзя достоверно определить — pair: null.

ПОДГРУППА:
- sub — 0 (вся группа), 1 или 2.
- Бери номер подгруппы старого занятия.
- Если в старом занятии явно написано «Пары нет», бери номер подгруппы нового занятия.
- Если подгруппу определить нельзя — 0.

ОСТАЛЬНОЕ:
- Название группы пиши с дефисами, как в таблице.
- Текст предметов и преподавателей переноси точно.
- Номера аудиторий, разбитые переносом строки, склеивай.
- Не путай номер пары с номером аудитории.
- Не используй сведения, которых нет в тексте.

Верни только JSON.`;

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
 * Вызов официального Baidu Cloud PaddleOCR-VL
 * (aip.baidubce.com) — один access_token
 */
async function callPaddleOCR(imageBase64) {
  const logs = [];
  const log = (msg, data) => {
    const line = data !== undefined
      ? `${msg} ${typeof data === 'string' ? data : JSON.stringify(data).slice(0, 400)}`
      : msg;
    logs.push(line);
    console.log('[BAIDU]', line);
  };

  const TOKEN =
    process.env.BAIDU_ACCESS_TOKEN ||
    process.env.PADDLEOCR_TOKEN ||
    process.env.BAIDU_TOKEN;

  if (!TOKEN) {
    return {
      ok: false,
      status: 500,
      error: 'Не задан BAIDU_ACCESS_TOKEN (или PADDLEOCR_TOKEN) в переменных окружения Vercel',
      logs
    };
  }

  log('token present', `len=${TOKEN.length}, start=${TOKEN.slice(0, 6)}...`);

  // 1. Создаём задачу
  const createUrl =
    `https://aip.baidubce.com/rest/2.0/brain/online/v2/paddle-vl-parser/task?access_token=${encodeURIComponent(TOKEN)}`;

  let createRes;
  let createRaw = '';
  try {
    const form = new URLSearchParams();
    form.set('file', imageBase64);
    form.set('file_type', 'image');

    log('create request', `imageBase64 len=${imageBase64?.length || 0}`);

    createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString()
    });

    createRaw = await createRes.text();
    log('create response status', createRes.status);
    log('create response body', createRaw.slice(0, 600));
  } catch (e) {
    log('create network error', e.message);
    return {
      ok: false,
      status: 502,
      error: 'Сеть (Baidu create): ' + e.message,
      logs
    };
  }

  let createData = {};
  try {
    createData = JSON.parse(createRaw);
  } catch (_) {
    return {
      ok: false,
      status: 502,
      error: 'Baidu create: не JSON ответ: ' + createRaw.slice(0, 300),
      logs
    };
  }

  if (!createRes.ok || (createData.error_code && createData.error_code !== 0)) {
    return {
      ok: false,
      status: createRes.status || 502,
      error: createData.error_msg || createData.error_code ||
        ('Ошибка создания задачи Baidu: ' + createRaw.slice(0, 300)),
      logs,
      createData
    };
  }

  const taskId =
    createData.task_id ||
    createData.result?.task_id ||
    createData.data?.task_id;

  if (!taskId) {
    return {
      ok: false,
      status: 502,
      error: 'Baidu не вернул task_id: ' + createRaw.slice(0, 400),
      logs,
      createData
    };
  }

  log('task created', taskId);

  // 2. Поллим результат
  const queryUrl =
    `https://aip.baidubce.com/rest/2.0/brain/online/v2/paddle-vl-parser/task/query?access_token=${encodeURIComponent(TOKEN)}`;

  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    log(`poll #${i + 1}`);

    let statusRes;
    let statusRaw = '';
    try {
      const form = new URLSearchParams();
      form.set('task_id', taskId);

      statusRes = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: form.toString()
      });

      statusRaw = await statusRes.text();
      log(`poll #${i + 1} status`, statusRes.status);
      log(`poll #${i + 1} body`, statusRaw.slice(0, 500));
    } catch (e) {
      log(`poll #${i + 1} network error`, e.message);
      continue;
    }

    let statusData = {};
    try {
      statusData = JSON.parse(statusRaw);
    } catch (_) {
      log(`poll #${i + 1} not json`);
      continue;
    }

    if (statusData.error_code && statusData.error_code !== 0) {
      const msg = String(statusData.error_msg || '');
      if (/processing|pending|running|queue|not ready/i.test(msg) || statusData.error_code === 282000) {
        log(`poll #${i + 1} still processing`, msg);
        continue;
      }

      return {
        ok: false,
        status: 502,
        error: statusData.error_msg || ('Baidu error: ' + statusData.error_code),
        logs,
        statusData
      };
    }

    const result = statusData.result || statusData.data || statusData;
    const status = String(
      result.task_status || result.status || statusData.task_status || statusData.status || ''
    ).toLowerCase();

    log(`poll #${i + 1} task_status`, status || '(empty)');

    // Готово
    if (
      status === 'success' ||
      status === 'done' ||
      status === 'completed' ||
      status === 'finished' ||
      result.markdown ||
      result.parse_result ||
      result.words_result ||
      result.layout_result ||
      result.markdown_url
    ) {
      let text = '';
      let textSource = 'none';

      if (typeof result.markdown === 'string' && result.markdown.trim()) {
        text = result.markdown;
        textSource = 'markdown';
      } else if (result.markdown_url) {
        try {
          const mdRes = await fetch(result.markdown_url);
          text = await mdRes.text();
          textSource = 'markdown_url';
        } catch (e) {
          log('markdown_url fetch failed', e.message);
        }
      }

      if (!text && result.parse_result) {
        text = typeof result.parse_result === 'string'
          ? result.parse_result
          : JSON.stringify(result.parse_result, null, 2);
        textSource = 'parse_result';
      }

      if (!text && result.layout_result) {
        text = JSON.stringify(result.layout_result, null, 2);
        textSource = 'layout_result';
      }

      if (!text && result.words_result) {
        text = JSON.stringify(result.words_result, null, 2);
        textSource = 'words_result';
      }

      if (!text) {
        text = JSON.stringify(result, null, 2);
        textSource = 'full_result_json';
      }

      log('done', `source=${textSource}, len=${text.length}`);

      return {
        ok: true,
        status: 200,
        text: String(text).slice(0, 35000),
        raw: result,
        logs,
        textSource
      };
    }

    if (status === 'failed' || status === 'error' || status === 'fail') {
      return {
        ok: false,
        status: 502,
        error: 'Baidu задача завершилась с ошибкой: ' + (result.error_msg || status),
        logs,
        result
      };
    }
  }

  return {
    ok: false,
    status: 504,
    error: 'Baidu: превышено время ожидания результата (task_id: ' + taskId + ')',
    logs
  };
}

/**
 * Текст OCR + PROMPT → строгий JSON
 * Поддерживает: Groq → OpenAI → Gemini → Anthropic
 */
async function callTextModel(ocrText, extra) {
  const prompt = extra
    ? `${PROMPT}\n\n--- OCR РЕЗУЛЬТАТ ---\n${ocrText}\n\n${extra}`
    : `${PROMPT}\n\n--- OCR РЕЗУЛЬТАТ ---\n${ocrText}`;

  // 1) Groq
  if (process.env.GROQ_API_KEY) {
    const body = {
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      max_completion_tokens: 8000,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    };

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const data = await r.json().catch(() => ({}));
    const content = data.choices?.[0]?.message?.content;
    const text = Array.isArray(content)
      ? content.map((part) => part.text || '').join('')
      : (typeof content === 'string' ? content : '');

    return {
      ok: r.ok,
      status: r.status,
      error: data.error?.message || data.message || 'Ошибка Groq API',
      text,
      retryAfterMs: getRetryDelay(r.headers, data.error?.message, 0)
    };
  }

  // 2) OpenAI
  if (process.env.OPENAI_API_KEY) {
    const body = {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 8000,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const data = await r.json().catch(() => ({}));
    const text = data.choices?.[0]?.message?.content || '';

    return {
      ok: r.ok,
      status: r.status,
      error: data.error?.message || 'Ошибка OpenAI API',
      text,
      retryAfterMs: getRetryDelay(r.headers, data.error?.message, 0)
    };
  }

  // 3) Gemini
  if (process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8000,
        responseMimeType: 'application/json'
      }
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await r.json().catch(() => ({}));
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';

    return {
      ok: r.ok,
      status: r.status,
      error: data.error?.message || 'Ошибка Gemini API',
      text,
      retryAfterMs: 0
    };
  }

  // 4) Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    const body = {
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }]
    };

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const data = await r.json().catch(() => ({}));
    const text = (data.content || []).map((b) => b.text || '').join('');

    return {
      ok: r.ok,
      status: r.status,
      error: data.error?.message || 'Ошибка Anthropic API',
      text,
      retryAfterMs: 0
    };
  }

  return {
    ok: false,
    status: 500,
    error: 'Нет ключа для текстовой модели: задай GROQ_API_KEY или OPENAI_API_KEY или GEMINI_API_KEY или ANTHROPIC_API_KEY'
  };
}

async function recognize(image, mt) {
  const debug = {
    stage: 'start',
    ocrTextLength: 0,
    ocrPreview: '',
    ocrTextSource: '',
    baiduLogs: [],
    groqAttempts: 0,
    lastGroqError: null,
    lastGroqRaw: '',
    imageLen: image?.length || 0
  };

  console.log('[DEBUG] recognize start, image len:', debug.imageLen);

  // === Шаг 1: Baidu OCR ===
  let ocrResult;
  try {
    ocrResult = await callPaddleOCR(image);
  } catch (e) {
    console.error('[DEBUG] Baidu network error:', e.message);
    return {
      error: 'Сеть (Baidu): ' + e.message,
      status: 502,
      debug: { ...debug, stage: 'baidu_network_error', baiduError: e.message }
    };
  }

  debug.baiduLogs = ocrResult.logs || [];

  if (!ocrResult.ok) {
    console.error('[DEBUG] Baidu error:', ocrResult.status, ocrResult.error);
    return {
      error: ocrResult.error,
      status: ocrResult.status || 502,
      debug: {
        ...debug,
        stage: 'baidu_error',
        baiduError: ocrResult.error,
        baiduCreateData: ocrResult.createData || null,
        baiduStatusData: ocrResult.statusData || null
      }
    };
  }

  debug.stage = 'baidu_ok';
  debug.ocrTextLength = ocrResult.text?.length || 0;
  debug.ocrPreview = String(ocrResult.text || '').slice(0, 800);
  debug.ocrTextSource = ocrResult.textSource || '';

  console.log('[DEBUG] Baidu OK, text length:', debug.ocrTextLength, 'source:', debug.ocrTextSource);
  console.log('[DEBUG] OCR preview:', debug.ocrPreview);

  // === Шаг 2: Текст → JSON через Groq ===
  let extra = '';
  let lastErr = null;
  let lastText = '';

  for (let attempt = 0; attempt < 5; attempt++) {
    debug.groqAttempts = attempt + 1;
    let result;

    try {
      result = await callTextModel(ocrResult.text, extra);
    } catch (e) {
      lastErr = {
        status: 502,
        error: 'Сеть (Groq): ' + e.message
      };
      debug.lastGroqError = lastErr.error;
      console.error('[DEBUG] Groq network error:', e.message);
      await sleep(1500 * (attempt + 1));
      continue;
    }

    if (!result.ok) {
      lastErr = result;
      debug.lastGroqError = result.error;
      console.error('[DEBUG] Groq API error:', result.status, result.error);

      if (result.status === 429) {
        const wait = getRetryDelay(null, result.error, attempt);
        console.log('[DEBUG] Groq rate limit, wait', wait, 'ms');
        await sleep(wait + Math.floor(Math.random() * 700));
        continue;
      }

      if (result.status >= 500) {
        await sleep(2000 * (attempt + 1));
        continue;
      }

      return {
        error: result.error,
        status: 502,
        debug
      };
    }

    lastText = result.text;
    debug.lastGroqRaw = String(result.text || '').slice(0, 1200);

    try {
      const all = extractJson(result.text);

      console.log('[DEBUG] JSON parsed, rows:', all.length);
      console.log('[DEBUG] First rows:', JSON.stringify(all.slice(0, 5)));

      return { all, debug };
    } catch (e) {
      console.error('[DEBUG] JSON parse error:', e.message);
      console.error('[DEBUG] Raw Groq response:', result.text?.slice(0, 800));
      debug.lastJsonError = e.message;

      extra = `Предыдущий ответ не подошёл.
Верни строго JSON-объект {"rows":[...]}.
Не добавляй пояснений.
Не пропускай строки таблицы.
Не выдумывай «Пары нет»: используй эту фразу только если она отчётливо есть в тексте.`;
    }
  }

  return lastText
    ? {
        error: 'Не удалось разобрать ответ модели',
        status: 502,
        raw: lastText,
        debug
      }
    : {
        error: lastErr?.error || 'Ошибка API после нескольких попыток',
        status: 502,
        debug
      };
}

module.exports = async (req, res) => {
  // === ВРЕМЕННАЯ ПРОВЕРКА ДЕПЛОЯ ===
  // Если видишь эту ошибку — новый скрипт работает.
  // После проверки скажи — уберу.
  if (req.body?.debug_ping === true) {
    return res.status(200).json({
      ok: true,
      message: 'NEW_PARSE_JS_LOADED_v3',
      time: new Date().toISOString(),
      hasBaiduToken: !!(process.env.BAIDU_ACCESS_TOKEN || process.env.PADDLEOCR_TOKEN || process.env.BAIDU_TOKEN),
      hasGroqKey: !!process.env.GROQ_API_KEY
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  if (!authed(req)) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }

  const { image, media_type } = req.body || {};

  if (!image) {
    return res.status(400).json({
      error: 'Нет изображения. Если видишь этот текст — новый parse.js загружен (v3).'
    });
  }

  const out = await recognize(image, media_type || 'image/jpeg');

  if (out.error) {
    console.error('[DEBUG] recognize failed:', out.error);
    return res.status(out.status || 502).json({
      error: out.error,
      raw: out.raw || null,
      debug: out.debug || null,
      baiduLogs: out.debug?.baiduLogs || []
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

      const from = fromNoPairs
        ? emptyLesson()
        : fixLesson(x.from, warnings, where);

      const to = toNoPairs || !x.to
        ? null
        : fixLesson(x.to, warnings, where);

      return {
        group,
        pair: x._pair,
        sub: Number(x.sub) || 0,
        from,
        to
      };
    })
    .filter((r) => r.pair > 0);

  const debugInfo = {
    ...(out.debug || {}),
    stage: 'done',
    parsedRows: all.length,
    knownGroups: known.length,
    finalRows: rows.length,
    unknownGroups: [...new Set(unknownGroups)].slice(0, 10),
    pairsFound: nums.filter(Boolean).length
  };

  console.log('[DEBUG] Final:', JSON.stringify(debugInfo));

  // Если ничего не распознали — возвращаем ошибку с подробностями
  if (rows.length === 0) {
    const reason = [
      `stage=${debugInfo.stage}`,
      `OCR длина: ${debugInfo.ocrTextLength || 0}`,
      `OCR source: ${debugInfo.ocrTextSource || '-'}`,
      `Распознано строк: ${debugInfo.parsedRows || 0}`,
      `Известных групп: ${debugInfo.knownGroups || 0}`,
      `Пар найдено: ${debugInfo.pairsFound || 0}`,
      debugInfo.unknownGroups?.length
        ? `Неизвестные группы: ${debugInfo.unknownGroups.join(', ')}`
        : null,
      debugInfo.lastGroqError
        ? `Groq error: ${debugInfo.lastGroqError}`
        : null,
      debugInfo.ocrPreview
        ? `OCR: ${String(debugInfo.ocrPreview).slice(0, 150)}`
        : 'OCR пустой'
    ].filter(Boolean).join(' | ');

    return res.status(422).json({
      error: '[v3] Не удалось распознать ни одной строки. ' + reason,
      rows: [],
      total: all.length,
      sample: all.slice(0, 8),
      debug: debugInfo,
      baiduLogs: debugInfo.baiduLogs || [],
      warnings: [...new Set(warnings)],
      scriptVersion: 'parse-js-v3-debug'
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
