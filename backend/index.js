const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// --- 1. CONFIG UPLOAD IMAGE (CLOUDINARY) ---
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'sport-booking-app',
        allowed_formats: ['jpg', 'png', 'jpeg']
    }
});

const upload = multer({ storage: storage });

const nodemailer = require('nodemailer');
// --- CẤU HÌNH GỬI MAIL ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
// --- 2. CONFIG SERVER & DATABASE ---
const app = express();
const port = process.env.PORT || 5000;
const SECRET_KEY = 'khoa_luan_tot_nghiep_2025';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads')); 

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.connect()
    .then(() => console.log('✅ Connected to PostgreSQL successfully!'))
    .catch(err => console.error('❌ DB Connection Error:', err.message));


const formatTime = (timeInput) => {
    if (!timeInput) return null;
    return timeInput; 
};

// --- 3. CẤU HÌNH UPLOAD NHIỀU FIELD (CHO FORM ĐĂNG KÝ VENDOR) ---

const registerUpload = upload.fields([
    { name: 'facility_images', maxCount: 10 },
    { name: 'identity_images', maxCount: 2 },
    { name: 'face_image', maxCount: 1 }
]);

// =======================================================
// PART A: AUTHENTICATION API
// =======================================================

// 1. API ĐĂNG KÝ (FIX LỖI LƯU NHIỀU ẢNH)
app.post('/api/register', registerUpload, async (req, res) => {
    const client = await pool.connect();
    try {
        console.log("📥 Nhận request đăng ký:", req.body); // Log body text
        await client.query('BEGIN');

        const { username, email, password, full_name, role, phone_number, facility_name, facility_address, lat, lng } = req.body;

        // 1. Validate cơ bản
        if (!username || !email || !password) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Thiếu thông tin bắt buộc (username, email, password)!" });
        }

        // 2. Check trùng (Username hoặc Email)
        const checkUser = await client.query("SELECT * FROM users WHERE username = $1 OR email = $2", [username, email]);
        if (checkUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Tên đăng nhập hoặc Email đã tồn tại!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        let status = 'active';
        
        // Mảng để lưu link ảnh
        let facilityImgs = []; 
        let identityImgs = []; 
        let faceImg = null;

        // 3. Xử lý file nếu là Vendor
        if (role === 'vendor') {
            status = 'pending';
            
            // Log để debug xem multer nhận được bao nhiêu file
            // console.log("📂 Files received from Multer:", req.files); 

            if (req.files) {
                // Lấy toàn bộ mảng ảnh sân (nếu có nhiều ảnh)
                if (req.files['facility_images']) {
                    facilityImgs = req.files['facility_images'].map(f => f.path);
                }
                
                // Lấy toàn bộ mảng ảnh CCCD (thường là 2 ảnh)
                if (req.files['identity_images']) {
                    identityImgs = req.files['identity_images'].map(f => f.path);
                }

                // Lấy ảnh mặt (chỉ 1 ảnh -> lấy phần tử đầu tiên)
                if (req.files['face_image'] && req.files['face_image'].length > 0) {
                    faceImg = req.files['face_image'][0].path;
                }
            }
            
            // Validate bắt buộc phải có ảnh xác minh
            if (identityImgs.length === 0 || !faceImg) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: "Thiếu ảnh xác minh (CCCD hoặc Khuôn mặt)!" });
            }
        }

        // 4. Insert vào DB
        // Lưu ý: Biến facilityImgs và identityImgs là mảng JS ['url1', 'url2']. 
        // Thư viện 'pg' sẽ tự động chuyển đổi chúng thành mảng PostgreSQL '{url1, url2}' khi insert.
        const query = `
            INSERT INTO users (
                username, email, password, full_name, role, status, 
                phone_number, facility_name, facility_address, 
                location, 
                facility_images, identity_images, face_image, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, 
                $7, $8, $9, 
                ST_SetSRID(ST_MakePoint($10, $11), 4326), 
                $12, $13, $14, NOW()
            ) RETURNING id, username, role, status
        `;

        const longitude = lng ? parseFloat(lng) : 0;
        const latitude = lat ? parseFloat(lat) : 0;

        const values = [
            username, email, hashedPassword, full_name, role, status, 
            phone_number || null, facility_name || null, facility_address || null, 
            longitude, latitude,
            facilityImgs, // Mảng ảnh sân
            identityImgs, // Mảng ảnh CCCD
            faceImg       // Ảnh mặt (string)
        ];

        await client.query(query, values);
        await client.query('COMMIT');
        
        console.log(`✅ Đăng ký thành công cho user: ${username} | Role: ${role}`);
        res.json({ message: role === 'vendor' ? "Đăng ký thành công! Vui lòng chờ Admin duyệt." : "Đăng ký thành công!" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ LỖI ĐĂNG KÝ:", err); 
        res.status(500).json({ message: "Lỗi Server: " + err.message });
    } finally {
        client.release();
    }
});

