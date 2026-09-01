const pool = require('../../lib/db');
const { requireRole } = require('../../lib/auth');

module.exports = async (req, res) => {
  const session = requireRole(req, res, 'landlord');
  if (!session) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password, room_id } = req.body;
  if (!username || !password || !room_id) {
    return res.status(400).json({ error: 'Username, password and room are required.' });
  }

  const roomId = parseInt(room_id, 10);
  if (!roomId) {
    return res.status(400).json({ error: 'Invalid room_id.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const roomRes = await client.query(
      'SELECT room_id FROM rooms WHERE room_id = $1 AND landlord_id = $2 LIMIT 1',
      [roomId, session.user_id]
    );
    if (roomRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Room not found or does not belong to you.' });
    }

    const existingUser = await client.query(
      'SELECT id FROM users WHERE username = $1 LIMIT 1',
      [username]
    );
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Username is already taken.' });
    }

    const tenantExists = await client.query(
      'SELECT id FROM users WHERE room_id = $1 AND role = $2 LIMIT 1',
      [roomId, 'tenant']
    );
    if (tenantExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This room already has a tenant assigned.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const insertResult = await client.query(
      'INSERT INTO users (username, password, role, room_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, hashedPassword, 'tenant', roomId]
    );
    const newTenantId = insertResult.rows[0].id;

    await client.query('COMMIT');

    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [newTenantId, 'Welcome to Mizigo Meter', `Your tenant account has been created. You can now log in and view your room dashboard.`, 'system']
    );

    return res.status(200).json({ message: 'Tenant added successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Database error: ' + err.message });
  } finally {
    client.release();
  }
};
