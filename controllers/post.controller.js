const { v4: uuidv4 } = require("uuid");
const path = require("path");
const Posts = require("../models/post.model");

const asMedia = (files, externalUrl) => [
  ...(files || []).map((file) => ({ kind: file.mimetype.startsWith("image/") ? "image" : file.mimetype.startsWith("video/") ? "video" : "document", storagePath: `/${file.path.replace(/\\/g, "/")}`, originalName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size })),
  ...(externalUrl ? [{ kind: "external_video", externalUrl }] : [])
];
exports.create = async (req, res, next) => {
  try {
    const bodyText = req.body?.body?.trim();
    if (!bodyText) return res.status(400).json({ success: false, message: "Post body is required" });
    const externalVideoUrl = req.body?.externalVideoUrl || null;
    await Posts.create({ publicId: uuidv4(), authorId: req.user.id, body: bodyText }, asMedia(req.files, externalVideoUrl));
    res.status(201).json({ success: true, message: "Post published" });
  } catch (error) { next(error); }
};
exports.list = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const viewerId = req.user?.id ?? null;
    res.json({
      success: true,
      data: await Posts.list({ userId: viewerId, page, limit }),
      meta: { page, limit }
    });
  } catch (error) { next(error); }
};
exports.react = async (req, res, next) => {
  try {
    const post = await Posts.findId(req.params.publicId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    const type = req.body?.type || "like";
    if (!["like", "support", "important"].includes(type)) return res.status(400).json({ success: false, message: "Invalid reaction type" });
    await Posts.react(post.id, req.user.id, type);
    res.json({ success: true });
  } catch (error) { next(error); }
};
exports.removeReaction = async (req, res, next) => { try { const post = await Posts.findId(req.params.publicId); if (!post) return res.status(404).json({ success: false, message: "Post not found" }); await Posts.removeReaction(post.id, req.user.id); res.status(204).end(); } catch (error) { next(error); } };
exports.comment = async (req, res, next) => {
  try {
    const post = await Posts.findId(req.params.publicId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    const commentBody = req.body?.body?.trim();
    if (!commentBody) return res.status(400).json({ success: false, message: "Comment body is required" });
    await Posts.addComment(post.id, req.user.id, commentBody, req.body?.parentId);
    res.status(201).json({ success: true });
  } catch (error) { next(error); }
};
exports.comments = async (req, res, next) => { try { const post = await Posts.findId(req.params.publicId); if (!post) return res.status(404).json({ success: false, message: "Post not found" }); res.json({ success: true, data: await Posts.comments(post.id) }); } catch (error) { next(error); } };
exports.media = async (req, res, next) => { try { const media = await Posts.findMedia(req.params.publicId, req.params.mediaId); if (!media) return res.status(404).json({ success: false, message: "Media not found" }); if (media.external_url) return res.redirect(media.external_url); const relativePath = media.storage_path.replace(/^[/\\]+/, ""); if (!relativePath.startsWith("uploads/")) return res.status(400).json({ success: false, message: "Invalid media path" }); res.type(media.mime_type || "application/octet-stream").sendFile(path.resolve(__dirname, "..", relativePath)); } catch (error) { next(error); } };
