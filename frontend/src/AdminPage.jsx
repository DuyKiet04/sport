import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
    Box, 
    VStack, 
    Heading, 
    FormControl, 
    FormLabel, 
    Input, 
    Select, 
    Button, 
    Image, 
    useToast, 
    Text, 
    HStack, 
    Badge, 
    Tabs, 
    TabList, 
    TabPanels, 
    Tab, 
    TabPanel, 
    Table, 
    Thead, 
    Tbody, 
    Tr, 
    Th, 
    Td,
    IconButton, 
    Divider, 
    Card, 
    CardBody, 
    SimpleGrid, 
    Stat, 
    StatLabel, 
    StatNumber, 
    StatHelpText,
    Checkbox, 
    CheckboxGroup, 
    Grid, 
    GridItem, 
    Container, 
    Icon,
    useBreakpointValue, 
    Flex, 
    Spacer, 
    useColorModeValue, 
    useColorMode, 
    Avatar, 
    Progress, 
    FormHelperText, 
    InputGroup, 
    InputRightElement
} from '@chakra-ui/react';
import { 
    FaEdit, 
    FaTrash, 
    FaChartBar, 
    FaFacebook, 
    FaPhone, 
    FaCheck, 
    FaSearch, 
    FaLocationArrow,
    FaMapMarkedAlt, 
    FaCalendarCheck, 
    FaUserCog, 
    FaPlus, 
    FaSignOutAlt,
    FaMoon, 
    FaSun, 
    FaCamera, 
    FaTimes, 
    FaFilter, 
    FaBars, 
    FaArrowRight, 
    FaImages, 
    FaCrown
} from 'react-icons/fa';
import { SiZalo } from 'react-icons/si';
import { 
    Chart as ChartJS, 
    CategoryScale, 
    LinearScale, 
    BarElement, 
    Title, 
    Tooltip as ChartTooltip, 
    Legend 
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';

// Đăng ký ChartJS
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend);

// --- HELPERS ---
const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url.substring(1) : url;
    return `http://localhost:5000/${cleanPath}`;
};

// --- STYLES ---
const customStyles = `
  .hide-scrollbar::-webkit-scrollbar { display: none; }
  .custom-scroll::-webkit-scrollbar { width: 4px; }
  .custom-scroll::-webkit-scrollbar-track { background: transparent; }
  .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }
  .admin-marker { background: none; border: none; }
  
  /* Glass Panel chuẩn để không bị vỡ giao diện */
  .glass-panel {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
  }
  .dark .glass-panel {
    background: rgba(26, 32, 44, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
`;

// --- MAP COMPONENTS ---
const createCircleMarker = (iconUrl, type, isHovered) => {
    const finalIcon = iconUrl && !iconUrl.includes('placeholder') ? getImgUrl(iconUrl) : 'https://cdn-icons-png.flaticon.com/512/857/857681.png';
    const borderColor = type === 'new' ? '#F6E05E' : '#38A169'; 
    const size = isHovered ? 60 : 50;
    
    return L.divIcon({ 
        className: `admin-marker ${isHovered ? 'marker-active' : ''}`, 
        html: `<div style="width: ${size}px; height: ${size}px; background: white; border-radius: 50%; border: 3px solid ${borderColor}; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center; overflow: hidden; transition: all 0.3s ease;">
               <img src="${finalIcon}" style="width: 100%; height: 100%; object-fit: cover;">
              </div>`, 
        iconSize: [size, size], iconAnchor: [size/2, size], popupAnchor: [0, -size] 
    });
};

const LocationPicker = ({ setFormData }) => {
    useMapEvents({
        click(e) {
            setFormData(prev => ({ 
                ...prev, 
                lat: e.latlng.lat, 
                lng: e.latlng.lng 
            }));
        },
    });
    return null;
};

const MapSearchControl = ({ setFormData }) => {
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
        try {
            const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
            if (res.data && res.data.length > 0) {
                const { lat, lon, display_name } = res.data[0];
                map.flyTo([lat, lon], 16);
                setFormData(prev => ({ 
                    ...prev, 
                    lat: parseFloat(lat), 
                    lng: parseFloat(lon), 
                    address: display_name 
                }));
                toast({ title: 'Đã tìm thấy!', status: 'success', position: 'top' });
            } else {
                toast({ title: 'Không tìm thấy', status: 'warning', position: 'top' });
            }
        } catch (e) { 
            toast({ title: 'Lỗi tìm kiếm', status: 'error' }); 
        } finally { 
            setSearching(false); 
        }
    };

    return (
        <Box ref={containerRef} position="absolute" top={4} left="50%" transform="translateX(-50%)" zIndex={1000} w="90%" maxW="350px" bg="white" borderRadius="full" p={1} shadow="lg">
            <InputGroup size="md">
                <Input placeholder="Tìm địa điểm..." borderRadius="full" border="none" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} pl={4} _focus={{boxShadow: 'none'}}/>
                <InputRightElement width="3rem">
                    <IconButton icon={<FaSearch />} size="sm" isRound colorScheme="blue" onClick={handleSearch} isLoading={searching} />
                </InputRightElement>
            </InputGroup>
        </Box>
    );
};

