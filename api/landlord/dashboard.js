const pool = require('../../lib/db');
const { requireRole } = require('../../lib/auth');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  const session = requireRole(req, res, 'landlord');
  if (!session) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const roomsRes = await pool.query(
      'SELECT * FROM rooms WHERE landlord_id = $1 ORDER BY room_name ASC',
      [session.user_id]
    );

    const roomIds = roomsRes.rows.map(r => r.room_id);
    let tenantsRes = { rows: [] };
    if (roomIds.length > 0) {
      tenantsRes = await pool.query(
        `SELECT u.id, u.username, u.room_id, r.room_name
         FROM users u
         JOIN rooms r ON u.room_id = r.room_id
         WHERE u.role = 'tenant' AND r.landlord_id = $1
         ORDER BY r.room_name ASC`,
        [session.user_id]
      );
    }

    const tenantsByRoom = {};
    for (const row of tenantsRes.rows) {
      if (!tenantsByRoom[row.room_id]) tenantsByRoom[row.room_id] = [];
      tenantsByRoom[row.room_id].push(row);
    }

    const rooms = roomsRes.rows.map(room => ({
      ...room,
      tenant: tenantsByRoom[room.room_id]?.[0] || null,
    }));

    return res.status(200).json({ rooms });
  } catch (err) {
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
};
