const mysql = require("mysql2/promise");

const baseConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    port: process.env.DB_PORT || 3306,
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool({
    ...baseConfig,
    database: process.env.DB_NAME
});

const adminPool = mysql.createPool(baseConfig);

const ensureDatabaseExists = async () => {
    if (!process.env.DB_NAME) return;
    await adminPool.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
};

const ensureDatabaseSchema = async () => {
    const schemaSql = `
        CREATE TABLE IF NOT EXISTS users (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            uuid CHAR(36) NOT NULL UNIQUE,
            full_name VARCHAR(120) NOT NULL,
            email VARCHAR(191) NOT NULL UNIQUE,
            phone VARCHAR(30) NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('user','admin','security_team','action_team') NOT NULL DEFAULT 'user',
            account_status ENUM('active','suspended','deleted') NOT NULL DEFAULT 'active',
            avatar_url VARCHAR(2048) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS reports (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            public_id CHAR(36) NOT NULL UNIQUE,
            reporter_id BIGINT UNSIGNED NULL,
            is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(100) NOT NULL,
            incident_location VARCHAR(255) NULL,
            incident_at DATETIME NULL,
            visibility ENUM('private','public') NOT NULL DEFAULT 'private',
            status ENUM('submitted','under_review','accepted','rejected','forwarded','closed') NOT NULL DEFAULT 'submitted',
            priority ENUM('low','normal','high','critical') NOT NULL DEFAULT 'normal',
            assigned_team ENUM('security_team','action_team') NULL,
            assigned_by BIGINT UNSIGNED NULL,
            assigned_at DATETIME NULL,
            reviewed_by BIGINT UNSIGNED NULL,
            reviewed_at DATETIME NULL,
            rejection_reason TEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT fk_reports_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
            CONSTRAINT fk_reports_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_reports_status_created (status, created_at),
            INDEX idx_reports_assigned_team (assigned_team, status)
        );

        CREATE TABLE IF NOT EXISTS report_evidence (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            report_id BIGINT UNSIGNED NOT NULL,
            kind ENUM('image','video','document','external_video') NOT NULL,
            storage_path VARCHAR(2048) NULL,
            external_url VARCHAR(2048) NULL,
            original_name VARCHAR(255) NULL,
            mime_type VARCHAR(150) NULL,
            size_bytes BIGINT UNSIGNED NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_evidence_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
            CHECK (storage_path IS NOT NULL OR external_url IS NOT NULL),
            INDEX idx_evidence_report (report_id)
        );

        CREATE TABLE IF NOT EXISTS report_actions (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            report_id BIGINT UNSIGNED NOT NULL,
            actor_id BIGINT UNSIGNED NULL,
            action ENUM('submitted','review_started','accepted','rejected','forwarded','commented','closed') NOT NULL,
            from_status VARCHAR(30) NULL,
            to_status VARCHAR(30) NULL,
            target_team ENUM('security_team','action_team') NULL,
            note TEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_actions_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
            CONSTRAINT fk_actions_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_actions_report_created (report_id, created_at)
        );

        CREATE TABLE IF NOT EXISTS posts (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            public_id CHAR(36) NOT NULL UNIQUE,
            author_id BIGINT UNSIGNED NOT NULL,
            title VARCHAR(255) NOT NULL,
            body TEXT NOT NULL,
            post_type ENUM('post','complaint') NOT NULL DEFAULT 'post',
            status ENUM('pending_review','published','hidden','cancelled','deleted') NOT NULL DEFAULT 'pending_review',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_posts_feed (status, created_at)
        );

        CREATE TABLE IF NOT EXISTS complaint_approvals (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            post_id BIGINT UNSIGNED NOT NULL,
            admin_id BIGINT UNSIGNED NOT NULL,
            action ENUM('approved','cancelled','forwarded') NOT NULL,
            target_team ENUM('security_team','action_team') NULL,
            note TEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_complaint_approval_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            CONSTRAINT fk_complaint_approval_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT,
            INDEX idx_complaint_approvals_post_created (post_id, created_at)
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            recipient_id BIGINT UNSIGNED NOT NULL,
            post_id BIGINT UNSIGNED NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            read_at DATETIME NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_notifications_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            INDEX idx_notifications_recipient_created (recipient_id, created_at)
        );

        CREATE TABLE IF NOT EXISTS post_media (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            post_id BIGINT UNSIGNED NOT NULL,
            kind ENUM('image','video','document','external_video') NOT NULL,
            storage_path VARCHAR(2048) NULL,
            external_url VARCHAR(2048) NULL,
            original_name VARCHAR(255) NULL,
            mime_type VARCHAR(150) NULL,
            size_bytes BIGINT UNSIGNED NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_post_media_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS post_reactions (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            post_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            type ENUM('like','support','important') NOT NULL DEFAULT 'like',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_reactions_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            CONSTRAINT fk_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY uq_reaction_user_post (post_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS post_comments (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            post_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            parent_id BIGINT UNSIGNED NULL,
            body TEXT NOT NULL,
            status ENUM('visible','hidden','deleted') NOT NULL DEFAULT 'visible',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES post_comments(id) ON DELETE CASCADE,
            INDEX idx_comments_post_created (post_id, created_at)
        );
    `;

    const connection = await pool.getConnection();
    try {
        await connection.query(schemaSql);
        await connection.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS title VARCHAR(255) NULL AFTER author_id");
        await connection.query("UPDATE posts SET title = LEFT(body, 255) WHERE title IS NULL OR title = ''");
        await connection.query("ALTER TABLE posts MODIFY COLUMN title VARCHAR(255) NOT NULL");
        await connection.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type ENUM('post','complaint') NOT NULL DEFAULT 'post' AFTER body");
        await connection.query("ALTER TABLE posts MODIFY COLUMN status ENUM('pending_review','published','hidden','cancelled','deleted') NOT NULL DEFAULT 'pending_review'");
    } finally {
        connection.release();
    }
};

const testConnection = async () => {
    try {
        await ensureDatabaseExists();
        const conn = await pool.getConnection();
        console.log("MySQL Connected Successfully");
        conn.release();
        await ensureDatabaseSchema();
    } catch (error) {
        console.error("MySQL Connection Failed:", error.message);
    }
};

testConnection();

module.exports = pool;