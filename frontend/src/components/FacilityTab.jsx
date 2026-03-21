import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, GeoJSON } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import { 
    Box, VStack, Heading, Button, Image, useToast, Text, HStack, 
    IconButton, Divider, Flex, FormControl, FormLabel, 
    Select, Input, Wrap, SimpleGrid, Icon, Checkbox, Badge, 
    Menu, MenuButton, MenuList, useColorModeValue, useColorMode
} from '@chakra-ui/react';
import { FaPlus, FaTrash, FaCamera, FaTimes, FaEdit, FaMapMarkerAlt, FaStar, FaLayerGroup, FaBan, FaSave, FaCogs, FaChevronRight } from 'react-icons/fa';
import FacilityForm from './FacilityForm';
import { createCircleMarker, MapSearchControl, getImgUrl } from './MapTools';

const COMMON_AMENITIES = [
    "Wifi miễn phí", "Bãi giữ xe", "Canteen / Giải khát", "Phòng thay đồ", "Tủ đồ (Locker)", 
    "Cho thuê giày/áo", "Trọng tài", "Dạy học", "Có mái che", "Đèn chiếu sáng tốt", "Ghế massage", "Máy lạnh", "Nước uống Free"
];

const getLayerThumb = (layer) => layer?.thumbnail_url || layer?.image_url || layer?.thumbnail || layer?.image || layer?.icon_url || null;

const parseArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data.map(item => parseInt(item));
    if (typeof data === 'string') {
        let cleanStr = data.replace('{', '').replace('}', '').replace('[', '').replace(']', '').replace(/"/g, '');
        if (cleanStr.trim() === '') return [];
        return cleanStr.includes(',') ? cleanStr.split(',').map(item => parseInt(item.trim())) : [parseInt(cleanStr.trim())];
    }
    return [];
};

const parsePostGISPoint = (geom) => {
    if (!geom) return null;
    if (typeof geom === 'object' && geom.coordinates) return { lat: geom.coordinates[1], lng: geom.coordinates[0] };
    if (typeof geom === 'string' && geom.length >= 40) {
        try {
            const buffer = new Uint8Array(geom.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16))).buffer;
            const view = new DataView(buffer);
            const isLittleEndian = view.getUint8(0) === 1;
            const lng = view.getFloat64(9, isLittleEndian);
            const lat = view.getFloat64(17, isLittleEndian);
            if(!isNaN(lat) && !isNaN(lng)) return { lat, lng };
        } catch (e) { return null; }
    }
    return null;
};

// 🔥 TÌM TỌA ĐỘ BẤT CHẤP LỖI DATABASE ĐỂ BẢN ĐỒ KHÔNG SẬP
const getSafeCoords = (item) => {
    if (!item) return null;
    let lat = parseFloat(item.lat || item.latitude);
    let lng = parseFloat(item.lng || item.longitude);
    if ((!lat || !lng || isNaN(lat) || isNaN(lng)) && item.location) {
        const p = parsePostGISPoint(item.location);
        if (p) { lat = p.lat; lng = p.lng; }
    }
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
};


export const isPointInWard = (lat, lng, shape) => {
    if (!shape || !shape.coordinates) return true; 
    const isPointInsidePolygon = (point, vs) => {
        let x = point[0], y = point[1];
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            let xi = vs[i][0], yi = vs[i][1];
            let xj = vs[j][0], yj = vs[j][1];
            let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };
    const pt = [lng, lat]; 
    if (shape.type === 'Polygon') return isPointInsidePolygon(pt, shape.coordinates[0]);
    else if (shape.type === 'MultiPolygon') {
        for (let i = 0; i < shape.coordinates.length; i++) if (isPointInsidePolygon(pt, shape.coordinates[i][0])) return true;
    }
    return false;
};

const MapBoundsFlyTo = ({ shape }) => {
    const map = useMap();
    useEffect(() => {
        if (shape) {
            try {
                const bounds = L.geoJSON(shape).getBounds();
                if (bounds.isValid()) map.flyToBounds(bounds, { padding: [30, 30], animate: true, duration: 1.5 });
            } catch (e) {}
        }
    }, [shape, map]);
    return null;
};


