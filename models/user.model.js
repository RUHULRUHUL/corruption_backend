const db = require("../config/db");

exports.create = (user) => db.execute(
  "INSERT INTO users (uuid, full_name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)",
  [user.uuid, user.fullName, user.email, user.phone || null, user.passwordHash]
);
exports.findByEmail = async (email) => (await db.execute("SELECT * FROM users WHERE email = ? LIMIT 1", [email]))[0][0];
exports.findSafeById = async (id) => (await db.execute("SELECT id, uuid, full_name, email, phone, role, avatar_url, created_at FROM users WHERE id = ?", [id]))[0][0];