// 2. API ĐĂNG NHẬP (SỬA ĐỂ TÌM BẰNG USERNAME)
app.post('/api/login', async (req, res) => {
    try {
        // 🔥 Nhận 'username' thay vì 'email'
        const { username, password } = req.body;

        // 🔥 Query theo 'username'
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        
        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Tên đăng nhập không tồn tại!" });
        }

        const user = result.rows[0];

        if (user.status === 'pending') return res.status(403).json({ message: "Tài khoản đang chờ duyệt." });
        if (user.status === 'blocked' || user.status === 'rejected') return res.status(403).json({ message: "Tài khoản đã bị khóa." });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ message: "Sai mật khẩu!" });

        const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET_KEY, { expiresIn: '7d' });

        res.json({
            message: "Đăng nhập thành công!",
            token,
            user: {
                id: user.id,
                username: user.username, // Trả về username
                email: user.email,
                name: user.full_name,
                role: user.role,
                avatar: user.avatar_url,
                status: user.status
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});
// Thêm API xử lý đăng nhập Google/Facebook
app.post('/api/auth/social-login', async (req, res) => {
  const { email, name, avatar, provider, uid } = req.body;

  try {
    // 1. Kiểm tra xem email này đã tồn tại trong DB chưa
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    let user;

    if (userCheck.rows.length > 0) {
      // 2. Nếu ĐÃ CÓ: Lấy thông tin user đó
      user = userCheck.rows[0];
      
      // (Tuỳ chọn) Cập nhật lại avatar/tên nếu muốn
    } else {
      // 3. Nếu CHƯA CÓ: Tạo user mới
      // Lưu ý: password để trống hoặc đặt chuỗi ngẫu nhiên vì họ dùng Google
      const newUser = await pool.query(
        `INSERT INTO users (username, email, password, full_name, avatar_url, role, provider, provider_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          email.split('@')[0], // Tạo username từ email
          email, 
          'social_login_no_pass', // Mật khẩu giả
          name, 
          avatar, 
          'user', // Role mặc định
          provider, 
          uid
        ]
      );
      user = newUser.rows[0];
    }

    // 4. Tạo JWT Token (để đăng nhập hệ thống)
    const token = jwt.sign(
      { id: user.id, role: user.role }, 
      process.env.JWT_SECRET || 'your_jwt_secret_key', 
      { expiresIn: '24h' }
    );

    // 5. Trả về cho Frontend
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        avatar: user.avatar_url
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Lỗi Server' });
  }
});
// 3. Update Profile
app.put('/api/users/:id/profile', async (req, res) => {
    try {
        const { id } = req.params;
        const { phone_number, facebook_url, zalo_url, instagram_url } = req.body;
        await pool.query(
            `UPDATE users SET phone_number = $1, facebook_url = $2, zalo_url = $3, instagram_url = $4 WHERE id = $5`,
            [phone_number, facebook_url, zalo_url, instagram_url, id]
        );
        res.json({ message: "Profile updated successfully!" });
    } catch (e) { res.status(500).send(e.message) }
});

// --- API MỚI: CẬP NHẬT THÔNG TIN USER (Tên, SĐT, Avatar) ---
// Dùng cho UserProfileDrawer
app.put('/api/users/:id', upload.single('avatar'), async (req, res) => {
    const { id } = req.params;
    const { full_name, phone_number } = req.body;
    
    // Nếu có file ảnh upload lên thì lấy link Cloudinary, không thì lấy link cũ gửi kèm (nếu có)
    const avatar_url = req.file ? req.file.path : req.body.avatar_url;

    const client = await pool.connect();
    try {
        const checkUser = await client.query("SELECT * FROM users WHERE id = $1", [id]);
        if (checkUser.rows.length === 0) {
            return res.status(404).json({ error: "User không tồn tại" });
        }

        // COALESCE + NULLIF: Giữ nguyên dữ liệu cũ nếu không gửi gì mới
        const query = `
            UPDATE users 
            SET 
                full_name = COALESCE(NULLIF($1, ''), full_name), 
                phone_number = COALESCE(NULLIF($2, ''), phone_number), 
                avatar_url = COALESCE(NULLIF($3, ''), avatar_url)
            WHERE id = $4
            RETURNING id, username, email, full_name, role, phone_number, avatar_url, status
        `;
        
        const result = await client.query(query, [full_name, phone_number, avatar_url, id]);
        
        const updatedUser = result.rows[0];
        const userResponse = {
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            name: updatedUser.full_name,
            role: updatedUser.role,
            avatar: updatedUser.avatar_url,
            phone_number: updatedUser.phone_number,
            status: updatedUser.status
        };

        res.json({ 
            success: true, 
            message: "Cập nhật thành công!", 
            user: userResponse 
        });

    } catch (err) {
        console.error("❌ Lỗi Update User:", err);
        res.status(500).json({ error: "Lỗi Server" });
    } finally {
        client.release();
    }
});

app.get('/api/users/:id/public', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT id, full_name, avatar_url, phone_number, created_at, role
            FROM users 
            WHERE id = $1
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Người dùng không tồn tại" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Lỗi Server" });
    }
});
// --- API 1: YÊU CẦU QUÊN MẬT KHẨU (Gửi mã về Email) ---
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // 1. Kiểm tra email có tồn tại không
        const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: "Email này chưa được đăng ký!" });
        }

        // 2. Tạo mã OTP ngẫu nhiên (6 số)
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // 3. Lưu mã vào DB (Hết hạn sau 15 phút)
        // Cú pháp Postgres: NOW() + interval '15 minutes'
        await pool.query(
            "UPDATE users SET reset_code = $1, reset_code_expires = NOW() + interval '15 minutes' WHERE email = $2",
            [code, email]
        );

        // 4. Gửi Email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Mã xác nhận khôi phục mật khẩu - Sport Booking',
            text: `Mã xác nhận của bạn là: ${code}\nMã này sẽ hết hạn sau 15 phút.\nVui lòng không chia sẻ mã này cho ai.`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ message: "Lỗi gửi email!" });
            } else {
                return res.json({ message: "Mã xác nhận đã được gửi về Email của bạn!" });
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// --- API 2: XÁC NHẬN MÃ & ĐỔI MẬT KHẨU MỚI ---
app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        // 1. Tìm user với email và mã code đó, đồng thời kiểm tra thời gian hết hạn
        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1 AND reset_code = $2 AND reset_code_expires > NOW()",
            [email, code]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Mã xác nhận không đúng hoặc đã hết hạn!" });
        }

        // 2. Mã hóa mật khẩu mới
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 3. Cập nhật mật khẩu mới và xóa mã code đi
        await pool.query(
            "UPDATE users SET password = $1, reset_code = NULL, reset_code_expires = NULL WHERE email = $2",
            [hashedPassword, email]
        );

        res.json({ message: "Đổi mật khẩu thành công! Hãy đăng nhập lại." });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});
// =======================================================
// PART B: IMAGE UPLOAD API
// =======================================================

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file selected!' });
    res.json({ url: req.file.path });
});

app.post('/api/upload-multiple', upload.array('images', 5), (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files selected!' });
    res.json({ urls: req.files.map(file => file.path) });
});

// =======================================================
// PART C: COURT MANAGEMENT API (WEBGIS)
// =======================================================

// 1. Get All Courts (PUBLIC - CHỈ HIỆN SÂN ACTIVE)
app.get('/api/courts', async (req, res) => {
    try {
        // 🔥 FIX: Thêm WHERE c.status = 'active'
        const query = `
            SELECT c.*, 
                   ST_AsGeoJSON(c.location)::json as geometry,
                   u.phone_number, u.facebook_url, u.zalo_url, u.instagram_url, u.full_name as owner_name,
                   u.avatar_url as owner_avatar,
                   COALESCE(AVG(r.rating), 0) as avg_rating,
                   COUNT(r.id) as review_count
            FROM courts c
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN reviews r ON c.id = r.court_id
            WHERE c.status = 'active' 
            GROUP BY c.id, u.id
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).send("Server Error"); }
});

// 2. Find Nearby Courts (PUBLIC - CHỈ HIỆN SÂN ACTIVE)
app.get('/api/courts/nearby', async (req, res) => {
    try {
        const { lat, lng, distance } = req.query;
        if (!lat || !lng) return res.status(400).json({ error: "Thiếu tọa độ GPS" });
        
        const radius = distance || 5000; // Mặc định 5km

        const query = `
            WITH 
            -- Tính toán thống kê sân con
            CourtStats AS (
                SELECT facility_id, MIN(price_per_hour) as min_price, COUNT(id) as total_courts, array_agg(DISTINCT type) as sports
                FROM courts GROUP BY facility_id
            ),
            -- Tính toán đánh giá
            ReviewStats AS (
                SELECT c.facility_id, AVG(r.rating) as avg_rating, COUNT(r.id) as review_count
                FROM reviews r JOIN courts c ON r.court_id = c.id GROUP BY c.facility_id
            )

            SELECT 
                f.id, f.name, f.address, f.image_url, f.open_time, f.close_time, f.owner_id, 
                
                COALESCE(u.full_name, 'Chủ sân') as owner_name, 
                u.avatar_url as owner_avatar,
                u.phone_number, u.zalo_url, u.facebook_url,

                ST_X(f.location::geometry) as lng, 
                ST_Y(f.location::geometry) as lat,
                
                COALESCE(cs.min_price, 0) as min_price,
                COALESCE(cs.total_courts, 0) as total_courts,
                COALESCE(cs.sports, '{}') as sports,
                COALESCE(rs.avg_rating, 5) as avg_rating,
                COALESCE(rs.review_count, 0) as review_count,

                -- Tính khoảng cách chính xác từ DB
                ST_Distance(f.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as dist_meters

            FROM facilities f
            LEFT JOIN users u ON f.owner_id = u.id
            LEFT JOIN CourtStats cs ON f.id = cs.facility_id
            LEFT JOIN ReviewStats rs ON f.id = rs.facility_id
            
            WHERE f.status = 'active' 
            AND ST_DWithin(f.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
            
            ORDER BY dist_meters ASC
        `;
        
        const result = await pool.query(query, [lng, lat, radius]);
        res.json(result.rows);

    } catch (err) { 
        console.error("Lỗi tìm kiếm gần đây:", err);
        res.status(500).send("Server Error"); 
    }
});
// 3. Add New Court
app.post('/api/courts', async (req, res) => {
    try {
        let { name, address, price, lat, lng, image_url, type, owner_id, amenities, images, open_time, close_time } = req.body;
        
        const priceNumber = parseFloat(price); 
        const latNumber = parseFloat(lat);
        const lngNumber = parseFloat(lng);
        const finalOpen = formatTime(open_time) || '06:00';
        const finalClose = formatTime(close_time) || '22:00';
        const finalImages = images && images.length > 0 ? images : [image_url];
        
        // Mặc định tạo sân mới là 'pending' (chờ duyệt) hoặc 'active' tùy logic bạn muốn.
        // Ở đây để mặc định là 'pending' cho an toàn.
        const query = `
            INSERT INTO courts (
                name, address, price_per_hour, location, image_url, 
                type, owner_id, amenities, images, open_time, close_time, status
            ) 
            VALUES (
                $1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, 
                $7, $8, $9, $10, $11, $12, 'pending'
            ) 
            RETURNING *
        `;

        const newCourt = await pool.query(query, [
            name, address, priceNumber, lngNumber, latNumber, 
            finalImages[0], type || 'other', owner_id, 
            amenities || '', finalImages, finalOpen, finalClose
        ]);

        res.json(newCourt.rows[0]);
    } catch (err) { 
        console.error("Lỗi INSERT Sân:", err); 
        res.status(500).send("Lỗi Server: " + err.message); 
    }
});

// 4. Update Court
app.put('/api/courts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let { name, address, price, type, image_url, owner_id, amenities, images, lat, lng, open_time, close_time } = req.body;
        
        const priceNumber = parseFloat(price);
        const finalOpen = formatTime(open_time) || '06:00';
        const finalClose = formatTime(close_time) || '22:00';
        const finalImages = images && images.length > 0 ? images : [image_url]; 

        let query = `
            UPDATE courts 
            SET name = $1, address = $2, price_per_hour = $3, type = $4, 
                image_url = $5, amenities = $6, images = $7, 
                open_time = $8, close_time = $9
        `;
        const mainImage = image_url || (finalImages.length > 0 ? finalImages[0] : null);

        const values = [name, address, priceNumber, type, mainImage, amenities, finalImages, finalOpen, finalClose];

        if (lat && lng) {
            query += `, location = ST_SetSRID(ST_MakePoint($10, $11), 4326) 
                      WHERE id = $12 AND owner_id = $13 RETURNING *`;
            values.push(parseFloat(lng), parseFloat(lat), id, owner_id); 
        } else {
            query += ` WHERE id = $10 AND owner_id = $11 RETURNING *`;
            values.push(id, owner_id);
        }
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(403).json({ error: "Không tìm thấy sân hoặc bạn không có quyền sửa!" });
        }
        
        res.json({ message: "Cập nhật thành công!", court: result.rows[0] });
    } catch (e) { 
        console.error("Lỗi UPDATE sân:", e); 
        res.status(500).send("Lỗi Server: " + e.message); 
    }
});

