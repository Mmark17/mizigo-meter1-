const pool = require('../../lib/db');
const { requireRole } = require('../../lib/auth');

module.exports = async (req, res) => {
  const session = requireRole(req, res, 'tenant');
  if (!session) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const roomRes = await pool.query(
      'SELECT * FROM rooms WHERE room_id = $1 LIMIT 1',
      [session.room_id]
    );
    if (roomRes.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    const telemetryRes = await pool.query(
      'SELECT * FROM energy_logs WHERE room_id = $1 ORDER BY logged_at DESC LIMIT 1',
      [session.room_id]
    );
    const telemetry = telemetryRes.rows[0] || null;

    return res.status(200).json({
      room: roomRes.rows[0],
      telemetry: telemetry || {},
    });
  } catch (err) {
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
};
