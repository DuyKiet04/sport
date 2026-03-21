const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 🔥 CẤU HÌNH DATABASE
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'sport_booking',
    password: '050704', 
    port: 2004,
});

const importFolder = async () => {
    try {
        const folderPath = path.join(__dirname, 'HCM_PhuongXa_Split'); 

        if (!fs.existsSync(folderPath)) {
            console.error(` 😒Không tìm thấy thư mục: ${folderPath}`);
            return;
        }

        const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.geojson') || file.endsWith('.json'));
        console.log(` 😘 Đang xử lý ${files.length} đơn vị hành chính mới của TP.HCM...`);

        // Xóa sạch dữ liệu cũ để nạp mới cho chuẩn
        await pool.query("TRUNCATE TABLE administrative_units RESTART IDENTITY");

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const rawData = fs.readFileSync(filePath, 'utf8');
            const geojson = JSON.parse(rawData);

            const features = geojson.features || (geojson.type === 'Feature' ? [geojson] : []);

            for (const feature of features) {
                const props = feature.properties;

                
                const name = props.ten_xa || props.Name || "Không tên";
                
                
                const district = props.ten_tinh || "TP. Hồ Chí Minh"; 
                
                const type = props.loai || "Phường";

                const geometry = JSON.stringify(feature.geometry);

                try {
                    await pool.query(
                        `INSERT INTO administrative_units (name, district_name, type, geom)
                         VALUES ($1, $2, $3, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)))`,
                        [name, district, type, geometry]
                    );
                    process.stdout.write("."); 
                } catch (e) {
                    console.error(`\n👌 Lỗi: ${name} - ${e.message}`);
                }
            }
        }

        console.log("\n👌 ĐÃ XONG! 168 đơn vị hành chính  đã vào DB.");

    } catch (err) {
        console.error("\n😒LỖI:", err.message);
    } finally {
        pool.end();
    }
};

importFolder();