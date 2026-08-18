const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");
const controller = require("../controllers/complaint.controller");
const { requireAuth } = require("../middleware/auth");

router.get("/getAllComplaints", controller.getAllComplaints);
router.post("/submitComplain", requireAuth, upload.any(), controller.submitComplain);

module.exports = router;