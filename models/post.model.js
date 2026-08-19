const db = require("../config/db");

exports.create = async (post, media) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      "INSERT INTO posts (public_id, author_id, title, body, post_type, status) VALUES (?, ?, ?, ?, ?, ?)",
      [post.publicId, post.authorId, post.title, post.body, post.postType || "post", post.status || "published"]
    );
    for (const item of media) {
      await connection.execute(
        "INSERT INTO post_media (post_id, kind, storage_path, external_url, original_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [result.insertId, item.kind, item.storagePath || null, item.externalUrl || null, item.originalName || null, item.mimeType || null, item.sizeBytes || null]
      );
    }
    await connection.commit();
    return result.insertId;
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
};

exports.list = async ({ userId, page, limit }) => {
  const offset = (page - 1) * limit;
  const [posts] = await db.execute(
    `SELECT p.id, p.public_id, p.body, p.created_at, p.updated_at, u.uuid AS author_uuid, u.full_name AS author_name, u.avatar_url,
      COUNT(DISTINCT r.id) AS reaction_count, COUNT(DISTINCT c.id) AS comment_count,
      MAX(CASE WHEN r.user_id = ? THEN r.type END) AS viewer_reaction
     FROM posts p JOIN users u ON u.id = p.author_id
     LEFT JOIN post_reactions r ON r.post_id = p.id LEFT JOIN post_comments c ON c.post_id = p.id AND c.status = 'visible'
     WHERE p.status = 'published' GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, [userId, limit, offset]
  );
  if (!posts || !posts.length) return [];
  const ids = posts.map((post) => post.id); const placeholders = ids.map(() => "?").join(",");
  const [media] = await db.execute(`SELECT * FROM post_media WHERE post_id IN (${placeholders}) ORDER BY created_at`, ids);
  const byPost = new Map(); media.forEach((item) => { const list = byPost.get(item.post_id) || []; list.push(item); byPost.set(item.post_id, list); });
  return posts.map((post) => ({ ...post, media: byPost.get(post.id) || [] }));
};

exports.findId = async (publicId) => (await db.execute("SELECT id FROM posts WHERE public_id = ? AND status = 'published'", [publicId]))[0][0];
exports.react = (postId, userId, type) => db.execute("INSERT INTO post_reactions (post_id, user_id, type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE type = VALUES(type)", [postId, userId, type]);
exports.removeReaction = (postId, userId) => db.execute("DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?", [postId, userId]);
exports.addComment = (postId, userId, body, parentId) => db.execute("INSERT INTO post_comments (post_id, user_id, body, parent_id) VALUES (?, ?, ?, ?)", [postId, userId, body, parentId || null]);
exports.comments = async (postId) => (await db.execute("SELECT c.id, c.body, c.parent_id, c.created_at, u.uuid AS author_uuid, u.full_name AS author_name, u.avatar_url FROM post_comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? AND c.status = 'visible' ORDER BY c.created_at", [postId]))[0] || [];
exports.findMedia = async (publicId, mediaId) => (await db.execute("SELECT pm.* FROM post_media pm JOIN posts p ON p.id = pm.post_id WHERE p.public_id = ? AND p.status = 'published' AND pm.id = ?", [publicId, mediaId]))[0][0];
