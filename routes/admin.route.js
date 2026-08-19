const router = require("express").Router();
const admin = require("../controllers/admin.controller");
const { requireAuth, allowRoles } = require("../middleware/auth");

router.use(requireAuth);
router.get("/complaints", allowRoles("admin"), admin.listComplaints);
router.patch("/complaints/:publicId/review", allowRoles("admin"), admin.reviewComplaint);
router.get("/notifications", allowRoles("admin", "security_team"), admin.listNotifications);
router.patch("/notifications/:notificationId/read", allowRoles("admin", "security_team"), admin.markNotificationRead);

module.exports = router;
