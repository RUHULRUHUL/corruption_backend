const router = require("express").Router();
const admin = require("../controllers/admin.controller");
const { requireAuth, allowRoles } = require("../middleware/auth");

router.use(requireAuth);
router.get("/complaints", allowRoles("admin"), admin.listComplaints);
router.post("/posts/review", allowRoles("admin"), admin.reviewPost);
router.patch("/posts/:publicId/review", allowRoles("admin"), admin.reviewPost);
router.patch("/complaints/:publicId/review", allowRoles("admin"), admin.reviewPost);
router.get("/notifications", allowRoles("admin", "security_team"), admin.listNotifications);
router.patch("/notifications/:notificationId/read", allowRoles("admin", "security_team"), admin.markNotificationRead);

module.exports = router;
