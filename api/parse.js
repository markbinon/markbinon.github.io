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

const PROMPT = `На изображении лист замен в расписании (фото таблицы). Столбцы слева направо:
1) № пары — РИМСКАЯ цифра (I–VI) в объединённой ячейке, одна на несколько строк подряд;
2) учебная группа; 3) п/г старого занятия; 4) СТАРОЕ занятие: дисциплина, преподаватель, аудитория;
5) п/г нового занятия; 6) НОВОЕ занятие: дисциплина, преподаватель, аудитория; 7) подпись (игнорируй).
Верни ТОЛЬКО JSON-массив без пояснений и без markdown — по одному элементу на КАЖДУЮ строку таблицы, сверху вниз, ВСЕ группы подряд, ничего не пропуская:
{"group":"мКСК-25-2","pair":5,"sub":0,"from":{"subject":"","teacher":"","room":""},"to":{"subject":"","teacher":"","room":""}}
Правила:
- "pair" — целое число 1–6. Римскую цифру пары записывай ВО ВСЕХ строках, которые к ней относятся (I=1, II=2, III=3, IV=4, V=5, VI=6): когда строка визуально находится внутри объединённой ячейки, бери цифру этой ячейки. Если цифры не видно (верх обрезанного листа) — null.
- "sub" — подгруппа: 0 (вся группа), 1 или 2. Бери п/г старого занятия; если старое «Пары нет» — п/г нового.
- Если в новой части «Пары нет», то "to": null. Если «Пары нет» в старой части, то "from": {"subject":"","teacher":"","room":""}.
- Текст переноси точно как в таблице. Номера аудиторий, разбитые переносом строки ("21-" и "45а", "22-" и "211"), склей в одно значение ("21-45а", "22-211"). Название группы пиши с дефисами, как в таблице ("мТМТ-25-2").
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!authed(req)) return res.status(401).json({ error: 'Неверный пароль' });

  const { image, media_type } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Нет изображения' });

  const mt = media_type || 'image/jpeg';
  let text;

  if (process.env.OPENAI_API_KEY) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        max_completion_tokens: 6000,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: `data:${mt};base64,${image}` } },
          ],
        }],
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data.error?.message || 'Ошибка OpenAI API' });
    text = data.choices?.[0]?.message?.content || '';
  } else if (process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: mt, data: image } },
            { text: PROMPT },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0,
        },
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data.error?.message || 'Ошибка Gemini API' });
    text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  } else {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 6000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mt, data: image } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data.error?.message || 'Ошибка API' });
    text = (data.content || []).map((b) => b.text || '').join('');
  }

  text = text.replace(/```json|```/g, '').trim();

  let all;
  try {
    all = JSON.parse(text);
  } catch {
    return res.status(502).json({ error: 'Не удалось разобрать ответ', raw: text });
  }

  if (!Array.isArray(all)) all = Array.isArray(all?.rows) ? all.rows : [];

  // Номер пары в листе замен — объединённая ячейка (I, II, ...), модель может оставить его пустым
  // у части строк. Заполняем пропуски значением предыдущей строки (по ВСЕМ группам, до фильтра).
  let last = 0;
  all.forEach((x) => {
    let n = pairNum(x);
    if (n) last = n; else n = last;
    x._pair = n;
  });

  const known = all.filter((x) => GROUPS[norm(x.group)]);
  const rows = known
    .map((x) => ({
      group: GROUPS[norm(x.group)],
      pair: x._pair,
      sub: Number(x.sub) || 0,
      from: x.from,
      to: x.to || null,
    }))
    .filter((r) => r.pair > 0);

  // sample — первые сырые элементы ответа модели, чтобы быстро увидеть, что пришло
  res.status(200).json({ rows, total: all.length, skipped: known.length - rows.length, sample: all.slice(0, 3) });
};
