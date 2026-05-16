const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'ispani-dev-secret';
const SALT_ROUNDS = 10;

const authController = {
  signup: async (req, res) => {
    try {
      const { email, password, full_name, role, phone_number, skills, categories, org_id } = req.body;

      if (!email || !password || !full_name || !role) {
        return res.status(400).json({ error: 'email, password, full_name, and role are required' });
      }
      if (!['worker', 'employer', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'role must be worker, employer, or admin' });
      }

      const { data: existing } = await db.from('users').select('id').eq('email', email).single();
      if (existing) return res.status(409).json({ error: 'Email already registered' });

      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

      const { data: user, error } = await db
        .from('users')
        .insert([{ email, password_hash, full_name, role, phone_number, skills, categories, org_id }])
        .select()
        .single();

      if (error) throw new Error(error.message);

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const { password_hash: _, ...safeUser } = user;
      res.status(201).json({ user: safeUser, token });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'email and password required' });

      const { data: user, error } = await db.from('users').select('*').eq('email', email).single();
      if (error || !user) return res.status(401).json({ error: 'Invalid email or password' });

      const valid = await bcrypt.compare(password, user.password_hash || '');
      if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const { password_hash: _, ...safeUser } = user;
      res.json({ user: safeUser, token });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  me: async (req, res) => {
    try {
      const { data: user, error } = await db.from('users').select('*').eq('id', req.user.id).single();
      if (error || !user) return res.status(404).json({ error: 'User not found' });
      const { password_hash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
};

module.exports = authController;
