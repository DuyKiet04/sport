import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import { 
    Box, VStack, Heading, Button, Image, useToast, Text, HStack, 
    IconButton, Card, CardBody, Divider, Flex, Modal, 
    ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, 
    ModalBody, FormControl, FormLabel, Select, Input, Wrap, Tag, 
    SimpleGrid, Icon, Checkbox, Badge
} from '@chakra-ui/react';
import { FaPlus, FaTrash, FaCamera, FaTimes, FaEdit, FaMapMarkerAlt, FaStar, FaImages } from 'react-icons/fa';
import FacilityForm from './FacilityForm';
import { createCircleMarker, LocationPicker, MapSearchControl, getImgUrl } from './MapTools';

const COMMON_AMENITIES = [
    "Wifi miễn phí", "Bãi giữ xe", "Canteen / Giải khát", 
    "Phòng thay đồ", "Tủ đồ (Locker)", "Cho thuê giày/áo", 
    "Trọng tài", "Dạy học", "Có mái che", "Đèn chiếu sáng tốt",
    "Ghế massage", "Máy lạnh", "Nước uống Free"
];

// =========================================================
// 1. MODAL CẤU HÌNH MÔN (ĐÃ FIX LỖI MẤT DỮ LIỆU KHI SỬA)
// =========================================================
const SportConfigModal = ({ isOpen, onClose, facility, sportTypes, onSave, initialData }) => {
    // initialData bây giờ chứa đầy đủ thông tin lấy từ API về
    const isEditMode = !!initialData; 
    const toast = useToast();
    
    const fileRefNormal = useRef();
    const fileRefVIP = useRef();

    const [sportData, setSportData] = useState({ 
        sport_type: '', 
        normal_count: 5, vip_count: 2, 
        price_normal: 100000, price_vip: 200000, 
        amenities_normal: [], amenities_vip: [],
        images_normal: [], images_vip: []
    });
    const [uploading, setUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 🔥 FILL DỮ LIỆU VÀO FORM KHI MỞ MODAL
    useEffect(() => {
        if (isOpen) {
            if (isEditMode && initialData) {
                // Parse amenities từ chuỗi sang mảng (nếu cần)
                const parseAmenities = (str) => {
                    if (!str) return [];
                    return Array.isArray(str) ? str : str.split(',');
                };

                setSportData({
                    sport_type: initialData.sport_type,
                    normal_count: initialData.normal_count || 0,
                    vip_count: initialData.vip_count || 0,
                    
                    price_normal: initialData.price_normal || 0,
                    price_vip: initialData.price_vip || 0,
                    
                    amenities_normal: parseAmenities(initialData.amenities_normal),
                    amenities_vip: parseAmenities(initialData.amenities_vip),
                    
                    images_normal: initialData.images_normal || [],
                    images_vip: initialData.images_vip || []
                });
            } else {
                // Reset form khi tạo mới
                setSportData({ 
                    sport_type: '', normal_count: 5, vip_count: 1, 
                    price_normal: 100000, price_vip: 200000, 
                    amenities_normal: [], amenities_vip: [], 
                    images_normal: [], images_vip: [] 
                });
            }
        }
    }, [isOpen, initialData, isEditMode]);

    const toggleAmenity = (item, type) => {
        const key = type === 'normal' ? 'amenities_normal' : 'amenities_vip';
        setSportData(prev => {
            const list = prev[key];
            if (list.includes(item)) return { ...prev, [key]: list.filter(a => a !== item) };
            return { ...prev, [key]: [...list, item] };
        });
    };

    const handleUpload = async (e, type) => {
        const files = e.target.files; if (!files.length) return;
        setUploading(true); const fd = new FormData();
        for (let i = 0; i < files.length; i++) { fd.append('images', files[i]); }
        try {
            const res = await axios.post('http://localhost:5000/api/upload-multiple', fd);
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

            if (isEditMode) {
                await axios.put(`http://localhost:5000/api/facilities/${facility.id}/sports/${sportData.sport_type}`, payload);
                toast({ title: "Cập nhật thành công!", status: "success" });
            } else {
                await axios.post(`http://localhost:5000/api/facilities/${facility.id}/sports`, payload);
                toast({ title: "Tạo thành công!", status: "success" });
            }
            onSave(); onClose();
        } catch (e) { toast({ title: "Lỗi", description: e.response?.data?.error, status: "error" }); } 
        finally { setIsSubmitting(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered scrollBehavior="inside">
            <ModalOverlay /><ModalContent borderRadius="xl">
                <ModalHeader>{isEditMode ? `Sửa: ${sportData.sport_type}` : `Thêm Môn: ${facility?.name}`}</ModalHeader>
                <ModalCloseButton />
                <ModalBody pb={6}>
                    <VStack spacing={4} align="stretch">
                        
                        <FormControl isRequired isDisabled={isEditMode}>
                            <FormLabel fontSize="sm" fontWeight="bold">Môn Thể Thao</FormLabel>
                            <Select placeholder="Chọn môn..." value={sportData.sport_type} onChange={e => setSportData({...sportData, sport_type: e.target.value})}>
                                {sportTypes.map(t => <option key={t.id} value={t.code}>{t.name}</option>)}
                            </Select>
                        </FormControl>

                        {/* Luôn hiện ô nhập số lượng (kể cả khi sửa) để chủ sân biết mình đang có bao nhiêu */}
                        <Box bg="blue.50" p={3} borderRadius="md" border="1px dashed" borderColor="blue.300">
                            <HStack justify="center" spacing={8}>
                                <FormControl w="150px">
                                    <FormLabel fontSize="xs">Sân Thường</FormLabel>
                                    {/* Khi sửa thì disable ô này để tránh lỗi logic xóa sân cũ */}
                                    <Input type="number" bg="white" value={sportData.normal_count} isReadOnly={isEditMode} onChange={e => setSportData({...sportData, normal_count: e.target.value})}/>
                                </FormControl>
                                <Text mt={6} fontWeight="bold" fontSize="xl">+</Text>
                                <FormControl w="150px">
                                    <FormLabel fontSize="xs" color="orange.600">Sân VIP</FormLabel>
                                    <Input type="number" bg="white" value={sportData.vip_count} isReadOnly={isEditMode} onChange={e => setSportData({...sportData, vip_count: e.target.value})}/>
                                </FormControl>
                            </HStack>
                            {isEditMode && <Text fontSize="xs" color="red.500" textAlign="center" mt={1}>* Không thể đổi số lượng khi đang sửa (Hãy xóa đi tạo lại nếu cần)</Text>}
                        </Box>

                        <Divider/>

                        <Flex gap={6}>
                            {/* CỘT TRÁI: SÂN THƯỜNG */}
                            <VStack flex={1} align="stretch" spacing={3} borderRight="1px solid" borderColor="gray.200" pr={4}>
                                <Badge colorScheme="gray" p={1} textAlign="center">CẤU HÌNH SÂN THƯỜNG</Badge>
                                <FormControl><FormLabel fontSize="xs">Giá / giờ</FormLabel><Input type="number" value={sportData.price_normal} onChange={e => setSportData({...sportData, price_normal: parseInt(e.target.value)})}/></FormControl>
                                
                                <Box p={2} border="1px dashed" borderColor="gray.300" borderRadius="md" bg="gray.50">
                                    <FormLabel fontSize="xs"><Icon as={FaImages} mr={1}/>Ảnh Sân Thường ({sportData.images_normal.length})</FormLabel>
                                    <Button size="xs" leftIcon={<FaCamera/>} onClick={() => fileRefNormal.current.click()} isLoading={uploading} w="100%" mb={2}>Thêm ảnh</Button>
                                    <input type="file" multiple ref={fileRefNormal} style={{display:'none'}} onChange={(e) => handleUpload(e, 'normal')} accept="image/*"/>
                                    {sportData.images_normal.length > 0 && <SimpleGrid columns={3} spacing={1}>{sportData.images_normal.map((img, idx) => (<Image key={idx} src={getImgUrl(img)} w="100%" h="40px" objectFit="cover" borderRadius="sm" onClick={()=>removeImage(idx, 'normal')} cursor="pointer"/>))}</SimpleGrid>}
                                </Box>

                                <Box>
                                    <Text fontSize="xs" fontWeight="bold" mb={1}>Tiện ích:</Text>
                                    <VStack align="start" spacing={0}>
                                        {COMMON_AMENITIES.slice(0, 6).map((item, idx) => (
                                            <Checkbox key={idx} isChecked={sportData.amenities_normal.includes(item)} onChange={()=>toggleAmenity(item, 'normal')} colorScheme="gray" size="sm"><Text fontSize="xs">{item}</Text></Checkbox>
                                        ))}
                                    </VStack>
                                </Box>
                            </VStack>

                            {/* CỘT PHẢI: SÂN VIP */}
                            <VStack flex={1} align="stretch" spacing={3} bg="orange.50" p={3} borderRadius="lg" border="1px solid" borderColor="orange.200">
                                <Badge colorScheme="orange" p={1} textAlign="center"><Icon as={FaStar} mr={1}/>CẤU HÌNH SÂN VIP</Badge>
                                <FormControl><FormLabel fontSize="xs">Giá VIP / giờ</FormLabel><Input type="number" bg="white" value={sportData.price_vip} onChange={e => setSportData({...sportData, price_vip: parseInt(e.target.value)})}/></FormControl>
                                
                                <Box p={2} border="1px dashed" borderColor="orange.300" borderRadius="md" bg="white">
                                    <FormLabel fontSize="xs" color="orange.600"><Icon as={FaImages} mr={1}/>Ảnh Sân VIP ({sportData.images_vip.length})</FormLabel>
                                    <Button size="xs" colorScheme="orange" leftIcon={<FaCamera/>} onClick={() => fileRefVIP.current.click()} isLoading={uploading} w="100%" mb={2}>Thêm ảnh VIP</Button>
                                    <input type="file" multiple ref={fileRefVIP} style={{display:'none'}} onChange={(e) => handleUpload(e, 'vip')} accept="image/*"/>
                                    {sportData.images_vip.length > 0 && <SimpleGrid columns={3} spacing={1}>{sportData.images_vip.map((img, idx) => (<Image key={idx} src={getImgUrl(img)} w="100%" h="40px" objectFit="cover" borderRadius="sm" onClick={()=>removeImage(idx, 'vip')} cursor="pointer"/>))}</SimpleGrid>}
                                </Box>

                                <Box>
                                    <Text fontSize="xs" fontWeight="bold" mb={1} color="orange.700">Tiện ích VIP:</Text>
                                    <VStack align="start" spacing={0}>
                                        {COMMON_AMENITIES.map((item, idx) => (
                                            <Checkbox key={idx} isChecked={sportData.amenities_vip.includes(item)} onChange={()=>toggleAmenity(item, 'vip')} colorScheme="orange" size="sm"><Text fontSize="xs">{item}</Text></Checkbox>
                                        ))}
                                    </VStack>
                                </Box>
                            </VStack>
                        </Flex>
                        
                        <Button w="100%" colorScheme="blue" onClick={handleSubmit} isLoading={isSubmitting} mt={2} size="lg">
                            {isEditMode ? "Lưu Thay Đổi" : "Xác Nhận Tạo"}
                        </Button>
                    </VStack>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

// =========================================================
// 2. MAIN COMPONENT (FACILITY TAB)
// =========================================================
const FacilityTab = ({ facilities, sportTypes, user, fetchData, isMobile }) => {
    const [hoveredCourtId, setHoveredCourtId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false); 
    const [uploading, setUploading] = useState(false);
    const [selectedFacility, setSelectedFacility] = useState(null); 
    
    // Modal Config State
    const [showSportModal, setShowSportModal] = useState(false);
    const [editingSportData, setEditingSportData] = useState(null); // Dữ liệu chi tiết lấy từ API

    const toast = useToast();
    const [formData, setFormData] = useState({ id: null, name: '', address: '', lat: null, lng: null, open_time: '06:00', close_time: '22:00', image_url: '' });

    // --- FORM ĐỊA ĐIỂM (CÁI VỎ) ---
    const openCreateForm = () => { setFormData({ id: null, name: '', address: '', lat: null, lng: null, open_time: '06:00', close_time: '22:00', image_url: '' }); setIsEditing(false); setShowForm(true); };
    
    // 🔥 FIX LỖI: Điền dữ liệu vào form Sửa Địa Điểm
    const openEditForm = (f) => {
        setFormData({
            id: f.id,
            name: f.name,
            address: f.address,
            lat: f.lat,
            lng: f.lng,
            open_time: f.open_time || '06:00',
            close_time: f.close_time || '22:00',
            image_url: f.image_url
        });
        setIsEditing(true); 
        setShowForm(true);
    };

    const handleFacilitySubmit = async () => {
        if (!formData.lat || !formData.lng || !formData.address) return toast({ title: 'Thiếu thông tin!', status: 'warning' });
        setUploading(true);
        try {
            if (isEditing) {
                await axios.put(`http://localhost:5000/api/facilities/${formData.id}`, formData);
                toast({ title: 'Cập nhật địa điểm thành công!', status: 'success' }); setShowForm(false);
            } else {
                const res = await axios.post('http://localhost:5000/api/facilities', { ...formData, owner_id: user.id });
                toast({ title: 'Đã tạo địa điểm!', status: 'success' });
                const newFac = { ...formData, id: res.data.id };
                setSelectedFacility(newFac); setShowForm(false); 
                setTimeout(() => openAddSport(newFac), 500);
            }
            fetchData();
        } catch (e) { toast({ title: 'Lỗi', description: e.response?.data?.error, status: 'error' }); } finally { setUploading(false); }
    };

    // --- FORM CẤU HÌNH MÔN (CÁI RUỘT) ---
    const openAddSport = (f) => { 
        setSelectedFacility(f); 
        setEditingSportData(null); // Null = Thêm mới
        setShowSportModal(true); 
    };

    // 🔥 HÀM MỚI: GỌI API LẤY CHI TIẾT TRƯỚC KHI MỞ MODAL SỬA
    const openEditSport = async (f, s) => { 
        setSelectedFacility(f);
        try {
            // Gọi API lấy full data (giá, ảnh, tiện ích...)
            const res = await axios.get(`http://localhost:5000/api/facilities/${f.id}/sports/${s.sport_type}`);
            setEditingSportData(res.data); // Lưu data vào state
            setShowSportModal(true);       // Mở modal lên
        } catch (e) {
            toast({ title: "Lỗi tải dữ liệu sân", status: "error" });
        }
    };

    const handleImageUpload = async (e) => { const file = e.target.files[0]; if (!file) return; setUploading(true); const fd = new FormData(); fd.append('image', file); try { const res = await axios.post('http://localhost:5000/api/upload', fd); setFormData(prev => ({ ...prev, image_url: res.data.url })); } catch { toast({ title: 'Lỗi', status: 'error' }); } finally { setUploading(false); } };
    const handleDelete = async (id) => { if(window.confirm("Xóa?")) { try { await axios.delete(`http://localhost:5000/api/facilities/${id}`); toast({ title: "Đã xóa", status: "success" }); fetchData(); } catch { toast({ title: "Lỗi", status: "error" }); } } };

    return (
        <Box h="100%" position="relative">
            <Flex h="100%">
                <Box flex={1} position="relative">
                    <MapContainer center={[10.7769, 106.7009]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <LocationPicker setFormData={setFormData} />
                        <MapSearchControl setFormData={setFormData} />
                        {facilities.map(f => f.lat && (<Marker key={f.id} position={[f.lat, f.lng]} icon={createCircleMarker(f.image_url, false, hoveredCourtId === f.id)} eventHandlers={{ mouseover: () => setHoveredCourtId(f.id), mouseout: () => setHoveredCourtId(null) }}><Popup><Text fontWeight="bold">{f.name}</Text></Popup></Marker>))}
                        {formData.lat && <Marker position={[formData.lat, formData.lng]} icon={createCircleMarker(formData.image_url, 'new', true)} />}
                    </MapContainer>
                    {showForm && (<Box position="absolute" top={4} left={4} bottom={4} w="350px" className="glass-panel" borderRadius="xl" zIndex={1000} shadow="dark-lg"><FacilityForm formData={formData} setFormData={setFormData} handleImageUpload={handleImageUpload} handleSubmit={handleFacilitySubmit} uploading={uploading} onCancel={()=>setShowForm(false)} isEditing={isEditing} /></Box>)}
                </Box>
                {!showForm && !isMobile && (
                    <Box w="380px" bg="gray.50" borderLeft="1px solid" borderColor="gray.200" display="flex" flexDirection="column">
                        <Flex p={4} justify="space-between" bg="white" borderBottom="1px solid" borderColor="gray.200"><Heading size="sm">🏢 Địa điểm ({facilities.length})</Heading><Button size="sm" leftIcon={<FaPlus/>} colorScheme="green" onClick={openCreateForm}>Tạo mới</Button></Flex>
                        <VStack p={4} spacing={4} flex={1} overflowY="auto" className="custom-scroll">
                            {facilities.map(f => (
                                <Card key={f.id} w="100%" variant="outline" _hover={{shadow:'md', borderColor: 'blue.300'}} onMouseEnter={() => setHoveredCourtId(f.id)} onMouseLeave={() => setHoveredCourtId(null)} bg="white">
                                    <CardBody p={3}>
                                        <HStack mb={2} align="start">
                                            <Image src={getImgUrl(f.image_url)} boxSize="60px" borderRadius="md" objectFit="cover" fallbackSrc="https://placehold.co/60x60?text=San"/>
                                            <Box flex={1}><Text fontWeight="bold" fontSize="sm">{f.name}</Text><Text fontSize="xs" color="gray.500" noOfLines={2}><Icon as={FaMapMarkerAlt} mr={1} color="red.400"/>{f.address}</Text></Box>
                                            
                                            {/* 🔥 NÚT SỬA ĐỊA ĐIỂM */}
                                            <VStack spacing={1}><IconButton icon={<FaEdit/>} size="xs" colorScheme="blue" variant="outline" onClick={(e)=>{e.stopPropagation(); openEditForm(f)}}/><IconButton icon={<FaTrash/>} size="xs" colorScheme="red" variant="ghost" onClick={(e)=>{e.stopPropagation(); handleDelete(f.id)}}/></VStack>
                                        </HStack>
                                        <Divider my={2}/>
                                        <HStack justify="space-between" align="center">
                                            {f.sports && f.sports.length > 0 ? (
                                                <Wrap spacing={2}>{f.sports.map(s => (
                                                    <Tag 
                                                        key={s.sport_type} size="sm" colorScheme="teal" variant="subtle" cursor="pointer" 
                                                        _hover={{ bg: "teal.100", border: "1px solid teal" }}
                                                        // 🔥 NÚT SỬA CẤU HÌNH MÔN (Có gọi API lấy dữ liệu)
                                                        onClick={() => openEditSport(f, s)}
                                                    >
                                                        {s.sport_type}: {s.total_courts} <Icon as={FaEdit} ml={1} w={2} h={2}/>
                                                    </Tag>
                                                ))}</Wrap>
                                            ) : <Text fontSize="xs" color="gray.400" fontStyle="italic">Chưa có môn</Text>}
                                            <Button size="xs" variant="ghost" colorScheme="blue" onClick={() => openAddSport(f)}>+ Thêm môn</Button>
                                        </HStack>
                                    </CardBody>
                                </Card>
                            ))}
                        </VStack>
                    </Box>
                )}
            </Flex>
            
            {/* Modal Cấu hình môn */}
            <SportConfigModal 
                isOpen={showSportModal} 
                onClose={()=>setShowSportModal(false)} 
                facility={selectedFacility} 
                sportTypes={sportTypes} 
                onSave={fetchData} 
                initialData={editingSportData} // Truyền dữ liệu chi tiết vào đây
            />
        </Box>
    );
};
export default FacilityTab;