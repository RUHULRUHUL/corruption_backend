const { v4: uuidv4 } = require("uuid");
const path = require("path");
const Reports = require("../models/report.model");

const allowedStatus = new Set(["under_review", "accepted", "rejected", "forwarded", "closed"]);
const toEvidence = (files, externalUrl) => [
  ...(files || []).map((file) => ({ kind: file.mimetype.startsWith("image/") ? "image" : file.mimetype.startsWith("video/") ? "video" : "document", storagePath: `/${file.path.replace(/\\/g, "/")}`, originalName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size })),
  ...(externalUrl ? [{ kind: "external_video", externalUrl }] : [])
];

exports.create = async (req, res, next) => {
  try {
    const { title, description, category, location, incidentAt, isAnonymous = false, externalVideoUrl } = req.body;
    if (!title || !description || !category) return res.status(400).json({ success: false, message: "title, description and category are required" });
    const publicId = uuidv4();
    await Reports.create({ publicId, reporterId: req.user.id, isAnonymous: isAnonymous === true || isAnonymous === "true", title, description, category, location, incidentAt, visibility: "private" }, toEvidence(req.files, externalVideoUrl));
    const report = await Reports.findByPublicId(publicId);
    res.status(201).json({ success: true, data: report });
  } catch (error) { next(error); }
};
exports.mine = async (req, res, next) => { try { res.json({ success: true, data: await Reports.listMine(req.user.id) }); } catch (error) { next(error); } };
exports.getOne = async (req, res, next) => {
  try {
    const report = await Reports.findByPublicId(req.params.publicId);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    const owner = report.reporter_id === req.user.id;
    if (!owner && !["admin", "security_team", "action_team"].includes(req.user.role)) return res.status(403).json({ success: false, message: "Not allowed to view this report" });
    res.json({ success: true, data: report });
  } catch (error) { next(error); }
};
exports.adminList = async (req, res, next) => {
  try { res.json({ success: true, data: await Reports.listForAdmin({ status: req.query.status, team: req.query.team, page: Math.max(Number(req.query.page) || 1, 1), limit: Math.min(Math.max(Number(req.query.limit) || 20, 1), 100) }) }); } catch (error) { next(error); }
};
exports.review = async (req, res, next) => {
  try {
    const { status, targetTeam, note, priority, visibility } = req.body;
    if (!allowedStatus.has(status)) return res.status(400).json({ success: false, message: "Invalid review status" });
    if (status === "forwarded" && !["security_team", "action_team"].includes(targetTeam)) return res.status(400).json({ success: false, message: "A security_team or action_team target is required" });
    if (status === "rejected" && !note) return res.status(400).json({ success: false, message: "A rejection reason is required" });
    const report = await Reports.updateReview(req.params.publicId, req.user.id, { status, targetTeam, note, priority, visibility });
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    res.json({ success: true, data: report });
  } catch (error) { next(error); }
};
exports.downloadEvidence = async (req, res, next) => {
  try {
    const evidence = await Reports.findEvidence(req.params.publicId, req.params.evidenceId);
    if (!evidence) return res.status(404).json({ success: false, message: "Evidence not found" });
    if (evidence.reporter_id !== req.user.id && !["admin", "security_team", "action_team"].includes(req.user.role)) return res.status(403).json({ success: false, message: "Not allowed to access this evidence" });
    if (evidence.external_url) return res.redirect(evidence.external_url);
    const relativePath = evidence.storage_path.replace(/^[/\\]+/, "");
    if (!relativePath.startsWith("uploads/")) return res.status(400).json({ success: false, message: "Invalid evidence path" });
    res.type(evidence.mime_type || "application/octet-stream").sendFile(path.resolve(__dirname, "..", relativePath));
  } catch (error) { next(error); }
};
