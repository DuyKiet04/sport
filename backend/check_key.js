const fs = require('fs');
const path = require('path');
// Đường dãn thư mục
const folderPath = path.join(__dirname, 'HCM_PhuongXa_Split'); 

try {
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.geojson') || f.endsWith('.json'));
    if (files.length > 0) {
        const firstFile = files[0];
        const raw = fs.readFileSync(path.join(folderPath, firstFile), 'utf8');
        const json = JSON.parse(raw);
        // Báo lỗi
        const feature = json.features ? json.features[0] : json;
        console.log("\n👇👇👇 ĐÂY LÀ CÁC KEY TRONG FILE CỦA BẠN (COPY GỬI TÔI) 👇👇👇");
        console.log(feature.properties);
        console.log("☝️☝️☝️ ---------------------------------------------------- ☝️☝️☝️\n");
    } else {
        console.log("Không tìm thấy file nào!");
    }
} catch (e) {
    console.error(e);
}