// --- STEP FORM ---
const StepForm = ({ formData, setFormData, sportTypes, handleImageUpload, handleSubmit, uploading, onCancel, currentStep, setCurrentStep }) => {
    const steps = [
        { title: "Cơ bản", icon: FaEdit },
        { title: "Cấu hình", icon: FaCrown },
        { title: "Vị trí & Ảnh", icon: FaLocationArrow },
    ];
    const amenityOptions = ["Wifi", "Gửi xe", "Căn tin", "WC", "Đèn", "Nước", "Khăn lạnh", "Máy lạnh"];

    const isStepValid = () => {
        if (currentStep === 0) return formData.name && formData.type && formData.open_time && formData.close_time;
        if (currentStep === 1) return formData.id ? formData.price : formData.price_normal;
        if (currentStep === 2) return formData.lat && formData.lng;
        return true;
    };

    return (
        <VStack spacing={0} h="100%" display="flex" flexDirection="column">
            <Box w="100%" px={4} pt={4} pb={2} bg="white" borderBottom="1px solid" borderColor="gray.100">
                <Flex justify="space-between" mb={2}>
                    {steps.map((s, i) => (
                        <VStack key={i} spacing={1} opacity={currentStep === i ? 1 : 0.4}>
                            <Icon as={s.icon} color={currentStep >= i ? "blue.500" : "gray.400"} />
                            <Text fontSize="10px" fontWeight="bold">{s.title}</Text>
                        </VStack>
                    ))}
                </Flex>
                <Progress value={((currentStep + 1) / 3) * 100} size="xs" colorScheme="blue" borderRadius="full" />
            </Box>

            <Box flex={1} w="100%" overflowY="auto" className="custom-scroll" px={4} py={4}>
                {currentStep === 0 && (
                    <VStack spacing={4}>
                        <FormControl isRequired>
                            <FormLabel fontSize="xs">TÊN SÂN</FormLabel>
                            <Input value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} bg="white"/>
                        </FormControl>
                        <FormControl isRequired>
                            <FormLabel fontSize="xs">LOẠI HÌNH</FormLabel>
                            <Select value={formData.type} onChange={e=>setFormData({...formData, type: e.target.value})} bg="white">
                                {sportTypes.map(t => <option key={t.id} value={t.code}>{t.name}</option>)}
                            </Select>
                        </FormControl>
                        <HStack>
                            <FormControl>
                                <FormLabel fontSize="xs">MỞ</FormLabel>
                                <Input type="time" value={formData.open_time} onChange={e=>setFormData({...formData, open_time: e.target.value})} bg="white"/>
                            </FormControl>
                            <FormControl>
                                <FormLabel fontSize="xs">ĐÓNG</FormLabel>
                                <Input type="time" value={formData.close_time} onChange={e=>setFormData({...formData, close_time: e.target.value})} bg="white"/>
                            </FormControl>
                        </HStack>
                    </VStack>
                )}

                {currentStep === 1 && (
                    <VStack spacing={4}>
                        {!formData.id ? (
                            <>
                                <Box p={3} bg="blue.50" borderRadius="md" w="100%">
                                    <Text fontSize="sm" fontWeight="bold" color="blue.700">🔢 Số lượng</Text>
                                    <HStack>
                                        <FormControl>
                                            <FormLabel fontSize="xs">Tổng</FormLabel>
                                            <Input type="number" bg="white" value={formData.total_courts} onChange={e=>setFormData({...formData, total_courts: parseInt(e.target.value)||1})}/>
                                        </FormControl>
                                        <FormControl>
                                            <FormLabel fontSize="xs">VIP</FormLabel>
                                            <Input type="number" bg="white" value={formData.vip_count} max={formData.total_courts} onChange={e=>setFormData({...formData, vip_count: parseInt(e.target.value)||0})}/>
                                        </FormControl>
                                    </HStack>
                                </Box>
                                <Box w="100%">
                                    <Badge colorScheme="green">Thường</Badge>
                                    <InputGroup size="sm" my={2}>
                                        <Input placeholder="Giá" type="number" value={formData.price_normal} onChange={e=>setFormData({...formData, price_normal: e.target.value})} bg="white"/>
                                        <InputRightElement children="đ"/>
                                    </InputGroup>
                                    <CheckboxGroup colorScheme="green" value={formData.amenities_normal} onChange={(val)=>setFormData({...formData, amenities_normal: val})}>
                                        <Grid templateColumns="repeat(3, 1fr)" gap={1}>
                                            {amenityOptions.slice(0,6).map(i=><GridItem key={i}><Checkbox value={i} size="sm"><Text fontSize="10px">{i}</Text></Checkbox></GridItem>)}
                                        </Grid>
                                    </CheckboxGroup>
                                </Box>
                                {formData.vip_count > 0 && (
                                    <Box w="100%">
                                        <Divider my={2}/>
                                        <Badge colorScheme="yellow">VIP</Badge>
                                        <InputGroup size="sm" my={2}>
                                            <Input placeholder="Giá VIP" type="number" value={formData.price_vip} onChange={e=>setFormData({...formData, price_vip: e.target.value})} bg="white"/>
                                            <InputRightElement children="đ"/>
                                        </InputGroup>
                                        <CheckboxGroup colorScheme="orange" value={formData.amenities_vip} onChange={(val)=>setFormData({...formData, amenities_vip: val})}>
                                            <Grid templateColumns="repeat(3, 1fr)" gap={1}>
                                                {amenityOptions.map(i=><GridItem key={i}><Checkbox value={i} size="sm"><Text fontSize="10px">{i}</Text></Checkbox></GridItem>)}
                                            </Grid>
                                        </CheckboxGroup>
                                    </Box>
                                )}
                            </>
                        ) : (
                            <Box w="100%">
                                <FormControl isRequired>
                                    <FormLabel fontSize="xs">GIÁ/H</FormLabel>
                                    <Input type="number" value={formData.price} onChange={e=>setFormData({...formData, price: e.target.value})} bg="white"/>
                                </FormControl>
                                <FormControl mt={4}>
                                    <FormLabel fontSize="xs">TIỆN ÍCH</FormLabel>
                                    <CheckboxGroup colorScheme="green" value={formData.amenities} onChange={(val)=>setFormData({...formData, amenities: val})}>
                                        <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                                            {amenityOptions.map(i=><GridItem key={i}><Checkbox value={i} size="sm"><Text fontSize="xs">{i}</Text></Checkbox></GridItem>)}
                                        </Grid>
                                    </CheckboxGroup>
                                </FormControl>
                            </Box>
                        )}
                    </VStack>
                )}

                {currentStep === 2 && (
                    <VStack spacing={4}>
                        <Box w="100%" h="200px" borderRadius="md" overflow="hidden" border="1px solid" borderColor="gray.300" position="relative">
                            <MapContainer 
                                center={formData.lat ? [formData.lat, formData.lng] : [10.7769, 106.7009]} 
                                zoom={15} 
                                style={{ height: "100%", width: "100%" }} 
                                zoomControl={false}
                            >
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <LocationPicker setFormData={setFormData} />
                                <MapSearchControl setFormData={setFormData} />
                                {formData.lat && <Marker position={[formData.lat, formData.lng]} icon={createCircleMarker(formData.image_url, 'new', true)} />}
                            </MapContainer>
                            <Box position="absolute" bottom={0} left={0} right={0} bg="rgba(255,255,255,0.8)" p={1}>
                                <Text fontSize="xs" textAlign="center">{formData.lat ? "Đã ghim vị trí" : "Chạm bản đồ để ghim"}</Text>
                            </Box>
                        </Box>
                        <FormControl>
                            <Input placeholder="Địa chỉ..." value={formData.address} onChange={e=>setFormData({...formData, address: e.target.value})} bg="white" size="sm"/>
                        </FormControl>
                        <FormControl>
                            <Button as="label" htmlFor="file-upload" size="sm" w="100%">Chọn ảnh</Button>
                            <Input id="file-upload" type="file" multiple onChange={handleImageUpload} display="none"/>
                            <HStack mt={2} overflowX="auto">
                                {formData.images.map((img,i)=><Image key={i} src={getImgUrl(img)} boxSize="40px" borderRadius="md"/>)}
                            </HStack>
                        </FormControl>
                    </VStack>
                )}
            </Box>

            <HStack w="100%" p={3} borderTop="1px solid" borderColor="gray.100" bg="gray.50">
                {currentStep > 0 ? (
                    <Button size="sm" onClick={() => setCurrentStep(c => c - 1)}>Quay lại</Button>
                ) : (
                    <Button size="sm" colorScheme="red" onClick={onCancel}>Hủy</Button>
                )}
                <Spacer />
                {currentStep < 2 ? (
                    <Button size="sm" colorScheme="blue" onClick={() => setCurrentStep(c => c + 1)} isDisabled={!isStepValid()}>Tiếp theo</Button>
                ) : (
                    <Button size="sm" colorScheme="green" onClick={handleSubmit} isLoading={uploading}>Hoàn tất</Button>
                )}
            </HStack>
        </VStack>
    );
};

