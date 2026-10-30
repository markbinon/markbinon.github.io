const { authed } = require('./_store');

// Название группы из таблицы -> id группы на сайте
const GROUPS = { 'мкск251': 'ksk-25-1', 'мкск252': 'ksk-25-2' };
const norm = (s) => String(s || '').toLowerCase()
  .replace(/k/g, 'к').replace(/c/g, 'с').replace(/m/g, 'м')
  .replace(/[^а-яa-z0-9]/g, '');

const PROMPT = `На изображении таблица замен в расписании. Каждая строка содержит:
день, группу, номер пары, подгруппу (0 = вся группа), затем СТАРОЕ занятие (предмет, преподаватель, аудитория), затем подгруппу и НОВОЕ занятие (предмет, преподаватель, аудитория).
Верни ТОЛЬКО JSON-массив без пояснений и без markdown. Элемент:
{"group":"мКСК-25-2","pair":5,"sub":0,"from":{"subject":"","teacher":"","room":""},"to":{"subject":"","teacher":"","room":""}}
Если в новой части написано «Пары нет», то "to": null.
Текст переносить точно как в таблице. Аудитории вида 21-49: если номер разбит переносом строки ("22-" и "214"), склей в "22-214". Ничего не выдумывай, пустые ячейки — пустая строка.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!authed(req)) return res.status(401).json({ error: 'Неверный пароль' });
  const { image, media_type } = req.body || {};
  if (!image) return res.status(400).json({ error: 'Нет изображения' });

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
          { type: 'image', source: { type: 'base64', media_type: media_type || 'image/jpeg', data: image } },
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  });
  const data = await r.json();
  if (!r.ok) return res.status(502).json({ error: data.error?.message || 'Ошибка API' });

  const text = (data.content || []).map((b) => b.text || '').join('').replace(/```json|```/g, '').trim();
  let all;
  try { all = JSON.parse(text); } catch { return res.status(502).json({ error: 'Не удалось разобрать ответ', raw: text }); }

  const rows = all
    .filter((x) => GROUPS[norm(x.group)])
    .map((x) => ({ group: GROUPS[norm(x.group)], pair: Number(x.pair), sub: Number(x.sub) || 0, from: x.from, to: x.to || null }));
  res.status(200).json({ rows, total: all.length });
};
