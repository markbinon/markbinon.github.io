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

const PROMPT = `Ты — система распознавания таблиц. На фото «Лист замены действующего расписания» колледжа. Это может быть одна страница из нескольких; снято под углом, с перекосом, бликами и фоном вокруг. Перенеси КАЖДУЮ строку таблицы в JSON. Ничего не выдумывай и не исправляй: переписывай то, что напечатано.

## Устройство таблицы
Столбцы слева направо:
1. № пары — римская цифра (I–VI) в объединённой ячейке, одна на несколько строк;
2. Учебная группа (например «мБУп-26-1»);
3. п/г СТАРОГО занятия: 0, 1 или 2;
4. Дисциплина старого занятия;
5. ФИО преподавателя;
6. Аудитория;
7. п/г НОВОГО занятия: 0, 1 или 2;
8. Дисциплина нового занятия;
9. ФИО преподавателя;
10. Аудитория;
11. «Ознакомлен» (подпись) — игнорируй.
Левая часть (3–6) — что было по расписанию, правая (7–10) — на что заменили.
Всё вне таблицы игнорируй: шапку, дату, рукописные пометки («Верхняя неделя»), подписи «Диспетчер» и «Зам. декана», булавки, стол.

## Как разбирать строки
- Одна строка = пространство между двумя соседними горизонтальными линиями таблицы. Всё внутри — ОДНА запись. Элементов в ответе столько же, сколько названий групп в столбце 2.
- Текст в ячейках прижат к НИЗУ: название группы, цифра п/г, фамилия и номер аудитории стоят на нижней строке ячейки, а длинное название дисциплины растёт вверх. Поэтому строку определяют линии, а не то, что стоит выше или ниже. Фото кривое: линии наклонены, и левая и правая половины одной строки могут оказаться на разной высоте. Сопоставляй части по линиям таблицы, а не по горизонтали экрана.
- Каждая строка — отдельный элемент, даже если группа повторяется (в разных парах или двумя строками для п/г 1 и п/г 2). Ничего не склеивай и не пропускай. Не добавляй строк, которых нет в таблице.

## Номер пары
- Пары разделены толстыми горизонтальными линиями, они проходят и через столбец 1. Блок между двумя такими линиями — одна пара. Римская цифра стоит посередине блока по высоте, поэтому строки ВЫШЕ цифры относятся к той же паре, что и строки НИЖЕ неё.
- "block" — порядковый номер блока на этом фото сверху вниз (1, 2, 3 …). "pair" — цифра этого блока (I=1, II=2, III=3, IV=4, V=5, VI=6), одинаковая у всех строк блока. Внимательно различай III/IV, IV/V, V/VI. Не путай номер пары с номером аудитории.
- Если цифры блока на этом фото не видно (блок оборван краем листа) — "pair": null.

## Подгруппы
Столбцы 3 и 7 узкие, в каждом одна цифра. Сначала перепиши её дословно: "sub_from_raw" (столбец 3) и "sub_to_raw" (столбец 7). Затем число: "sub_from" / "sub_to" — 0, 1 или 2. Значения слева и справа могут различаться (например 2 слева и 0 справа), это нормально. Не додумывай цифру по соседним строкам. Если ячейка пуста — "" и 0.

## Тексты и «Пары нет»
- «Пары нет» пиши ТОЛЬКО если эти слова отчётливо напечатаны в ячейке. Пустая ячейка или прочерк — это НЕ «Пары нет». Не заполняй этой фразой строки «на всякий случай»: каждую ячейку проверяй отдельно.
- «Пары нет» слева: "from" с пустыми строками. «Пары нет» справа: "to": null (sub_to всё равно запиши по ячейке).
- Перенос строки внутри ячейки — это пробел. Если строка заканчивается дефисом, склей без пробела: «Организационно-» + «технологическое» → «Организационно-технологическое»; «21-» + «45а» → «21-45а»; «21-» + «001-» + «1» → «21-001-1».
- Аудитория — как напечатано: «21-28», «22-211», «21-45а» (буква «а» кириллическая), «21-001», «21-001-1». Короткие номера («37», «23») оставь без префикса. «--» или «–» значит «нет аудитории» → "".
- Преподаватель — «Фамилия И.О.» как напечатано (Клеймёнов В.Ф., Шкилёва В.Е.). Не подбирай похожие фамилии.
- Группу пиши ровно как в таблице, с дефисами и регистром: мБУ-25-1, мБУп-26-1, мИСПР-23-3, мКСК-24-2, мМТО-23-1, мМТОЭ-24-1, мРУП-26-2, мСПР-25-2, мТМТ-26-3. Это разные группы: мБУ и мБУп, мМТО и мМТОЭ. Группы 23 и 24 годов тоже включай.
- Дисциплины переписывай полностью. Кавычки оставь как есть; «Web-технологии» — с латинской W.

## Ответ
Верни ТОЛЬКО JSON-объект {"rows":[...]}: без markdown, пояснений и рассуждений. Порядок строк — сверху вниз. Формат элемента:
{"block":1,"pair":1,"group":"","sub_from_raw":"","sub_from":0,"sub_to_raw":"","sub_to":0,"from":{"subject":"","teacher":"","room":""},"to":{"subject":"","teacher":"","room":""}}

Примеры формата (не данные: на твоём фото будут другие строки):
{"rows":[
{"block":1,"pair":1,"group":"мБУп-26-1","sub_from_raw":"0","sub_from":0,"sub_to_raw":"0","sub_to":0,"from":{"subject":"","teacher":"","room":""},"to":{"subject":"Физическая культура","teacher":"Малых А.А.","room":"21-001-1"}},
{"block":1,"pair":1,"group":"мРУП-26-2","sub_from_raw":"2","sub_from":2,"sub_to_raw":"2","sub_to":2,"from":{"subject":"Иностранный язык","teacher":"Родионова И.П.","room":"21-35"},"to":null},
{"block":1,"pair":1,"group":"мМТОЭ-25-2","sub_from_raw":"0","sub_from":0,"sub_to_raw":"0","sub_to":0,"from":{"subject":"Математические методы в профессиональной деятельности","teacher":"Загоскина Е.Б.","room":"21-23"},"to":{"subject":"История России","teacher":"Чинская В.Э.","room":"21-45а"}},
{"block":2,"pair":2,"group":"мКСК-24-2","sub_from_raw":"0","sub_from":0,"sub_to_raw":"0","sub_to":0,"from":{"subject":"","teacher":"","room":""},"to":{"subject":"Физическая культура","teacher":"Немарова Ж.М.","room":""}},
{"block":4,"pair":4,"group":"мТМТ-26-3","sub_from_raw":"0","sub_from":0,"sub_to_raw":"1","sub_to":1,"from":{"subject":"Физическая культура","teacher":"Ульянов Д.С.","room":"21-001"},"to":{"subject":"Иностранный язык","teacher":"Бухарова Н.А.","room":"21-17"}}
]}`;

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
// Пустое занятие и «Пары нет», которое модель могла написать текстом вместо null
const isNoPairs = (lesson) => {
  if (!lesson || typeof lesson !== 'object') return false;
  return [lesson.subject, lesson.teacher, lesson.room].some((v) =>
    /^пары?\s+нет[.!]?$/i.test(String(v || '').trim())
  );
};

