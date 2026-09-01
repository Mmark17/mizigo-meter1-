const pool = require('../../lib/db');
const { requireRole } = require('../../lib/auth');

module.exports = async (req, res) => {
  const session = requireRole(req, res, 'admin');
  if (!session) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, room_id } = req.body;
  const roomId = parseInt(room_id, 10);
  if (!roomId) {
    return res.status(400).json({ error: 'room_id is required' });
  }

  try {
    let actionTitle = '';
    let actionMessage = '';

    if (action === 'demo_reset') {
      await pool.query(
        'UPDATE rooms SET remaining_units = 0.0, total_paid = 0.0, relay_status = 0 WHERE room_id = $1',
        [roomId]
      );
      actionTitle = 'Room Reset';
      actionMessage = `Room ${roomId} has been reset by admin.`;
    } else if (action === 'demo_restore') {
      await pool.query(
        'UPDATE rooms SET remaining_units = 10.0, relay_status = 1 WHERE room_id = $1',
        [roomId]
      );
      actionTitle = 'Room Restored';
      actionMessage = `Room ${roomId} has been restored by admin.`;
    } else if (action === 'cut_off') {
      await pool.query(
        'UPDATE rooms SET relay_status = 0 WHERE room_id = $1',
        [roomId]
      );
      actionTitle = 'Power Cut Off';
      actionMessage = `Room ${roomId} power has been cut off by admin.`;
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    const roomInfo = await pool.query(
      'SELECT landlord_id FROM rooms WHERE room_id = $1 LIMIT 1',
      [roomId]
    );
    if (roomInfo.rows.length > 0) {
      const landlordId = roomInfo.rows[0].landlord_id;
      const tenantResult = await pool.query(
        'SELECT user_id FROM users WHERE room_id = $1 AND role = $2 LIMIT 1',
        [roomId, 'tenant']
      );
      const tenantId = tenantResult.rows.length > 0 ? tenantResult.rows[0].user_id : null;

      if (landlordId) {
        await pool.query(
          'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
          [landlordId, actionTitle, actionMessage, 'system']
        );
      }
      if (tenantId) {
        await pool.query(
          'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
          [tenantId, actionTitle, actionMessage, 'system']
        );
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
};