// 5. Delete Court
app.delete('/api/courts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { owner_id } = req.body;
        
        await pool.query("DELETE FROM bookings WHERE court_id = $1", [id]);
        await pool.query("DELETE FROM reviews WHERE court_id = $1", [id]);
        
        const result = await pool.query("DELETE FROM courts WHERE id = $1 AND owner_id = $2 RETURNING *", [id, owner_id]);
        
        if (result.rows.length === 0) return res.status(403).json({ error: "Cannot delete!" });
        res.json({ message: "Court deleted!" });
    } catch (e) { res.status(500).send(e.message) }
});



// 🔥 API SUPER ADMIN: CẬP NHẬT TRẠNG THÁI TỪNG SÂN CON (COURTS)
app.put('/api/admin/courts/:id/status', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { status } = req.body; 

        const query = `UPDATE courts SET status = $1 WHERE id = $2 RETURNING *`;
        const result = await client.query(query, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy sân này" });
        }
        res.json({ success: true, message: "Đã cập nhật trạng thái sân!", court: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Lỗi server" });
    } finally {
        client.release();
    }
});



app.get('/api/facilities/:id/check', async (req, res) => {
    try {
        const { id } = req.params; // Đây là facility_id
        const { date, start, end } = req.query; // start ví dụ: '17:00'

        // 1. Lấy tất cả sân con thuộc Cơ sở này (chỉ lấy sân đang ACTIVE)
        const courtsRes = await pool.query(
            "SELECT * FROM courts WHERE facility_id = $1 AND status = 'active'",
            [id]
        );

        if (courtsRes.rows.length === 0) {
            return res.json([]); // Không có sân nào
        }

        // 2. Tìm các sân đã bị đặt (Booked) trong khung giờ này
        // Logic: Tìm booking nào có cùng ngày và giờ bắt đầu
        const bookedRes = await pool.query(
            `SELECT court_id FROM bookings 
             WHERE booking_date = $1 
             AND booking_time = $2 
             AND status != 'cancelled'`,
            [date, start]
        );

        const bookedIds = bookedRes.rows.map(b => b.court_id);

        // 3. Lọc ra danh sách sân còn trống
        // (Lấy danh sách tất cả sân TRỪ ĐI danh sách sân đã bị đặt)
        const availableCourts = courtsRes.rows.filter(c => !bookedIds.includes(c.id));

        res.json(availableCourts);

    } catch (err) {
        console.error("Lỗi API Check Sân:", err);
        res.status(500).send("Server Error");
    }
});



// --- 2. API DASHBOARD STATS (ĐÃ FIX: ĐẾM CẢ SÂN CON) ---
app.get('/api/admin/dashboard-stats', async (req, res) => {
    const client = await pool.connect();
    try {
        const usersCount = await client.query('SELECT COUNT(*) FROM users');
        const facilitiesCount = await client.query('SELECT COUNT(*) FROM facilities');
        // 🔥 Đếm sân con
        const courtsCount = await client.query('SELECT COUNT(*) FROM courts'); 
        const bookingsCount = await client.query('SELECT COUNT(*) FROM bookings');

        let chartLabels = [], chartUsers = [], chartCourts = [];
        try {
            const usersByMonth = await client.query(`
                SELECT to_char(created_at, 'Mon') as month, COUNT(*) as count 
                FROM users WHERE created_at IS NOT NULL GROUP BY 1 ORDER BY MIN(created_at)
            `);
            chartLabels = usersByMonth.rows.map(r => r.month);
            chartUsers = usersByMonth.rows.map(r => r.count);
        } catch (e) {}

        res.json({
            total_users: parseInt(usersCount.rows[0].count),
            total_facilities: parseInt(facilitiesCount.rows[0].count), 
            total_courts: parseInt(courtsCount.rows[0].count), // Trả về số 41
            total_bookings: parseInt(bookingsCount.rows[0].count),
            chart_data: { labels: chartLabels, users: chartUsers, courts: chartCourts }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Lỗi stats" });
    } finally {
        client.release();
    }
});

app.get('/api/facilities', async (req, res) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT f.*, u.full_name as owner_name, 
            CASE 
                WHEN f.location IS NOT NULL THEN ST_X(f.location::geometry) 
                ELSE 106.7009 
            END as lng,
            CASE 
                WHEN f.location IS NOT NULL THEN ST_Y(f.location::geometry) 
                ELSE 10.7769 
            END as lat
            FROM facilities f
            LEFT JOIN users u ON f.owner_id = u.id
            WHERE f.status = 'active'
            ORDER BY f.id DESC
        `;
        const result = await client.query(query);
        
        const facilities = result.rows.map(f => ({
            ...f,
            geometry: { coordinates: [f.lng, f.lat] } 
        }));

        res.json(facilities);
    } catch (err) {
        console.error("Lỗi lấy facilities:", err); 
        res.status(500).json({ error: "Lỗi lấy danh sách cơ sở" });
    } finally {
        client.release();
    }
});

// =======================================================
// PART D: BOOKING & REVIEWS
// =======================================================

// 1. Get Booked Slots
app.get('/api/bookings/slots', async (req, res) => {
    try {
        const { court_id, date } = req.query;
        if (!court_id || !date) return res.json([]);
        
        const result = await pool.query(
            "SELECT booking_time FROM bookings WHERE court_id = $1 AND booking_date = $2 AND status != 'cancelled'",
            [court_id, date]
        );
        const bookedTimes = result.rows.map(row => row.booking_time);
        res.json(bookedTimes);
    } catch (err) { res.status(500).send("Server Error"); }
});

// 2. Create Booking (ĐÃ SỬA: CHECK STATUS)
app.post('/api/bookings', async (req, res) => {
    try {
        // 👇 KHÚC QUAN TRỌNG: Hứng đúng tên biến Frontend gửi lên (start_time, total_price)
        const { user_id, court_id, booking_date, start_time, total_price } = req.body;

        console.log("📥 Nhận đơn booking:", { user_id, court_id, date: booking_date, time: start_time, price: total_price });

        // 1. Kiểm tra dữ liệu đầu vào
        if (!user_id || !court_id || !booking_date || !start_time) {
            return res.status(400).json({ message: "Thiếu thông tin đặt sân (User, Sân, Ngày, Giờ)" });
        }

        // 2. Kiểm tra trạng thái sân (Active mới cho đặt)
        const courtCheck = await pool.query("SELECT status FROM courts WHERE id = $1", [court_id]);
        
        if (courtCheck.rows.length === 0) {
            return res.status(404).json({ message: "Sân không tồn tại" });
        }

        // Nếu database chưa có status thì bỏ qua check, nếu có thì bắt buộc phải 'active'
        if (courtCheck.rows[0].status && courtCheck.rows[0].status !== 'active') {
            return res.status(400).json({ message: "Sân này đang bị khóa hoặc bảo trì!" });
        }

        // 3. Kiểm tra trùng giờ (Dùng start_time thay cho booking_time cũ)
        const checkSlot = await pool.query(
            "SELECT id FROM bookings WHERE court_id = $1 AND booking_date = $2 AND booking_time = $3 AND status != 'cancelled'",
            [court_id, booking_date, start_time]
        );

        if (checkSlot.rows.length > 0) {
            return res.status(409).json({ message: "Khung giờ này đã có người đặt rồi!" });
        }

        // 4. Insert vào DB
        // Lưu ý: Mapping start_time -> booking_time, total_price -> price
        await pool.query(
            "INSERT INTO bookings (user_id, court_id, booking_date, booking_time, price, status, is_archived) VALUES ($1, $2, $3, $4, $5, 'confirmed', false)",
            [
                parseInt(user_id), 
                parseInt(court_id), 
                booking_date, 
                start_time,                   // Sử dụng start_time
                parseFloat(total_price) || 0  // Sử dụng total_price và ép kiểu số
            ]
        );

        console.log("✅ Đặt thành công!");
        res.json({ message: "Booking successful!" });

    } catch (err) { 
        console.error("❌ Lỗi Đặt Sân:", err);
        res.status(500).json({ message: "Server Error: " + err.message }); 
    }
});

// 3. Get My Bookings (Customer)
app.get('/api/my-bookings', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, c.name as court_name, c.address, c.image_url, c.price_per_hour, b.booking_time as start_time 
            FROM bookings b 
            JOIN courts c ON b.court_id = c.id 
            WHERE b.user_id = $1 AND (b.is_archived IS NULL OR b.is_archived = false) 
            ORDER BY b.booking_date DESC
        `, [req.query.user_id]);
        res.json(result.rows);
    } catch (e) { res.status(500).send(e.message) }
});

