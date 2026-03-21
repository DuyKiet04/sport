import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat'; // Import thư viện gốc

const HeatmapLayer = ({ points }) => {
    const map = useMap();

    useEffect(() => {
        // 1. Kiểm tra dữ liệu đầu vào
        if (!points || points.length === 0) return;

        // 2. Tạo lớp Heatmap
        // points format: [[lat, lng, intensity], ...]
        const heat = L.heatLayer(points, {
            radius: 25,   // Bán kính nhiệt (pixels)
            blur: 15,     // Độ nhòe
            maxZoom: 15,  // Mức zoom để đạt độ đậm tối đa
            minOpacity: 0.4,
            gradient: {
                0.2: 'blue',
                0.4: 'cyan',
                0.6: 'lime',
                0.8: 'yellow',
                1.0: 'red'
            }
        });

        // 3. Thêm vào bản đồ
        heat.addTo(map);

        //  QUAN TRỌNG: hàm dọn dẹp
    
        return () => {
            map.removeLayer(heat);
        };

    }, [points, map]); // Chạy lại khi danh sách điểm thay đổi

    return null;
};

export default HeatmapLayer;