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

// Hàm tạo vé ngẫu nhiên
const generateTicketCode = () => {
    const chars = '0123456789'
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};
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
const SECRET_KEY = process.env.SECRET_KEY1;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads')); 

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  max: 1,
  port: process.env.DB_PORT,
  ssl: {
        rejectUnauthorized: false
    }
});

pool.connect()
    .then(() => console.log('✅ Connected to PostgreSQL successfully!'))
    .catch(err => console.error('❌ DB Connection Error:', err.message));


const formatTime = (timeInput) => {
    if (!timeInput) return null;
    return timeInput; 
};

//  CẤU HÌNH UP ẢNH ĐĂNG KÝ VENDOR ---

const registerUpload = upload.fields([
    { name: 'facility_images', maxCount: 10 },
    { name: 'identity_images', maxCount: 2 },
    { name: 'face_image', maxCount: 1 }
]);

// Phần login

//  API ĐĂNG KÝ , đang test thử......
app.post('/api/register', registerUpload, async (req, res) => {
    const client = await pool.connect();
    try {
        console.log(" Nhận request đăng ký:", req.body); 
        await client.query('BEGIN');

        const { username, email, password, full_name, role, phone_number, facility_name, facility_address, lat, lng } = req.body;

        // Validate cơ bản , nâng cấp sau ....
        if (!username || !email || !password) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Thiếu thông tin bắt buộc (username, email, password)!" });
        }

        // Check trùng Username hoặc Email
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
            
            if (req.files) {
                if (req.files['facility_images']) {
                    facilityImgs = req.files['facility_images'].map(f => f.path);
                }
                if (req.files['identity_images']) {
                    identityImgs = req.files['identity_images'].map(f => f.path);
                }
                if (req.files['face_image'] && req.files['face_image'].length > 0) {
                    faceImg = req.files['face_image'][0].path;
                }
            }
            
            // Validate bắt buộc phải có ảnh xác minh
            // if (identityImgs.length === 0 || !faceImg) {
            //     await client.query('ROLLBACK');
            //     return res.status(400).json({ message: "Thiếu ảnh xác minh (CCCD hoặc Khuôn mặt)!" });
            // }
        }

        // 4. Insert vào DB
        const query = `
            INSERT INTO users (
                username, email, password, full_name, role, status, 
                phone_number, facility_name, facility_address, 
                location, 
                facility_images, identity_images, face_image, created_at ,
                approved_ward_id, approved_sports
            ) VALUES (
                $1, $2, $3, $4, $5, $6, 
                $7, $8, $9, 
                ST_SetSRID(ST_MakePoint($10, $11), 4326), 
                $12, $13, $14, NOW(),
                $15, $16
            ) RETURNING id, username, role, status
        `;

        const longitude = lng ? parseFloat(lng) : 0;
        const latitude = lat ? parseFloat(lat) : 0;

        const values = [
            username, email, hashedPassword, full_name, role, status, 
            phone_number || null, facility_name || null, facility_address || null, 
            longitude, latitude,
            facilityImgs, identityImgs, faceImg,
            req.body.ward_id ? parseInt(req.body.ward_id) : null, 
            req.body.sport_ids || null
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

// 2. API ĐĂNG NHẬP
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
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
                username: user.username,
                email: user.email,
                name: user.full_name,
                role: user.role,
                avatar: user.avatar_url,
                approved_ward_id: user.approved_ward_id, 
                approved_sports: user.approved_sports,
                status: user.status , 
                phone_number: user.phone_number , 
                facebook_url: user.facebook_url,
                zalo_url: user.zalo_url
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
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user;

    if (userCheck.rows.length > 0) {
      user = userCheck.rows[0];
    } else {
      const newUser = await pool.query(
        `INSERT INTO users (username, email, password, full_name, avatar_url, role, provider, provider_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          email.split('@')[0], 
          email, 
          'social_login_no_pass', 
          name, 
          avatar, 
          'user', 
          provider, 
          uid
        ]
      );
      user = newUser.rows[0];
    }

    const token = jwt.sign(
      { id: user.id, role: user.role }, 
      process.env.JWT_SECRET || 'your_jwt_secret_key', 
      { expiresIn: '24h' }
    );

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

app.put('/api/users/:id', upload.single('avatar'), async (req, res) => {
    const { id } = req.params;
    const { full_name, phone_number } = req.body;
    const avatar_url = req.file ? req.file.path : req.body.avatar_url;

    const client = await pool.connect();
    try {
        const checkUser = await client.query("SELECT * FROM users WHERE id = $1", [id]);
        if (checkUser.rows.length === 0) {
            return res.status(404).json({ error: "User không tồn tại" });
        }

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
            SELECT id, full_name, avatar_url, phone_number, created_at, role , facebook_url, zalo_url , email
             
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

// --- YÊU CẦU QUÊN MẬT KHẨU  ---
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        // 1. Kiểm tra Email có tồn tại không
        const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: "Email này chưa được đăng ký!" });
        }

        // 2. Tạo mã OTP ngẫu nhiên 6 số
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // 3. Lưu mã vào Database (hết hạn sau 15 phút)
        await pool.query(
            "UPDATE users SET reset_code = $1, reset_code_expires = NOW() + interval '15 minutes' WHERE email = $2",
            [code, email]
        );

        // 4. Cấu hình nội dung Email đẹp (HTML)           
        const logoUrl = "https://duykiet04.github.io/anh/logo.jpg";

const emailTemplate = `
<div style="margin:0; padding:0; background-color:#f0f4ff; font-family: Arial, sans-serif;">
    <div style="max-width:600px; margin:40px auto; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#0d47a1,#1976d2); padding:30px 20px; text-align:center;">
            <img src="${logoUrl}" 
                 alt="SportFinder Logo" 
                 style="width:90px; height:90px; border-radius:50%; object-fit:cover; border:4px solid #ffffff; box-shadow:0 4px 10px rgba(0,0,0,0.2);" />
            <h2 style="color:#ffffff; margin-top:15px; font-size:22px;">
                Yêu cầu đặt lại mật khẩu
            </h2>
        </div>

        <!-- Body -->
        <div style="padding:30px;">
            <p style="color:#333; font-size:16px;">Xin chào,</p>

            <p style="color:#555; font-size:15px; line-height:1.6;">
                Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản 
                <strong style="color:#1976d2;">SportFinder</strong> của bạn.
                Vui lòng sử dụng mã xác nhận bên dưới:
            </p>

            <!-- OTP -->
            <div style="text-align:center; margin:35px 0;">
                <span style="
                    display:inline-block;
                    font-size:34px;
                    font-weight:bold;
                    letter-spacing:6px;
                    color:#0d47a1;
                    background:#e3f2fd;
                    padding:18px 40px;
                    border-radius:10px;
                    border:2px solid #1976d2;
                ">
                    ${code}
                </span>
            </div>

            <p style="color:#666; font-size:14px; text-align:center; line-height:1.6;">
                ⏳ Mã có hiệu lực trong <strong>15 phút</strong>.<br/>
                Nếu bạn không yêu cầu thay đổi mật khẩu, hãy bỏ qua email này.
            </p>
        </div>

        <!-- Footer -->
        <div style="background:#f8faff; padding:20px; text-align:center; font-size:12px; color:#888;">
            © 2026 SportFinder. All rights reserved.
        </div>

    </div>
</div>
`;

        const mailOptions = {
            from: `"Sport Booking Support" <${process.env.EMAIL_USER}>`, // Tên người gửi đẹp hơn
            to: email,
            subject: '🔐 Mã xác nhận khôi phục mật khẩu', // Tiêu đề có icon cho nổi
            html: emailTemplate // 🔥 Gửi bằng HTML thay vì text thường
        };

        // 5. Gửi mail
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Lỗi gửi mail:", error); // Dùng console.error để dễ debug
                return res.status(500).json({ message: "Lỗi hệ thống gửi email!" });
            } else {
                console.log("Email sent: " + info.response);
                return res.json({ message: "Mã xác nhận đã được gửi về Email của bạn!" });
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1 AND reset_code = $2 AND reset_code_expires > NOW()",
            [email, code]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Mã xác nhận không đúng hoặc đã hết hạn!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

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


// --- XÁC MINH MÃ OTP (KIỂM TRA HẾT HẠN) ---
app.post('/api/verify-reset-code', async (req, res) => {
    try {
        const { email, code } = req.body;

        // 1. Lấy thông tin user
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Email không tồn tại!" });
        }

        const user = result.rows[0];

        // 2. Kiểm tra mã có khớp không
        if (user.reset_code !== code) {
            return res.status(400).json({ message: "Mã xác nhận không đúng!" });
        }

        // 3. 🔥 KIỂM TRA THỜI GIAN HẾT HẠN 
        const currentTime = new Date();
        const expiresTime = new Date(user.reset_code_expires);

        if (currentTime > expiresTime) {
            return res.status(400).json({ message: "Mã xác nhận đã hết hạn! Vui lòng lấy mã mới." });
        }

        // 4. Nếu ngon lành -> Cho phép đổi mật khẩu
        // (Thường thì bước này trả về OK, Frontend sẽ chuyển sang màn hình nhập Pass mới)
        res.json({ message: "Xác minh thành công! Mời bạn nhập mật khẩu mới." });

    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi server");
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

app.get('/api/courts', async (req, res) => {
    try {
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

// 🔥 ĐÃ FIX LỖI CRASH KHI LOCATION NULL + SỬA LẠI LOGIC LẤY THÔNG TIN
app.get('/api/courts/nearby', async (req, res) => {
    try {
        const { lat, lng, distance } = req.query;
        if (!lat || !lng) return res.status(400).json({ error: "Thiếu tọa độ GPS" });
        const radius = distance || 5000; 

        const query = `
            WITH 
            CourtStats AS (SELECT facility_id, MIN(price_per_hour) as min_price, COUNT(id) as total_courts, array_agg(DISTINCT type) as sports FROM courts GROUP BY facility_id),
            ReviewStats AS (SELECT c.facility_id, AVG(r.rating) as avg_rating, COUNT(r.id) as review_count FROM reviews r JOIN courts c ON r.court_id = c.id GROUP BY c.facility_id)
            SELECT 
                f.id, f.name, f.address, f.image_url, f.open_time, f.close_time, f.owner_id, 
                
                -- 🔥 ĐÃ FIX LỖI COALESCE: Lấy trực tiếp từ bảng, nếu null mới lấy của User
                COALESCE(NULLIF(TRIM(f.owner_name), ''), u.full_name, 'Chủ sân') as owner_name, 
                u.avatar_url as owner_avatar,
                COALESCE(NULLIF(TRIM(f.phone_number), ''), u.phone_number) as phone_number,
                COALESCE(NULLIF(TRIM(f.facebook_url), ''), u.facebook_url) as facebook_url,
                COALESCE(NULLIF(TRIM(f.zalo_url), ''), u.zalo_url) as zalo_url,
                f.amenities,

                COALESCE(f.lng, CASE WHEN f.location IS NOT NULL THEN ST_X(f.location::geometry) ELSE 106.7009 END) as lng, 
                COALESCE(f.lat, CASE WHEN f.location IS NOT NULL THEN ST_Y(f.location::geometry) ELSE 10.7769 END) as lat,
                
                COALESCE(cs.min_price, 0) as min_price, COALESCE(cs.total_courts, 0) as total_courts, COALESCE(cs.sports, '{}') as sports,
                COALESCE(rs.avg_rating, 5) as avg_rating, COALESCE(rs.review_count, 0) as review_count,
                ST_Distance(f.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as dist_meters
            FROM facilities f
            LEFT JOIN users u ON f.owner_id = u.id
            LEFT JOIN CourtStats cs ON f.id = cs.facility_id
            LEFT JOIN ReviewStats rs ON f.id = rs.facility_id
            
            WHERE f.status = 'active' AND f.location IS NOT NULL 
            AND ST_DWithin(f.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
            ORDER BY dist_meters ASC
        `;
        const result = await pool.query(query, [lng, lat, radius]);
        res.json(result.rows);
    } catch (err) { res.status(500).send("Server Error"); }
});

app.post('/api/courts', async (req, res) => {
    try {
        let { name, address, price, lat, lng, image_url, type, owner_id, amenities, images, open_time, close_time } = req.body;
        
        const priceNumber = parseFloat(price); 
        const latNumber = parseFloat(lat);
        const lngNumber = parseFloat(lng);
        const finalOpen = formatTime(open_time) || '06:00';
        const finalClose = formatTime(close_time) || '22:00';
        const finalImages = images && images.length > 0 ? images : [image_url];
        
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
        const { id } = req.params; 
        const { date, start, end } = req.query; 

        const courtsRes = await pool.query(
            "SELECT * FROM courts WHERE facility_id = $1 AND status = 'active'",
            [id]
        );

        if (courtsRes.rows.length === 0) {
            return res.json([]); 
        }

        const bookedRes = await pool.query(
            `SELECT court_id FROM bookings 
             WHERE booking_date = $1 
             AND booking_time = $2 
             AND status != 'cancelled'`,
            [date, start]
        );

        const bookedIds = bookedRes.rows.map(b => b.court_id);
        const availableCourts = courtsRes.rows.filter(c => !bookedIds.includes(c.id));

        res.json(availableCourts);

    } catch (err) {
        console.error("Lỗi API Check Sân:", err);
        res.status(500).send("Server Error");
    }
});


// 🔥 ĐÃ FIX: HÀM LẤY DANH SÁCH FACILITY CHO BẢN ĐỒ TỔNG ĐÃ THÊM ZALO FB
app.get('/api/facilities', async (req, res) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                f.*, 
                -- 🔥 ÉP TRẢ VỀ 0 NẾU LÀ NULL ĐỂ FRONTEND KHÔNG HIỂN THỊ SAI SAO VÀ VIEW
                COALESCE(f.avg_rating, 0) as avg_rating,
                COALESCE(f.view_count, 0) as view_count,
                COALESCE(f.booking_count, 0) as booking_count,
                
                -- 🔥 ĐÃ FIX LỖI COALESCE: Lấy trực tiếp từ bảng, nếu null mới lấy của User
                COALESCE(NULLIF(TRIM(f.owner_name), ''), u.full_name) as owner_name, 
                COALESCE(NULLIF(TRIM(f.phone_number), ''), u.phone_number) as owner_phone,
                COALESCE(NULLIF(TRIM(f.facebook_url), ''), u.facebook_url) as facebook_url,
                COALESCE(NULLIF(TRIM(f.zalo_url), ''), u.zalo_url) as zalo_url,
                
                COALESCE(f.lng, CASE WHEN f.location IS NOT NULL THEN ST_X(f.location::geometry) ELSE 106.7009 END) as lng,
                COALESCE(f.lat, CASE WHEN f.location IS NOT NULL THEN ST_Y(f.location::geometry) ELSE 10.7769 END) as lat
            FROM facilities f
            LEFT JOIN users u ON f.owner_id = u.id
            WHERE f.status = 'active'
            ORDER BY f.id DESC
        `;
        const result = await client.query(query);
        const facilities = result.rows.map(f => ({
            ...f, geometry: { coordinates: [f.lng, f.lat] } 
        }));
        res.json(facilities);
    } catch (err) {
        console.error("Lỗi lấy danh sách cơ sở:", err);
        res.status(500).json({ error: "Lỗi lấy danh sách cơ sở" });
    } finally {
        client.release();
    }
});

// =======================================================
// PART D: BOOKING & REVIEWS
// =======================================================

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

// API đặt sân thống báo qua chuông 
app.post('/api/bookings', async (req, res) => {
    try {
        const { user_id, court_id, booking_date, start_time, end_time, total_price } = req.body; //  Nhận end_time

        if (!user_id || !court_id || !booking_date || !start_time || !end_time) {
            return res.status(400).json({ message: "Thiếu thông tin đặt sân!" });
        }

        const now = new Date();
        const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
        const vnNow = new Date(vnTimeStr); 

        const [year, month, day] = booking_date.split('-');
        const [hour, minute] = start_time.split(':');
        const bookingDateTime = new Date(year, month - 1, day, hour, minute, 0);

        if (bookingDateTime < vnNow) {
            return res.status(400).json({ message: "Bạn spam à ? nhìn đồng hồ mà đặt!!" });
        }

        const courtCheck = await pool.query("SELECT status FROM courts WHERE id = $1", [court_id]);
        if (courtCheck.rows.length === 0) return res.status(404).json({ message: "Sân không tồn tại" });
        if (courtCheck.rows[0].status && courtCheck.rows[0].status !== 'active') {
            return res.status(400).json({ message: "Sân này đang bị khóa hoặc bảo trì!" });
        }

        //  KIỂM TRA TRÙNG GIỜ 
        const checkSlot = await pool.query(
            `SELECT id FROM bookings 
             WHERE court_id = $1 
             AND booking_date = $2 
             AND status != 'cancelled'
             AND booking_time < $4
             AND COALESCE(end_time, TO_CHAR(booking_time::time + INTERVAL '1 hour', 'HH24:MI')) > $3`,
            [court_id, booking_date, start_time, end_time]
        );

        if (checkSlot.rows.length > 0) {
            return res.status(409).json({ message: "Khung giờ này đã có người đặt rồi!" });
        }

        const ticketCode = generateTicketCode();
        
        // Lưu vé 
        const bookingRes = await pool.query(
            "INSERT INTO bookings (user_id, court_id, booking_date, booking_time, end_time, price, status, is_archived, ticket_code) VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', false, $7) RETURNING id",
            [
                parseInt(user_id), parseInt(court_id), booking_date, start_time, end_time,                   
                parseFloat(total_price) || 0, ticketCode
            ]
        );
        const newBookingId = bookingRes.rows[0].id;

        // BẮN THÔNG BÁO VÀO CHUÔNG CHO USER
        const formattedDate = new Date(booking_date).toLocaleDateString('vi-VN');
        await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES ($1, $2, $3, $4, $5)`,
            [
                user_id, "🎉 Đặt sân thành công!", 
                `Bạn đã đặt sân từ ${start_time} đến ${end_time} ngày ${formattedDate}. Bấm "Lưu vé (Dạng Ảnh)" để tải lại thông tin.`, 
                'booking_success', newBookingId 
            ]
        );

        // Bắn thông báo cho chủ sân
        const ownerRes = await pool.query("SELECT owner_id, name FROM courts WHERE id = $1", [court_id]);
        if (ownerRes.rows.length > 0) {
            const vendorId = ownerRes.rows[0].owner_id;
            const courtName = ownerRes.rows[0].name;
            await pool.query(
                `INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES ($1, $2, $3, $4, $5)`,
                [
                    vendorId, "💰 Khách mới đặt sân!", 
                    `Có đơn đặt sân "${courtName}" từ ${start_time} - ${end_time} ngày ${formattedDate}. Doanh thu: ${total_price}đ. Vui lòng kiểm tra Lịch Đặt!`, 
                    'new_booking', newBookingId 
                ]
            );
        }

        console.log(" Đặt thành công và đã gửi thông báo!");
        res.json({ message: "Booking successful!" });

    } catch (err) { 
        console.error(" Lỗi Đặt Sân:", err);
        res.status(500).json({ message: "Server Error: " + err.message }); 
    }
});
// Kểm tra trùng dữ liệu
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

app.get('/api/bookings/my-tickets', async (req, res) => {
    try {
        const { user_id } = req.query;
        const result = await pool.query(`
            SELECT b.id,b.ticket_code, c.name as court_name, b.booking_date, b.booking_time, b.price, b.status 
            FROM bookings b 
            JOIN courts c ON b.court_id = c.id 
            WHERE b.user_id = $1 AND (b.is_archived = false OR b.is_archived IS NULL)
            ORDER BY b.booking_date DESC, b.booking_time DESC
        `, [user_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).send("Server Error"); }
});

app.get('/api/vendor/bookings', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.id,b.ticket_code, b.booking_date, b.booking_time, b.price, b.status, b.is_archived,
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

app.put('/api/bookings/:id/checkin', async (req, res) => {
    await pool.query("UPDATE bookings SET status = 'completed' WHERE id = $1", [req.params.id]);
    res.json({ message: "Check-in successful!" });
});

app.put('/api/bookings/:id/cancel', async (req, res) => {
    await pool.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [req.params.id]);
    res.json({ message: "Booking cancelled!" });
});

app.delete('/api/bookings/:id', async (req, res) => {
    try {
        await pool.query("UPDATE bookings SET is_archived = true WHERE id = $1", [req.params.id]);
        res.json({ message: "Booking moved to history!" });
    } catch (e) { res.status(500).send(e.message); }
});

//  Logic xóa vé đã or không check-in của chủ sân
app.delete('/api/vendor/bookings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { owner_id } = req.body; 

        // Kiểm tra quyền trạng thái chủ sân
        const checkQuery = `
            SELECT b.id, b.status 
            FROM bookings b 
            JOIN courts c ON b.court_id = c.id 
            WHERE b.id = $1 AND c.owner_id = $2
        `;
        
        const checkResult = await pool.query(checkQuery, [id, owner_id]);
        
        if (checkResult.rows.length === 0) {
            return res.status(403).json({ error: "Bạn không có quyền xóa vé này (hoặc vé không tồn tại)!" });
        }

        const bookingStatus = checkResult.rows[0].status;

        // Phân loại logic xóa vé của chủ sân
        if (bookingStatus === 'completed') {
            //  Nếu đã check-in xóa thì vé tạm ẩn phía database vẫn lưu
            await pool.query("UPDATE bookings SET is_archived = true WHERE id = $1", [id]);
            res.json({ message: "Đã ẩn vé cho gọn! (Doanh thu và số đơn vẫn được giữ lại)" });
        } else {
            //  Nếu chưa check-in thì xóa vĩnh viễn 
            await pool.query("DELETE FROM bookings WHERE id = $1", [id]);
            res.json({ message: "Đã xóa vĩnh viễn vé rác khỏi hệ thống!" });
        }

    } catch (e) {
        console.error("Lỗi xóa vé vendor:", e);
        res.status(500).send("Lỗi Server: " + e.message);
    }
});

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

// =======================================================
// 🔥 HỆ THỐNG ĐÁNH GIÁ (REVIEW) - CÓ ẢNH & TÍNH SAO TỰ ĐỘNG
// =======================================================


// =======================================================
// 🔥 HỆ THỐNG ĐÁNH GIÁ (FIX LỖI TÀNG HÌNH BÌNH LUẬN)
// =======================================================

// Hàm tính toán và cập nhật lại sao trung bình (Lấy thẳng từ facility_id)
const updateFacilityRating = async (facility_id) => {
    try {
        const result = await pool.query(`
            SELECT AVG(rating) as avg_rating 
            FROM reviews 
            WHERE facility_id = $1 AND status = 'active' -- 🔥 CHỐT 1: CHỈ TÍNH SAO NHỮNG ĐÁNH GIÁ CÒN HIỂN THỊ
        `, [facility_id]);
        
        const avg = result.rows[0].avg_rating ? parseFloat(result.rows[0].avg_rating).toFixed(1) : 5.0;
        await pool.query('UPDATE facilities SET avg_rating = $1 WHERE id = $2', [avg, facility_id]);
    } catch (err) { console.error("❌ Lỗi tính sao:", err.message); }
};

const reviewUpload = upload.single('image');

// 1. LẤY DANH SÁCH REVIEW (CHO USER XEM CHI TIẾT SÂN)
app.get('/api/reviews/facility/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT r.*, u.full_name, COALESCE(u.avatar_url, '') as avatar_url 
             FROM reviews r 
             JOIN users u ON r.user_id = u.id 
             WHERE r.facility_id = $1 AND r.status = 'active' 
             ORDER BY r.created_at DESC`, 
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) { 
        console.error("❌ Lỗi GET reviews:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

// API Lấy review theo court_id (Nếu bác có dùng)
app.get('/api/reviews/:court_id', async (req, res) => {
    try {
        const query = `
            SELECT r.*, u.full_name, u.username ,u.avatar_url
            FROM reviews r 
            JOIN users u ON r.user_id = u.id 
            WHERE r.court_id = $1 AND r.status = 'active' -- 🔥 CHỐT 3: CHẶN Ở ĐÂY NỮA
            ORDER BY r.created_at DESC
        `;
        const result = await pool.query(query, [req.params.court_id]);
        res.json(result.rows);
    } catch (e) { res.status(500).send(e.message); }
});

// 2. TẠO MỚI REVIEW (Đã nhét facility_id vào lệnh INSERT)
app.post('/api/reviews', reviewUpload, async (req, res) => {
    try {
        const { facility_id, court_id, user_id, rating, comment } = req.body;
        const imageUrl = req.file ? req.file.path.replace(/\\/g, '/') : null;

        await pool.query(
            `INSERT INTO reviews (facility_id, court_id, user_id, rating, comment, image_url) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [facility_id, court_id || null, user_id, rating, comment, imageUrl]
        );
        
        await updateFacilityRating(facility_id); 
        res.json({ success: true });
    } catch (err) { 
        console.error("❌ Lỗi POST review:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

// 3. CẬP NHẬT REVIEW
app.put('/api/reviews/:id', reviewUpload, async (req, res) => {
    try {
        const { rating, comment, facility_id, keep_old_image } = req.body;
        const reviewId = req.params.id;
        
        let query = 'UPDATE reviews SET rating = $1, comment = $2';
        let values = [rating, comment];
        let valIndex = 3;

        if (req.file) {
            query += `, image_url = $${valIndex}`;
            values.push(req.file.path.replace(/\\/g, '/'));
            valIndex++;
        } else if (keep_old_image === 'false') {
            query += `, image_url = NULL`;
        }
        
        query += ` WHERE id = $${valIndex}`;
        values.push(reviewId);

        await pool.query(query, values);
        await updateFacilityRating(facility_id); 
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. XÓA REVIEW
app.delete('/api/reviews/:id', async (req, res) => {
    try {
        const reviewId = req.params.id;
        const { facility_id, user_id } = req.body;
        
        const deleteRes = await pool.query('DELETE FROM reviews WHERE id = $1 AND user_id = $2 RETURNING id', [reviewId, user_id]);
        if (deleteRes.rowCount === 0) return res.status(403).json({ error: "Không có quyền xóa!" });

        await updateFacilityRating(facility_id); 
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// =======================================================
// 🔥 API LẤY TOP 5 CƠ SỞ GỢI Ý (THUẬT TOÁN THƯƠNG MẠI)
// =======================================================
app.get('/api/facilities/top-suggestions', async (req, res) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                f.*, 
                
                -- 🔥 Đổi tên thành current_rating để không bị trùng với cột avg_rating có sẵn của f.*
                COALESCE(r.real_rating, 0) as current_rating,
                
                (COALESCE(r.real_rating, 0) * 20 + 
                 COALESCE(f.booking_count, 0) * 5 + 
                 COALESCE(f.contact_count, 0) * 3 + 
                 COALESCE(f.view_count, 0) * 1) as hot_score,
                
                COALESCE(NULLIF(TRIM(f.owner_name), ''), u.full_name) as owner_name, 
                COALESCE(NULLIF(TRIM(f.phone_number), ''), u.phone_number) as phone_number,
                COALESCE(NULLIF(TRIM(f.facebook_url), ''), u.facebook_url) as facebook_url,
                COALESCE(NULLIF(TRIM(f.zalo_url), ''), u.zalo_url) as zalo_url,
                u.avatar_url as owner_avatar,
                
                COALESCE(f.lng, CASE WHEN f.location IS NOT NULL THEN ST_X(f.location::geometry) ELSE 106.7009 END) as lng,
                COALESCE(f.lat, CASE WHEN f.location IS NOT NULL THEN ST_Y(f.location::geometry) ELSE 10.7769 END) as lat
            FROM facilities f
            LEFT JOIN users u ON f.owner_id = u.id
            
            -- Lấy sao thật từ bảng reviews
            LEFT JOIN (
                SELECT facility_id, ROUND(AVG(rating)::numeric, 1) as real_rating
                FROM reviews
                GROUP BY facility_id
            ) r ON f.id = r.facility_id
            
            WHERE f.status = 'active'
            ORDER BY hot_score DESC, current_rating DESC
            LIMIT 5
        `;
        const result = await client.query(query);
        
        // 🔥 ÉP LẠI TÊN avg_rating TRONG JAVASCRIPT ĐỂ FRONTEND KHÔNG BỊ LỖI
        const facilities = result.rows.map(f => ({
            ...f, 
            avg_rating: f.current_rating, // Tráo điểm thật đè lên điểm ảo
            geometry: { coordinates: [f.lng, f.lat] } 
        }));
        
        res.json(facilities);
    } catch (err) {
        console.error("❌ Lỗi lấy Top gợi ý:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});
// API: Đếm lượt click Gọi điện / Zalo
app.post('/api/facilities/:id/contact', async (req, res) => {
    try {
        await pool.query('UPDATE facilities SET contact_count = COALESCE(contact_count, 0) + 1 WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API phụ: Tăng lượt xem mỗi khi User bấm vào xem chi tiết cơ sở
app.post('/api/facilities/:id/view', async (req, res) => {
    try {
        await pool.query('UPDATE facilities SET view_count = view_count + 1 WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// =======================================================
// PART E: SUPER ADMIN & SYSTEM CONFIG
// =======================================================

app.get('/api/admin/users', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM users 
            WHERE role != 'super_admin' 
            ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// --- 3. ADMIN DUYỆT / KHÓA TÀI KHOẢN (CÓ GỬI EMAIL CHÀO MỪNG ĐỐI TÁC) ---
app.put('/api/admin/users/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const { id } = req.params;

        await pool.query("UPDATE users SET status = $1 WHERE id = $2", [status, id]);

        const infoQuery = `SELECT email, full_name, role FROM users WHERE id = $1`;
        const infoRes = await pool.query(infoQuery, [id]);

        if (infoRes.rows.length > 0) {
            const info = infoRes.rows[0];

            if (info.role === 'vendor' && info.email) {
                const websiteName = "SportFinder";
                const logoUrl = "https://duykiet04.github.io/anh/logo.jpg";
                
                let subject = "";
                let emailTemplate = "";

                if (status === 'active') {
                    subject = `🎉 Chúc mừng! Hồ sơ đối tác đã được duyệt - ${websiteName}`;
                    emailTemplate = `
                        <div style="font-family: Arial, sans-serif; background-color: #f0f7f4; padding: 40px 0;">
                            <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 12px; border-top: 6px solid #38a169; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
                                <div style="text-align: center; margin-bottom: 30px;">
                                    <img src="${logoUrl}" alt="Logo" style="height: 70px; object-fit: contain;">
                                    <h2 style="color: #276749; margin-top: 20px;">CHÀO MỪNG ĐỐI TÁC MỚI</h2>
                                </div>
                                <p style="color: #4a5568; font-size: 16px;">Xin chào <b>${info.full_name}</b>,</p>
                                <p style="color: #4a5568; font-size: 16px;">Tài khoản <strong>Chủ Sân</strong> của bạn đã chính thức được <b>kích hoạt</b>.</p>
                                <div style="text-align: center; margin: 40px 0;">
                                    <a href="http://localhost:5173/login" style="background-color: #3182ce; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Đăng nhập Trang Quản Trị</a>
                                </div>
                                <hr style="border: none; border-top: 1px dashed #cbd5e0; margin: 40px 0 20px 0;">
                                <p style="text-align: center; color: #a0aec0; font-size: 13px;">© ${new Date().getFullYear()} ${websiteName}.</p>
                            </div>
                        </div>
                    `;
                } else if (status === 'rejected' || status === 'blocked') {
                    subject = `⚠️ Thông báo tài khoản - ${websiteName}`;
                    emailTemplate = `<p>Tài khoản Đối tác của bạn hiện đang ở trạng thái <b>TỪ CHỐI / TẠM KHÓA</b>. Vui lòng liên hệ ZALO ADMIN.</p>`;
                }

                if (subject) {
                    transporter.sendMail({
                        from: `"${websiteName} Support" <${process.env.EMAIL_USER}>`,
                        to: info.email, subject: subject, html: emailTemplate
                    }).catch(err => console.error("Lỗi gửi mail User:", err));
                }
            }
        }
        res.json({ message: "Status updated!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// [SỬA CƠ SỞ] - Dành cho SuperAdmin
app.put('/api/admin/facilities/:id', upload.array('facility_images'), async (req, res) => {
    try {
        const facId = req.params.id;
        const { name, address, owner_name, phone_number, facebook_url, zalo_url, open_time, close_time, amenities, lat, lng } = req.body;

        // Nếu admin bỏ trống giờ, ta lưu null để tránh lỗi Database
        const openTimeVal = open_time ? open_time : null;
        const closeTimeVal = close_time ? close_time : null;

        let query = `UPDATE facilities SET
            name = $1, address = $2, owner_name = $3, phone_number = $4,
            facebook_url = $5, zalo_url = $6, open_time = $7, close_time = $8,
            amenities = $9, lat = $10, lng = $11 , location = ST_SetSRID(ST_MakePoint($11, $10), 4326)`;
            
        let values = [name, address, owner_name, phone_number, facebook_url, zalo_url, openTimeVal, closeTimeVal, amenities,parseFloat(lat), parseFloat(lng)];
        let valIndex = 12;

        if (req.files && req.files.length > 0) {
            const imageUrl = req.files[0].path.replace(/\\/g, '/');
            query += `, image_url = $${valIndex}`;
            values.push(imageUrl);
            valIndex++;
        }

        query += ` WHERE id = $${valIndex}`;
        values.push(facId);

        await pool.query(query, values);
        res.json({ message: "Cập nhật cơ sở thành công!" });
    } catch (err) {
        console.error("Lỗi cập nhật cơ sở:", err);
        res.status(500).json({ error: err.message });
    }
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
    const { website_name ,admin_zalo } = req.body;
    if(website_name) {
        await pool.query("INSERT INTO system_config (config_key, config_value) VALUES ('website_name', $1) ON CONFLICT (config_key) DO UPDATE SET config_value = $1", [website_name]);
    }
    if(admin_zalo) {
        await pool.query("INSERT INTO system_config (config_key, config_value) VALUES ('admin_zalo', $1) ON CONFLICT (config_key) DO UPDATE SET config_value = $1", [admin_zalo]);
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

// ==========================================
// 🔥 XÓA USER (DỌN SẠCH TẬN GỐC - BẢN FINAL CHUẨN DB)
// ==========================================
app.delete('/api/admin/users/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        await client.query('BEGIN'); // Bắt đầu chuỗi hành động xóa

        // 1. Dọn dẹp dữ liệu râu ria liên kết trực tiếp với User
        await client.query('DELETE FROM notifications WHERE user_id = $1', [id]);
        await client.query('DELETE FROM user_favorites WHERE user_id = $1', [id]);
        await client.query('DELETE FROM reviews WHERE user_id = $1', [id]);
        await client.query('DELETE FROM bookings WHERE user_id = $1', [id]);

        // 2. Dọn dẹp Kèo đấu (Matches & Match Participants)
        // a. Xóa user này khỏi các kèo mà họ đi đá ké
        await client.query('DELETE FROM match_participants WHERE user_id = $1', [id]);
        
        // b. Xóa tất cả người chơi khác đang tham gia cái Kèo do user này TẠO (dùng user_id)
        await client.query('DELETE FROM match_participants WHERE match_id IN (SELECT id FROM matches WHERE user_id = $1)', [id]);
        
        // c. Cuối cùng mới xóa Kèo do user này TẠO (dùng user_id)
        await client.query('DELETE FROM matches WHERE user_id = $1', [id]);

        // 3. Dọn dẹp NẾU USER NÀY LÀ CHỦ SÂN (VENDOR)
        const facRes = await client.query('SELECT id FROM facilities WHERE owner_id = $1', [id]);
        if (facRes.rows.length > 0) {
            const facIds = facRes.rows.map(f => f.id);
            
            // a. Xóa toàn bộ Đánh giá (Reviews) của cơ sở này
            await client.query('DELETE FROM reviews WHERE facility_id = ANY($1::int[])', [facIds]);
            
            // b. Xóa toàn bộ Booking của các sân con thuộc cơ sở này
            await client.query('DELETE FROM bookings WHERE court_id IN (SELECT id FROM courts WHERE facility_id = ANY($1::int[]))', [facIds]);
            
            // c. Xóa Sân con (Courts)
            await client.query('DELETE FROM courts WHERE facility_id = ANY($1::int[])', [facIds]);
            
            // d. Cuối cùng xóa Cơ sở (Facilities)
            await client.query('DELETE FROM facilities WHERE owner_id = $1', [id]);
        }

        // 4. CHỐT HẠ: Trảm User
        await client.query('DELETE FROM users WHERE id = $1', [id]);

        await client.query('COMMIT'); // Xác nhận toàn bộ thành công
        res.json({ message: 'Đã xóa vĩnh viễn User và toàn bộ dữ liệu liên quan!' });
        
    } catch (err) {
        await client.query('ROLLBACK'); // Có lỗi là Hoàn tác lại ngay để cứu Database
        console.error("❌ Lỗi xóa User chi tiết:", err.message); 
        res.status(500).json({ error: 'Lỗi server khi xóa User: ' + err.message });
    } finally {
        client.release();
    }
});

app.get('/api/admin/all-courts', async (req, res) => {
    try {
        const query = `
            SELECT c.*, 
                   f.name as facility_name, 
                   u.full_name as owner_name,
                   ST_X(c.location::geometry) as lng, 
                   ST_Y(c.location::geometry) as lat
            FROM courts c
            JOIN facilities f ON c.facility_id = f.id  
            LEFT JOIN users u ON c.owner_id = u.id
            WHERE f.status = 'active' 
            ORDER BY c.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi API Admin Courts:", err);
        res.status(500).send("Server Error");
    }
});

app.get('/api/superadmin/dashboard-stats', async (req, res) => {
    try {
        const userQuery = `
            SELECT 
                COUNT(*) FILTER (WHERE TRIM(LOWER(role)) = 'user') as user_count,
                COUNT(*) FILTER (WHERE TRIM(LOWER(role)) = 'vendor') as vendor_count
            FROM users;
        `;
        const userRes = await pool.query(userQuery);
        const usersCount = parseInt(userRes.rows[0].user_count || 0);
        const vendorsCount = parseInt(userRes.rows[0].vendor_count || 0);

        const courtRes = await pool.query("SELECT COUNT(*) as count FROM courts");
        const courtsCount = parseInt(courtRes.rows[0].count || 0);

        const bookingRes = await pool.query("SELECT COUNT(*) as count FROM bookings");
        const bookingsCount = parseInt(bookingRes.rows[0].count || 0);

        const gmvRes = await pool.query(`
            SELECT COALESCE(SUM(c.price_per_hour), 0)::bigint as total 
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
        `);
        const revenue = parseInt(gmvRes.rows[0].total || 0);

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

app.get('/api/superadmin/stats/courts-by-ward', async (req, res) => {
    try {
        const query = `
            SELECT 
                w.name as ward_name, 
                w.district_name, 
                COUNT(f.id)::int as total_courts
            FROM administrative_units w
            LEFT JOIN facilities f ON ST_Contains(w.geom, f.location::geometry) AND f.status = 'active'
            WHERE w.name != 'Không tên'
            GROUP BY w.id, w.name, w.district_name
            HAVING COUNT(f.id) > 0 
            ORDER BY total_courts DESC
             
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Court By Ward Error:", err);
        res.status(500).send("Lỗi server: " + err.message);
    }
});

// =======================================================
// 🔥 CỤM LẤY SÂN SEARCH, BÁN KÍNH VÀ CHI TIẾT (ĐÃ FIX JOIN MÔN VÀ ƯU TIÊN ADMIN NHẬP)
// =======================================================

// 🔥 3. API TÌM KIẾM CƠ SỞ (ĐÃ FIX ƯU TIÊN THÔNG TIN ADMIN NHẬP VÀ TRIM CHUỖI RỖNG)
app.get('/api/user/facilities-search', async (req, res) => {
    try {
        const { user_id } = req.query; // 🔥 Nhận thêm user_id từ Frontend gửi lên

        // Khởi tạo câu query cơ bản
        let query = `
            WITH 
            CourtStats AS (SELECT facility_id, MIN(price_per_hour) as min_price, COUNT(id) as total_courts, array_agg(DISTINCT type) as sports FROM courts GROUP BY facility_id),
            ReviewStats AS (SELECT c.facility_id, AVG(r.rating) as avg_rating, COUNT(r.id) as review_count FROM reviews r JOIN courts c ON r.court_id = c.id GROUP BY c.facility_id),
            -- 🔥 MỚI: Đếm tổng lượt đặt toàn hệ thống (Sân nổi bật)
            GlobalBookings AS (SELECT c.facility_id, COUNT(b.id) as global_count FROM bookings b JOIN courts c ON b.court_id = c.id GROUP BY c.facility_id)
        `;

        // 🔥 MỚI: Nếu có user_id, tính thêm số lần user này đặt sân (Sân ưa thích cá nhân)
        if (user_id) {
            query += `, MyBookings AS (SELECT c.facility_id, COUNT(b.id) as my_count FROM bookings b JOIN courts c ON b.court_id = c.id WHERE b.user_id = $1 GROUP BY c.facility_id) `;
        }

        query += `
            SELECT 
                f.id, f.name, f.address, f.image_url, f.open_time, f.close_time, f.owner_id, 
                
                COALESCE(NULLIF(TRIM(f.owner_name), ''), u.full_name, 'Chủ sân') as owner_name, 
                u.avatar_url as owner_avatar,u.role as owner_role ,
                COALESCE(NULLIF(TRIM(f.phone_number), ''), u.phone_number) as phone_number,
                COALESCE(NULLIF(TRIM(f.facebook_url), ''), u.facebook_url) as facebook_url,
                COALESCE(NULLIF(TRIM(f.zalo_url), ''), u.zalo_url) as zalo_url,
                f.amenities, 

                COALESCE(f.lng, CASE WHEN f.location IS NOT NULL THEN ST_X(f.location::geometry) ELSE 106.7009 END) as lng, 
                COALESCE(f.lat, CASE WHEN f.location IS NOT NULL THEN ST_Y(f.location::geometry) ELSE 10.7769 END) as lat,
                
                COALESCE(cs.min_price, 0) as min_price, COALESCE(cs.total_courts, 0) as total_courts, COALESCE(cs.sports, '{}') as sports,
                COALESCE(rs.avg_rating, 5) as avg_rating, COALESCE(rs.review_count, 0) as review_count,
                
                -- Lấy thêm số liệu thống kê
                COALESCE(gb.global_count, 0) as global_booking_count
        `;

        // Nếu có user, lấy thêm cột my_count
        if (user_id) query += `, COALESCE(mb.my_count, 0) as my_booking_count `;

        query += `
            FROM facilities f
            LEFT JOIN users u ON f.owner_id = u.id
            LEFT JOIN CourtStats cs ON f.id = cs.facility_id
            LEFT JOIN ReviewStats rs ON f.id = rs.facility_id
            LEFT JOIN GlobalBookings gb ON f.id = gb.facility_id
        `;

        // Join bảng cá nhân hóa nếu có user
        if (user_id) query += ` LEFT JOIN MyBookings mb ON f.id = mb.facility_id `;

        query += ` WHERE f.status = 'active' `;

        // 🔥 THUẬT TOÁN SẮP XẾP (RANKING SYSTEM)
        // Ưu tiên 1: Sân mình đặt nhiều nhất (my_count DESC)
        // Ưu tiên 2: Điểm đánh giá cao (avg_rating DESC)
        // Ưu tiên 3: Sân đông khách nhất (global_count DESC)
        if (user_id) {
            query += ` ORDER BY COALESCE(mb.my_count, 0) DESC, COALESCE(rs.avg_rating, 0) DESC, COALESCE(gb.global_count, 0) DESC`;
        } else {
            // Khách vãng lai: Chỉ xếp theo Rating và Độ Hot
            query += ` ORDER BY COALESCE(rs.avg_rating, 0) DESC, COALESCE(gb.global_count, 0) DESC`;
        }

        // Thực thi query (Nếu có user_id thì truyền tham số $1)
        const result = user_id ? await pool.query(query, [user_id]) : await pool.query(query);
        
        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi lấy danh sách sân:", err);
        res.status(500).json({ error: err.message });
    }
});

// API: Lấy danh sách ID sân yêu thích của User
app.get('/api/favorites/:userId', async (req, res) => {
    try {
        const result = await pool.query('SELECT facility_id FROM user_favorites WHERE user_id = $1', [req.params.userId]);
        res.json(result.rows.map(r => r.facility_id));
    } catch (err) { res.status(500).send(err.message); }
});

// API: Bật/Tắt Yêu Thích (Toggle)
app.post('/api/favorites', async (req, res) => {
    const { user_id, facility_id } = req.body;
    try {
        const check = await pool.query('SELECT * FROM user_favorites WHERE user_id = $1 AND facility_id = $2', [user_id, facility_id]);
        if (check.rows.length > 0) {
            await pool.query('DELETE FROM user_favorites WHERE user_id = $1 AND facility_id = $2', [user_id, facility_id]);
            res.json({ status: 'removed' });
        } else {
            await pool.query('INSERT INTO user_favorites (user_id, facility_id) VALUES ($1, $2)', [user_id, facility_id]);
            res.json({ status: 'added' });
        }
    } catch (err) { res.status(500).send(err.message); }
});

// API: Lấy chi tiết CỰC ĐẦY ĐỦ các sân Yêu Thích
app.get('/api/user/favorite-facilities/:userId', async (req, res) => {
    try {
        const query = `
            WITH 
            CourtStats AS (SELECT facility_id, MIN(price_per_hour) as min_price, COUNT(id) as total_courts, array_agg(DISTINCT type) as sports FROM courts GROUP BY facility_id),
            ReviewStats AS (SELECT c.facility_id, AVG(r.rating) as avg_rating, COUNT(r.id) as review_count FROM reviews r JOIN courts c ON r.court_id = c.id GROUP BY c.facility_id)
            
            SELECT 
                f.id, f.name, f.address, f.image_url, f.open_time, f.close_time, f.owner_id, 
                
                -- Lấy thông tin Chủ Sân, Liên hệ
                COALESCE(NULLIF(TRIM(f.owner_name), ''), u.full_name, 'Chủ sân') as owner_name, 
                u.avatar_url as owner_avatar,u.role as owner_role,
                COALESCE(NULLIF(TRIM(f.phone_number), ''), u.phone_number) as phone_number,
                COALESCE(NULLIF(TRIM(f.facebook_url), ''), u.facebook_url) as facebook_url,
                COALESCE(NULLIF(TRIM(f.zalo_url), ''), u.zalo_url) as zalo_url,
                f.amenities, 

                -- Lấy Tọa độ
                COALESCE(f.lng, CASE WHEN f.location IS NOT NULL THEN ST_X(f.location::geometry) ELSE 106.7009 END) as lng, 
                COALESCE(f.lat, CASE WHEN f.location IS NOT NULL THEN ST_Y(f.location::geometry) ELSE 10.7769 END) as lat,
                
                -- Lấy Thống kê Sân & Đánh giá
                COALESCE(cs.min_price, 0) as min_price, 
                COALESCE(cs.total_courts, 0) as total_courts, 
                COALESCE(cs.sports, '{}') as sports,
                COALESCE(rs.avg_rating, 5) as avg_rating, 
                COALESCE(rs.review_count, 0) as review_count
                
            FROM facilities f
            JOIN user_favorites uf ON f.id = uf.facility_id
            LEFT JOIN users u ON f.owner_id = u.id
            LEFT JOIN CourtStats cs ON f.id = cs.facility_id
            LEFT JOIN ReviewStats rs ON f.id = rs.facility_id
            WHERE uf.user_id = $1 AND f.status = 'active'
            ORDER BY uf.created_at DESC -- Sắp xếp: Sân nào mới tim thì nằm trên cùng
        `;
        const result = await pool.query(query, [req.params.userId]);
        res.json(result.rows);
    } catch (err) { 
        console.error("Lỗi lấy sân yêu thích:", err);
        res.status(500).send(err.message); 
    }
});
// 🔥 2. API LẤY DANH SÁCH SÂN CON (ĐÃ FIX LỖI ẨN SÂN)
app.get('/api/facilities/:id/courts-detail', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT c.*, 
                   COALESCE(c.type, s.name, 'Khác') as type
            FROM courts c
            LEFT JOIN sport_types s ON c.sport_type_id = s.id
            WHERE c.facility_id = $1 
            AND c.status = 'active'
            ORDER BY c.price_per_hour ASC
        `;
        const result = await pool.query(query, [id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================================================
// 🔥 API GEOJSON: TÌM KIẾM THEO PHƯỜNG XÃ
// =======================================================

app.get('/api/locations/wards', async (req, res) => {
    try {
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

app.get('/api/courts/by-ward/:wardId', async (req, res) => {
    try {
        const { wardId } = req.params;

        // 🔥 ĐÃ SỬA: Lấy danh sách CƠ SỞ (Facilities) thay vì lấy Sân con, kèm đếm Sân con bên trong
        const facilityQuery = `
            WITH 
            CourtStats AS (SELECT facility_id, MIN(price_per_hour) as min_price, COUNT(id) as total_courts, array_agg(DISTINCT type) as sports FROM courts GROUP BY facility_id),
            ReviewStats AS (SELECT c.facility_id, AVG(r.rating) as avg_rating, COUNT(r.id) as review_count FROM reviews r JOIN courts c ON r.court_id = c.id GROUP BY c.facility_id)
            SELECT 
                f.id, f.name, f.address, f.image_url, f.open_time, f.close_time, f.owner_id, 
                
                COALESCE(NULLIF(TRIM(f.owner_name), ''), u.full_name, 'Chủ sân') as owner_name, 
                u.avatar_url as owner_avatar,
                
                COALESCE(NULLIF(TRIM(f.phone_number), ''), u.phone_number) as phone_number,
                COALESCE(NULLIF(TRIM(f.facebook_url), ''), u.facebook_url) as facebook_url,
                COALESCE(NULLIF(TRIM(f.zalo_url), ''), u.zalo_url) as zalo_url,
                f.amenities, 

                COALESCE(f.lng, CASE WHEN f.location IS NOT NULL THEN ST_X(f.location::geometry) ELSE 106.7009 END) as lng, 
                COALESCE(f.lat, CASE WHEN f.location IS NOT NULL THEN ST_Y(f.location::geometry) ELSE 10.7769 END) as lat,
                
                COALESCE(cs.min_price, 0) as min_price, COALESCE(cs.total_courts, 0) as total_courts, COALESCE(cs.sports, '{}') as sports,
                COALESCE(rs.avg_rating, 5) as avg_rating, COALESCE(rs.review_count, 0) as review_count
            FROM facilities f
            JOIN administrative_units w ON w.id = $1 
            LEFT JOIN users u ON f.owner_id = u.id
            LEFT JOIN CourtStats cs ON f.id = cs.facility_id
            LEFT JOIN ReviewStats rs ON f.id = rs.facility_id
            WHERE f.status = 'active' AND f.location IS NOT NULL AND ST_Contains(w.geom, f.location::geometry)
        `;

        const boundsQuery = `
            SELECT 
                ST_AsGeoJSON(geom) as shape,               
                ST_AsGeoJSON(ST_Envelope(geom)) as bounds  
            FROM administrative_units 
            WHERE id = $1
        `;

        const [facilitiesResult, boundsResult] = await Promise.all([
            pool.query(facilityQuery, [wardId]),
            pool.query(boundsQuery, [wardId])
        ]);

        res.json({
            // Vẫn giữ key 'courts' để Frontend nhận diện được bình thường
            courts: facilitiesResult.rows, 
            shape: boundsResult.rows.length > 0 ? JSON.parse(boundsResult.rows[0].shape) : null,
            bounds: boundsResult.rows.length > 0 ? JSON.parse(boundsResult.rows[0].bounds) : null
        });

    } catch (err) { 
        console.error(err);
        res.status(500).send(err.message); 
    }
});
// =======================================================
// MATCHES
// =======================================================

app.get('/api/matches', async (req, res) => {
    try {
        const query = `
            SELECT 
                m.*, 
                f.name as court_name, 
                f.address as court_address, 
                f.image_url as court_image, 
                
                u.full_name as host_name, 
                u.avatar_url as host_avatar,
                u.phone_number as host_phone, 

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

app.post('/api/matches', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { user_id, court_id, title, match_time, level, price_note, max_players, lat, lng } = req.body;

        const checkSpam = await client.query(
            `SELECT id FROM matches 
             WHERE user_id = $1 AND created_at > NOW() - INTERVAL '5 minutes'`, 
            [user_id]
        );

        if (checkSpam.rows.length > 0) {
            return res.status(429).json({ error: 'Từ từ thôi! Đợi 5 phút nữa hãy tạo kèo mới.' });
        }

        await client.query('BEGIN'); 

        const insertMatchQuery = `
            INSERT INTO matches (user_id, court_id, title, match_time, level, price_note, max_players, lat, lng) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING id
        `;
        const resMatch = await client.query(insertMatchQuery, [
            user_id, parseInt(court_id), title, match_time, level, price_note, parseInt(max_players), lat, lng
        ]);
        const newMatchId = resMatch.rows[0].id;

        const insertParticipantQuery = `
            INSERT INTO match_participants (match_id, user_id) 
            VALUES ($1, $2)
        `;
        await client.query(insertParticipantQuery, [newMatchId, user_id]);

        await client.query('COMMIT'); 

        res.json({ success: true, message: "Tạo kèo thành công", id: newMatchId });

    } catch (err) {
        await client.query('ROLLBACK'); 
        console.error("Lỗi tạo kèo:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/matches/join', async (req, res) => {
    const { match_id, user_id } = req.body;
    try {
        // Kiểm tra thời gian kèo
        const matchInfo = await pool.query('SELECT match_time, status FROM matches WHERE id = $1', [match_id]);
        if (matchInfo.rows.length === 0) return res.status(404).json({ message: 'Kèo không tồn tại!' });
        
        if (matchInfo.rows[0].status === 'locked') return res.status(400).json({ message: 'Kèo này đã bị chủ phòng khóa!' });
        
        if (new Date(matchInfo.rows[0].match_time) < new Date()) {
            return res.status(400).json({ message: 'Kèo này đã quá thời gian thi đấu (Hết hạn)!' });
        }

        const check = await pool.query('SELECT * FROM match_participants WHERE match_id = $1 AND user_id = $2', [match_id, user_id]);
        if (check.rows.length > 0) {
            return res.status(400).json({ message: 'Bạn đã tham gia kèo này rồi!' });
        }

        await pool.query('INSERT INTO match_participants (match_id, user_id) VALUES ($1, $2)', [match_id, user_id]);
        res.json({ success: true, message: 'Tham gia thành công' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/matches/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { user_id, court_id, title, match_time, level, price_note, max_players, lat, lng } = req.body;

        const checkHost = await client.query('SELECT user_id, status FROM matches WHERE id = $1', [id]);
        if (checkHost.rows.length === 0) return res.status(404).json({ error: "Kèo không tồn tại" });
        if (parseInt(checkHost.rows[0].user_id) !== parseInt(user_id)) {
            return res.status(403).json({ error: "Bạn không phải chủ kèo, không được sửa!" });
        }
        if (checkHost.rows[0].status === 'locked') {
            return res.status(400).json({ error: "Kèo đã bị khóa, không thể sửa!" });
        }

        const updateQuery = `
            UPDATE matches 
            SET court_id = $1, title = $2, match_time = $3, level = $4, price_note = $5, max_players = $6, lat = $7, lng = $8 
            WHERE id = $9 AND user_id = $10
        `;
        await client.query(updateQuery, [court_id, title, match_time, level, price_note, max_players, lat, lng, id, user_id]);
        
        res.json({ success: true, message: "Cập nhật kèo thành công!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

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

app.delete('/api/matches/:id', async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body; 

    try {
        const check = await pool.query('SELECT user_id FROM matches WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: "Kèo không tồn tại" });
        
        if (parseInt(check.rows[0].user_id) !== parseInt(user_id)) {
            return res.status(403).json({ error: "Mày đéo phải chủ kèo, xóa cái lồn!" });
        }

        await pool.query('DELETE FROM match_participants WHERE match_id = $1', [id]);
        await pool.query('DELETE FROM matches WHERE id = $1', [id]);

        res.json({ success: true, message: "Đã xóa kèo!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/matches/:match_id/kick/:user_to_kick', async (req, res) => {
    const { match_id, user_to_kick } = req.params;
    const { host_id } = req.body; 

    try {
        const checkHost = await pool.query('SELECT user_id FROM matches WHERE id = $1', [match_id]);
        if (checkHost.rows.length === 0 || parseInt(checkHost.rows[0].user_id) !== parseInt(host_id)) {
            return res.status(403).json({ error: "Mày không phải chủ phòng!" });
        }

        await pool.query('DELETE FROM match_participants WHERE match_id = $1 AND user_id = $2', [match_id, user_to_kick]);
        
        res.json({ success: true, message: "Đã đuổi cổ thành công!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/matches/:id/lock', async (req, res) => {
    const { id } = req.params;
    const { user_id, status } = req.body; 

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
//  CÁC API MỚI DÀNH CHO QUẢN LÝ FACILITY CỦA VENDOR
// ==========================================

app.get('/api/vendor/facilities', async (req, res) => {
    const { vendor_id } = req.query;
    try {
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

app.post('/api/facilities', async (req, res) => {
    const { owner_id, name, address, lat, lng, open_time, close_time, image_url } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: "Thiếu tọa độ (lat, lng)" });

    try {
        const query = `
            INSERT INTO facilities (
                owner_id, name, address, lat, lng, location, open_time, close_time, image_url, status
            ) 
            VALUES (
                $1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($5, $4), 4326), $6, $7, $8, 'pending' 
            ) 
            RETURNING id
        `;
        
        // 🔥 ĐÃ ĐỔI LẠI ĐÚNG THỨ TỰ: $4 là LAT, $5 là LNG. 
        // Trong ST_MakePoint($5, $4) thì nó sẽ tự hiểu là Lng trước, Lat sau theo chuẩn PostGIS.
        const result = await pool.query(query, [
            owner_id, name, address, parseFloat(lat), parseFloat(lng), open_time, close_time, image_url
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
        images_normal, images_vip 
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const facRes = await client.query(`SELECT owner_id, address, ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat FROM facilities WHERE id = $1`, [id]);
        if (facRes.rows.length === 0) throw new Error(`Không tìm thấy Facility ID ${id}`);
        const { owner_id, address, lat, lng } = facRes.rows[0];
        
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
            ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', ST_SetSRID(ST_MakePoint($7, $8), 4326), $9, $10, $11)
        `;

        for (let i = 1; i <= normalCount; i++) {
            await client.query(insertQuery, [
                parseInt(id), parseInt(owner_id), `${sport_type} Sân ${i}`, sport_type,
                parseInt(price_normal) || 0, strNormal, 
                parseFloat(lng), parseFloat(lat), address, 
                mainImgNormal, imgsNormal 
            ]);
        }

        for (let i = 1; i <= v_count; i++) {
            await client.query(insertQuery, [
                parseInt(id), parseInt(owner_id), `${sport_type} VIP ${i}`, sport_type,
                parseInt(price_vip) || 0, strVIP,
                parseFloat(lng), parseFloat(lat), address, 
                mainImgVIP, imgsVIP 
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

// ==========================================
// 🔥 LẤY CHI TIẾT 1 MÔN ĐỂ SỬA (FIX LỖI 404)
// ==========================================
app.get('/api/facilities/:id/sports/:sport_type', async (req, res) => {
    try {
        const facilityId = req.params.id;
        // Bắt chính xác tên môn, có dấu cũng được vì đã decode
        const sportType = decodeURIComponent(req.params.sport_type); 

        const courtsResult = await pool.query(
            `SELECT * FROM courts 
             WHERE facility_id = $1 
             AND type = $2`, 
            [facilityId, sportType]
        );

        if (courtsResult.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy dữ liệu môn này" });
        }

        const courts = courtsResult.rows;

        const normalCourts = courts.filter(c => !c.name.toLowerCase().includes('vip'));
        const vipCourts = courts.filter(c => c.name.toLowerCase().includes('vip'));

        const sampleNormal = normalCourts[0] || {};
        const sampleVip = vipCourts[0] || {};

        const sportConfig = {
            sport_type: sportType,
            normal_count: normalCourts.length,
            vip_count: vipCourts.length,
            price_normal: sampleNormal.price_per_hour || 0,
            price_vip: sampleVip.price_per_hour || 0,
            amenities_normal: sampleNormal.amenities || [],
            amenities_vip: sampleVip.amenities || [],
            images_normal: sampleNormal.images || [],
            images_vip: sampleVip.images || []
        };

        res.json(sportConfig);
    } catch (err) {
        console.error("Lỗi lấy chi tiết môn:", err);
        res.status(500).json({ error: "Lỗi server" });
    }
});

// ==========================================
// 🔥 XÓA TOÀN BỘ MÔN THỂ THAO CỦA CƠ SỞ
// ==========================================
app.delete('/api/facilities/:id/sports/:sport_type', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id, sport_type } = req.params;
        const decodedSport = decodeURIComponent(sport_type);

        await client.query('BEGIN');

        // 1. Tìm tất cả các ID sân thuộc môn này
        const courtsRes = await client.query(
            'SELECT id FROM courts WHERE facility_id = $1 AND type = $2', 
            [id, decodedSport]
        );
        const courtIds = courtsRes.rows.map(c => c.id);

        if (courtIds.length > 0) {
            // 2. Xóa các vé và đánh giá liên quan đến các sân này để tránh lỗi khóa ngoại (Foreign Key)
            await client.query('DELETE FROM bookings WHERE court_id = ANY($1::int[])', [courtIds]);
            await client.query('DELETE FROM reviews WHERE court_id = ANY($1::int[])', [courtIds]);
            
            // 3. Xóa sân vật lý
            await client.query('DELETE FROM courts WHERE facility_id = $1 AND type = $2', [id, decodedSport]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Đã xóa toàn bộ sân của môn này!" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Lỗi xóa môn:", err);
        res.status(500).json({ error: "Lỗi server khi xóa môn" });
    } finally {
        client.release();
    }
});
// --- 2. ADMIN XÓA CƠ SỞ (CÓ GỬI EMAIL) ---
app.delete('/api/facilities/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect(); 
    try {
        await client.query('BEGIN');

        const infoQuery = `
            SELECT f.name as facility_name, u.email, u.full_name
            FROM facilities f
            LEFT JOIN users u ON f.owner_id = u.id
            WHERE f.id = $1
        `;
        const infoRes = await client.query(infoQuery, [id]);
        const info = infoRes.rows.length > 0 ? infoRes.rows[0] : null;

        await client.query('DELETE FROM courts WHERE facility_id = $1', [id]); 
        await client.query('DELETE FROM facilities WHERE id = $1', [id]);     

        await client.query('COMMIT'); 

        if (info && info.email) {
            const websiteName = "SportFinder";
            const logoUrl = "https://duykiet04.github.io/anh/logo.jpg"; 

            const emailTemplate = `
                <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 40px 0;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 10px; border-top: 5px solid #000000; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <img src="${logoUrl}" alt="Logo" style="height: 60px; object-fit: contain;">
                            <h2 style="color: #e53e3e; margin-top: 15px;">THÔNG BÁO XÓA CƠ SỞ</h2>
                        </div>
                        <p style="color: #555; font-size: 16px;">Xin chào <b>${info.full_name || 'Đối tác'}</b>,</p>
                        <div style="margin: 25px 0; padding: 20px; background-color: #fff5f5; border-radius: 8px;">
                            <p style="color: #555; font-size: 16px; margin-top: 0;">Cơ sở <b>${info.facility_name}</b> của bạn đã bị <strong>XÓA VĨNH VIỄN</strong> khỏi hệ thống <strong>${websiteName}</strong>.</p>
                        </div>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="text-align: center; color: #aaa; font-size: 12px;">© ${new Date().getFullYear()} ${websiteName}. All rights reserved.</p>
                    </div>
                </div>
            `;

            transporter.sendMail({
                from: `"${websiteName} Admin" <${process.env.EMAIL_USER}>`,
                to: info.email,
                subject: `[CẢNH BÁO] Cơ sở ${info.facility_name} đã bị xóa!`,
                html: emailTemplate
            }).catch(err => console.error("Lỗi gửi mail xóa sân:", err));
        }

        res.json({ success: true, message: "Đã xóa cơ sở thành công" });
    } catch (err) { 
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message }); 
    } finally {
        client.release();
    }
});

app.put('/api/facilities/:id', async (req, res) => {
    const { id } = req.params;
    const { name, address, open_time, close_time, image_url, lat, lng } = req.body;
    
    try {
        // 1. Cập nhật các thông tin cơ bản (5 biến đầu tiên)
        let query = `
            UPDATE facilities 
            SET name = $1, address = $2, open_time = $3, close_time = $4, image_url = $5
        `;
        const values = [name, address, open_time, close_time, image_url];
        
        // 2. Nếu có gửi kèm tọa độ thì update thêm tọa độ (Biến $6 và $7)
        if (lat && lng) {
            // 🔥 Lưu ý: ST_MakePoint(Kinh_Độ, Vĩ_Độ) -> $7 là Lng, $6 là Lat
            query += `, 
                lat = $6, 
                lng = $7, 
                location = ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography
            `;
            values.push(parseFloat(lat), parseFloat(lng)); // $6 = lat, $7 = lng
        }

        // 3. Cuối cùng là điều kiện WHERE (Biến cuối cùng phụ thuộc độ dài mảng)
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

            await client.query(`
                UPDATE courts SET price_per_hour = $1, amenities = $2, images = $3, image_url = $4
                WHERE facility_id = $5 AND type = $6 AND name NOT LIKE '%VIP%'
            `, [price_normal, strNormal, imgsNormal, mainImgNormal, id, type]);

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
// 🔥 CHỨC NĂNG ADMIN DUYỆT SÂN, SETTING LAYER MAP
// ==========================================

app.get('/api/admin/facilities', async (req, res) => {
    try {
        const query = `
            SELECT 
                f.*, 
                u.full_name as owner_name, 
                u.role as owner_role,
                u.phone_number as owner_phone,
                u.email as owner_email,
                (SELECT COUNT(*) FROM courts c WHERE c.facility_id = f.id) as total_courts,
                
                /* 🔥 TÍNH TOÁN DATA THẬT TỪ BẢNG REVIEWS (HẾT ẢO LÒI) */
                COALESCE((SELECT COUNT(*) FROM reviews r WHERE r.facility_id = f.id AND r.status = 'active'), 0) as real_review_count,
                COALESCE((SELECT ROUND(AVG(rating), 1) FROM reviews r WHERE r.facility_id = f.id AND r.status = 'active'), 0) as real_avg_rating,

                /* 🔥 CHIÊU MỚI: DÙNG TRUY VẤN CON KÈM LIMIT 1 ĐỂ CHỐNG NHÂN ĐÔI */
                (
                    SELECT au.id 
                    FROM administrative_units au 
                    WHERE ST_Intersects(f.location::geometry, au.geom) 
                    LIMIT 1
                ) AS ward_id 
                
            FROM facilities f
            LEFT JOIN users u ON f.owner_id = u.id
            ORDER BY 
                CASE WHEN f.status = 'pending' THEN 0 ELSE 1 END, 
                f.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi lấy admin facilities:", err);
        res.status(500).json({ error: "Lỗi Server" });
    }
});

// --- 1. ADMIN CẬP NHẬT TRẠNG THÁI CƠ SỞ (CÓ GỬI EMAIL) ---
app.put('/api/admin/facilities/:id/status', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { status } = req.body; 

        await client.query('BEGIN');

        const queryFac = `UPDATE facilities SET status = $1 WHERE id = $2 RETURNING *`;
        const result = await client.query(queryFac, [status, id]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Không tìm thấy cơ sở này" });
        }

        if (status === 'blocked' || status === 'rejected') {
            await client.query(`UPDATE courts SET status = 'blocked' WHERE facility_id = $1`, [id]);
        } 
        else if (status === 'active') {
            await client.query(`UPDATE courts SET status = 'active' WHERE facility_id = $1 AND status = 'pending'`, [id]);
        }

        await client.query('COMMIT'); 

        // --- GỬI EMAIL ---
        try {
            // Đã bỏ bảng config, chỉ lấy info từ cơ sở và user
            const infoQuery = `
                SELECT f.name as facility_name, u.email, u.full_name
                FROM facilities f
                LEFT JOIN users u ON f.owner_id = u.id
                WHERE f.id = $1
            `;
            const infoRes = await pool.query(infoQuery, [id]);

            if (infoRes.rows.length > 0 && infoRes.rows[0].email && (status === 'active' || status === 'blocked' || status === 'rejected')) {
                const info = infoRes.rows[0];
                
                // 🔥 SỬA TÊN WEB VÀ LOGO CỦA BẠN TẠI ĐÂY
                const websiteName = "SportFinder"; 
                const logoUrl = "https://duykiet04.github.io/anh/logo.jpg"; 

                let statusText = status === 'active' ? "ĐÃ ĐƯỢC PHÊ DUYỆT ✅" : "ĐÃ BỊ TẠM KHÓA ❌";
                let statusColor = status === 'active' ? "#38a169" : "#e53e3e";
                let messageStr = status === 'active' 
                    ? "Chúc mừng! Cơ sở của bạn đã vượt qua khâu kiểm duyệt và hiện đang <b>hoạt động công khai</b> trên hệ thống." 
                    : "Rất tiếc, cơ sở của bạn hiện đang bị <b>tạm khóa/từ chối</b>. Vui lòng liên hệ với Ban Quản Trị để biết thêm chi tiết.";

                const emailTemplate = `
                    <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 40px 0;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                            <div style="text-align: center; margin-bottom: 20px;">
                                <img src="${logoUrl}" alt="Logo" style="height: 60px; object-fit: contain;">
                                <h2 style="color: #2c3e50; margin-top: 15px;">Thông báo trạng thái Cơ sở</h2>
                            </div>
                            <p style="color: #555; font-size: 16px;">Xin chào <b>${info.full_name || 'Đối tác'}</b>,</p>
                            <p style="color: #555; font-size: 16px;">Hệ thống <strong>${websiteName}</strong> xin thông báo trạng thái mới nhất về cơ sở thể thao của bạn:</p>
                            <div style="margin: 25px 0; padding: 20px; border-left: 5px solid ${statusColor}; background-color: #f8f9fa;">
                                <h3 style="margin: 0 0 10px 0; color: #333;">Cơ sở: <span style="color: #2b6cb0;">${info.facility_name}</span></h3>
                                <div style="font-size: 18px; font-weight: bold; color: ${statusColor}; margin-bottom: 10px;">TRẠNG THÁI: ${statusText}</div>
                                <p style="margin: 0; color: #555; line-height: 1.5;">${messageStr}</p>
                            </div>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                            <p style="text-align: center; color: #aaa; font-size: 12px;">© ${new Date().getFullYear()} ${websiteName}. All rights reserved.</p>
                        </div>
                    </div>
                `;

                transporter.sendMail({
                    from: `"${websiteName} Admin" <${process.env.EMAIL_USER}>`,
                    to: info.email,
                    subject: `[${websiteName}] Thông báo cơ sở: ${info.facility_name}`,
                    html: emailTemplate
                }).catch(err => console.error("Lỗi gửi mail sân:", err));
            }
        } catch (mailErr) { console.error("Lỗi gửi mail:", mailErr); }

        res.json({ success: true, message: `Đã cập nhật trạng thái thành: ${status}`, facility: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Lỗi server khi duyệt sân" });
    } finally {
        client.release();
    }
});
app.put('/api/admin/courts/bulk-status', async (req, res) => {
    const client = await pool.connect();
    try {
        const { ids, status } = req.body; 

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "Chưa chọn sân nào!" });
        }

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

app.get('/api/map/layers', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM map_layers ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 🔥 THÊM LỚP BẢN ĐỒ (BẮT LỖI NULL 100%)
// ==========================================
app.post('/api/admin/map/layers', upload.any(), async (req, res) => {
    // Nhận tất cả các trường text từ body
    const { name, url, attribution, thumbnail_url, thumbnail, image_url, image } = req.body;
    
    let final_thumbnail = null;

    // Trường hợp 1: Frontend đính kèm File thật gửi lên
    if (req.files && req.files.length > 0) {
        final_thumbnail = req.files[0].path; 
    } 
    // Trường hợp 2: from đã gửi lên trước dạng text
    else if (thumbnail_url) {
        final_thumbnail = thumbnail_url;
    } 
    else if (thumbnail) {
        final_thumbnail = thumbnail;
    }
    else if (image_url) {
        final_thumbnail = image_url;
    }
    else if (image) {
        final_thumbnail = image;
    }

    console.log("🔥 KIỂM TRA THUMBNAIL NHẬN ĐƯỢC:", final_thumbnail);

    try {
        await pool.query(
            "INSERT INTO map_layers (name, url, attribution, thumbnail_url) VALUES ($1, $2, $3, $4)",
            [name, url, attribution, final_thumbnail]
        );
        res.json({ success: true, message: "Đã thêm lớp bản đồ!" });
    } catch (err) {
        console.error("Lỗi thêm map layer:", err);
        res.status(500).json({ error: err.message });
    }
});
//  api xóa lớp nền bản đồ
app.delete('/api/admin/map/layers/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM map_layers WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Đã xóa lớp bản đồ!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/map/layers/:id/toggle', async (req, res) => {
    try {
        await pool.query("UPDATE map_layers SET active = NOT active WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/map/marker-icon', upload.single('icon'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Chưa chọn file!" });
    try {
        await pool.query(
            "INSERT INTO system_config (config_key, config_value) VALUES ('marker_icon_url', $1) ON CONFLICT (config_key) DO UPDATE SET config_value = $1",
            [req.file.path]
        );
        res.json({ success: true, url: req.file.path });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 🔥 API ADMIN TẠO CƠ SỞ SEEDING FULL OPTION (CỐT LÕI)
// ==========================================
const cpUploadFac = upload.fields([
    { name: 'facility_images', maxCount: 5 }, 
    { name: 'court_normal_image', maxCount: 1 }, 
    { name: 'court_vip_image', maxCount: 1 }
]);

app.post('/api/admin/facilities', cpUploadFac, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { 
            name, address, description, lat, lng, 
            owner_name, phone_number, facebook_url, zalo_url, 
            open_time, close_time, amenities, owner_id,
            qty_normal, price_normal, sport_ids, sport_type_id, qty_vip, price_vip 
        } = req.body;

        // Xử lý amenities
        let parsedAmenities = [];
        try { if (amenities) parsedAmenities = JSON.parse(amenities); } catch(e){}

        const files = req.files || {};
        const facImgs = files['facility_images'] ? files['facility_images'].map(f => f.path.replace(/\\/g, '/')) : [];
        const facMainImg = facImgs.length > 0 ? facImgs[0] : null;
        const normalImg = files['court_normal_image'] ? files['court_normal_image'][0].path.replace(/\\/g, '/') : facMainImg;
        const vipImg = files['court_vip_image'] ? files['court_vip_image'][0].path.replace(/\\/g, '/') : facMainImg;

        let owner_id_val = owner_id ? parseInt(owner_id) : null;
        let openTimeVal = open_time ? open_time : null;
        let closeTimeVal = close_time ? close_time : null;

        // TẠO CƠ SỞ (Giữ nguyên PostGIS xịn xò của bác)
        const facRes = await client.query(
            `INSERT INTO facilities 
            (name, address, description, lat, lng, location,
             owner_name, phone_number, facebook_url, zalo_url, 
             open_time, close_time, amenities, 
             image_url, gallery_images, owner_id, status) 
            VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($5, $4), 4326), $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active') 
            RETURNING id`,
            [
                name, address, description || "", parseFloat(lat), parseFloat(lng),
                owner_name || 'Đang cập nhật', phone_number || 'Đang cập nhật', facebook_url || "", zalo_url || "", 
                openTimeVal, closeTimeVal, JSON.stringify(parsedAmenities),
                facMainImg, JSON.stringify(facImgs), owner_id_val
            ]
        );
        const facilityId = facRes.rows[0].id;

        // 🔥 XỬ LÝ MÔN THỂ THAO (Frontend giờ gửi lên mảng sport_ids)
        let sportsArr = [];
        try { if (sport_ids) sportsArr = JSON.parse(sport_ids); } catch(e){}
        // Đề phòng trường hợp tạo bằng form cũ chỉ có 1 môn
        if (sportsArr.length === 0 && sport_type_id) sportsArr.push(parseInt(sport_type_id));

        const qN = parseInt(qty_normal) || 0;
        const pN = parseInt(price_normal) || 0;
        const qV = parseInt(qty_vip) || 0;
        const pV = parseInt(price_vip) || 0;

        // 🔥 VÒNG LẶP: TẠO SÂN CON CHO *TỪNG* MÔN THỂ THAO ĐƯỢC CHỌN
        for (let sId of sportsArr) {
            const sportRes = await client.query("SELECT name FROM sport_types WHERE id = $1", [sId]);
            if (sportRes.rows.length === 0) continue;
            const sportName = sportRes.rows[0].name;

            if (qN === 0 && qV === 0) {
                // TẠO SÂN ẢO: Giữ môn thể thao cho bộ lọc, nhưng sẽ bị ẨN KHỎI GIAO DIỆN
                await client.query(
                    `INSERT INTO courts (facility_id, name, type, sport_type_id, price_per_hour, image_url, location, status) 
                     VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), 'active')`, 
                    [facilityId, `[Ảo] Sân ${sportName}`, sportName, parseInt(sId), 0, normalImg, parseFloat(lng), parseFloat(lat)]
                );
            } else {
                // TẠO SÂN THƯỜNG
                if (qN > 0) {
                    for (let i = 1; i <= qN; i++) {
                        await client.query(
                            `INSERT INTO courts (facility_id, name, type, sport_type_id, price_per_hour, image_url, location, status) 
                             VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), 'active')`, 
                            [facilityId, `Sân ${sportName} ${i}`, sportName, parseInt(sId), pN, normalImg, parseFloat(lng), parseFloat(lat)]
                        );
                    }
                }
                // TẠO SÂN VIP
                if (qV > 0) {
                    for (let i = 1; i <= qV; i++) {
                        await client.query(
                            `INSERT INTO courts (facility_id, name, type, sport_type_id, price_per_hour, image_url, location, status) 
                             VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), 'active')`, 
                            [facilityId, `Sân VIP ${sportName} ${i}`, sportName, parseInt(sId), pV, vipImg, parseFloat(lng), parseFloat(lat)]
                        );
                    }
                }
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Đã tạo cơ sở và sân con thành công!" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Lỗi:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// 🔥 BỔ SUNG LẠI API LẤY REVIEW CỦA CƠ SỞ BỊ THIẾU
// ==========================================
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
    } catch (e) { 
        res.status(500).send(e.message); 
    }
});

// ========================================================
// API: KIỂM TRA SÂN TRỐNG TRƯỚC KHI ĐẶT
// ========================================================
app.get('/api/courts/:id/check', async (req, res) => {
    try {
        const { id } = req.params;
        const { date, start, end } = req.query; //  Nhận thêm giờ Kết thúc (end)

        if (!date || !start || !end) {
            return res.status(400).json({ error: 'Vui lòng cung cấp ngày và giờ!' });
        }

        //  THUẬT TOÁN CHỐNG LẤN GIỜ:
        
        const checkQuery = `
            SELECT id FROM bookings 
            WHERE court_id = $1 
              AND booking_date = $2::date 
              AND status != 'cancelled'
              AND booking_time < $4
              AND COALESCE(end_time, TO_CHAR(booking_time::time + INTERVAL '1 hour', 'HH24:MI')) > $3
        `;
        const result = await pool.query(checkQuery, [id, date, start, end]);

        if (result.rows.length > 0) {
            res.json({ available: false });
        } else {
            res.json({ available: true });
        }
    } catch (err) {
        console.error("=== LỖI KIỂM TRA SÂN TRỐNG ===", err.message); 
        res.status(500).json({ error: "Lỗi máy chủ khi kiểm tra sân" });
    }
});

// =======================================================
// 🔥 HỆ THỐNG THÔNG BÁO (NOTIFICATIONS)
// =======================================================

// 1. Lấy danh sách thông báo (Có phân trang "Xem thêm")
app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit) || 5;
        const offset = parseInt(req.query.offset) || 0;

        const query = `
            SELECT * FROM notifications 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT $2 OFFSET $3
        `;
        const result = await pool.query(query, [userId, limit, offset]);
        
        // Đếm số lượng chưa đọc
        const unreadRes = await pool.query("SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false", [userId]);
        
        res.json({
            notifications: result.rows,
            unreadCount: parseInt(unreadRes.rows[0].count)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Đánh dấu đã đọc tất cả
app.put('/api/notifications/:userId/read', async (req, res) => {
    try {
        await pool.query("UPDATE notifications SET is_read = true WHERE user_id = $1", [req.params.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Xóa 1 thông báo
app.delete('/api/notifications/item/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM notifications WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Xóa TẤT CẢ thông báo
app.delete('/api/notifications/all/:userId', async (req, res) => {
    try {
        await pool.query("DELETE FROM notifications WHERE user_id = $1", [req.params.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Lấy chi tiết vé để Tải xuống
app.get('/api/bookings/ticket/:bookingId', async (req, res) => {
    try {
        const query = `
            SELECT b.*, c.name as court_name, f.name as facility_name, f.address 
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            JOIN facilities f ON c.facility_id = f.id
            WHERE b.id = $1
        `;
        const result = await pool.query(query, [req.params.bookingId]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 🔥 THAO TÁC CƠ SỞ HÀNG LOẠT (BULK ACTION)
// ==========================================

// 1. Khóa / Duyệt nhiều cơ sở cùng lúc
app.put('/api/admin/facilities/bulk-status', async (req, res) => {
    const client = await pool.connect();
    try {
        const { ids, status } = req.body; 
        if (!ids || ids.length === 0) return res.status(400).json({ error: "Chưa chọn cơ sở nào!" });

        await client.query('BEGIN');
        
        // Cập nhật trạng thái cơ sở
        await client.query('UPDATE facilities SET status = $1 WHERE id = ANY($2::int[])', [status, ids]);

        // Đồng bộ trạng thái xuống sân con
        if (status === 'blocked' || status === 'rejected') {
            await client.query(`UPDATE courts SET status = 'blocked' WHERE facility_id = ANY($1::int[])`, [ids]);
        } else if (status === 'active') {
            await client.query(`UPDATE courts SET status = 'active' WHERE facility_id = ANY($1::int[]) AND status = 'pending'`, [ids]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Đã chuyển ${ids.length} cơ sở thành ${status}` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Lỗi server" });
    } finally {
        client.release();
    }
});

// 2. Xóa nhiều cơ sở cùng lúc
app.delete('/api/admin/facilities/bulk-delete', async (req, res) => {
    const client = await pool.connect();
    try {
        const { ids } = req.body;
        if (!ids || ids.length === 0) return res.status(400).json({ error: "Chưa chọn cơ sở nào!" });

        await client.query('BEGIN');
        
        // Xóa sân con trước (để tránh lỗi khóa ngoại)
        await client.query('DELETE FROM courts WHERE facility_id = ANY($1::int[])', [ids]);
        // Xóa cơ sở
        await client.query('DELETE FROM facilities WHERE id = ANY($1::int[])', [ids]);

        await client.query('COMMIT');
        res.json({ success: true, message: `Đã xóa vĩnh viễn ${ids.length} cơ sở!` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Lỗi server" });
    } finally {
        client.release();
    }
});

// ==========================================
// 🔥 MODULE KIỂM DUYỆT ĐÁNH GIÁ (SUPER ADMIN)
// ==========================================

// 1. Lấy danh sách tất cả đánh giá
app.get('/api/admin/reviews', async (req, res) => {
    try {
        const query = `
            SELECT r.*, 
                   u.full_name as user_name, u.email as user_email, u.avatar_url as user_avatar,
                   f.name as facility_name
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            JOIN facilities f ON r.facility_id = f.id
            ORDER BY r.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi lấy danh sách đánh giá' });
    }
});


// 2. Đổi trạng thái hiển thị/ẩn của đánh giá (DÀNH CHO ADMIN)
app.put('/api/admin/reviews/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'active' hoặc 'hidden'
        
        // Cập nhật trạng thái và lấy facility_id để cập nhật lại sao
        const revRes = await pool.query(
            'UPDATE reviews SET status = $1 WHERE id = $2 RETURNING facility_id', 
            [status, id]
        );
        
        // 🔥 NẾU ADMIN ẨN/HIỆN THÌ PHẢI TÍNH LẠI SAO TRUNG BÌNH CỦA SÂN NGAY LẬP TỨC
        if (revRes.rows.length > 0) {
            await updateFacilityRating(revRes.rows[0].facility_id);
        }
        
        res.json({ message: 'Cập nhật trạng thái thành công' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi cập nhật' });
    }
});

// 3. Xóa vĩnh viễn đánh giá rác
app.delete('/api/admin/reviews/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM reviews WHERE id = $1', [id]);
        res.json({ message: 'Đã xóa đánh giá' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi xóa đánh giá' });
    }
});

// ==========================================
// 🔥 BULK ACTION CHO REVIEW (ẨN/XÓA/KHÓA HÀNG LOẠT)
// ==========================================

// 1. Ẩn / Hiện nhiều đánh giá cùng lúc
app.put('/api/admin/reviews/bulk-status', async (req, res) => {
    try {
        const { ids, status } = req.body;
        if (!ids || ids.length === 0) return res.status(400).json({ error: "Chưa chọn đánh giá nào" });
        
        await pool.query('UPDATE reviews SET status = $1 WHERE id = ANY($2::int[])', [status, ids]);
        res.json({ message: `Đã cập nhật ${ids.length} đánh giá thành ${status}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi cập nhật hàng loạt' });
    }
});

// 2. Xóa vĩnh viễn nhiều đánh giá cùng lúc
app.post('/api/admin/reviews/bulk-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        
        // Log ra xem Backend có nhận được mảng ID không
        console.log("Danh sách ID cần xóa:", ids); 

        if (!ids || ids.length === 0) {
            return res.status(400).json({ error: "Chưa chọn đánh giá nào" });
        }

        await pool.query('DELETE FROM reviews WHERE id = ANY($1::int[])', [ids]);
        res.json({ message: `Đã xóa ${ids.length} đánh giá` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi xóa hàng loạt' });
    }
});

// 3. Khóa tài khoản (Ban) nhiều User dựa trên các đánh giá đã chọn
app.put('/api/admin/users/bulk-ban-from-reviews', async (req, res) => {
    try {
        const { reviewIds } = req.body;
        if (!reviewIds || reviewIds.length === 0) return res.status(400).json({ error: "Chưa chọn đánh giá nào" });

        // Tìm User ID từ Review ID và cập nhật trạng thái User thành 'blocked'
        await pool.query(`
            UPDATE users 
            SET status = 'blocked' 
            WHERE id IN (SELECT user_id FROM reviews WHERE id = ANY($1::int[]))
        `, [reviewIds]);
        
        res.json({ message: 'Đã khóa tài khoản các user vi phạm!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi khóa user' });
    }
});

// ==========================================
// 🔥 API DỮ LIỆU BẢN ĐỒ NHIỆT (HEATMAP)
// ==========================================
app.get('/api/map/heatmap', async (req, res) => {
    try {
        // Lấy các sân có phát sinh giao dịch thật (bỏ qua đã hủy)
        const query = `
            SELECT 
                f.lat, 
                f.lng, 
                COUNT(b.id) AS weight
            FROM facilities f
            JOIN courts c ON f.id = c.facility_id
            JOIN bookings b ON c.id = b.court_id
            WHERE b.status IN ('pending', 'confirmed', 'completed')
              AND f.lat IS NOT NULL 
              AND f.lng IS NOT NULL
            GROUP BY f.id, f.lat, f.lng
            HAVING COUNT(b.id) > 0
        `;
        const result = await pool.query(query);
        
        // Chuyển format sang mảng 3 chiều [lat, lng, weight] cho Frontend dễ dùng
        const heatPoints = result.rows.map(row => [
            parseFloat(row.lat), 
            parseFloat(row.lng), 
            parseInt(row.weight)
        ]);

        res.json(heatPoints);
    } catch (err) {
        console.error('Lỗi lấy dữ liệu Heatmap:', err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});
// API: Lấy tọa độ điểm nhiệt (dựa trên lượng Booking thật)
app.get('/api/map/real-heatmap', async (req, res) => {
    try {
        // Gom nhóm theo cơ sở (lat, lng) và đếm tổng số booking
        const query = `
            SELECT 
                f.lat, 
                f.lng, 
                COUNT(b.id) AS total_bookings
            FROM facilities f
            JOIN courts c ON f.id = c.facility_id
            JOIN bookings b ON c.id = b.court_id
            WHERE b.status IN ('pending', 'confirmed', 'completed')
              AND f.lat IS NOT NULL 
              AND f.lng IS NOT NULL
            GROUP BY f.lat, f.lng
            HAVING COUNT(b.id) > 0
        `;
        const result = await pool.query(query);
        
        // Map data về đúng chuẩn mảng 3 chiều của leaflet.heat: [lat, lng, intensity]
        const heatPoints = result.rows.map(row => [
            parseFloat(row.lat), 
            parseFloat(row.lng), 
            parseInt(row.total_bookings) // Intensity chính là số lượng vé
        ]);

        res.json(heatPoints);
    } catch (err) {
        console.error('Lỗi lấy Heatmap:', err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// ==========================================
// 🔥 BULK ACTIONS: CẬP NHẬT TRẠNG THÁI & XÓA NHANH USERS
// ==========================================

// 1. Cập nhật trạng thái hàng loạt (Khóa / Mở Khóa)
app.put('/api/admin/users/bulk-status', async (req, res) => {
    try {
        const { ids, status } = req.body; // status: 'active' hoặc 'blocked'
        if (!ids || ids.length === 0) return res.status(400).json({ error: "Chưa chọn user nào" });
        
        await pool.query('UPDATE users SET status = $1 WHERE id = ANY($2::int[])', [status, ids]);
        res.json({ message: `Đã cập nhật ${ids.length} user thành ${status}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi cập nhật hàng loạt' });
    }
});

// 2. Xóa vĩnh viễn hàng loạt User (Kèm thuật toán dọn rác cực mạnh)
app.post('/api/admin/users/bulk-delete', async (req, res) => {
    const client = await pool.connect();
    try {
        const { ids } = req.body;
        if (!ids || ids.length === 0) return res.status(400).json({ error: "Chưa chọn user" });

        await client.query('BEGIN'); // Bắt đầu giao dịch

        // 1. Dọn dẹp dữ liệu râu ria
        await client.query('DELETE FROM notifications WHERE user_id = ANY($1::int[])', [ids]);
        await client.query('DELETE FROM user_favorites WHERE user_id = ANY($1::int[])', [ids]);
        await client.query('DELETE FROM reviews WHERE user_id = ANY($1::int[])', [ids]);
        await client.query('DELETE FROM bookings WHERE user_id = ANY($1::int[])', [ids]);

        // 2. Dọn dẹp Kèo đấu
        await client.query('DELETE FROM match_participants WHERE user_id = ANY($1::int[])', [ids]);
        await client.query('DELETE FROM match_participants WHERE match_id IN (SELECT id FROM matches WHERE user_id = ANY($1::int[]))', [ids]);
        await client.query('DELETE FROM matches WHERE user_id = ANY($1::int[])', [ids]);

        // 3. Dọn dẹp Cơ sở (Nếu có Vendor trong danh sách bị xóa)
        const facRes = await client.query('SELECT id FROM facilities WHERE owner_id = ANY($1::int[])', [ids]);
        if (facRes.rows.length > 0) {
            const facIds = facRes.rows.map(f => f.id);
            await client.query('DELETE FROM reviews WHERE facility_id = ANY($1::int[])', [facIds]);
            await client.query('DELETE FROM bookings WHERE court_id IN (SELECT id FROM courts WHERE facility_id = ANY($1::int[]))', [facIds]);
            await client.query('DELETE FROM courts WHERE facility_id = ANY($1::int[])', [facIds]);
            await client.query('DELETE FROM facilities WHERE owner_id = ANY($1::int[])', [ids]);
        }

        // 4. Trảm Users
        await client.query('DELETE FROM users WHERE id = ANY($1::int[])', [ids]);

        await client.query('COMMIT');
        res.json({ message: `Đã dọn dẹp và xóa vĩnh viễn ${ids.length} users!` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Lỗi xóa nhiều User:", err.message);
        res.status(500).json({ error: 'Lỗi server khi xóa Users: ' + err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// 🔥 API CHO VENDOR: QUẢN LÝ ĐÁNH GIÁ (REVIEWS)
// ==========================================

// 1. Lấy danh sách tất cả đánh giá thuộc về các cơ sở của Vendor này
app.get('/api/vendor/reviews', async (req, res) => {
    try {
        const { vendor_id } = req.query;
        const query = `
            SELECT r.*, u.full_name as user_name, u.avatar_url as user_avatar, f.name as facility_name
            FROM reviews r
            JOIN facilities f ON r.facility_id = f.id
            JOIN users u ON r.user_id = u.id
            WHERE f.owner_id = $1
            ORDER BY r.created_at DESC
        `;
        const result = await pool.query(query, [vendor_id]);
        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi lấy đánh giá cho Vendor:", err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// 2. Vendor báo cáo xấu một đánh giá lên Admin
app.post('/api/vendor/reviews/:id/report', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        await client.query('BEGIN');

        // 1. Cập nhật trạng thái báo cáo cho Đánh giá
        const reviewRes = await client.query(
            'UPDATE reviews SET is_reported = true, report_reason = $1 WHERE id = $2 RETURNING facility_id',
            [reason, id]
        );
        
        if (reviewRes.rows.length > 0) {
            const facilityId = reviewRes.rows[0].facility_id;
            
            // Lấy tên cơ sở để nhét vào câu thông báo cho Admin dễ hiểu
            const facRes = await client.query('SELECT name FROM facilities WHERE id = $1', [facilityId]);
            const facName = facRes.rows.length > 0 ? facRes.rows[0].name : 'Một cơ sở';

            // 2. Bắn thông báo cho TOÀN BỘ Super Admin
            const adminRes = await client.query("SELECT id FROM users WHERE role = 'super_admin'");
            const adminIds = adminRes.rows.map(row => row.id);

            for (let adminId of adminIds) {
                await client.query(
                    `INSERT INTO notifications (user_id, title, message, type, reference_id)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        adminId, 
                        '🚩 Cảnh báo: Đánh giá vi phạm!', 
                        `Chủ sân "${facName}" vừa báo cáo 1 đánh giá. Lý do: ${reason}. Vui lòng kiểm tra!`, 
                        'review_report', 
                        id
                    ]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Đã gửi báo cáo và thông báo cho Admin xử lý!' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Lỗi báo cáo đánh giá:", err);
        res.status(500).json({ error: 'Lỗi server' });
    } finally {
        client.release();
    }
});

// ==========================================
// 🔥 API ĐẾM SỐ LƯỢNG ĐÁNH GIÁ ĐANG BỊ BÁO CÁO (CHO SIDEBAR)
// ==========================================
app.get('/api/admin/reviews/reported-count', async (req, res) => {
    try {
        const result = await pool.query("SELECT COUNT(*) FROM reviews WHERE is_reported = true");
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (err) {
        console.error("Lỗi đếm số báo cáo:", err);
        res.status(500).json({ error: 'Lỗi server' });
    }
});
// 4. Admin bỏ qua báo cáo xấu (Hủy cờ đỏ)
app.put('/api/admin/reviews/:id/dismiss-report', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        await client.query('BEGIN');
        
        // 1. Tắt cờ báo cáo, bật cờ "Đã giải quyết"
        const reviewRes = await client.query(
            'UPDATE reviews SET is_reported = false, report_resolved = true, report_reason = NULL WHERE id = $1 RETURNING facility_id', 
            [id]
        );

        // 2. Tìm ID Chủ sân để bắn chuông thông báo
        if (reviewRes.rows.length > 0) {
            const facilityId = reviewRes.rows[0].facility_id;
            const ownerRes = await client.query('SELECT owner_id, name FROM facilities WHERE id = $1', [facilityId]);
            
            if (ownerRes.rows.length > 0) {
                const { owner_id, name } = ownerRes.rows[0];
                
                // Nhét thông báo vào giỏ của Chủ sân
                await client.query(
                    `INSERT INTO notifications (user_id, title, message, type, reference_id)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        owner_id, 
                        '🛡️ Kết quả báo cáo đánh giá', 
                        `Admin đã xem xét báo cáo của bạn tại sân "${name}". Đánh giá này KHÔNG vi phạm tiêu chuẩn cộng đồng và được giữ lại.`, 
                        'report_dismissed', 
                        id
                    ]
                );
            }
        }
        
        await client.query('COMMIT');
        res.json({ message: 'Đã bỏ qua báo cáo và thông báo cho Chủ sân!' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Lỗi bỏ qua báo cáo:", err);
        res.status(500).json({ error: 'Lỗi xử lý' });
    } finally {
        client.release();
    }
});
// --- START SERVER ---
app.listen(port,() => {
    console.log(`🫡 Server running on port ${port}`);
});
module.exports = app;
