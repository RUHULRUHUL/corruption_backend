const db = require("../config/db");

const getYouTubeId = (value) => {
    if (!value) return null;

    const input = value.trim();

    try {
        const url = new URL(input);

        if (url.hostname.includes("youtu.be")) {
            return url.pathname.split("/").filter(Boolean)[0] || null;
        }

        if (url.hostname.includes("youtube.com")) {
            return url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
        }
    } catch (error) {
        return input;
    }

    return input;
};

exports.addMedia = async (req, res) => {
    try {
        const reportId = req.body.report_id || req.body.complaint_id;
        const youtubeId = getYouTubeId(req.body.youtube_id || req.body.youtube_url);
        const uploadedMedia = [];

        if (!reportId) {
            return res.status(400).json({
                success: false,
                error: "report_id is required"
            });
        }

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                let kind = "document";

                if (file.mimetype.startsWith("image")) kind = "image";
                else if (file.mimetype.startsWith("video")) kind = "video";

                await db.execute(
                    `INSERT INTO report_evidence
                    (report_id, kind, storage_path, original_name, mime_type, size_bytes)
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [reportId, kind, file.path, file.originalname, file.mimetype, file.size]
                );

                uploadedMedia.push({
                    type: kind,
                    file_path: file.path
                });
            }
        }

        if (youtubeId) {
            await db.execute(
                `INSERT INTO report_evidence
                (report_id, kind, external_url)
                VALUES (?, 'external_video', ?)`,
                [reportId, `https://www.youtube.com/watch?v=${youtubeId}`]
            );

            uploadedMedia.push({
                type: "external_video",
                youtube_url: `https://www.youtube.com/watch?v=${youtubeId}`
            });
        }

        if (req.body.facebook_url) {
            await db.execute(
                `INSERT INTO report_evidence
                (report_id, kind, external_url)
                VALUES (?, 'external_video', ?)`,
                [reportId, req.body.facebook_url]
            );

            uploadedMedia.push({
                type: "external_video",
                facebook_url: req.body.facebook_url
            });
        }

        res.json({
            success: true,
            message: "Media uploaded successfully",
            data: {
                report_id: reportId,
                media: uploadedMedia
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};