const emptyLesson = () => ({ subject: '', teacher: '', room: '' });
const isEmptyLesson = (l) => !l || !String(l.subject || '').trim();

const fixLesson = (l, warns, where) => {
  if (!l || typeof l !== 'object') return emptyLesson();
  const t = fixTeacher(l.teacher);
  if (t.warn) warns.push(`${where}: ${t.warn}`);
  return { subject: String(l.subject || '').trim(), teacher: t.value, room: fixRoom(l.room) };
};

// ---------- Подгруппа ----------
// Модель отдаёт п/г старого и нового занятия отдельно (с дословной записью ячейки).
// Здесь выбираем итоговую подгруппу и подстраховываемся разбором текста.
const subFromText = (...parts) => {
  for (const p of parts) {
    const t = String(p ?? '').toLowerCase().trim();
    if (!t) continue;
    const m = t.match(/(?:п\s*\/?\s*г\w*\.?\s*|подгр\w*\.?\s*)([12])(?!\d)/)
      || t.match(/(?<![\d-])([12])\s*(?:п\s*\/?\s*г|подгр)/)
      || t.match(/^([12])$/);
    if (m) return Number(m[1]);
  }
  return 0;
};
const asSub = (v) => { const n = Number(v); return n === 1 || n === 2 ? n : 0; };

