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

// =======================================================
// PART A: AUTHENTICATION API
// =======================================================

// 1. Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, full_name, role } = req.body;
        
        const userExist = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (userExist.rows.length > 0) {
            return res.status(400).json({ error: "Username already exists!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        let finalStatus = role === 'vendor' ? 'pending' : 'active';

        await pool.query(
            "INSERT INTO users (username, password, full_name, email, role, status) VALUES ($1, $2, $3, $4, $5, $6)",
            [username, hashedPassword, full_name, username + '@gmail.com', role, finalStatus]
        );

        res.json({ message: "Registration successful!" });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error: " + err.message);
    }
});

// 2. Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (user.rows.length === 0) return res.status(400).json({ error: "Invalid username!" });

        const userData = user.rows[0];

        if (userData.status === 'pending') return res.status(403).json({ error: "Account is pending approval!" });
        if (userData.status === 'blocked') return res.status(403).json({ error: "Account has been blocked!" });

        const validPass = await bcrypt.compare(password, userData.password);
        if (!validPass) return res.status(400).json({ error: "Invalid password!" });

        const token = jwt.sign({ id: userData.id, role: userData.role }, SECRET_KEY);
        
        res.json({ 
            token, 
            user: { 
                id: userData.id, 
                name: userData.full_name, 
                role: userData.role,
                avatar: userData.avatar_url 
            } 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
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
        if (!lat || !lng) return res.status(400).json({ error: "Missing coordinates" });
        const radius = distance || 5000;
        
        // 🔥 FIX: Thêm điều kiện status = 'active'
        const query = `
            SELECT id, name, address, price_per_hour, image_url, type, owner_id, status,
                   ST_AsGeoJSON(location)::json as geometry,
                   ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as dist_meters
            FROM courts
            WHERE status = 'active' 
            AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
            ORDER BY dist_meters ASC
        `;
        const result = await pool.query(query, [lng, lat, radius]);
        res.json(result.rows);
    } catch (err) { res.status(500).send("Server Error"); }
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

app.post('/api/facilities', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { 
            owner_id, name, address, open_time, close_time, image_url, 
            type, lat, lng, images, 
            total_courts, vip_count,    
            price_normal, amenities_normal, 
            price_vip, amenities_vip
        } = req.body;

        await client.query('BEGIN');

        const facilityQuery = `
            INSERT INTO facilities (owner_id, name, address, open_time, close_time, image_url, location)
            VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326))
            RETURNING id;
        `;
        const facilityRes = await client.query(facilityQuery, [
            owner_id, name, address, open_time, close_time, image_url, 
            parseFloat(lng), parseFloat(lat) 
        ]);
        const newFacilityId = facilityRes.rows[0].id;

        const strAmenitiesNormal = Array.isArray(amenities_normal) ? amenities_normal.join(',') : amenities_normal;
        const strAmenitiesVIP = Array.isArray(amenities_vip) ? amenities_vip.join(',') : amenities_vip;

        const courtQuery = `
            INSERT INTO courts (
                facility_id, owner_id, name, price_per_hour, 
                type, amenities, image_url, address, location, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_MakePoint($9, $10), 4326), 'pending')
        `;

        const normalCount = total_courts - vip_count;
        for (let i = 1; i <= normalCount; i++) {
            const courtName = `Sân số ${i}`;
            await client.query(courtQuery, [
                newFacilityId, owner_id, courtName, parseInt(price_normal),
                type, strAmenitiesNormal, image_url, address, parseFloat(lng), parseFloat(lat)
            ]);
        }

        for (let j = 1; j <= vip_count; j++) {
            const courtName = `Sân VIP ${j}`; 
            await client.query(courtQuery, [
                newFacilityId, owner_id, courtName, parseInt(price_vip),
                type, strAmenitiesVIP, image_url, address, parseFloat(lng), parseFloat(lat)
            ]);
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: `Đã tạo ${normalCount} sân thường và ${vip_count} sân VIP!` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Lỗi tạo sân:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
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

// API SUPER ADMIN: CẬP NHẬT TRẠNG THÁI CƠ SỞ (FACILITIES)
app.put('/api/admin/facilities/:id/status', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { status } = req.body; 

        const query = `UPDATE facilities SET status = $1 WHERE id = $2 RETURNING *`;
        const result = await client.query(query, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy sân" });
        }
        res.json({ success: true, message: "Cập nhật thành công!", facility: result.rows[0] });
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

// 🔥 API SUPER ADMIN: LẤY TOÀN BỘ SÂN CON (ĐỂ DUYỆT)
app.get('/api/admin/all-courts', async (req, res) => {
    try {
        // Query này lấy HẾT status (cả pending, rejected, active)
        const query = `
            SELECT c.*, f.name as facility_name, u.full_name as owner_name
            FROM courts c
            LEFT JOIN facilities f ON c.facility_id = f.id
            LEFT JOIN users u ON c.owner_id = u.id
            ORDER BY c.id DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Lỗi lấy all-courts:", err);
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
        const result = await pool.query(`
            SELECT id, full_name, email, role, status, avatar_url, created_at 
            FROM users 
            WHERE role != 'super_admin'
            ORDER BY id DESC
        `);
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

app.get('/api/admin/all-courts', async (req, res) => {
    try {
        const query = `
            SELECT c.*, 
                   f.name as facility_name, 
                   u.full_name as owner_name,
                   -- 👇 Dòng này quan trọng nhất, không có nó là map trắng
                   ST_X(c.location::geometry) as lng, 
                   ST_Y(c.location::geometry) as lat
            FROM courts c
            LEFT JOIN facilities f ON c.facility_id = f.id
            LEFT JOIN users u ON c.owner_id = u.id
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
        // Đếm User
        const userRes = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'user'");
        // Đếm Vendor
        const vendorRes = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'vendor'");
        // Đếm Sân
        const courtRes = await pool.query("SELECT COUNT(*) FROM courts");
        // Đếm Booking
        const bookingRes = await pool.query("SELECT COUNT(*) FROM bookings");
        
        // Tính tổng doanh thu (Giả sử: tổng giá các booking đã confirmed/completed)
        // Nếu chưa có bảng payments, ta tính tạm bằng cách sum price trong booking hoặc lấy số ảo
        // Ở đây tôi query thật:
        const revenueRes = await pool.query(`
            SELECT SUM(c.price_per_hour) as total 
            FROM bookings b
            JOIN courts c ON b.court_id = c.id
            WHERE b.status IN ('confirmed', 'completed')
        `);

        res.json({
            users: parseInt(userRes.rows[0].count),
            vendors: parseInt(vendorRes.rows[0].count),
            courts: parseInt(courtRes.rows[0].count),
            bookings: parseInt(bookingRes.rows[0].count),
            revenue: parseInt(revenueRes.rows[0].total) || 0
        });
    } catch (err) {
        console.error("Dashboard Stats Error:", err);
        res.status(500).send("Lỗi lấy thống kê");
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

// --- START SERVER ---
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});