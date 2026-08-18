const router = require("express").Router();
const upload = require("../middleware/upload");
const posts = require("../controllers/post.controller");
const { requireAuth } = require("../middleware/auth");

router.get("/", posts.list);
router.get("/:publicId/media/:mediaId", posts.media);

router.use(requireAuth);
router.post("/", upload.array("media", 10), posts.create);
router.put("/:publicId/reaction", posts.react);
router.delete("/:publicId/reaction", posts.removeReaction);
router.get("/:publicId/comments", posts.comments);
router.post("/:publicId/comments", posts.comment);

module.exports = router;
