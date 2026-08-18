const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const baseUploadDir = path.join(__dirname, "..", "uploads");
const subDirs = ["images", "videos", "documents"];

subDirs.forEach((folder) => {
  const fullPath = path.join(baseUploadDir, folder);
  fs.mkdirSync(fullPath, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      return cb(null, path.join(baseUploadDir, "images"));
    }
    if (file.mimetype.startsWith("video/")) {
      return cb(null, path.join(baseUploadDir, "videos"));
    }
    return cb(null, path.join(baseUploadDir, "documents"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const allowed = /^(image\/(jpeg|png|webp|jpg)|video\/(mp4|webm|quicktime)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))$/i;
    cb(null, allowed.test(file.mimetype));
  }
});

module.exports = upload;