// =========================================================
// 🔥 SPORT CONFIG FORM (NEUMORPHISM STYLE)
// =========================================================
const SportConfigForm = ({ facility, sportTypes, onSave, initialData, onDeleteSport, user, onCancel }) => {
    const isEditMode = !!initialData; 
    
    // GOM TOÀN BỘ HOOKS LÊN ĐẦU
    const toast = useToast();
    const fileRefNormal = useRef(); 
    const fileRefVIP = useRef();
    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '6px 6px 12px #0d1117, -4px -4px 10px #2d3748');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #0d1117, inset -4px -4px 8px #2d3748');
    const textColor = useColorModeValue('gray.700', 'gray.100');
    const textMuted = useColorModeValue('gray.500', 'gray.400');
    
    // 🔥 LÔI HẾT USECOLORMODEVALUE LÊN ĐÂY (TRÁNH LỖI HOOKS ORDER)
    const sportBorderColor = useColorModeValue('whiteAlpha.800', 'whiteAlpha.100');

    const [sportData, setSportData] = useState({ 
        sport_type: '', normal_count: 5, vip_count: 2, price_normal: 100000, price_vip: 200000, 
        amenities_normal: [], amenities_vip: [], images_normal: [], images_vip: []
    });
    const [uploading, setUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const inputStyle = {
        bg: neumorphBg, border: "none", color: textColor, boxShadow: neumorphActiveShadow,
        borderRadius: "xl", fontSize: "sm", fontWeight: "bold",
        _focus: { boxShadow: neumorphActiveShadow, border: "1px solid", borderColor: "blue.400" }
    };

    useEffect(() => {
        if (isEditMode && initialData) {
            const parseAmenities = (str) => (!str ? [] : (Array.isArray(str) ? str : str.split(',')));
            setSportData({
                sport_type: initialData.sport_type, normal_count: initialData.normal_count || 0, vip_count: initialData.vip_count || 0,
                price_normal: initialData.price_normal || 0, price_vip: initialData.price_vip || 0,
                amenities_normal: parseAmenities(initialData.amenities_normal), amenities_vip: parseAmenities(initialData.amenities_vip),
                images_normal: initialData.images_normal || [], images_vip: initialData.images_vip || []
            });
        }
    }, [initialData, isEditMode]);

    const toggleAmenity = (item, type) => {
        const key = type === 'normal' ? 'amenities_normal' : 'amenities_vip';
        setSportData(prev => {
            const list = prev[key];
            return list.includes(item) ? { ...prev, [key]: list.filter(a => a !== item) } : { ...prev, [key]: [...list, item] };
        });
    };

    const handleUpload = async (e, type) => {
        const files = e.target.files; if (!files.length) return;
        setUploading(true); const fd = new FormData();
        for (let i = 0; i < files.length; i++) fd.append('images', files[i]);
        try {
            const res = await axios.post(import.meta.env.VITE_API_URL + '/api/upload-multiple', fd);
            const key = type === 'normal' ? 'images_normal' : 'images_vip';
            setSportData(prev => ({ ...prev, [key]: [...prev[key], ...res.data.urls] }));
            toast({ title: "Đã thêm ảnh!", status: "success" });
        } catch (err) { toast({ title: "Lỗi tải ảnh", status: "error" }); } 
        finally { setUploading(false); }
    };

    const removeImage = (idx, type) => {
        const key = type === 'normal' ? 'images_normal' : 'images_vip';
        setSportData(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
    };

    const handleSubmit = async () => {
        if (!sportData.sport_type) return toast({ title: "Vui lòng chọn môn", status: "warning" });
        setIsSubmitting(true);
        try {
            const total = parseInt(sportData.normal_count) + parseInt(sportData.vip_count);
            const payload = { ...sportData, total_courts: total, vip_count: parseInt(sportData.vip_count) };
            if (isEditMode) await axios.put(`${import.meta.env.VITE_API_URL}/api/facilities/${facility.id}/sports/${sportData.sport_type}`, payload);
            else await axios.post(`${import.meta.env.VITE_API_URL}/api/facilities/${facility.id}/sports`, payload);
            toast({ title: "Thành công!", status: "success" });
            onSave(); onCancel();
        } catch (e) { toast({ title: "Lỗi", description: e.response?.data?.error, status: "error" }); } 
        finally { setIsSubmitting(false); }
    };

    const allowedSportIds = parseArray(user?.approved_sports);
    const availableSports = sportTypes.filter(t => allowedSportIds.includes(t.id));

    return (
        <Box p={5} bg={neumorphBg} h="100%" overflowY="auto" className="hide-scrollbar">
            <VStack spacing={6} align="stretch" pb={10}>
                <VStack spacing={2} mb={2}>
                    <Box p={3} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphShadow} color="blue.500">
                        <Icon as={FaCogs} boxSize={6} />
                    </Box>
                    <Text fontWeight="900" fontSize="md" color={textColor} textAlign="center" textTransform="uppercase">
                        {isEditMode ? `CẤU HÌNH SÂN ${sportData.sport_type}` : `THÊM MÔN THỂ THAO`}
                    </Text>
                </VStack>

                <FormControl isRequired isDisabled={isEditMode}>
                    <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2}>CHỌN MÔN</FormLabel>
                    <Select {...inputStyle} placeholder="Chọn môn..." value={sportData.sport_type} onChange={e => setSportData({...sportData, sport_type: e.target.value})}>
                        {availableSports.map(t => <option key={t.id} value={t.code} style={{color: 'black'}}>{t.name}</option>)}
                    </Select>
                </FormControl>

                <Box bg={neumorphBg} p={5} borderRadius="3xl" boxShadow={neumorphShadow}>
                    <HStack justify="space-between">
                        <FormControl w="45%">
                            <FormLabel fontSize="xs" fontWeight="900" color={textMuted}>SỐ SÂN THƯỜNG</FormLabel>
                            <Input h="45px" type="number" {...inputStyle} value={sportData.normal_count} isReadOnly={isEditMode} onChange={e => setSportData({...sportData, normal_count: e.target.value})}/>
                        </FormControl>
                        <Icon as={FaPlus} mt={6} color="gray.400" />
                        <FormControl w="45%">
                            <FormLabel fontSize="xs" fontWeight="900" color="orange.400">SỐ SÂN VIP</FormLabel>
                            <Input h="45px" type="number" {...inputStyle} value={sportData.vip_count} isReadOnly={isEditMode} onChange={e => setSportData({...sportData, vip_count: e.target.value})}/>
                        </FormControl>
                    </HStack>
                </Box>

                {/* SÂN THƯỜNG SECTION */}
                <Box p={5} borderRadius="3xl" bg={neumorphBg} boxShadow={neumorphShadow} border="1px solid" borderColor={sportBorderColor}>
                    <Badge colorScheme="blue" variant="subtle" px={3} py={1} borderRadius="lg" mb={4} fontWeight="900">CẤU HÌNH SÂN THƯỜNG</Badge>
                    <FormControl mb={4}>
                        <FormLabel fontSize="xs" fontWeight="900" color={textMuted}>GIÁ / GIỜ (VNĐ)</FormLabel>
                        <Input h="50px" type="number" {...inputStyle} value={sportData.price_normal} onChange={e => setSportData({...sportData, price_normal: parseInt(e.target.value)})}/>
                    </FormControl>
                    <Box mb={4}>
                        <Text fontSize="xs" fontWeight="900" color={textMuted} mb={3}>TIỆN ÍCH SÂN THƯỜNG</Text>
                        <SimpleGrid columns={2} spacing={3} bg={neumorphBg} p={4} borderRadius="2xl" boxShadow={neumorphActiveShadow}>
                            {COMMON_AMENITIES.slice(0, 6).map((item, idx) => (
                                <Checkbox key={idx} isChecked={sportData.amenities_normal.includes(item)} onChange={()=>toggleAmenity(item, 'normal')} colorScheme="blue">
                                    <Text fontSize="xs" fontWeight="bold">{item}</Text>
                                </Checkbox>
                            ))}
                        </SimpleGrid>
                    </Box>
                    <Box p={4} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow}>
                        <Button size="sm" w="100%" leftIcon={<FaCamera/>} onClick={() => fileRefNormal.current.click()} isLoading={uploading} bg={neumorphBg} boxShadow={neumorphShadow} borderRadius="xl">Tải ảnh Sân Thường</Button>
                        <input type="file" multiple ref={fileRefNormal} style={{display:'none'}} onChange={(e) => handleUpload(e, 'normal')} />
                        {sportData.images_normal.length > 0 && <SimpleGrid columns={3} spacing={2} mt={3}>{sportData.images_normal.map((img, idx) => (<Image key={idx} src={getImgUrl(img)} w="100%" h="60px" objectFit="cover" borderRadius="lg" onClick={()=>removeImage(idx, 'normal')} cursor="pointer" border="2px solid" borderColor={neumorphBg} />))}</SimpleGrid>}
                    </Box>
                </Box>

                {/* SÂN VIP SECTION */}
                <Box p={5} borderRadius="3xl" bg={neumorphBg} boxShadow={neumorphShadow} border="2px solid" borderColor="orange.200">
                    <Badge colorScheme="orange" variant="solid" px={3} py={1} borderRadius="lg" mb={4} fontWeight="900">CẤU HÌNH SÂN VIP 💎</Badge>
                    <FormControl mb={4}>
                        <FormLabel fontSize="xs" fontWeight="900" color="orange.500">GIÁ VIP / GIỜ (VNĐ)</FormLabel>
                        <Input h="50px" type="number" {...inputStyle} value={sportData.price_vip} onChange={e => setSportData({...sportData, price_vip: parseInt(e.target.value)})}/>
                    </FormControl>
                    <Box mb={4}>
                        <Text fontSize="xs" fontWeight="900" color="orange.500" mb={3}>TIỆN ÍCH VIP</Text>
                        <SimpleGrid columns={2} spacing={3} bg={neumorphBg} p={4} borderRadius="2xl" boxShadow={neumorphActiveShadow}>
                            {COMMON_AMENITIES.map((item, idx) => (
                                <Checkbox key={idx} isChecked={sportData.amenities_vip.includes(item)} onChange={()=>toggleAmenity(item, 'vip')} colorScheme="orange">
                                    <Text fontSize="xs" fontWeight="bold">{item}</Text>
                                </Checkbox>
                            ))}
                        </SimpleGrid>
                    </Box>
                    <Box p={4} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow}>
                        <Button size="sm" w="100%" colorScheme="orange" leftIcon={<FaCamera/>} onClick={() => fileRefVIP.current.click()} isLoading={uploading} borderRadius="xl">Tải ảnh Sân VIP</Button>
                        <input type="file" multiple ref={fileRefVIP} style={{display:'none'}} onChange={(e) => handleUpload(e, 'vip')} />
                        {sportData.images_vip.length > 0 && <SimpleGrid columns={3} spacing={2} mt={3}>{sportData.images_vip.map((img, idx) => (<Image key={idx} src={getImgUrl(img)} w="100%" h="60px" objectFit="cover" borderRadius="lg" onClick={()=>removeImage(idx, 'vip')} cursor="pointer" border="2px solid" borderColor={neumorphBg}/>))}</SimpleGrid>}
                    </Box>
                </Box>

                <VStack pt={4} spacing={4}>
                    <Button w="100%" h="55px" rounded="2xl" fontWeight="900" bgGradient="linear(to-r, blue.400, blue.600)" color="white" boxShadow="xl" onClick={handleSubmit} isLoading={isSubmitting} leftIcon={<FaSave/>}>
                        {isEditMode ? "LƯU CẤU HÌNH" : "XÁC NHẬN TẠO MÔN"}
                    </Button>
                    <HStack w="100%" spacing={4}>
                        <Button flex={1} h="50px" rounded="xl" bg={neumorphBg} boxShadow={neumorphShadow} onClick={onCancel} leftIcon={<FaBan/>}>Hủy</Button>
                        {isEditMode && <IconButton icon={<FaTrash />} colorScheme="red" h="50px" w="50px" rounded="xl" boxShadow={neumorphShadow} onClick={onDeleteSport} aria-label="Delete" />}
                    </HStack>
                </VStack>
            </VStack>
        </Box>
    );
};

