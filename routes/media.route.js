const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");
const controller = require("../controllers/media.controller");

// MULTIPLE FILE UPLOAD
router.post(
    "/upload",
    upload.array("files", 10),
    controller.addMedia
);

module.exports = router;