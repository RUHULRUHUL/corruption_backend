const db = require("../config/db");

const evidenceColumns = "id, report_id, kind, storage_path, external_url, original_name, mime_type, size_bytes, created_at";

exports.create = async (report, evidence) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO reports (public_id, reporter_id, is_anonymous, title, description, category, incident_location, incident_at, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [report.publicId, report.reporterId, report.isAnonymous, report.title, report.description, report.category, report.location || null, report.incidentAt || null, report.visibility]
    );
    const reportId = result.insertId;
    for (const item of evidence) {
      await connection.execute(
        `INSERT INTO report_evidence (report_id, kind, storage_path, external_url, original_name, mime_type, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [reportId, item.kind, item.storagePath || null, item.externalUrl || null, item.originalName || null, item.mimeType || null, item.sizeBytes || null]
      );
    }
    await connection.execute("INSERT INTO report_actions (report_id, actor_id, action, to_status) VALUES (?, ?, 'submitted', 'submitted')", [reportId, report.reporterId]);
    await connection.commit();
    return reportId;
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
};

exports.findByPublicId = async (publicId) => {
  const [reports] = await db.execute("SELECT r.*, u.full_name AS reporter_name FROM reports r LEFT JOIN users u ON u.id = r.reporter_id WHERE r.public_id = ?", [publicId]);
  if (!reports[0]) return null;
  const [evidence] = await db.execute(`SELECT ${evidenceColumns} FROM report_evidence WHERE report_id = ? ORDER BY created_at`, [reports[0].id]);
  return { ...reports[0], evidence };
};

exports.listForAdmin = async ({ status, team, page, limit }) => {
  const filters = []; const values = [];
  if (status) { filters.push("r.status = ?"); values.push(status); }
  if (team) { filters.push("r.assigned_team = ?"); values.push(team); }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const offset = (page - 1) * limit;
  const [rows] = await db.execute(`SELECT r.*, u.full_name AS reporter_name FROM reports r LEFT JOIN users u ON u.id = r.reporter_id ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`, [...values, limit, offset]);
  return rows || [];
};

exports.updateReview = async (publicId, actorId, { status, targetTeam, note, priority, visibility }) => {
  const report = await exports.findByPublicId(publicId);
  if (!report) return null;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const actionMap = { under_review: "review_started", accepted: "accepted", rejected: "rejected", forwarded: "forwarded", closed: "closed" };
    const nextTeam = status === "forwarded" ? targetTeam : report.assigned_team;
    await connection.execute(
      `UPDATE reports SET status = ?, priority = COALESCE(?, priority), visibility = COALESCE(?, visibility),
       assigned_team = ?, assigned_by = CASE WHEN ? = 'forwarded' THEN ? ELSE assigned_by END,
       assigned_at = CASE WHEN ? = 'forwarded' THEN NOW() ELSE assigned_at END,
       reviewed_by = ?, reviewed_at = NOW(), rejection_reason = CASE WHEN ? = 'rejected' THEN ? ELSE rejection_reason END
       WHERE id = ?`,
      [status, priority || null, visibility || null, nextTeam, status, actorId, status, actorId, status, note || null, report.id]
    );
    await connection.execute("INSERT INTO report_actions (report_id, actor_id, action, from_status, to_status, target_team, note) VALUES (?, ?, ?, ?, ?, ?, ?)", [report.id, actorId, actionMap[status], report.status, status, targetTeam || null, note || null]);
    await connection.commit();
    return exports.findByPublicId(publicId);
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
};

exports.listMine = async (userId) => (await db.execute("SELECT public_id, title, category, status, priority, assigned_team, created_at, updated_at FROM reports WHERE reporter_id = ? ORDER BY created_at DESC", [userId]))[0] || [];
exports.findEvidence = async (publicId, evidenceId) => (await db.execute("SELECT e.*, r.reporter_id FROM report_evidence e JOIN reports r ON r.id = e.report_id WHERE r.public_id = ? AND e.id = ?", [publicId, evidenceId]))[0][0];