// =========================================================
// 4. MAIN COMPONENT (FACILITY TAB - VENDOR)
// =========================================================
const FacilityTab = ({ facilities, sportTypes, user, fetchData, isMobile, searchQuery, searchTrigger }) => {
    // 🔥 1. ĐƯA TOÀN BỘ HOOKS LÊN ĐẦU COMPONENT ĐỂ CHỐNG CRASH
    const { colorMode } = useColorMode();
    const toast = useToast();
    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '6px 6px 12px #0d1117, -4px -4px 10px #2d3748');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #0d1117, inset -4px -4px 8px #2d3748');
    const textColor = useColorModeValue('gray.700', 'gray.100');

    // 🔥 XỬ LÝ SẠCH SẼ NHỮNG HOOKS BỊ NÉM VÀO VÒNG LẶP & ĐIỀU KIỆN TRƯỚC ĐÓ
    const borderColorGeneral = useColorModeValue('gray.200', 'gray.700');
    const borderColorHeader = useColorModeValue('gray.100', 'gray.700');

    // STATES
    const [hoveredCourtId, setHoveredCourtId] = useState(null);
    const [rightPanelState, setRightPanelState] = useState(null); 
    const [isEditing, setIsEditing] = useState(false); 
    const [uploading, setUploading] = useState(false);
    const [selectedFacility, setSelectedFacility] = useState(null); 
    const [editingSportData, setEditingSportData] = useState(null); 
    const [mapLayers, setMapLayers] = useState([]);
    const [activeMapLayer, setActiveMapLayer] = useState({ url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '&copy; OpenStreetMap', thumbnail: null });
    const [wardShape, setWardShape] = useState(null);
    const [formData, setFormData] = useState({ id: null, name: '', address: '', lat: null, lng: null, open_time: '06:00', close_time: '22:00', image_url: '' });

    useEffect(() => {
        const fetchBaseData = async () => {
            try {
                const resLayer = await axios.get(import.meta.env.VITE_API_URL + '/api/map/layers');
                setMapLayers(resLayer.data);
                const aLayer = resLayer.data.find(layer => layer.active === true) || resLayer.data[0];
                if (aLayer) setActiveMapLayer({ url: aLayer.url, attribution: aLayer.attribution || '', thumbnail: getLayerThumb(aLayer) });

                if (user?.approved_ward_id) {
                    const resWard = await axios.get(`${import.meta.env.VITE_API_URL}/api/courts/by-ward/${user.approved_ward_id}`);
                    if (resWard.data?.shape) setWardShape(typeof resWard.data.shape === 'string' ? JSON.parse(resWard.data.shape) : resWard.data.shape);
                }
            } catch (error) { console.error(error); }
        };
        fetchBaseData();
    }, [user]);

    const openCreateForm = () => { setFormData({ id: null, name: '', address: '', lat: null, lng: null, open_time: '06:00', close_time: '22:00', image_url: '' }); setIsEditing(false); setRightPanelState('facility'); };
    
    const openEditForm = (f) => { 
        const coords = getSafeCoords(f);
        setFormData({ id: f.id, name: f.name, address: f.address, lat: coords?.lat || null, lng: coords?.lng || null, open_time: f.open_time || '06:00', close_time: f.close_time || '22:00', image_url: f.image_url }); 
        setIsEditing(true); setRightPanelState('facility'); 
    };

    const handleFacilitySubmit = async () => {
        if (!formData.lat || !formData.lng || !formData.address) {
            return toast({ title: 'Bác chưa ghim vị trí hoặc thiếu địa chỉ!', status: 'warning' });
        }

        setUploading(true);
        try {
            const cleanLat = parseFloat(formData.lat);
            const cleanLng = parseFloat(formData.lng);

            const payload = {
                name: formData.name.trim(),
                address: formData.address.trim(),
                lat: cleanLat,   
                lng: cleanLng,   
                open_time: formData.open_time,
                close_time: formData.close_time,
                image_url: formData.image_url,
                owner_id: user.id
            };

            if (isEditing) {
                await axios.put(`${import.meta.env.VITE_API_URL}/api/facilities/${formData.id}`, payload);
                toast({ title: 'Cập nhật cơ sở ngon lành!', status: 'success' });
                setRightPanelState(null);
            } else {
                const res = await axios.post(import.meta.env.VITE_API_URL + '/api/facilities', payload);
                setSelectedFacility({ ...payload, id: res.data.id });
                toast({ title: 'Tạo cơ sở thành công!', status: 'success' });
                setRightPanelState('sport'); 
            }

            fetchData(); 
        } catch (e) {
            console.error("Lỗi gửi dữ liệu:", e);
            toast({ 
                title: 'Lỗi Database rồi bác ơi!', 
                description: e.response?.data?.message || "Kiểm tra lại kết nối Server", 
                status: 'error' 
            });
        } finally {
            setUploading(false);
        }
    };
    
    const openAddSport = (f) => { setSelectedFacility(f); setEditingSportData(null); setRightPanelState('sport'); };
    const openEditSport = async (f, s) => { 
        setSelectedFacility(f);
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/facilities/${f.id}/sports/${encodeURIComponent(s.sport_type)}`);
            setEditingSportData(res.data); setRightPanelState('sport');       
        } catch (e) { toast({ title: "Lỗi", status: "error" }); }
    };
    
    const handleDeleteSport = async () => {
        if(!window.confirm(`Xóa toàn bộ sân của môn ${editingSportData.sport_type}?`)) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/facilities/${selectedFacility.id}/sports/${encodeURIComponent(editingSportData.sport_type)}`);
            toast({ title: "Đã xóa!", status: "success" }); setRightPanelState(null); fetchData(); 
        } catch (error) { toast({ title: "Lỗi", status: "error" }); }
    };

    const handleImageUpload = async (e) => { 
        const file = e.target.files[0]; if (!file) return; setUploading(true); const fd = new FormData(); fd.append('image', file); 
        try { const res = await axios.post(import.meta.env.VITE_API_URL + '/api/upload', fd); setFormData(prev => ({ ...prev, image_url: res.data.url })); } 
        catch { toast({ title: 'Lỗi', status: 'error' }); } finally { setUploading(false); } 
    };

    const handleDelete = async (id) => { 
        if(window.confirm("Xóa?")) { 
            try { await axios.delete(`${import.meta.env.VITE_API_URL}/api/facilities/${id}`); toast({ title: "Đã xóa", status: "success" }); fetchData(); } 
            catch { toast({ title: "Lỗi", status: "error" }); } 
        } 
    };

    const VendorMapClicker = () => {
        useMapEvents({ click(e) { 
            if (rightPanelState !== 'facility') return; 
            if (isPointInWard(e.latlng.lat, e.latlng.lng, wardShape)) setFormData(prev => ({...prev, lat: e.latlng.lat, lng: e.latlng.lng})); 
            else toast({ title: "Ngoài ranh giới phường!", status: "error" }); 
        } });
        return null;
    };

    return (
        <Box h="100%" position="relative" overflow="hidden" bg={neumorphBg}>
            <Flex h="100%" direction={{ base: "column", md: "row" }}>
                
                {/* MAP AREA */}
                <Box flex={{ base: rightPanelState ? 1 : "0 0 45%", md: 1 }} position="relative" minH={{base: rightPanelState ? "40%" : "35%", md: "auto"}}>
                    <MapContainer center={[10.7769, 106.7009]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                        <TileLayer key={activeMapLayer.url + colorMode} url={colorMode === 'dark' && activeMapLayer.url.includes("openstreetmap") ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : activeMapLayer.url} attribution={activeMapLayer.attribution} />
                        <VendorMapClicker />
                        <MapSearchControl setFormData={setFormData} query={searchQuery} triggerSearch={searchTrigger} />
                        {wardShape && <><GeoJSON data={wardShape} style={{ color: 'red', weight: 4, fillOpacity: 0.05, dashArray: '10, 10' }} /><MapBoundsFlyTo shape={wardShape} /></>}
                        
                        {facilities.map(f => {
                            const coords = getSafeCoords(f);
                            if (!coords) return null;
                            return (
                                <Marker key={f.id} position={[coords.lat, coords.lng]} icon={createCircleMarker(f.image_url, false, hoveredCourtId === f.id)} eventHandlers={{ mouseover: () => setHoveredCourtId(f.id), mouseout: () => setHoveredCourtId(null) }}>
                                    <Popup><Text fontWeight="bold">{f.name}</Text></Popup>
                                </Marker>
                            );
                        })}
                        
                        {formData.lat && <Marker position={[formData.lat, formData.lng]} icon={createCircleMarker(formData.image_url, 'new', true)} />}
                    </MapContainer>

                    {/* LAYER MENU FLOATING */}
                    <Box position="absolute" top={{base: "150px", md:"20px"}} left="20px" zIndex={10000}>
                        <Menu placement="bottom-end">
                            <MenuButton as={Box} cursor="pointer" boxSize="45px"  borderRadius="full"  p={0} border="2px solid" borderColor="white" overflow="hidden">
                                {activeMapLayer.thumbnail ? <Image src={getImgUrl(activeMapLayer.thumbnail)} w="100%" h="100%" objectFit="cover" borderRadius="full" /> : <Flex w="100%" h="100%" align="center" justify="center"><Icon as={FaLayerGroup} color="blue.500" /></Flex>}
                            </MenuButton>
                            <MenuList minW="220px" bg={neumorphBg} borderRadius="2xl" border="none" boxShadow="2xl" p={1} zIndex={3000}>
                                
                                <SimpleGrid columns={2} spacing={3}>
                                    {mapLayers.map((layer) => (
                                        <Box key={layer.id} onClick={() => setActiveMapLayer({url: layer.url, attribution: layer.attribution, thumbnail: getLayerThumb(layer)})} cursor="pointer" borderRadius="xl" overflow="hidden" boxShadow={activeMapLayer.url === layer.url ? neumorphActiveShadow : neumorphShadow} p={1} transition="all 0.2s">
                                            <Image src={getImgUrl(getLayerThumb(layer))} h="50px" w="100%" objectFit="cover" borderRadius="lg" />
                                            <Text mt={1} fontSize="9px" fontWeight="900" textAlign="center" color={activeMapLayer.url === layer.url ? "blue.500" : textColor}>{layer.name.toUpperCase()}</Text>
                                        </Box>
                                    ))}
                                </SimpleGrid>
                            </MenuList>
                        </Menu>
                    </Box>

                    {isMobile && !rightPanelState && (
                        <Button
  position="absolute"
  bottom="25px"
  left="20px"
  zIndex={1000}
  colorScheme="blue"
  bgGradient="linear(to-r, blue.400, blue.600)"
  color="white"
  borderRadius="full"
  w="45px"
  h="45px"
  p={0}
  shadow="2xl"
  onClick={openCreateForm}
>
  <FaPlus />
</Button>
                    )}
                </Box>
                
                {/* SIDEBAR LIST / FORM AREA */}
                <Box w={{ base: "100%", md: "400px" }} flex={1} h="100%" display="flex" flexDirection="column" bg={neumorphBg} borderLeft={{ md: "1px solid" }} borderColor={borderColorGeneral} overflow="hidden" zIndex={2001}>
                    {rightPanelState === 'facility' ? (
                        <Box h="100%" bg={neumorphBg} boxShadow="dark-lg"><FacilityForm formData={formData} setFormData={setFormData} handleImageUpload={handleImageUpload} handleSubmit={handleFacilitySubmit} uploading={uploading} onCancel={() => setRightPanelState(null)} isEditing={isEditing} user={user} wardShape={wardShape} isPointInWard={isPointInWard} /></Box>
                    ) : rightPanelState === 'sport' ? (
                        <Box h="100%" bg={neumorphBg} boxShadow="dark-lg"><SportConfigForm facility={selectedFacility} sportTypes={sportTypes} onSave={fetchData} initialData={editingSportData} onDeleteSport={handleDeleteSport} user={user} onCancel={() => setRightPanelState(null)} /></Box>
                    ) : (
                        <>
                            {!isMobile && (
                                <Flex p={5} justify="space-between" align="center" bg={neumorphBg} borderBottom="1px solid" borderColor={borderColorHeader}>
                                    <VStack align="start" spacing={0}>
                                        <Box
                                        px={4}
                                        py={2}
                                        borderRadius="xl"
                                        bg={neumorphBg}
                                        boxShadow={neumorphActiveShadow}
                                        >
                                        <Heading
                                            size="md"
                                            color="blue.500"
                                            fontWeight="900"
                                        >
                                            CƠ SỞ CỦA BẠN
                                        </Heading>

                                        <Text
                                            fontSize="10px"
                                            color="blue.500"
                                            fontWeight="bold"
                                        >
                                            {facilities.length} ĐỊA ĐIỂM ĐÃ TẠO
                                        </Text>
                                        </Box>
                                    </VStack>
                                    <Box
  px={2}
  py={1}
  borderRadius="xl"
  bg={neumorphBg}
  boxShadow={neumorphShadow}
  _hover={{ boxShadow: neumorphActiveShadow }}
  _active={{ boxShadow: neumorphActiveShadow }}
  transition="all 0.2s"
>
  <Button
    size="sm"
    h="36px"
    px={4}
    borderRadius="lg"
    variant="ghost"
    leftIcon={<FaPlus />}
    color="blue.500"
    onClick={openCreateForm}
    fontWeight="900"
  >
    TẠO CƠ SỞ
  </Button>
</Box>
                                </Flex>
                            )}
                            
                            {/* 🔥 ĐÃ GỠ LÕI FACILITYLISTCONTENT ĐỂ CHỐNG LỖI HIỂN THỊ */}
                            <Box flex={1} overflowY="auto" p={4} css={{ scrollbarWidth: "none" }}>
                                <VStack spacing={5} align="stretch" pb={20}>
                                    {facilities.length === 0 && <VStack py={10} bg={neumorphBg} borderRadius="2xl" boxShadow={neumorphActiveShadow}><Text color="gray.500" fontWeight="bold">Bạn chưa tạo cơ sở nào.</Text></VStack>}
                                    {facilities.map(f => {
                                        const coords = getSafeCoords(f);
                                        return (
                                            <Box key={f.id} bg={neumorphBg} p={4} borderRadius="2xl" boxShadow={neumorphShadow} border="none" onMouseEnter={() => setHoveredCourtId(f.id)} onMouseLeave={() => setHoveredCourtId(null)} transition="all 0.2s" _hover={{ transform: 'scale(0.99)', boxShadow: neumorphActiveShadow }}>
                                                <HStack mb={3} align="start" spacing={4}>
                                                    <Box boxSize="75px" borderRadius="xl" overflow="hidden" boxShadow={neumorphActiveShadow} border="3px solid" borderColor={neumorphBg} flexShrink={0}>
                                                        <Image src={getImgUrl(f.image_url)} w="100%" h="100%" objectFit="cover" fallbackSrc="https://placehold.co/75x75?text=Sport"/>
                                                    </Box>
                                                    <Box flex={1}>
                                                        <Text fontWeight="900" fontSize="md" color={textColor} noOfLines={1}>{f.name}</Text>
                                                        <Text fontSize="xs" color="gray.500" noOfLines={2} fontWeight="bold" mt={1}><Icon as={FaMapMarkerAlt} mr={1} color="red.500"/>{f.address}</Text>
                                                        
                                                        {!coords && (
                                                            <Text fontSize="9px" color="red.500" fontWeight="900" animation="pulse 1.5s infinite" mt={1}>
                                                                ⚠️ CHƯA GHIM TỌA ĐỘ TRÊN BẢN ĐỒ
                                                            </Text>
                                                        )}
                                                    </Box>
                                                    <VStack spacing={2}>
                                                        <IconButton icon={<FaEdit/>} size="sm" isRound bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} color="blue.500" onClick={() => openEditForm(f)}/>
                                                        <IconButton icon={<FaTrash/>} size="sm" isRound bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} color="red.400" onClick={() => handleDelete(f.id)}/>
                                                    </VStack>
                                                </HStack>
                                                <Divider borderColor={borderColorGeneral} opacity={0.5} mb={3} />
                                                <HStack justify="space-between">
                                                    <Wrap spacing={2}>
                                                        {f.sports?.map(s => (
                                                            <Box key={s.sport_type} fontSize="10px" fontWeight="900" px={3} py={1} borderRadius="lg" bg={neumorphBg} boxShadow={neumorphActiveShadow} color="teal.500" cursor="pointer" onClick={() => openEditSport(f, s)} display="flex" alignItems="center">
                                                                {s.sport_type.toUpperCase()} <Icon as={FaChevronRight} ml={1.5} boxSize={2}/>
                                                            </Box>
                                                        ))}
                                                    </Wrap>
                                                    <Button size="xs" variant="ghost" colorScheme="blue" fontWeight="900" onClick={() => openAddSport(f)}>+ MÔN MỚI</Button>
                                                </HStack>
                                            </Box>
                                        );
                                    })}
                                </VStack>
                            </Box>
                        </>
                    )}
                </Box>
            </Flex>
        </Box>
    );
};
export default FacilityTab;