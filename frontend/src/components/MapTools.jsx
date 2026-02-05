import React, { useState, useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import { Box, InputGroup, Input, InputRightElement, IconButton, useToast } from '@chakra-ui/react';
import { FaSearch } from 'react-icons/fa';

// --- HELPER: XỬ LÝ LINK ẢNH ---
export const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url.substring(1) : url;
    return `http://localhost:5000/${cleanPath}`;
};

// --- HELPER: TẠO MARKER TRÒN (AVATAR) TRÊN BẢN ĐỒ ---
export const createCircleMarker = (iconUrl, type, isHovered) => {
    const realUrl = getImgUrl(iconUrl);
    const fallbackIcon = 'https://cdn-icons-png.flaticon.com/512/857/857681.png'; 
    const initialSrc = (realUrl && !realUrl.includes('placeholder')) ? realUrl : fallbackIcon;
    const size = isHovered ? 60 : 50;
    const borderColor = type === 'new' ? '#F6E05E' : '#38A169'; 

    return L.divIcon({ 
        className: `admin-marker ${isHovered ? 'z-index-high' : ''}`, 
        html: `
            <div style="width: ${size}px; height: ${size}px; background: white; border-radius: 50%; border: 3px solid ${borderColor}; box-shadow: 0 4px 15px rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center; overflow: hidden; transition: all 0.3s ease;">
               <img src="${initialSrc}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null;this.src='${fallbackIcon}';"/>
            </div>
        `, 
        iconSize: [size, size], iconAnchor: [size/2, size], popupAnchor: [0, -size] 
    });
};

// --- COMPONENT: CHỌN VỊ TRÍ KHI CLICK VÀO BẢN ĐỒ ---
export const LocationPicker = ({ setFormData }) => {
    const toast = useToast();
    useMapEvents({
        click: async (e) => {
            const { lat, lng } = e.latlng;
            setFormData(prev => ({ ...prev, lat, lng }));
            
            // Gọi API Reverse Geocoding
            try {
                const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                if (res.data && res.data.display_name) {
                    // Chỉ cập nhật địa chỉ nếu user chưa tự nhập gì (tùy chọn)
                    // Hoặc update luôn để họ biết vị trí đó là gì
                    // setFormData(prev => ({ ...prev, address: res.data.display_name }));
                    
                    toast({ 
                        title: 'Đã ghim vị trí!', 
                        description: `Gần: ${res.data.display_name.split(',')[0]}`, // Chỉ hiện tên ngắn gọn
                        status: 'info', duration: 2000, position: 'top', variant: 'subtle'
                    });
                }
            } catch (err) {}
        },
    });
    return null;
};

// --- COMPONENT: THANH TÌM KIẾM ĐỊA CHỈ THÔNG MINH ---
export const MapSearchControl = ({ setFormData }) => {
    const map = useMap();
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const toast = useToast();
    const containerRef = useRef(null);

    useEffect(() => {
        if (containerRef.current) {
            L.DomEvent.disableClickPropagation(containerRef.current);
            L.DomEvent.disableScrollPropagation(containerRef.current);
        }
    }, []);

    const handleSearch = async () => {
        if (!query) return;
        setSearching(true);

        // Hàm search nội bộ
        const searchApi = async (q) => {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=vn`;
            return await axios.get(url);
        };

        try {
            // 1. Thử tìm chính xác 100%
            let res = await searchApi(query);
            let foundQuery = query;

            // 2. Nếu không thấy -> Thử cắt bỏ số nhà (Tìm theo tên đường)
            if (res.data.length === 0) {
                // Regex tìm từ khóa đường/phường...
                // Ví dụ: "1078/20 Đường số 18..." -> Lấy từ "Đường số 18..."
                const streetMatch = query.match(/(Đường|Phố|Quốc lộ|Tỉnh lộ|Xa lộ|Đại lộ|Khu phố|Phường|Xã|Thị trấn).*$/i);
                
                if (streetMatch) {
                    const broaderQuery = streetMatch[0]; // Lấy phần tên đường trở về sau
                    // toast({ title: 'Đang mở rộng tìm kiếm...', description: `Tìm: "${broaderQuery}"`, status: 'info', position: 'top', duration: 1500 });
                    res = await searchApi(broaderQuery);
                    foundQuery = broaderQuery;
                }
            }

            // 3. Nếu vẫn không thấy -> Thử tìm theo Phường + Quận (Cắt bớt nữa)
            if (res.data.length === 0) {
                const wardMatch = query.match(/(Phường|Xã|Thị trấn).*$/i);
                if (wardMatch) {
                    res = await searchApi(wardMatch[0]);
                    foundQuery = wardMatch[0];
                }
            }

            if (res.data && res.data.length > 0) {
                const { lat, lon, display_name } = res.data[0];
                const latNum = parseFloat(lat);
                const lngNum = parseFloat(lon);

                map.flyTo([latNum, lngNum], 16); 
                
                // Cập nhật marker, NHƯNG KHÔNG GHI ĐÈ ĐỊA CHỈ GỐC CỦA USER
                // Để user tự sửa địa chỉ chi tiết, chỉ lấy tọa độ thôi
                setFormData(prev => ({ 
                    ...prev, 
                    lat: latNum, 
                    lng: lngNum,
                    // address: display_name // 👈 Tạm tắt dòng này để ko bị ghi đè địa chỉ "1078/20..." mà user đã nhập
                }));
                
                toast({ 
                    title: foundQuery === query ? 'Đã tìm thấy!' : 'Tìm thấy khu vực lân cận', 
                    description: "Hãy kéo thả bản đồ hoặc chạm để ghim đúng vị trí sân nhà bạn.", 
                    status: 'success', position: 'top', duration: 5000, isClosable: true
                });
            } else {
                toast({ 
                    title: 'Không tìm thấy', 
                    description: "Bản đồ chưa cập nhật số nhà này. Hãy thử tìm địa điểm lớn gần đó (VD: Chợ, Trường học, Ủy ban...).", 
                    status: 'warning', position: 'top', duration: 5000, isClosable: true 
                });
            }
        } catch (e) { 
            toast({ title: 'Lỗi kết nối bản đồ', status: 'error' }); 
        } finally { 
            setSearching(false); 
        }
    };

    return (
        <Box ref={containerRef} position="absolute" top={4} left="50%" transform="translateX(-50%)" zIndex={1000} w="90%" maxW="400px" bg="white" borderRadius="full" p={1} boxShadow="0 4px 12px rgba(0,0,0,0.15)">
            <InputGroup size="md">
                <Input 
                    placeholder="Tìm địa chỉ (VD: Đường số 18, Linh Trung)..." 
                    borderRadius="full" border="none" 
                    value={query} 
                    onChange={(e) => setQuery(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()} 
                    pl={4} _focus={{boxShadow: 'none'}}
                />
                <InputRightElement width="3rem">
                    <IconButton icon={<FaSearch />} size="sm" isRound colorScheme="blue" onClick={handleSearch} isLoading={searching} />
                </InputRightElement>
            </InputGroup>
        </Box>
    );
};