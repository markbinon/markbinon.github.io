const { load, save, authed } = require('./_store');

const dstr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(await load());
    }
    if (req.method === 'POST') {
      if (!authed(req)) return res.status(401).json({ error: 'Неверный пароль' });
      const { date, rows } = req.body || {};
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(rows)) return res.status(400).json({ error: 'Неверные данные' });
      const data = await load();
      const byGroup = {};
      rows.forEach((r) => { (byGroup[r.group] = byGroup[r.group] || []).push({ pair: r.pair, sub: r.sub || 0, to: r.to || null }); });
      data[date] = byGroup;
      const limit = dstr(new Date(Date.now() - 14 * 86400000));
      Object.keys(data).forEach((k) => { if (k < limit) delete data[k]; });
      await save(data);
      return res.status(200).json({ ok: true });
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
