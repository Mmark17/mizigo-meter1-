const pool = require('../lib/db');
const { getSession, requireRole } = require('../lib/auth');

module.exports = async (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.method === 'GET') {
    const action = req.query.action;

    if (action === 'read-all') {
      try {
        await pool.query(
          'UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE',
          [session.user_id]
        );
        return res.status(200).json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
    }

    try {
      const result = await pool.query(
        `SELECT id, title, message, type, read, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [session.user_id]
      );
      return res.status(200).json({ notifications: result.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }
  }

  if (req.method === 'POST') {
    const action = req.query.action;

    if (action === 'mark-read') {
      const notificationId = parseInt(req.query.id, 10);
      if (!notificationId) {
        return res.status(400).json({ error: 'Notification ID is required' });
      }
      try {
        await pool.query(
          'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2',
          [notificationId, session.user_id]
        );
        return res.status(200).json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
    }

    const { title, message, type } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    try {
      const result = await pool.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4) RETURNING id',
        [session.user_id, title, message, type || 'system']
      );
      return res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
