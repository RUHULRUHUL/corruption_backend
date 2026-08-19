const db = require("../config/db");

const allowedActions = new Set(["approved", "cancelled", "forwarded"]);

exports.listComplaints = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const values = [];
    const statusFilter = status ? "AND p.status = ?" : "";
    if (status) values.push(status);

    const [complaints] = await db.execute(
      `SELECT p.id, p.public_id, p.title, p.body, p.status, p.created_at, p.updated_at,
              u.uuid AS author_uuid, u.full_name AS author_name, u.email AS author_email
       FROM posts p
       LEFT JOIN users u ON u.id = p.author_id
      WHERE p.status <> 'deleted' ${statusFilter}
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    const ids = complaints.map((complaint) => complaint.id);
    let mediaRows = [];
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      [mediaRows] = await db.execute(`SELECT * FROM post_media WHERE post_id IN (${placeholders}) ORDER BY created_at`, ids);
    }
    const mediaByPost = new Map();
    for (const media of mediaRows) {
      const items = mediaByPost.get(media.post_id) || [];
      items.push(media);
      mediaByPost.set(media.post_id, items);
    }

    res.json({
      success: true,
      data: complaints.map((complaint) => ({ ...complaint, media: mediaByPost.get(complaint.id) || [] })),
      meta: { page, limit }
    });
  } catch (error) { next(error); }
};

exports.reviewComplaint = async (req, res, next) => {
  const { action, targetTeam, note } = req.body;
  if (!allowedActions.has(action)) return res.status(400).json({ success: false, message: "action must be approved, cancelled or forwarded" });
  if (action === "forwarded" && targetTeam !== "security_team") return res.status(400).json({ success: false, message: "targetTeam must be security_team when forwarding" });
  if ((action === "cancelled" || action === "forwarded") && !note) return res.status(400).json({ success: false, message: "note is required for cancellation or forwarding" });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [posts] = await connection.execute("SELECT id, public_id, title, status FROM posts WHERE public_id = ? AND status <> 'deleted' FOR UPDATE", [req.params.publicId]);
    const post = posts[0];
    if (!post) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    const nextStatus = action === "cancelled" ? "cancelled" : "published";
    await connection.execute("UPDATE posts SET status = ? WHERE id = ?", [nextStatus, post.id]);
    await connection.execute(
      "INSERT INTO complaint_approvals (post_id, admin_id, action, target_team, note) VALUES (?, ?, ?, ?, ?)",
      [post.id, req.user.id, action, action === "forwarded" ? targetTeam : null, note || null]
    );

    let notified = 0;
    if (action === "forwarded") {
      const [securityUsers] = await connection.execute("SELECT id FROM users WHERE role = 'security_team' AND account_status = 'active'");
      for (const user of securityUsers) {
        await connection.execute(
          "INSERT INTO notifications (recipient_id, post_id, type, title, message) VALUES (?, ?, 'complaint_forwarded', ?, ?)",
          [user.id, post.id, "Complaint forwarded for review", `Complaint \"${post.title}\" was forwarded by an admin. ${note}`]
        );
      }
      notified = securityUsers.length;
    }

    await connection.commit();
    res.json({ success: true, data: { public_id: post.public_id, status: nextStatus, action, target_team: targetTeam || null, notified_security_members: notified } });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
};

exports.listNotifications = async (req, res, next) => {
  try {
    const [notifications] = await db.execute(
      `SELECT id, post_id, type, title, message, read_at, created_at
       FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 100`,
      [req.user.id]
    );
    res.json({ success: true, data: notifications });
  } catch (error) { next(error); }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const [result] = await db.execute("UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND recipient_id = ?", [req.params.notificationId, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: "Notification not found" });
    res.json({ success: true });
  } catch (error) { next(error); }
};