// п/г старого занятия главнее; если старого нет («Пары нет») — берём п/г нового.
const subNum = (x, hasOld) => {
  const from = asSub(x.sub_from) || subFromText(x.sub_from_raw);
  const to = asSub(x.sub_to) || subFromText(x.sub_to_raw);
  const picked = hasOld ? (from || to) : (to || from);
  return picked || asSub(x.sub) || subFromText(x.from?.room, x.from?.teacher, x.from?.subject);
};

// ---------- Номер пары ----------
// Основной путь: модель нумерует блоки между толстыми линиями ("block"), цифра пары одна на блок.
// Голосуем по строкам блока, пропуски заполняем по соседним блокам. Если "block" не пришёл —
// старый способ: пропуски между известными номерами делим пополам.
function assignPairs(all, warnings) {
  const nums = all.map((x) => pairNum(x));
  const rawBlocks = all.map((x) => { const b = parseInt(x.block, 10); return b > 0 ? b : 0; });

  if (!rawBlocks.every(Boolean)) {
    const known = nums.map((n, i) => (n ? i : -1)).filter((i) => i >= 0);
    all.forEach((x, i) => {
      if (nums[i]) { x._pair = nums[i]; return; }
      const prev = known.filter((k) => k < i).pop();
      const next = known.find((k) => k > i);
      if (prev === undefined && next === undefined) x._pair = 0;
      else if (prev === undefined) x._pair = nums[next];
      else if (next === undefined) x._pair = nums[prev];
      else x._pair = (i - prev) <= (next - i) ? nums[prev] : nums[next];
    });
    return;
  }

  // блоки в порядке появления сверху вниз
  const order = [];
  rawBlocks.forEach((b) => { if (order[order.length - 1] !== b && !order.includes(b)) order.push(b); });
  const pairOf = order.map((b) => {
    const votes = {};
    all.forEach((x, i) => { if (rawBlocks[i] === b && nums[i]) votes[nums[i]] = (votes[nums[i]] || 0) + 1; });
    const keys = Object.keys(votes).sort((a, c) => votes[c] - votes[a]);
    if (keys.length > 1) warnings.push(`блок ${b}: в строках разные номера пар (${keys.join(', ')}), взят ${keys[0]}`);
    return keys.length ? Number(keys[0]) : 0;
  });

  // заполняем блоки без цифры по соседям
  let guessed = false;
  const n = pairOf.length;
  for (let i = 0; i < n; i++) {
    if (pairOf[i]) continue;
    let a = i - 1; while (a >= 0 && !pairOf[a]) a--;
    let b = i + 1; while (b < n && !pairOf[b]) b++;
    guessed = true;
    if (a >= 0 && b < n) {
      const v = pairOf[a] + (i - a);
      pairOf[i] = v < pairOf[b] ? v : pairOf[a];
    } else if (a >= 0) {
      pairOf[i] = Math.min(6, pairOf[a] + (i - a));
    } else if (b < n) {
      pairOf[i] = Math.max(1, pairOf[b] - (b - i));
    }
  }
  if (guessed) warnings.push('у части блоков цифра пары не видна на фото — номер определён по соседним блокам, проверьте');

  all.forEach((x, i) => { x._pair = pairOf[order.indexOf(rawBlocks[i])] || 0; });
}

