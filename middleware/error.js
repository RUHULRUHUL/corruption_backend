exports.notFound = (req, res) => res.status(404).json({ success: false, message: "Route not found" });
exports.errorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ success: false, message: err.message || "Internal server error" });
};