// --- MAIN ADMIN PAGE ---
export default function AdminPage() {
    const [tabIndex, setTabIndex] = useState(0);
    const isMobile = useBreakpointValue({ base: true, md: false });
    const { colorMode, toggleColorMode } = useColorMode();
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);

    // States for interaction
    const [hoveredCourtId, setHoveredCourtId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [formStep, setFormStep] = useState(0);
    const [sheetHeight, setSheetHeight] = useState(0);

    const bg = useColorModeValue('gray.50', 'gray.900');
    const headerBg = useColorModeValue('white', 'gray.800');
    const panelBg = useColorModeValue('white', 'gray.800');

    // Data States
    const [courts, setCourts] = useState([]);
    const [bookings, setBookings] = useState([]); 
    const [sportTypes, setSportTypes] = useState([]); 
    const [iconUrlMap, setIconUrlMap] = useState({}); 
    const [uploading, setUploading] = useState(false);
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({ summary: {}, daily: [] });
    const [config, setConfig] = useState({});
    const [filterType, setFilterType] = useState('');
    
    // FORM DATA
    const [formData, setFormData] = useState({ 
        id: null, name: '', address: '', lat: null, lng: null, type: '', image_url: '', 
        open_time: '06:00', close_time: '22:00', images: [], 
        total_courts: 10, vip_count: 2,
        price_normal: 50000, amenities_normal: ["Wifi", "Gửi xe"],
        price_vip: 100000, amenities_vip: ["Wifi", "Gửi xe", "Máy lạnh"],
        price: 0, amenities: []
    });
    
    const [profileData, setProfileData] = useState({ 
        phone_number: '', facebook_url: '', zalo_url: '', 
        open_time: '06:00', close_time: '22:00' 
    });
    
    const toast = useToast();
    const fileInputRef = useRef();
    const navigate = useNavigate();

    // Fetch Data
    const fetchData = async () => {
        const userStr = localStorage.getItem('user');
        if(!userStr) { navigate('/login'); return; }
        const currentUser = JSON.parse(userStr);
        setUser(currentUser);
        setProfileData({
            phone_number: currentUser.phone_number || '',
            facebook_url: currentUser.facebook_url || '',
            zalo_url: currentUser.zalo_url || '',
            open_time: currentUser.open_time || '06:00',
            close_time: currentUser.close_time || '22:00'
        });

        try {
            const [resCourts, resBookings, resTypes, resStats, resConfig] = await Promise.all([
                axios.get('http://localhost:5000/api/courts'),
                axios.get(`http://localhost:5000/api/vendor/bookings?vendor_id=${currentUser.id}`),
                axios.get('http://localhost:5000/api/sport-types'),
                axios.get(`http://localhost:5000/api/vendor/stats?vendor_id=${currentUser.id}`),
                axios.get('http://localhost:5000/api/config')
            ]);
            
            const myCourtsList = resCourts.data.filter(c => String(c.owner_id) === String(currentUser.id));
            setCourts(myCourtsList);
            setBookings(resBookings.data || []);
            setSportTypes(resTypes.data || []);
            setStats(resStats.data || { summary: {}, daily: [] });
            setConfig(resConfig.data || {});
            
            const map = {}; 
            resTypes.data.forEach(t => { map[t.code] = t.icon_url; });
            setIconUrlMap(map);
        } catch (error) { 
            console.error("Fetch error:", error); 
        }
    };
    useEffect(() => { fetchData(); }, []);

    // Handlers
    const handleImageUpload = async (e) => {
        const files = e.target.files; if (!files.length) return; setUploading(true);
        const data = new FormData(); for (let i = 0; i < files.length; i++) data.append('images', files[i]);
        try { const res = await axios.post('http://localhost:5000/api/upload-multiple', data); setFormData(prev => ({ ...prev, images: [...prev.images, ...res.data.urls], image_url: res.data.urls[0] })); toast({ title: 'Upload xong', status: 'success' }); } catch { toast({ title: 'Lỗi upload', status: 'error' }); } finally { setUploading(false); }
    };

    // 🔥 HANDLE SUBMIT: ĐÃ SỬA LOGIC CHỜ CẬP NHẬT
    const handleSubmit = async () => {
        if (!formData.lat || !formData.type) return toast({ title: 'Thiếu vị trí/loại', status: 'warning' });
        setUploading(true);
        try { 
            const payload = { ...formData, owner_id: user.id }; 
            
            if (formData.id) {
                const updatePayload = {
                    ...payload,
                    amenities: Array.isArray(formData.amenities) ? formData.amenities.join(',') : formData.amenities,
                    price_per_hour: formData.price
                };
                await axios.put(`http://localhost:5000/api/courts/${formData.id}`, updatePayload);
                toast({ title: 'Cập nhật sân thành công!', status: 'success' });
            } else {
                await axios.post('http://localhost:5000/api/facilities', payload);
                toast({ title: 'Đã tạo xong toàn bộ sân!', description: 'Hệ thống đã tự chia sân VIP và Thường.', status: 'success' });
            }

            // 🔥 QUAN TRỌNG: GỌI LẠI FETCH ĐỂ CẬP NHẬT LIST
            await fetchData();
            
            closeForm();
        } catch (err) { 
            console.error(err);
            toast({ status: 'error', title: 'Lỗi', description: err.response?.data?.message || 'Lỗi server' }); 
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => { 
        if(window.confirm("Xóa sân?")) {
            try { 
                await axios.delete(`http://localhost:5000/api/courts/${id}`, { data: { owner_id: user.id } }); 
                fetchData(); 
            } catch {} 
        }
    };
    
    // 🔥 HÀM XÓA VÉ VĨNH VIỄN
    const handleDeleteBooking = async (bookingId) => {
        if(!window.confirm("CẢNH BÁO: Xóa vé này sẽ mất vĩnh viễn khỏi hệ thống. Bạn có chắc chắn?")) return;
        try {
            await axios.delete(`http://localhost:5000/api/vendor/bookings/${bookingId}`, {
                data: { owner_id: user.id } 
            });
            toast({ title: "Đã xóa vĩnh viễn vé", status: "success" });
            fetchData(); 
        } catch (error) {
            toast({ title: "Lỗi xóa vé", description: error.response?.data?.error || "Lỗi server", status: "error" });
        }
    };

    const handleCheckIn = async (id) => { try { await axios.put(`http://localhost:5000/api/bookings/${id}/checkin`); fetchData(); toast({status:'success', title:'OK'}); } catch{} };
    const handleCancel = async (id) => { if(window.confirm("Hủy vé?")) try { await axios.put(`http://localhost:5000/api/bookings/${id}/cancel`); fetchData(); } catch{} };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0]; if (!file) return; setUploading(true);
        const fd = new FormData(); fd.append('image', file);
        try {
            const res = await axios.post('http://localhost:5000/api/upload', fd);
            await axios.put(`http://localhost:5000/api/users/${user.id}/avatar`, { avatar_url: res.data.url });
            const newUser = { ...user, avatar: res.data.url }; localStorage.setItem('user', JSON.stringify(newUser)); setUser(newUser);
            toast({ title: 'Đã cập nhật ảnh đại diện!', status: 'success' });
        } catch (err) { toast({ title: 'Lỗi upload ảnh', status: 'error' }); } finally { setUploading(false); }
    };

    const handleUpdateProfile = async () => {
        try {
            await axios.put(`http://localhost:5000/api/users/${user.id}/profile`, profileData);
            const newUser = { ...user, ...profileData }; localStorage.setItem('user', JSON.stringify(newUser)); setUser(newUser);
            toast({ title: 'Cập nhật hồ sơ thành công!', status: 'success' });
        } catch (err) { toast({ title: 'Lỗi cập nhật', status: 'error' }); }
    };

    const openForm = (c = null) => {
        if (c) {
            setFormData({ 
                id: c.id, name: c.name, address: c.address, 
                price: c.price_per_hour || 0, 
                lat: c.geometry?.coordinates[1], lng: c.geometry?.coordinates[0], 
                type: c.type, image_url: c.image_url, 
                images: c.images || [], 
                open_time: c.open_time || '06:00', close_time: c.close_time || '22:00',
                amenities: c.amenities ? c.amenities.split(',') : [],
                total_courts: 1, vip_count: 0
            });
        } else {
            setFormData({ 
                id: null, name: '', address: '', lat: null, lng: null, type: '', image_url: '', images: [],
                open_time: profileData.open_time || '06:00', close_time: profileData.close_time || '22:00',
                total_courts: 10, vip_count: 2,
                price_normal: 50000, amenities_normal: ["Wifi", "Gửi xe"],
                price_vip: 100000, amenities_vip: ["Wifi", "Gửi xe", "Máy lạnh", "Nước"],
                price: 0, amenities: []
            });
        }
        setFormStep(0);
        setShowForm(true);
        if (isMobile) setSheetHeight(2); 
    };

    const closeForm = () => { setShowForm(false); if (isMobile) setSheetHeight(1); };

    const filteredCourts = useMemo(() => courts.filter(c => filterType ? c.type === filterType : true), [courts, filterType]);
    const chartConfig = { labels: stats.daily?.map(d => d.day) || [], datasets: [{ label: 'Doanh thu', data: stats.daily?.map(d => d.revenue) || [], backgroundColor: '#38A169', borderRadius: 6 }] };

    return (
        <Flex h="100vh" w="100vw" direction="column" bg={bg} overflow="hidden">
            <style>{customStyles}</style>

            {/* HEADER */}
            <Flex h="64px" bg={headerBg} shadow="sm" align="center" px={4} justify="space-between" zIndex={2000} borderBottom="1px solid" borderColor={useColorModeValue('gray.200', 'gray.700')}>
                <HStack spacing={4}>
                    {!isMobile && <IconButton icon={<FaBars />} variant="ghost" onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} />}
                    <HStack>
                        {config.logo_url && <Image src={getImgUrl(config.logo_url)} h="32px" objectFit="contain" />}
                        <Text fontWeight="900" fontSize="lg" bgGradient="linear(to-r, blue.500, purple.500)" bgClip="text">{config.website_name || 'Admin Panel'}</Text>
                    </HStack>
                </HStack>
                <HStack spacing={3}>
                    <IconButton icon={colorMode === 'light' ? <FaMoon /> : <FaSun />} isRound variant="ghost" onClick={toggleColorMode} />
                    <Avatar size="sm" src={getImgUrl(user?.avatar)} name={user?.full_name} border="2px solid #48BB78"/>
                </HStack>
            </Flex>

            {/* BODY */}
            <Flex flex={1} position="relative" overflow="hidden">
                {/* DESKTOP SIDEBAR */}
                {!isMobile && (
                    <VStack w={isSidebarCollapsed ? "0px" : "240px"} bg={panelBg} h="100%" borderRight="1px solid" borderColor="gray.200" py={6} transition="width 0.3s ease" overflow="hidden" align="stretch" spacing={2} px={isSidebarCollapsed ? 0 : 4}>
                        <Button leftIcon={<FaMapMarkedAlt />} justifyContent="flex-start" variant={tabIndex===0?"solid":"ghost"} colorScheme="blue" onClick={()=>setTabIndex(0)}>Quản lý Sân</Button>
                        <Button leftIcon={<FaCalendarCheck />} justifyContent="flex-start" variant={tabIndex===1?"solid":"ghost"} colorScheme="blue" onClick={()=>setTabIndex(1)}>Lịch Đặt</Button>
                        <Button leftIcon={<FaChartBar />} justifyContent="flex-start" variant={tabIndex===2?"solid":"ghost"} colorScheme="blue" onClick={()=>setTabIndex(2)}>Hồ sơ & TK</Button>
                        <Spacer/>
                        <Button leftIcon={<FaSignOutAlt />} justifyContent="flex-start" variant="ghost" colorScheme="red" onClick={()=>{localStorage.clear(); window.location.href='/login'}}>Đăng xuất</Button>
                    </VStack>
                )}

                {/* MAIN CONTENT AREA */}
                <Box flex={1} h="100%" position="relative" overflow="hidden">
                    <Tabs index={tabIndex} onChange={setTabIndex} isLazy h="100%" variant="unstyled">
                        <TabPanels h="100%">
                            
                            {/* TAB 0: WEBGIS MANAGER */}
                            <TabPanel p={0} h="100%" position="relative">
                                <MapContainer center={[10.7769, 106.7009]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                                    <TileLayer url={colorMode === 'light' ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"} />
                                    <LocationPicker setFormData={setFormData} />
                                    <MapSearchControl setFormData={setFormData} />
                                    {courts.map(c => c.geometry?.coordinates && (
                                        <Marker 
                                            key={c.id} 
                                            position={[c.geometry.coordinates[1], c.geometry.coordinates[0]]} 
                                            icon={createCircleMarker(iconUrlMap[c.type], c.type, hoveredCourtId === c.id)}
                                            eventHandlers={{
                                                click: () => { openForm(c); },
                                                mouseover: () => setHoveredCourtId(c.id),
                                                mouseout: () => setHoveredCourtId(null)
                                            }}
                                        >
                                            <Popup><Image src={getImgUrl(c.image_url)} h="80px" w="100%" objectFit="cover" borderRadius="md" mb={1}/><Text fontWeight="bold" textAlign="center">{c.name}</Text></Popup>
                                        </Marker>
                                    ))}
                                    {formData.lat && <Marker position={[formData.lat, formData.lng]} icon={createCircleMarker(formData.image_url, 'new', true)} />}
                                </MapContainer>

                                {/* 🔥 DANH SÁCH SÂN BÊN TRÁI (FIX GIAO DIỆN KHÔNG BỊ VỠ) */}
                                {!isMobile && !showForm && (
                                    <Box position="absolute" top={4} left={4} bottom={4} w="340px" className="glass-panel" borderRadius="2xl" zIndex={1000} display="flex" flexDirection="column" overflow="hidden">
                                        <VStack p={4} spacing={3} align="stretch" flex={1} h="100%">
                                            <Flex justify="space-between" align="center">
                                                <Heading size="sm" color="gray.700">🏟️ Danh sách ({filteredCourts.length})</Heading>
                                                <IconButton icon={<FaPlus/>} isRound size="sm" colorScheme="green" onClick={() => openForm(null)}/>
                                            </Flex>
                                            <HStack overflowX="auto" className="hide-scrollbar" pb={1} minH="30px">
                                                <Badge cursor="pointer" colorScheme={filterType===''?'blue':'gray'} onClick={()=>setFilterType('')} borderRadius="full" px={3}>Tất cả</Badge>
                                                {Object.keys(iconUrlMap).map(k => (<Badge key={k} cursor="pointer" colorScheme={filterType===k?'blue':'gray'} onClick={()=>setFilterType(k)} borderRadius="full" px={3}>{k}</Badge>))}
                                            </HStack>
                                            <Box flex={1} overflowY="auto" className="custom-scroll">
                                                <VStack spacing={3} pb={2}>
                                                    {filteredCourts.map(c => (
                                                        <Card key={c.id} w="100%" variant="outline" size="sm" cursor="pointer" onClick={() => openForm(c)} onMouseEnter={() => setHoveredCourtId(c.id)} onMouseLeave={() => setHoveredCourtId(null)} borderColor={hoveredCourtId === c.id ? 'blue.400' : 'gray.200'} transform={hoveredCourtId === c.id ? 'scale(1.02)' : 'scale(1)'} transition="all 0.2s" bg="white">
                                                            <CardBody p={3} display="flex" alignItems="center">
                                                                <Image src={getImgUrl(c.image_url)} boxSize="60px" borderRadius="lg" objectFit="cover" mr={3} fallbackSrc="https://via.placeholder.com/60"/>
                                                                <Box flex={1} overflow="hidden">
                                                                    <HStack>
                                                                        <Text fontWeight="800" fontSize="sm" noOfLines={1}>{c.name}</Text>
                                                                        {(c.price_per_hour >= 100000 || c.name.toLowerCase().includes('vip')) && <Badge colorScheme="yellow"><Icon as={FaCrown}/> VIP</Badge>}
                                                                    </HStack>
                                                                    <Text fontSize="xs" color="gray.500" noOfLines={1}>{c.address}</Text>
                                                                    <Badge colorScheme="green" fontSize="xs" mt={1}>{parseInt(c.price_per_hour).toLocaleString()} đ</Badge>
                                                                </Box>
                                                                <IconButton icon={<FaTrash/>} size="xs" colorScheme="red" variant="ghost" onClick={(e) => {e.stopPropagation(); handleDelete(c.id)}}/>
                                                            </CardBody>
                                                        </Card>
                                                    ))}
                                                </VStack>
                                            </Box>
                                        </VStack>
                                    </Box>
                                )}

                                {/* DESKTOP FORM */}
                                {!isMobile && showForm && (
                                    <Box position="absolute" top={4} left={4} bottom={4} w="340px" className="glass-panel" borderRadius="2xl" zIndex={1000} display="flex" flexDirection="column" animation="slideInLeft 0.3s">
                                            <StepForm formData={formData} setFormData={setFormData} sportTypes={sportTypes} handleImageUpload={handleImageUpload} handleSubmit={handleSubmit} uploading={uploading} onCancel={closeForm} currentStep={formStep} setCurrentStep={setFormStep} />
                                    </Box>
                                )}

                                {/* MOBILE BOTTOM SHEET */}
                                {isMobile && (
                                    <Box position="fixed" bottom={0} left={0} right={0} bg="white" borderTopRadius="24px" shadow="dark-lg" zIndex={3000} h={sheetHeight === 2 ? "100%" : sheetHeight === 1 ? "45%" : "60px"} transition="height 0.3s" display={tabIndex === 0 ? "flex" : "none"} flexDirection="column">
                                        <Flex justify="center" pt={3} pb={1} onClick={() => setSheetHeight(h => h === 2 ? 1 : 2)} cursor="pointer"><Box w="40px" h="5px" bg="gray.300" borderRadius="full" /></Flex>
                                        <Box flex={1} overflowY="auto" px={4} pb={20}>
                                            {showForm ? (
                                                <StepForm formData={formData} setFormData={setFormData} sportTypes={sportTypes} handleImageUpload={handleImageUpload} handleSubmit={handleSubmit} uploading={uploading} onCancel={closeForm} currentStep={formStep} setCurrentStep={setFormStep} />
                                            ) : (
                                                <VStack spacing={4} align="stretch" pt={2}>
                                                    <Flex justify="space-between" align="center"><Text fontWeight="bold" fontSize="lg">Danh sách ({filteredCourts.length})</Text><Button size="sm" leftIcon={<FaPlus/>} colorScheme="blue" borderRadius="full" onClick={() => openForm(null)}>Thêm sân</Button></Flex>
                                                    {filteredCourts.map(c => (
                                                        <HStack key={c.id} p={3} bg="gray.5" borderRadius="xl" spacing={3} onClick={() => openForm(c)}>
                                                            <Image src={getImgUrl(c.image_url)} boxSize="70px" borderRadius="lg" objectFit="cover" />
                                                            <Box flex={1}><Text fontWeight="bold" fontSize="sm">{c.name}</Text><Text fontSize="xs" color="gray.500" noOfLines={1}>{c.address}</Text><Badge colorScheme="green">{parseInt(c.price_per_hour).toLocaleString()} đ</Badge></Box>
                                                        </HStack>
                                                    ))}
                                                </VStack>
                                            )}
                                        </Box>
                                    </Box>
                                )}
                            </TabPanel>

                            {/* TAB 1: BOOKINGS */}
                            <TabPanel h="100%" overflowY="auto" p={isMobile ? 2 : 8} px={0} bg={bg} css={{scrollbarWidth: "none",msOverflowStyle: "none", "&::-webkit-scrollbar": { display: "none" }}}>
                                <Container maxW="container.xl">
                                    <Heading size="lg" mb={6} bgGradient="linear(to-r, blue.600, purple.600)" bgClip="text">📅 Quản lý Lịch Đặt</Heading>
                                    <Card bg={panelBg} shadow="lg" borderRadius="2xl" overflow="hidden">
                                        <CardBody p={0}>
                                            <Table variant="simple" size="md">
                                                <Thead bg={useColorModeValue('gray.50', 'gray.700')}><Tr><Th>Khách hàng</Th><Th>Sân</Th><Th>Thời gian</Th><Th>TT</Th><Th>Xử lý</Th></Tr></Thead>
                                                <Tbody>
                                                    {bookings.map(b => (
                                                        <Tr key={b.id} _hover={{bg: useColorModeValue('gray.50', 'gray.700')}}>
                                                            <Td><HStack><Avatar size="xs" name={b.user_name} src={getImgUrl(b.avatar_url)} /><Box><Text fontWeight="bold" fontSize="sm" noOfLines={1}>{b.user_name}</Text></Box></HStack></Td>
                                                            <Td fontWeight="medium" fontSize="sm" noOfLines={1}>{b.court_name}</Td>
                                                            <Td><Badge colorScheme="purple">{b.booking_time}</Badge><Text fontSize="xs">{new Date(b.booking_date).toLocaleDateString()}</Text></Td>
                                                            <Td><Badge borderRadius="full" colorScheme={b.status==='confirmed'?'green':b.status==='completed'?'blue':'red'}>{b.status}</Badge></Td>
                                                            {/* 🔥 NÚT XÓA VÉ Ở ĐÂY */}
                                                            <Td>
                                                                <HStack>
                                                                    {b.status === 'confirmed' && (<IconButton size="xs" icon={<FaCheck/>} colorScheme="purple" onClick={()=>handleCheckIn(b.id)} title="Check-in"/>)}
                                                                    {b.status !== 'cancelled' && (<IconButton icon={<FaTimes/>} size="xs" colorScheme="orange" onClick={()=>handleCancel(b.id)} title="Hủy"/>)}
                                                                    
                                                                    {/* 🔥 NÚT XÓA VĨNH VIỄN */}
                                                                    <IconButton icon={<FaTrash/>} size="xs" colorScheme="red" variant="outline" onClick={()=>handleDeleteBooking(b.id)} title="Xóa vĩnh viễn"/>
                                                                </HStack>
                                                            </Td>
                                                        </Tr>
                                                    ))}
                                                </Tbody>
                                            </Table>
                                        </CardBody>
                                    </Card>
                                </Container>
                            </TabPanel>

                            {/* TAB 2: STATS */}
                            <TabPanel h="100%" overflowY="auto" p={isMobile ? 2 : 8} px={0} bg={bg} css={{scrollbarWidth: "none",msOverflowStyle: "none", "&::-webkit-scrollbar": { display: "none" }}}>
                                <Container maxW="container.xl">
                                    <Heading size="lg" mb={6} bgGradient="linear(to-r, green.500, teal.500)" bgClip="text">📊 Thống kê & Hồ sơ</Heading>
                                    <SimpleGrid columns={{base: 1, lg: 3}} spacing={6}>
                                        <GridItem colSpan={{base: 1, lg: 2}}>
                                            <SimpleGrid columns={2} spacing={6} mb={6}>
                                                <Stat bg="white" p={6} borderRadius="2xl" shadow="md" borderLeft="4px solid" borderColor="green.400"><StatLabel color="gray.500">Doanh thu tháng</StatLabel><StatNumber fontSize="3xl" fontWeight="800" color="green.600">{parseInt(stats.summary.total_revenue || 0).toLocaleString()} đ</StatNumber></Stat>
                                                <Stat bg="white" p={6} borderRadius="2xl" shadow="md" borderLeft="4px solid" borderColor="blue.400"><StatLabel color="gray.500">Tổng lượt đặt</StatLabel><StatNumber fontSize="3xl" fontWeight="800" color="blue.600">{stats.summary.total_bookings || 0}</StatNumber></Stat>
                                            </SimpleGrid>
                                            <Box bg="white" p={6} borderRadius="2xl" shadow="md" h="400px"><Heading size="sm" mb={4} color="gray.600">Biểu đồ doanh thu 7 ngày qua</Heading><Bar data={chartConfig} options={{ maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } } }} /></Box>
                                        </GridItem>
                                        <GridItem>
                                            <Box bg="white" p={6} borderRadius="2xl" shadow="md" h="100%">
                                                <VStack align="center" spacing={4} mb={6} position="relative">
                                                    <Box position="relative"><Avatar size="2xl" src={getImgUrl(user?.avatar)} border="4px solid" borderColor="purple.400"/><IconButton icon={<FaCamera/>} isRound size="sm" colorScheme="blue" position="absolute" bottom={0} right={2} shadow="lg" onClick={() => fileInputRef.current.click()} isLoading={uploading}/><input type="file" ref={fileInputRef} style={{display:'none'}} accept="image/*" onChange={handleAvatarUpload}/></Box>
                                                    <Box textAlign="center"><Heading size="md">{user?.full_name}</Heading><Badge colorScheme="purple" mt={1}>CHỦ SÂN</Badge></Box>
                                                </VStack>
                                                <Divider mb={6}/>
                                                <VStack spacing={4} align="stretch">
                                                    <Text fontWeight="bold" fontSize="sm" color="gray.500">⏱️ GIỜ HOẠT ĐỘNG</Text>
                                                    <HStack><FormControl><FormLabel fontSize="xs">MỞ CỬA</FormLabel><Input type="time" value={profileData.open_time} onChange={e=>setProfileData({...profileData, open_time: e.target.value})} /></FormControl><FormControl><FormLabel fontSize="xs">ĐÓNG CỬA</FormLabel><Input type="time" value={profileData.close_time} onChange={e=>setProfileData({...profileData, close_time: e.target.value})} /></FormControl></HStack>
                                                    <Text fontWeight="bold" fontSize="sm" color="gray.500" mt={2}>📞 LIÊN HỆ</Text>
                                                    <FormControl><InputGroup><InputRightElement children={<FaPhone color="gray.400"/>}/><Input placeholder="SĐT" value={profileData.phone_number} onChange={e=>setProfileData({...profileData, phone_number: e.target.value})} /></InputGroup></FormControl>
                                                    <FormControl><InputGroup><InputRightElement children={<FaFacebook color="blue.400"/>}/><Input placeholder="Facebook Link" value={profileData.facebook_url} onChange={e=>setProfileData({...profileData, facebook_url: e.target.value})} /></InputGroup></FormControl>
                                                    <FormControl><InputGroup><InputRightElement children={<SiZalo color="blue.600"/>}/><Input placeholder="Zalo Link" value={profileData.zalo_url} onChange={e=>setProfileData({...profileData, zalo_url: e.target.value})} /></InputGroup></FormControl>
                                                    <Button colorScheme="purple" w="100%" onClick={handleUpdateProfile} mt={4} shadow="md" leftIcon={<FaCheck/>}>LƯU THÔNG TIN</Button>
                                                </VStack>
                                            </Box>
                                        </GridItem>
                                    </SimpleGrid>
                                </Container>
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </Box>
                {/* Mobile Nav */}
                {isMobile && (
                    <Flex position="fixed" bottom={0} left={0} right={0} bg="white" h="65px" borderTop="1px solid" borderColor="gray.100" justify="space-around" align="center" zIndex={4000} pb="safe-area-inset-bottom" shadow="inner">
                        <VStack spacing={1} w="33%" onClick={()=>{setTabIndex(0); setSheetHeight(1);}} color={tabIndex===0 ? "blue.600" : "gray.400"}><Icon as={FaMapMarkedAlt} boxSize={5} /><Text fontSize="10px" fontWeight="bold">Sân Bãi</Text></VStack>
                        <VStack spacing={1} w="33%" onClick={()=>{setTabIndex(1);}} color={tabIndex===1 ? "blue.600" : "gray.400"}><Icon as={FaCalendarCheck} boxSize={5} /><Text fontSize="10px" fontWeight="bold">Lịch Đặt</Text></VStack>
                        <VStack spacing={1} w="33%" onClick={()=>{setTabIndex(2);}} color={tabIndex===2 ? "blue.600" : "gray.400"}><Icon as={FaUserCog} boxSize={5} /><Text fontSize="10px" fontWeight="bold">Hồ sơ</Text></VStack>
                    </Flex>
                )}
            </Flex>
        </Flex>
    );
}