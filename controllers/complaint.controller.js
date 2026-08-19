const { v4: uuidv4 } = require("uuid");
const path = require("path");
const db = require("../config/db");
const Posts = require("../models/post.model");

const normalizeUploadPath = (file) => {
  if (!file || !file.path) return null;
  const relative = path.relative(path.join(__dirname, ".."), file.path).replace(/\\/g, "/");
  return relative.startsWith("uploads/") ? relative : `uploads/${relative.split("uploads/").pop() || relative.split("uploads").pop()}`;
};

const toPostMedia = (files, externalUrl) => [
  ...(files || []).map((file) => ({
    kind: file.mimetype.startsWith("image/") ? "image" : file.mimetype.startsWith("video/") ? "video" : "document",
    storagePath: normalizeUploadPath(file),
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size
  })),
  ...(externalUrl ? [{ kind: "external_video", externalUrl: externalUrl }] : [])
];

const getMediaUrl = (req, storagePath) => {
  if (!storagePath) return null;
  const relativePath = storagePath.replace(/^[/\\]+/, "");
  const baseUrl = (process.env.API_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  return `${baseUrl}/${relativePath}`;
};

const mapMedia = (req, mediaRows = []) =>
  mediaRows.map((item) => ({
    id: item.id,
    kind: item.kind,
    storage_path: item.storage_path,
    media_url: getMediaUrl(req, item.storage_path),
    external_url: item.external_url,
    original_name: item.original_name,
    mime_type: item.mime_type,
    size_bytes: item.size_bytes,
    created_at: item.created_at
  }));

exports.submitComplain = async (req, res) => {
  try {
    const title = (req.body.title || "").trim();
    const description = (req.body.description || "").trim();
    const category = (req.body.category || "").trim();
    const location = (req.body.location || "").trim();
    const incidentTime = req.body.incident_time || req.body.incidentAt || "";
    const isAnonymous = req.body.is_anonymous ?? req.body.isAnonymous ?? true;
    const bodyValue = (req.body.body || description || "").trim();

    if (!title && !description && !bodyValue) {
      return res.status(400).json({
        success: false,
        message: "title or description is required"
      });
    }

    const finalTitle = title || (bodyValue ? bodyValue.slice(0, 80) : "Complaint");
    const bodyText = [
      description ? `Description: ${description}` : null,
      bodyValue && bodyValue !== description ? `Body: ${bodyValue}` : null,
      category ? `Category: ${category}` : null,
      location ? `Location: ${location}` : null,
      incidentTime ? `Incident time: ${incidentTime}` : null,
      `Anonymous: ${String(isAnonymous)}`
    ].filter(Boolean).join("\n");

    const publicId = uuidv4();
    const media = toPostMedia(req.files, req.body.external_video_url || req.body.externalVideoUrl || req.body.youtube_url || req.body.facebook_url || null);

    const postId = await Posts.create({
      publicId,
      authorId: req.user.id,
      title: finalTitle,
      body: bodyText,
      postType: "complaint",
      status: "pending_review"
    }, media);

    return res.status(201).json({
      success: true,
      message: "Complaint submitted successfully",
      data: {
        id: postId,
        public_id: publicId,
        title: finalTitle,
        body: bodyText,
        author_id: req.user.id,
        status: "pending_review"
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getAllComplaints = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const [posts] = await db.execute(
      `SELECT p.id, p.public_id, p.title, p.body, p.created_at, p.updated_at,
              u.uuid AS author_uuid, u.full_name AS author_name, u.avatar_url
       FROM posts p
       LEFT JOIN users u ON u.id = p.author_id
       WHERE p.status = 'published'
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    if (!posts || posts.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const ids = posts.map((post) => post.id);
    const placeholders = ids.map(() => "?").join(", ");
    const [mediaRows] = await db.execute(
      `SELECT * FROM post_media WHERE post_id IN (${placeholders}) ORDER BY created_at DESC`,
      ids
    );

    const mediaByPostId = new Map();
    for (const media of mediaRows) {
      const list = mediaByPostId.get(media.post_id) || [];
      list.push(media);
      mediaByPostId.set(media.post_id, list);
    }

    const data = posts.map((post) => ({
      id: post.id,
      public_id: post.public_id,
      title: post.title,
      body: post.body,
      created_at: post.created_at,
      updated_at: post.updated_at,
      author: {
        uuid: post.author_uuid,
        full_name: post.author_name,
        avatar_url: post.avatar_url
      },
      media: mapMedia(req, mediaByPostId.get(post.id) || [])
    }));

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.getMyComplaints = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const [posts] = await db.execute(
      `SELECT p.id, p.public_id, p.title, p.body, p.created_at, p.updated_at,
              u.uuid AS author_uuid, u.full_name AS author_name, u.avatar_url
       FROM posts p
       LEFT JOIN users u ON u.id = p.author_id
      WHERE p.post_type = 'complaint' AND p.author_id = ?
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );

    if (!posts || posts.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const ids = posts.map((post) => post.id);
    const placeholders = ids.map(() => "?").join(", ");
    const [mediaRows] = await db.execute(
      `SELECT * FROM post_media WHERE post_id IN (${placeholders}) ORDER BY created_at DESC`,
      ids
    );

    const mediaByPostId = new Map();
    for (const media of mediaRows) {
      const list = mediaByPostId.get(media.post_id) || [];
      list.push(media);
      mediaByPostId.set(media.post_id, list);
    }

    const data = posts.map((post) => ({
      id: post.id,
      public_id: post.public_id,
      title: post.title,
      body: post.body,
      created_at: post.created_at,
      updated_at: post.updated_at,
      author: {
        uuid: post.author_uuid,
        full_name: post.author_name,
        avatar_url: post.avatar_url
      },
      media: mapMedia(req, mediaByPostId.get(post.id) || [])
    }));

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
