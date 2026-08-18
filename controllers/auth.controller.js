const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const Users = require("../models/user.model");

const issueToken = (user) => jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password, phone } = req.body;
    if (!fullName || !email || !password || password.length < 8) return res.status(400).json({ success: false, message: "fullName, email and an 8-character password are required" });
    if (await Users.findByEmail(email.toLowerCase())) return res.status(409).json({ success: false, message: "Email already registered" });
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await Users.create({ uuid: uuidv4(), fullName, email: email.toLowerCase(), phone, passwordHash });
    const user = await Users.findSafeById(result.insertId);
    res.status(201).json({ success: true, data: { user, token: issueToken(user) } });
  } catch (error) { next(error); }
};
exports.login = async (req, res, next) => {
  try {
    const user = await Users.findByEmail((req.body.email || "").toLowerCase());
    if (!user || user.account_status !== "active" || !(await bcrypt.compare(req.body.password || "", user.password_hash))) return res.status(401).json({ success: false, message: "Invalid email or password" });
    const safeUser = await Users.findSafeById(user.id);
    res.json({ success: true, data: { user: safeUser, token: issueToken(safeUser) } });
  } catch (error) { next(error); }
};