// ---------- Вызов модели ----------
// Провайдер выбирается по LLM_PROVIDER ('openrouter' | 'mistral' | 'groq'); если не задан — по тому, чей ключ есть в окружении.
const PROVIDERS = {
  mistral: {
    url: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-small-2603', // псевдоним без привязки к версии: mistral-small-latest
    keyEnv: 'MISTRAL_API_KEY',
    maxTokensField: 'max_tokens',
    detail: null,
    reasoning: process.env.LLM_REASONING || '', // для Mistral по умолчанию не передаём
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'nvidia/nemotron-3.5-super-vl:free', // бесплатная, лимит 20 запросов/мин и 50/день
    keyEnv: 'OPENROUTER_API_KEY',
    maxTokensField: 'max_tokens',
    detail: null,
    reasoning: process.env.LLM_REASONING || '',
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'qwen/qwen3.8-27b',
    keyEnv: 'GROQ_API_KEY',
    maxTokensField: 'max_completion_tokens',
    detail: 'high',
    reasoning: 'none',
  },
};
const PROVIDER_NAME = (process.env.LLM_PROVIDER || (process.env.OPENROUTER_API_KEY ? 'openrouter' : process.env.MISTRAL_API_KEY ? 'mistral' : 'groq')).toLowerCase();
const P = PROVIDERS[PROVIDER_NAME] || PROVIDERS.openrouter;
const API_URL = process.env.LLM_API_URL || P.url;
const MODEL = process.env.LLM_MODEL || process.env.QWEN_MODEL || P.model;
const BUDGET_MS = Number(process.env.PARSE_BUDGET_MS) || 55000; // общий лимит времени на все повторы

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (headers, errorMessage, attempt) => {
  const resetHeader = headers?.get('x-ratelimit-reset-tokens') || headers?.get('retry-after');
  let seconds = NaN;
  if (resetHeader) {
    const match = String(resetHeader).match(/[\d.]+/);
    if (match) seconds = Number(match[0]);
  }
  if (!Number.isFinite(seconds)) {
    const match = String(errorMessage || '').match(/try again in\s+([\d.]+)\s*s/i);
    if (match) seconds = Number(match[1]);
  }
  if (!Number.isFinite(seconds) || seconds <= 0) seconds = Math.min(3 * (attempt + 1), 15);
  return Math.min(30000, Math.max(1000, seconds * 1000 + 1000));
};

const extractJson = (text) => {
  const t = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  const arr1 = t.indexOf('['), arr2 = t.lastIndexOf(']');
  let parsed;
  try {
    parsed = JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t);
  } catch (e) {
    // модель могла вернуть голый массив
    if (arr1 >= 0 && arr2 > arr1) parsed = JSON.parse(t.slice(arr1, arr2 + 1)); else throw e;
  }
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.rows)) return parsed.rows;
  throw new Error('В ответе нет массива rows');
};

// level: 2 — строгий JSON + без рассуждений, 1 — только строгий JSON, 0 — без дополнительных параметров.
// Если провайдер не принял параметр (400), recognize() понижает уровень и повторяет запрос.
async function callModel(image, mt, extra, level, attempt) {
  const apiKey = process.env.LLM_API_KEY || process.env[P.keyEnv];
  if (!apiKey) return { ok: false, fatal: true, status: 500, error: `Не задан ${P.keyEnv} (или LLM_API_KEY) в переменных окружения` };

  const url = `data:${mt};base64,${image}`;
  const body = {
    model: MODEL,
    [P.maxTokensField]: 8000,
    temperature: 0,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: extra ? `${PROMPT}\n\n${extra}` : PROMPT },
        { type: 'image_url', image_url: P.detail ? { url, detail: P.detail } : { url } },
      ],
    }],
  };
  if (level >= 1) body.response_format = { type: 'json_object' };
  if (level >= 2 && P.reasoning) body.reasoning_effort = P.reasoning;

  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  const content = data.choices?.[0]?.message?.content;
  // content бывает строкой или списком кусков (у моделей с рассуждениями: куски thinking и text)
  const text = Array.isArray(content)
    ? content.filter((part) => !part.type || part.type === 'text').map((part) => part.text || '').join('')
    : (typeof content === 'string' ? content : '');
  const clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const error = data.error?.message || data.message || 'Ошибка API модели';
  return { ok: r.ok, status: r.status, error, text: clean, retryMs: getRetryDelay(r.headers, error, attempt) };
}

