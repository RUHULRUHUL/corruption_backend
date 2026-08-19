require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") || true }));
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: "draft-8", legacyHeaders: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// Ensure req.body is always an object to avoid crashes when undefined
app.use((req, res, next) => { if (!req.body) req.body = {}; next(); });

// ROUTES
const authRoutes = require("./routes/auth.route");
const reportRoutes = require("./routes/report.route");
const postRoutes = require("./routes/post.route");
const complaintRoutes = require("./routes/complaint.route");
const { notFound, errorHandler } = require("./middleware/error");


app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/posts", postRoutes);
app.use("/api", complaintRoutes);
app.get("/health", (req, res) => res.json({ success: true, status: "ok" }));
app.use(notFound);
app.use(errorHandler);


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
