const router = require("express").Router();
const upload = require("../middleware/upload");
const reports = require("../controllers/report.controller");
const { requireAuth, allowRoles } = require("../middleware/auth");

router.post("/", requireAuth, upload.array("evidence", 10), reports.create);
router.get("/mine", requireAuth, reports.mine);
router.get("/admin", requireAuth, allowRoles("admin", "security_team", "action_team"), reports.adminList);
router.patch("/:publicId/review", requireAuth, allowRoles("admin"), reports.review);
router.get("/:publicId/evidence/:evidenceId", requireAuth, reports.downloadEvidence);
router.get("/:publicId", requireAuth, reports.getOne);
module.exports = router;
