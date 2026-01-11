const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 5000;

// Cấu hình Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Thêm dòng này nếu deploy lên cloud (Render/Heroku/Vercel) để tránh lỗi SSL
    ssl:
        process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false,
});

// Khởi tạo bảng dữ liệu dạng Key-Value (JSON)
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_storage (
                username TEXT PRIMARY KEY,
                data JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("✅ Database initialized: 'user_storage' table ready.");
    } catch (err) {
        console.error("❌ Database init error:", err);
    }
};

initDb();

app.use(cors());
app.use(express.json({ limit: "10mb" })); // Tăng giới hạn để lưu được nhiều hình vẽ
app.use(express.static("."));

// API: Lưu dữ liệu (Save/Sync)
app.post("/api/save", async (req, res) => {
    try {
        const { username, data } = req.body;

        if (!username || !data) {
            return res.status(400).json({ error: "Thiếu username hoặc data" });
        }

        // Dùng Upsert (Nếu chưa có thì tạo mới, có rồi thì cập nhật)
        const query = `
            INSERT INTO user_storage (username, data, updated_at) 
            VALUES ($1, $2, NOW()) 
            ON CONFLICT (username) 
            DO UPDATE SET data = $2, updated_at = NOW()
        `;

        await pool.query(query, [username, data]);
        console.log(`💾 Saved data for user: ${username}`);

        res.json({ success: true });
    } catch (err) {
        console.error("Save error:", err);
        res.status(500).json({ error: err.message });
    }
});

// API: Tải dữ liệu (Load)
app.get("/api/load/:username", async (req, res) => {
    try {
        const username = req.params.username;
        const result = await pool.query(
            "SELECT data FROM user_storage WHERE username = $1",
            [username],
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ data: result.rows[0].data });
    } catch (e) {
        console.error("Load error:", e);
        res.status(500).json({ error: "Database error" });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

