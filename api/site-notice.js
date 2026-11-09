const { loadNotice, saveNotice, authed } = require('./_store');

const DEFAULT_NOTICE = {  show: false,  title: 'Временно не работает',
  sub: 'Ведутся технические работы. Загляните позже.'
};

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.status(200).json({ ...DEFAULT_NOTICE, ...(await loadNotice()) });
    }
    if (req.method === 'POST') {
      if (!authed(req)) return res.status(401).json({ error: 'Неверный пароль' });
      const body = req.body || {};
      const notice = {
        show: body.show === true,
        title: typeof body.title === 'string' ? body.title.trim().slice(0, 120) : DEFAULT_NOTICE.title,
        sub: typeof body.sub === 'string' ? body.sub.trim().slice(0, 500) : DEFAULT_NOTICE.sub
      };
      await saveNotice(notice);
      return res.status(200).json({ ok: true, notice });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