async function recognize(image, mt) {
  const t0 = Date.now();
  let extra = '', level = 2, lastErr = null, lastText = '';

  for (let attempt = 0; attempt < 6; attempt++) {
    let res;
    try {
      res = await callModel(image, mt, extra, level, attempt);
    } catch (e) {
      lastErr = { status: 502, error: 'Сеть: ' + e.message };
      if (Date.now() - t0 + 1500 * (attempt + 1) > BUDGET_MS) break;
      await sleep(1500 * (attempt + 1));
      continue;
    }

    if (!res.ok) {
      if (res.fatal) return { error: res.error, status: 502 }; // ошибка настройки — повторять бессмысленно
      lastErr = res;
      console.error('LLM API ERROR:', res.status, res.error);
      if ([400, 404, 422].includes(res.status) && level > 0) { level--; continue; } // параметр не принят — пробуем проще
      if (res.status === 429 && /per[- ]day|daily|в день/i.test(res.error)) {
        return { error: 'Исчерпан дневной лимит бесплатной модели: ' + res.error, status: 429 };
      }
      if (res.status === 429 || res.status >= 500) {
        const wait = (res.status === 429 ? res.retryMs : 2000 * (attempt + 1)) + Math.floor(Math.random() * 700);
        if (Date.now() - t0 + wait > BUDGET_MS) break;
        await sleep(wait);
        continue;
      }
      return { error: res.error, status: 502 };
    }

    lastText = res.text;
    try {
      const all = extractJson(res.text);
      if (!all.length) throw new Error('пустой массив rows');
      console.log('OCR TOTAL:', all.length);
      console.log('OCR DEBUG:', JSON.stringify(all.slice(0, 5)));
      return { all };
    } catch (e) {
      console.error('JSON ERROR:', e.message);
      console.error('RAW RESPONSE:', res.text.slice(0, 2000));
      extra = 'Предыдущий ответ не подошёл. Верни строго JSON-объект {"rows":[...]} с ВСЕМИ строками таблицы, без пояснений. «Пары нет» пиши только там, где эти слова напечатаны в ячейке.';
    }
  }

  return lastText
    ? { error: 'Не удалось разобрать ответ модели', status: 502, raw: lastText }
    : { error: lastErr?.error || 'Ошибка API после нескольких попыток', status: 502 };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!authed(req)) return res.status(401).json({ error: 'Неверный пароль' });

  const { image, media_type } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Нет изображения' });

  const out = await recognize(image, media_type || 'image/jpeg');
  if (out.error) return res.status(out.status || 502).json({ error: out.error, raw: out.raw });

  const all = (Array.isArray(out.all) ? out.all : []).filter((x) => x && typeof x === 'object');
  const warnings = [];
  assignPairs(all, warnings);

  const unknownGroups = new Set();
  const known = all.filter((x) => {
    if (GROUPS[norm(x.group)]) return true;
    if (x.group) unknownGroups.add(String(x.group));
    return false;
  });

  const rows = [];
  for (const x of known) {
    const group = GROUPS[norm(x.group)];
    const where = `${group}, пара ${x._pair}`;

    const fromNoPairs = isNoPairs(x.from);
    const toNoPairs = isNoPairs(x.to);
    const from = fromNoPairs || !x.from ? emptyLesson() : fixLesson(x.from, warnings, where);

    // Новая часть пустая, но «Пары нет» не написано — это не отмена: такую строку не публикуем
    if (!toNoPairs && x.to && isEmptyLesson(x.to)) {
      warnings.push(`${where}: пустая новая часть без «Пары нет» — строка пропущена`);
      continue;
    }
    const to = toNoPairs || !x.to ? null : fixLesson(x.to, warnings, where);

    rows.push({
      group,
      pair: x._pair,
      sub: subNum(x, !fromNoPairs && !isEmptyLesson(x.from)),
      from,
      to,
    });
  }

  const final = rows.filter((r) => r.pair > 0);
  res.status(200).json({
    rows: final,
    total: all.length,
    skipped: known.length - final.length,
    warnings: [...new Set(warnings)],
    unknown_groups: [...unknownGroups],
    sample: all.slice(0, 3),
  });
};