// 3.5 Get My Tickets (For Frontend Modal)
app.get('/api/bookings/my-tickets', async (req, res) => {
    try {
        const { user_id } = req.query;
        const result = await pool.query(`
            SELECT b.id, c.name as court_name, b.booking_date, b.booking_time, b.price, b.status 
            FROM bookings b 
            JOIN courts c ON b.court_id = c.id 
            WHERE b.user_id = $1 AND (b.is_archived = false OR b.is_archived IS NULL)
            ORDER BY b.booking_date DESC, b.booking_time DESC
        `, [user_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).send("Server Error"); }
});

// 4. Get Vendor Bookings
app.get('/api/vendor/bookings', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.id, b.booking_date, b.booking_time, b.price, b.status, b.is_archived,
                   u.full_name as user_name, u.username as user_phone, c.name as court_name, c.price_per_hour ,u.avatar_url
            FROM bookings b 
            JOIN courts c ON b.court_id = c.id 
            JOIN users u ON b.user_id = u.id 
            WHERE c.owner_id = $1 AND (b.is_archived = false OR b.is_archived IS NULL)
            ORDER BY b.booking_date DESC
        `, [req.query.vendor_id]);
        res.json(result.rows);
    } catch (e) { res.status(500).send(e.message) }
});

// 5. Booking Operations (Check-in / Cancel)
app.put('/api/bookings/:id/checkin', async (req, res) => {
    await pool.query("UPDATE bookings SET status = 'completed' WHERE id = $1", [req.params.id]);
    res.json({ message: "Check-in successful!" });
});

app.put('/api/bookings/:id/cancel', async (req, res) => {
    await pool.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [req.params.id]);
    res.json({ message: "Booking cancelled!" });
});

// 5.5 Soft Delete Booking (Archive)
app.delete('/api/bookings/:id', async (req, res) => {
    try {
        await pool.query("UPDATE bookings SET is_archived = true WHERE id = $1", [req.params.id]);
        res.json({ message: "Booking moved to history!" });
    } catch (e) { res.status(500).send(e.message); }
});


app.delete('/api/vendor/bookings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { owner_id } = req.body; // Frontend phải gửi owner_id lên để kiểm tra quyền

        // Bước 1: Kiểm tra xem cái vé này (booking) có thuộc về sân của ông chủ này không?
        // Logic: booking -> court -> owner_id
        const checkQuery = `
            SELECT b.id 
            FROM bookings b 
            JOIN courts c ON b.court_id = c.id 
            WHERE b.id = $1 AND c.owner_id = $2
        `;
        
        const checkResult = await pool.query(checkQuery, [id, owner_id]);
        
        if (checkResult.rows.length === 0) {
            return res.status(403).json({ error: "Bạn không có quyền xóa vé này (hoặc vé không tồn tại)!" });
        }

        // Bước 2: Nếu đúng là chủ sân -> Xóa vĩnh viễn (Hard Delete)
        await pool.query("DELETE FROM bookings WHERE id = $1", [id]);
        
        res.json({ message: "Đã xóa vĩnh viễn vé khỏi hệ thống!" });

    } catch (e) {
        console.error(e);
        res.status(500).send("Lỗi Server: " + e.message);
    }
});
// 6. Vendor Stats (Revenue)
app.get('/api/vendor/stats', async (req, res) => {
    try {
        const { vendor_id } = req.query;
        const totalStats = await pool.query(`
            SELECT COUNT(*) as total_bookings, 
                   COALESCE(SUM(b.price), 0) as total_revenue
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            WHERE c.owner_id = $1 AND b.status = 'completed'
        `, [vendor_id]);

        const dailyStats = await pool.query(`
            SELECT TO_CHAR(b.booking_date, 'DD/MM') as day,
                   SUM(b.price) as revenue
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            WHERE c.owner_id = $1 AND b.status = 'completed'
            GROUP BY day ORDER BY day DESC LIMIT 7
        `, [vendor_id]);

        const monthlyStats = await pool.query(`
            SELECT TO_CHAR(b.booking_date, 'MM/YYYY') as month,
                   SUM(b.price) as revenue
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            WHERE c.owner_id = $1 AND b.status = 'completed'
            GROUP BY month ORDER BY month ASC
        `, [vendor_id]);

        res.json({ 
            summary: totalStats.rows[0] || { total_bookings: 0, total_revenue: 0 }, 
            daily: dailyStats.rows.reverse(), 
            monthly: monthlyStats.rows 
        });
    } catch (e) { res.status(500).send(e.message) }
});

// 7. Reviews
app.get('/api/reviews/:court_id', async (req, res) => {
    try {
        const query = `
            SELECT r.*, u.full_name, u.username ,u.avatar_url
            FROM reviews r 
            JOIN users u ON r.user_id = u.id 
            WHERE r.court_id = $1 
            ORDER BY r.created_at DESC
        `;
        const result = await pool.query(query, [req.params.court_id]);
        res.json(result.rows);
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/reviews', async (req, res) => {
    try {
        const { court_id, user_id, rating, comment } = req.body;
        await pool.query(
            "INSERT INTO reviews (court_id, user_id, rating, comment) VALUES ($1, $2, $3, $4)", 
            [court_id, user_id, rating, comment]
        );
        res.json({ message: "Thanks for your review!" });
    } catch (e) { res.status(500).send(e.message); }
});

// =======================================================
// PART E: SUPER ADMIN & SYSTEM CONFIG
// =======================================================



app.get('/api/admin/users', async (req, res) => {
    try {
        // Lấy tất cả thông tin để hiển thị trong Modal chi tiết
        const result = await pool.query(`
            SELECT * FROM users 
            WHERE role != 'super_admin' 
            ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC
        `);
        // Logic sort: Đưa ông nào 'pending' lên đầu để Admin thấy mà duyệt ngay
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

app.put('/api/admin/users/:id/status', async (req, res) => {
    const { status } = req.body;
    await pool.query("UPDATE users SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.json({ message: "Status updated!" });
});

app.get('/api/sport-types', async (req, res) => {
    const result = await pool.query("SELECT * FROM sport_types");
    res.json(result.rows);
});

app.post('/api/sport-types', upload.single('icon'), async (req, res) => {
    const { code, name, icon_url_direct } = req.body;
    const icon_url = req.file ? req.file.path : icon_url_direct;
    await pool.query("INSERT INTO sport_types (code, name, icon_url) VALUES ($1, $2, $3)", [code, name, icon_url]);
    res.json({ message: "Sport type added!" });
});

app.delete('/api/sport-types/:id', async (req, res) => {
    await pool.query("DELETE FROM sport_types WHERE id = $1", [req.params.id]);
    res.json({ message: "Sport type deleted!" });
});

app.get('/api/config', async (req, res) => {
    const result = await pool.query("SELECT * FROM system_config");
    const config = {};
    result.rows.forEach(r => config[r.config_key] = r.config_value);
    res.json(config);
});

app.post('/api/config', upload.single('logo'), async (req, res) => {
    const { website_name } = req.body;
    if(website_name) {
        await pool.query("INSERT INTO system_config (config_key, config_value) VALUES ('website_name', $1) ON CONFLICT (config_key) DO UPDATE SET config_value = $1", [website_name]);
    }
    if(req.file) {
        await pool.query("INSERT INTO system_config (config_key, config_value) VALUES ('logo_url', $1) ON CONFLICT (config_key) DO UPDATE SET config_value = $1", [req.file.path]);
    }
    res.json({ message: "Configuration saved!" });
});

app.delete('/api/bookings/clear-history/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        await pool.query("UPDATE bookings SET is_archived = true WHERE user_id = $1", [user_id]);
        res.json({ message: "History cleared!" });
    } catch (e) { res.status(500).send(e.message); }
});

app.put('/api/users/:id/avatar', async (req, res) => {
    try {
        const { id } = req.params;
        const { avatar_url } = req.body;
        await pool.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [avatar_url, id]);
        res.json({ message: "Avatar updated!" });
    } catch (e) { res.status(500).send(e.message); }
});

app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query("DELETE FROM bookings WHERE user_id = $1", [id]);
        await pool.query("DELETE FROM reviews WHERE user_id = $1", [id]);
        await pool.query("DELETE FROM bookings WHERE court_id IN (SELECT id FROM courts WHERE owner_id = $1)", [id]);
        await pool.query("DELETE FROM reviews WHERE court_id IN (SELECT id FROM courts WHERE owner_id = $1)", [id]);
        await pool.query("DELETE FROM courts WHERE owner_id = $1", [id]);
        await pool.query("DELETE FROM users WHERE id = $1", [id]);

        res.json({ message: "User permanently deleted!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error deleting user" });
    }
});

// app.get('/api/admin/all-courts', async (req, res) => {
//     try {
//         const query = `
//             SELECT c.*, 
//                    f.name as facility_name, 
//                    u.full_name as owner_name,
//                    -- 👇 Dòng này quan trọng nhất, không có nó là map trắng
//                    ST_X(c.location::geometry) as lng, 
//                    ST_Y(c.location::geometry) as lat
//             FROM courts c
//             LEFT JOIN facilities f ON c.facility_id = f.id
//             LEFT JOIN users u ON c.owner_id = u.id
//             WHERE f.status = 'active'
//             ORDER BY c.created_at DESC
//         `;
//         const result = await pool.query(query);
//         res.json(result.rows);
//     } catch (err) {
//         console.error("Lỗi API Admin Courts:", err);
//         res.status(500).send("Server Error");
//     }
// });
app.get('/api/admin/all-courts', async (req, res) => {
    try {
        const query = `
            SELECT c.*, 
                   f.name as facility_name, 
                   u.full_name as owner_name,
                   -- 👇 Dòng này quan trọng nhất để MAP ADMIN hoạt động
                   ST_X(c.location::geometry) as lng, 
                   ST_Y(c.location::geometry) as lat
            FROM courts c
            JOIN facilities f ON c.facility_id = f.id  -- Dùng JOIN để đảm bảo sân phải thuộc về 1 cơ sở
            LEFT JOIN users u ON c.owner_id = u.id
            WHERE f.status = 'active' -- 👈 CHỈ LẤY SÂN CỦA CƠ SỞ ĐÃ DUYỆT
            ORDER BY c.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi API Admin Courts:", err);
        res.status(500).send("Server Error");
    }
});

// 1. API Tổng hợp số liệu cho Dashboard (Mới thêm)
app.get('/api/superadmin/dashboard-stats', async (req, res) => {
    try {
        console.log("---- ĐANG TÍNH TOÁN DASHBOARD ----");

        // 1. Đếm User & Vendor (Dùng Lower + Trim để bất chấp viết hoa thường hay dấu cách)
        const userQuery = `
            SELECT 
                COUNT(*) FILTER (WHERE TRIM(LOWER(role)) = 'user') as user_count,
                COUNT(*) FILTER (WHERE TRIM(LOWER(role)) = 'vendor') as vendor_count
            FROM users;
        `;
        const userRes = await pool.query(userQuery);
        const usersCount = parseInt(userRes.rows[0].user_count || 0);
        const vendorsCount = parseInt(userRes.rows[0].vendor_count || 0);

        console.log(`✅ Tìm thấy: ${usersCount} Khách, ${vendorsCount} Chủ sân`);

        // 2. Đếm số lượng Sân
        const courtRes = await pool.query("SELECT COUNT(*) as count FROM courts");
        const courtsCount = parseInt(courtRes.rows[0].count || 0);
        console.log(`✅ Tìm thấy: ${courtsCount} Sân`);

        // 3. Đếm số lượng Booking
        const bookingRes = await pool.query("SELECT COUNT(*) as count FROM bookings");
        const bookingsCount = parseInt(bookingRes.rows[0].count || 0);

        // 4. Tính GMV (Tổng tiền)
        // Nếu booking ít, có thể chưa có status 'confirmed', ta tạm bỏ điều kiện status để test số liệu trước
        const gmvRes = await pool.query(`
            SELECT COALESCE(SUM(c.price_per_hour), 0)::bigint as total 
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            -- WHERE b.status IN ('confirmed', 'completed') -- Bỏ tạm dòng này để hiện số nếu data test chưa chuẩn
        `);
        const revenue = parseInt(gmvRes.rows[0].total || 0);
        console.log(`✅ Doanh thu GMV: ${revenue}`);

        // 5. Trả về đúng cấu trúc Frontend đang chờ
        const responseData = {
            summary: {
                users: usersCount,
                vendors: vendorsCount,
                courts: courtsCount,
                bookings: bookingsCount,
                revenue: revenue
            },
            pie_data: {
                users: usersCount,
                vendors: vendorsCount
            },
            ward_stats: [] 
        };

        res.json(responseData);

    } catch (err) {
        console.error("❌ LỖI API DASHBOARD:", err);
        res.status(500).send("Lỗi server: " + err.message);
    }
});

// 2. API Thống kê Sân theo Phường/Xã (ĐÃ SỬA TÊN BẢNG administrative_units)
app.get('/api/superadmin/stats/courts-by-ward', async (req, res) => {
    try {
        const query = `
            SELECT 
                w.name as ward_name, 
                w.district_name, 
                COUNT(c.id)::int as total_courts
            FROM administrative_units w
            LEFT JOIN courts c ON ST_Contains(w.geom, c.location::geometry)
            GROUP BY w.id, w.name, w.district_name
            HAVING COUNT(c.id) > 0 
            ORDER BY total_courts DESC
            LIMIT 20; 
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Court By Ward Error:", err);
        res.status(500).send("Lỗi server: " + err.message);
    }
});
// =======================================================
// 🔥 API GEOJSON: TÌM KIẾM THEO PHƯỜNG XÃ (Đã update cho DB của bạn)
// =======================================================

// 1. API Lấy danh sách Phường/Xã để hiện lên Dropdown
app.get('/api/locations/wards', async (req, res) => {
    try {
        // Lấy id và tên phường. 
        // Loại bỏ các dòng "Không tên" (do lần import lỗi trước đó)
        // Sắp xếp theo tên A-Z cho dễ tìm
        const result = await pool.query(`
            SELECT id, name, type, district_name 
            FROM administrative_units 
            WHERE name != 'Không tên' 
            ORDER BY name ASC
        `);
        res.json(result.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).send(err.message); 
    }
});

// 2. API Tìm sân nằm TRONG phường đã chọn
app.get('/api/courts/by-ward/:wardId', async (req, res) => {
    try {
        const { wardId } = req.params;

        // Query 1: Tìm sân (giữ nguyên)
        const courtQuery = `
            SELECT c.*, 
                   ST_X(c.location::geometry) as lng, 
                   ST_Y(c.location::geometry) as lat,
                   u.full_name as owner_name,
                   u.avatar_url as owner_avatar
            FROM courts c
            JOIN administrative_units w ON w.id = $1 
            LEFT JOIN users u ON c.owner_id = u.id
            WHERE c.status = 'active' AND ST_Contains(w.geom, c.location::geometry)
        `;

        // Query 2: 🔥 SỬA ĐOẠN NÀY: Lấy cả 'shape' (hình vẽ thật) và 'bounds' (khung zoom)
        const boundsQuery = `
            SELECT 
                ST_AsGeoJSON(geom) as shape,               -- 👈 Lấy hình dáng thật để vẽ
                ST_AsGeoJSON(ST_Envelope(geom)) as bounds  -- 👈 Lấy khung để zoom
            FROM administrative_units 
            WHERE id = $1
        `;

        const [courtsResult, boundsResult] = await Promise.all([
            pool.query(courtQuery, [wardId]),
            pool.query(boundsQuery, [wardId])
        ]);

        res.json({
            courts: courtsResult.rows,
            // 👇 Trả về shape cho Frontend vẽ
            shape: boundsResult.rows.length > 0 ? JSON.parse(boundsResult.rows[0].shape) : null,
            bounds: boundsResult.rows.length > 0 ? JSON.parse(boundsResult.rows[0].bounds) : null
        });

    } catch (err) { 
        console.error(err);
        res.status(500).send(err.message); 
    }
});
// API ĐĂNG kèo

// 1. API Lấy danh sách kèo (Kèm thông tin người tạo + Avatar)
app.get('/api/matches', async (req, res) => {
    try {
        const query = `
            SELECT 
                m.*, 
                f.name as court_name, 
                f.address as court_address, 
                f.image_url as court_image, 
                
                -- Lấy thông tin Chủ Phòng (Host)
                u.full_name as host_name, 
                u.avatar_url as host_avatar,
                u.phone_number as host_phone, -- 🔥 Lấy thêm SĐT chủ phòng

                -- 🔥 Lấy danh sách những thằng đã tham gia (Gồm tên, avatar, sđt)
                (
                    SELECT json_agg(json_build_object(
                        'id', u2.id,
                        'name', u2.full_name,
                        'avatar', u2.avatar_url,
                        'phone', u2.phone_number
                    ))
                    FROM match_participants mp
                    JOIN users u2 ON mp.user_id = u2.id
                    WHERE mp.match_id = m.id
                ) as participants,

                -- Đếm số lượng (để hiển thị 2/10)
                (SELECT COUNT(*) FROM match_participants mp WHERE mp.match_id = m.id) as real_current_players

            FROM matches m
            JOIN facilities f ON m.court_id = f.id
            JOIN users u ON m.user_id = u.id
            ORDER BY m.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


// 2. API Tạo kèo mới
app.post('/api/matches', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { user_id, court_id, title, match_time, level, price_note, max_players, lat, lng } = req.body;

        // 1. CHỐNG SPAM: Cấm đặt liên tục trong 5 phút
        const checkSpam = await client.query(
            `SELECT id FROM matches 
             WHERE user_id = $1 AND created_at > NOW() - INTERVAL '5 minutes'`, 
            [user_id]
        );

        if (checkSpam.rows.length > 0) {
            return res.status(429).json({ error: 'Từ từ thôi! Đợi 5 phút nữa hãy tạo kèo mới.' });
        }

        await client.query('BEGIN'); // Bắt đầu giao dịch

        // 2. TẠO KÈO (Insert vào bảng matches)
        const insertMatchQuery = `
            INSERT INTO matches (user_id, court_id, title, match_time, level, price_note, max_players, lat, lng) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING id
        `;
        const resMatch = await client.query(insertMatchQuery, [
            user_id, parseInt(court_id), title, match_time, level, price_note, parseInt(max_players), lat, lng
        ]);
        const newMatchId = resMatch.rows[0].id;

        // 3. 🔥 QUAN TRỌNG: INSERT VÀO BẢNG match_participants CỦA MÀY
        // Để xác định "Slot còn bao nhiêu" (mặc định là 1/10)
        const insertParticipantQuery = `
            INSERT INTO match_participants (match_id, user_id) 
            VALUES ($1, $2)
        `;
        await client.query(insertParticipantQuery, [newMatchId, user_id]);

        await client.query('COMMIT'); // Lưu thành công cả 2 bảng

        res.json({ success: true, message: "Tạo kèo thành công", id: newMatchId });

    } catch (err) {
        await client.query('ROLLBACK'); // Lỗi thì hủy hết
        console.error("Lỗi tạo kèo:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/matches/join', async (req, res) => {
    const { match_id, user_id } = req.body;
    try {
        // Kiểm tra xem đã join chưa
        const check = await pool.query('SELECT * FROM match_participants WHERE match_id = $1 AND user_id = $2', [match_id, user_id]);
        if (check.rows.length > 0) {
            return res.status(400).json({ message: 'Bạn đã tham gia kèo này rồi!' });
        }

        // Thêm vào bảng tham gia
        await pool.query('INSERT INTO match_participants (match_id, user_id) VALUES ($1, $2)', [match_id, user_id]);
        
        res.json({ success: true, message: 'Tham gia thành công' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 3. API XEM DANH SÁCH NGƯỜI THAM GIA (Để chủ kèo biết ai join) ---
app.get('/api/matches/:id/participants', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT u.id, u.full_name, u.avatar_url, mp.joined_at 
            FROM match_participants mp
            JOIN users u ON mp.user_id = u.id
            WHERE mp.match_id = $1
        `, [id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 🔥 CÁC API MỚI DÀNH CHO QUẢN LÝ FACILITY (BỔ SUNG)
// ==========================================

// 1. API Lấy danh sách Địa điểm (Facility) của Chủ sân
app.get('/api/vendor/facilities', async (req, res) => {
    const { vendor_id } = req.query;
    try {
        // Lấy danh sách địa điểm (Dùng ST_X, ST_Y để tách tọa độ cho frontend)
        const query = `
            SELECT 
                id, owner_id, name, address, 
                open_time, close_time, image_url, status, created_at,
                ST_Y(location::geometry) as lat, 
                ST_X(location::geometry) as lng
            FROM facilities 
            WHERE owner_id = $1 
            ORDER BY id DESC
        `;
        const facilities = await pool.query(query, [vendor_id]);
        
        // Lấy thông tin tóm tắt các môn thể thao bên trong từng địa điểm
        const result = await Promise.all(facilities.rows.map(async (fac) => {
            const sports = await pool.query(
                `SELECT type as sport_type, COUNT(*) as total_courts 
                 FROM courts WHERE facility_id = $1 GROUP BY type`, 
                [fac.id]
            );
            return { ...fac, sports: sports.rows };
        }));

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 2. API Tạo Địa điểm Mới (Facility)
app.post('/api/facilities', async (req, res) => {
    const { owner_id, name, address, lat, lng, open_time, close_time, image_url } = req.body;
    
    // Validate
    if (!lat || !lng) return res.status(400).json({ error: "Thiếu tọa độ (lat, lng)" });

    try {
        const query = `
            INSERT INTO facilities (
                owner_id, name, address, location, open_time, close_time, image_url,
                status  -- 🔥 1. THÊM CỘT STATUS
            ) 
            VALUES (
                $1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, $8,
                'pending' -- 🔥 2. ÉP CỨNG LÀ 'pending' ĐỂ ADMIN DUYỆT
            ) 
            RETURNING id
        `;
        
        const result = await pool.query(query, [
            owner_id, name, address, parseFloat(lng), parseFloat(lat), open_time, close_time, image_url
        ]);

        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error("Lỗi tạo Facility:", err);
        res.status(500).json({ error: err.message });
    }
});



app.post('/api/facilities/:id/sports', async (req, res) => {
    const { id } = req.params;
    const { 
        sport_type, total_courts, vip_count, 
        price_normal, price_vip, 
        amenities_normal, amenities_vip, 
        images_normal, images_vip // 🔥 Nhận 2 bộ ảnh riêng
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const facRes = await client.query(`SELECT owner_id, address, ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat FROM facilities WHERE id = $1`, [id]);
        if (facRes.rows.length === 0) throw new Error(`Không tìm thấy Facility ID ${id}`);
        const { owner_id, address, lat, lng } = facRes.rows[0];
        
        // Xử lý ảnh
        const imgsNormal = (images_normal && Array.isArray(images_normal)) ? images_normal : [];
        const mainImgNormal = imgsNormal.length > 0 ? imgsNormal[0] : null;

        const imgsVIP = (images_vip && Array.isArray(images_vip)) ? images_vip : [];
        const mainImgVIP = imgsVIP.length > 0 ? imgsVIP[0] : null;

        const t_courts = parseInt(total_courts) || 0;
        const v_count = parseInt(vip_count) || 0;
        const normalCount = t_courts - v_count;

        const strNormal = Array.isArray(amenities_normal) ? amenities_normal.join(',') : '';
        const strVIP = Array.isArray(amenities_vip) ? amenities_vip.join(',') : '';

        const insertQuery = `
            INSERT INTO courts (
                facility_id, owner_id, name, type, price_per_hour, amenities, status, location, address, image_url, images
            ) VALUES ($1, $2, $3, $4, $5, $6, 'active', ST_SetSRID(ST_MakePoint($7, $8), 4326), $9, $10, $11)
        `;

        // 1. Tạo sân thường (Dùng images_normal)
        for (let i = 1; i <= normalCount; i++) {
            await client.query(insertQuery, [
                parseInt(id), parseInt(owner_id), `${sport_type} Sân ${i}`, sport_type,
                parseInt(price_normal) || 0, strNormal, 
                parseFloat(lng), parseFloat(lat), address, 
                mainImgNormal, imgsNormal // 🔥 Lưu ảnh thường
            ]);
        }

        // 2. Tạo sân VIP (Dùng images_vip)
        for (let i = 1; i <= v_count; i++) {
            await client.query(insertQuery, [
                parseInt(id), parseInt(owner_id), `${sport_type} VIP ${i}`, sport_type,
                parseInt(price_vip) || 0, strVIP,
                parseFloat(lng), parseFloat(lat), address, 
                mainImgVIP, imgsVIP // 🔥 Lưu ảnh VIP
            ]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Đã thêm môn thành công!" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Lỗi:", err.message);
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});
// 4. API Xóa Địa điểm (Xóa luôn sân con bên trong)
app.delete('/api/facilities/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM courts WHERE facility_id = $1', [id]); 
        await pool.query('DELETE FROM facilities WHERE id = $1', [id]);      
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/facilities/:id', async (req, res) => {
    const { id } = req.params;
    const { name, address, open_time, close_time, image_url, lat, lng } = req.body;
    
    try {
        let query = `
            UPDATE facilities 
            SET name = $1, address = $2, open_time = $3, close_time = $4, image_url = $5
        `;
        const values = [name, address, open_time, close_time, image_url];
        
        // Nếu có sửa vị trí bản đồ thì cập nhật luôn location
        if (lat && lng) {
            query += `, location = ST_SetSRID(ST_MakePoint($6, $7), 4326)`;
            values.push(parseFloat(lng), parseFloat(lat));
        }

        query += ` WHERE id = $${values.length + 1} RETURNING *`;
        values.push(id);

        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) return res.status(404).json({ error: "Không tìm thấy sân" });
        
        res.json({ success: true, message: "Cập nhật thành công!", facility: result.rows[0] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/facilities/:id/sports/:type', async (req, res) => {
    const { id, type } = req.params;
    const { price_normal, price_vip, amenities_normal, amenities_vip, images_normal, images_vip } = req.body;

    try {
        const strNormal = Array.isArray(amenities_normal) ? amenities_normal.join(',') : '';
        const strVIP = Array.isArray(amenities_vip) ? amenities_vip.join(',') : '';
        
        const imgsNormal = (images_normal && Array.isArray(images_normal)) ? images_normal : [];
        const mainImgNormal = imgsNormal.length > 0 ? imgsNormal[0] : null;

        const imgsVIP = (images_vip && Array.isArray(images_vip)) ? images_vip : [];
        const mainImgVIP = imgsVIP.length > 0 ? imgsVIP[0] : null;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update Sân Thường (Dùng images_normal)
            await client.query(`
                UPDATE courts SET price_per_hour = $1, amenities = $2, images = $3, image_url = $4
                WHERE facility_id = $5 AND type = $6 AND name NOT LIKE '%VIP%'
            `, [price_normal, strNormal, imgsNormal, mainImgNormal, id, type]);

            // Update Sân VIP (Dùng images_vip)
            await client.query(`
                UPDATE courts SET price_per_hour = $1, amenities = $2, images = $3, image_url = $4
                WHERE facility_id = $5 AND type = $6 AND name LIKE '%VIP%'
            `, [price_vip, strVIP, imgsVIP, mainImgVIP, id, type]);

            await client.query('COMMIT');
            res.json({ success: true, message: "Đã cập nhật!" });
        } catch (e) { await client.query('ROLLBACK'); throw e; } 
        finally { client.release(); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});
// ==========================================
// 🔥 KẾT THÚC PHẦN BỔ SUNG
// ==========================================

// ============================================================
// 5. API LẤY DANH SÁCH ĐỊA ĐIỂM CHO USER (GỘP SÂN LẠI)
// ============================================================
app.get('/api/user/facilities-search', async (req, res) => {
    try {
        const query = `
            WITH 
            CourtStats AS (
                SELECT facility_id, MIN(price_per_hour) as min_price, COUNT(id) as total_courts, array_agg(DISTINCT type) as sports
                FROM courts GROUP BY facility_id
            ),
            ReviewStats AS (
                SELECT c.facility_id, AVG(r.rating) as avg_rating, COUNT(r.id) as review_count
                FROM reviews r JOIN courts c ON r.court_id = c.id GROUP BY c.facility_id
            )
            SELECT 
                f.id, f.name, f.address, f.image_url, f.open_time, f.close_time, f.owner_id, 
                
                -- 🔥 LẤY THÔNG TIN LIÊN HỆ CHỦ SÂN TỪ DB
                COALESCE(u.full_name, 'Chủ sân') as owner_name, 
                u.avatar_url as owner_avatar,
                u.phone_number,   -- SĐT thật
                u.zalo_url,       -- Link Zalo thật
                u.facebook_url,   -- Link Facebook thật

                ST_X(f.location::geometry) as lng, 
                ST_Y(f.location::geometry) as lat,
                
                COALESCE(cs.min_price, 0) as min_price,
                COALESCE(cs.total_courts, 0) as total_courts,
                COALESCE(cs.sports, '{}') as sports,
                COALESCE(rs.avg_rating, 5) as avg_rating,
                COALESCE(rs.review_count, 0) as review_count

            FROM facilities f
            LEFT JOIN users u ON f.owner_id = u.id
            LEFT JOIN CourtStats cs ON f.id = cs.facility_id
            LEFT JOIN ReviewStats rs ON f.id = rs.facility_id
            WHERE f.status = 'active'
            ORDER BY f.id DESC
        `;
        
        const result = await pool.query(query);
        res.json(result.rows);

    } catch (err) {
        console.error("❌ Lỗi API Search:", err.message); 
        res.status(500).json({ error: err.message });
    }
});
// API Lấy danh sách sân con chi tiết (để hiện trong Modal)
app.get('/api/facilities/:id/courts-detail', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT * FROM courts 
            WHERE facility_id = $1 
            AND status = 'active'
            ORDER BY type, price_per_hour ASC
        `;
        const result = await pool.query(query, [id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/facilities/:id/sports/:type', async (req, res) => {
    const { id, type } = req.params;
    try {
        // 1. Lấy thông tin Sân Thường
        const normalRes = await pool.query(`
            SELECT price_per_hour, amenities, images 
            FROM courts 
            WHERE facility_id = $1 AND type = $2 AND name NOT LIKE '%VIP%' 
            LIMIT 1
        `, [id, type]);

        // 2. Lấy thông tin Sân VIP
        const vipRes = await pool.query(`
            SELECT price_per_hour, amenities, images 
            FROM courts 
            WHERE facility_id = $1 AND type = $2 AND name LIKE '%VIP%' 
            LIMIT 1
        `, [id, type]);

        // 3. Đếm số lượng
        const countNormal = await pool.query(`SELECT COUNT(*) FROM courts WHERE facility_id = $1 AND type = $2 AND name NOT LIKE '%VIP%'`, [id, type]);
        const countVIP = await pool.query(`SELECT COUNT(*) FROM courts WHERE facility_id = $1 AND type = $2 AND name LIKE '%VIP%'`, [id, type]);

        const data = {
            sport_type: type,
            normal_count: parseInt(countNormal.rows[0].count) || 0,
            vip_count: parseInt(countVIP.rows[0].count) || 0,
            
            // Dữ liệu sân thường
            price_normal: normalRes.rows.length > 0 ? normalRes.rows[0].price_per_hour : 0,
            amenities_normal: normalRes.rows.length > 0 ? normalRes.rows[0].amenities : '',
            images_normal: normalRes.rows.length > 0 ? normalRes.rows[0].images : [],

            // Dữ liệu sân VIP
            price_vip: vipRes.rows.length > 0 ? vipRes.rows[0].price_per_hour : 0,
            amenities_vip: vipRes.rows.length > 0 ? vipRes.rows[0].amenities : '',
            images_vip: vipRes.rows.length > 0 ? vipRes.rows[0].images : [],
        };

        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/courts/:id/check', async (req, res) => {
    try {
        const { id } = req.params;
        const { date, start } = req.query; // start="17:00"

        // Kiểm tra xem khung giờ này đã có ai đặt chưa
        const checkQuery = `
            SELECT id FROM bookings 
            WHERE court_id = $1 
            AND booking_date = $2 
            AND booking_time = $3 
            AND status != 'cancelled'
        `;
        
        const result = await pool.query(checkQuery, [id, date, start]);

        if (result.rows.length > 0) {
            return res.json({ available: false, message: "Khung giờ này đã kín!" });
        }

        res.json({ available: true, message: "Sân còn trống!" });

    } catch (err) {
        console.error("Check Court Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reviews/facility/:id', async (req, res) => {
    try {
        const query = `
            SELECT r.*, u.full_name, u.avatar_url, c.name as court_name
            FROM reviews r 
            JOIN users u ON r.user_id = u.id 
            JOIN courts c ON r.court_id = c.id
            WHERE c.facility_id = $1 
            ORDER BY r.created_at DESC
        `;
        const result = await pool.query(query, [req.params.id]);
        res.json(result.rows);
    } catch (e) { res.status(500).send(e.message); }
});

// ==========================================
// 🔥 API QUẢN LÝ KÈO CHO CHỦ PHÒNG (HOST)
// ==========================================

// 1. XÓA KÈO (Chỉ chủ kèo mới xóa được)
app.delete('/api/matches/:id', async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body; // ID thằng đang bấm xóa

    try {
        // Kiểm tra xem thằng này có phải chủ kèo không
        const check = await pool.query('SELECT user_id FROM matches WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Kèo không tồn tại" });
        
        if (parseInt(check.rows[0].user_id) !== parseInt(user_id)) {
            return res.status(403).json({ error: "Mày đéo phải chủ kèo, xóa cái lồn!" });
        }

        // Xóa người tham gia trước (do ràng buộc khóa ngoại)
        await pool.query('DELETE FROM match_participants WHERE match_id = $1', [id]);
        // Xóa kèo
        await pool.query('DELETE FROM matches WHERE id = $1', [id]);

        res.json({ success: true, message: "Đã xóa kèo!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. ĐUỔI NGƯỜI (KICK)
app.delete('/api/matches/:match_id/kick/:user_to_kick', async (req, res) => {
    const { match_id, user_to_kick } = req.params;
    const { host_id } = req.body; // ID thằng chủ phòng gửi lên

    try {
        // Check quyền chủ phòng
        const checkHost = await pool.query('SELECT user_id FROM matches WHERE id = $1', [match_id]);
        if (checkHost.rows.length === 0 || parseInt(checkHost.rows[0].user_id) !== parseInt(host_id)) {
            return res.status(403).json({ error: "Mày không phải chủ phòng!" });
        }

        // Đuổi thằng kia
        await pool.query('DELETE FROM match_participants WHERE match_id = $1 AND user_id = $2', [match_id, user_to_kick]);
        
        res.json({ success: true, message: "Đã đuổi cổ thành công!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. KHÓA / MỞ KÈO (Toggle Status)
// Cần thêm cột status vào bảng matches nếu chưa có. 
// Nếu lười sửa DB, tao dùng mẹo này: Tao thêm cột 'is_locked' vào query SELECT ở API lấy danh sách.
// Nhưng để chuẩn, tao giả sử mày dùng status. Nếu chưa có cột status trong bảng matches, chạy lệnh SQL này trong pgAdmin:
// ALTER TABLE matches ADD COLUMN status VARCHAR(20) DEFAULT 'open';

app.put('/api/matches/:id/lock', async (req, res) => {
    const { id } = req.params;
    const { user_id, status } = req.body; // status: 'open' hoặc 'locked'

    try {
        const check = await pool.query('SELECT user_id FROM matches WHERE id = $1', [id]);
        if (parseInt(check.rows[0].user_id) !== parseInt(user_id)) {
            return res.status(403).json({ error: "Không phải chủ kèo" });
        }

        await pool.query('UPDATE matches SET status = $1 WHERE id = $2', [status, id]);
        res.json({ success: true, message: status === 'locked' ? "Đã khóa kèo!" : "Đã mở kèo!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 🔥 API ADMIN QUẢN LÝ CƠ SỞ (FACILITIES) - CẦN THÊM CÁI NÀY
// ==========================================

// 1. API Lấy TOÀN BỘ danh sách Facility (Cả Active/Pending/Blocked) để Admin duyệt
app.get('/api/admin/facilities', async (req, res) => {
    try {
        const query = `
            SELECT 
                f.*, 
                u.full_name as owner_name, 
                u.phone_number as owner_phone,
                u.email as owner_email,
                -- Đếm số sân con bên trong
                (SELECT COUNT(*) FROM courts c WHERE c.facility_id = f.id) as total_courts
            FROM facilities f
            LEFT JOIN users u ON f.owner_id = u.id
            ORDER BY 
                CASE WHEN f.status = 'pending' THEN 0 ELSE 1 END, -- Ưu tiên hiện Pending lên đầu
                f.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi lấy admin facilities:", err);
        res.status(500).json({ error: "Lỗi Server" });
    }
});

// 2. API Duyệt / Khóa Facility (Approve / Reject)
app.put('/api/admin/facilities/:id/status', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { status } = req.body; // 'active', 'rejected', 'blocked'

        await client.query('BEGIN');

        // 1. Cập nhật trạng thái Facility
        const queryFac = `UPDATE facilities SET status = $1 WHERE id = $2 RETURNING *`;
        const result = await client.query(queryFac, [status, id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Không tìm thấy cơ sở này" });
        }

        // 2. 🔥 LOGIC TỰ ĐỘNG: 
        // Nếu Facility bị khóa (blocked/rejected) -> Khóa luôn tất cả sân con (Courts) bên trong
        // Nếu Facility được duyệt (active) -> Mở tất cả sân con (hoặc giữ nguyên tùy logic)
        
        if (status === 'blocked' || status === 'rejected') {
            await client.query(`UPDATE courts SET status = 'blocked' WHERE facility_id = $1`, [id]);
        } 
        else if (status === 'active') {
            // Khi duyệt cơ sở, ta cũng duyệt luôn các sân con đang pending bên trong (cho tiện chủ sân)
            await client.query(`UPDATE courts SET status = 'active' WHERE facility_id = $1 AND status = 'pending'`, [id]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Đã cập nhật trạng thái thành: ${status}`, facility: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Lỗi server khi duyệt sân" });
    } finally {
        client.release();
    }
});

// 🔥 API DUYỆT/KHÓA HÀNG LOẠT SÂN CON (BULK ACTION)
app.put('/api/admin/courts/bulk-status', async (req, res) => {
    const client = await pool.connect();
    try {
        const { ids, status } = req.body; // ids: [1, 2, 3...], status: 'active'/'rejected'

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "Chưa chọn sân nào!" });
        }

        // Dùng cú pháp ANY($1::int[]) để update nhiều dòng 1 lúc
        const query = `UPDATE courts SET status = $1 WHERE id = ANY($2::int[]) RETURNING id`;
        const result = await client.query(query, [status, ids]);

        res.json({ success: true, message: `Đã cập nhật ${result.rowCount} sân thành ${status}!` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Lỗi server" });
    } finally {
        client.release();
    }
});
// --- START SERVER ---
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});