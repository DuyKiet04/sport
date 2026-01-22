import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
    Box, Flex, Heading, VStack, HStack, Button, Input, 
    Table, Thead, Tbody, Tr, Th, Td, IconButton, Image, 
    useToast, Card, CardBody, Badge, Tabs, TabList, TabPanels, Tab, TabPanel,
    FormControl, FormLabel, InputGroup, InputLeftElement, Radio, RadioGroup, Stack, Container,
    Icon, Text, Avatar, useColorModeValue, SimpleGrid, Spacer, useColorMode,
    GridItem, Select, Stat, StatLabel, StatNumber, StatHelpText, Divider,
    Drawer, DrawerOverlay, DrawerContent, DrawerBody, DrawerCloseButton,
    useBreakpointValue 
} from '@chakra-ui/react';
import { 
    FaTrash, FaPlus, FaLink, FaUpload, FaGamepad, FaCode, FaUserShield, 
    FaUserCheck, FaUserTimes, FaCheck, FaSave, FaGlobe, FaImage, FaSignOutAlt, FaMoon, FaSun, FaSearch,
    FaMapMarkedAlt, FaChartLine, FaBan, FaBars, FaTimes, FaList
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip as ChartTooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Đăng ký ChartJS
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend);

// --- HELPERS ---
const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url.substring(1) : url;
    return `http://localhost:5000/${cleanPath}`; 
};

// 🔥 HÀM GIẢI MÃ TỌA ĐỘ HEX (GIÚP MAP KHÔNG BỊ TRẮNG)
const parsePostGISPoint = (hex) => {
    if (!hex || typeof hex !== 'string' || hex.length < 40) return null;
    try {
        const buffer = new Uint8Array(hex.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16))).buffer;
        const view = new DataView(buffer);
        const isLittleEndian = view.getUint8(0) === 1;
        const lng = view.getFloat64(9, isLittleEndian);
        const lat = view.getFloat64(17, isLittleEndian);
        if(isNaN(lat) || isNaN(lng)) return null;
        return { lat, lng };
    } catch (e) { return null; }
};

// --- STYLES ---
const customStyles = `
  .hide-scrollbar::-webkit-scrollbar { display: none; }
  .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  .custom-cluster-icon { background: none; border: none; }
  .cluster-content { width: 40px; height: 40px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: 800; border: 3px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-size: 12px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); }
  
  /* Glassmorphism Panel */
  .glass-panel {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
  }
  .dark .glass-panel {
    background: rgba(26, 32, 44, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
`;

// --- MAP ICON ---
const createStatusIcon = (status) => {
    let color = '#38A169'; // Active - Green
    if (status === 'pending') color = '#D69E2E'; // Pending - Yellow
    if (status === 'rejected' || status === 'blocked') color = '#E53E3E'; // Red

    return L.divIcon({
        className: 'custom-pin',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.4); transform: translate(-50%, -50%);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -10]
    });
};

const UserItemMobile = ({ u, handleUserStatus, handleDeleteUser }) => {
    const cardBg = useColorModeValue('white', 'gray.800');
    return (
        <Card bg={cardBg} mb={3} shadow="sm" borderLeft="4px solid" borderColor={u.role==='vendor'?'purple.400':'blue.400'}>
            <CardBody p={3}>
                <Flex align="center" mb={2}>
                    <Avatar size="sm" src={getImgUrl(u.avatar_url)} name={u.full_name} mr={3} border="2px solid white" shadow="sm" />
                    <Box>
                        <Text fontWeight="bold" fontSize="sm">{u.full_name}</Text>
                        <Text fontSize="xs" color="gray.500">{u.email}</Text>
                    </Box>
                    <Spacer/>
                    <Badge colorScheme={u.status==='active'?'green':u.status==='blocked'?'red':'orange'}>{u.status}</Badge>
                </Flex>
                <Flex justify="space-between" align="center" mt={2} borderTop="1px solid" borderColor="gray.100" pt={2}>
                    <Badge colorScheme={u.role==='vendor'?'purple':'blue'}>{u.role==='vendor'?'Chủ sân':'Khách'}</Badge>
                    <HStack>
                        {u.status === 'blocked' ? 
                            <IconButton size="xs" icon={<FaUserCheck/>} colorScheme="green" onClick={() => handleUserStatus(u.id, 'active')} aria-label="Unblock"/> : 
                            <IconButton size="xs" icon={<FaUserTimes/>} colorScheme="orange" onClick={() => handleUserStatus(u.id, 'blocked')} aria-label="Block"/>
                        }
                        <IconButton size="xs" icon={<FaTrash/>} colorScheme="red" variant="outline" onClick={() => handleDeleteUser(u.id)} aria-label="Delete"/>
                    </HStack>
                </Flex>
            </CardBody>
        </Card>
    );
};

export default function SuperAdminPage() {
    // --- STATE ---
    const [sportTypes, setSportTypes] = useState([]);
    const [users, setUsers] = useState([]); 
    const [courts, setCourts] = useState([]); 
    const [config, setConfig] = useState({ website_name: '', logo_url: '' });
    const [stats, setStats] = useState({ users: 0, facilities: 0, courts: 0, bookings: 0 }); 
    
    // UI States
    const [formData, setFormData] = useState({ name: '', code: '', icon_url_direct: '' });
    const [file, setFile] = useState(null); 
    const [logoFile, setLogoFile] = useState(null); 
    const [uploadMode, setUploadMode] = useState('file');
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewLogo, setPreviewLogo] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); 
    
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    const toast = useToast();
    const navigate = useNavigate();
    const { colorMode, toggleColorMode } = useColorMode();
    const isMobile = useBreakpointValue({ base: true, lg: false });
    
    // 🔥 FIX LỖI: ĐỊNH NGHĨA hoverTrBg
    const bg = useColorModeValue('gray.50', 'gray.900');
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');
    const headerBg = useColorModeValue('white', 'gray.800');
    const hoverTrBg = useColorModeValue('gray.50', 'gray.700'); // ĐÃ THÊM CÁI NÀY

    // --- FETCH DATA ---
    const fetchData = async () => {
        try {
            const [resSports, resUsers, resConfig, resAllCourts, resStats] = await Promise.all([
                axios.get('http://localhost:5000/api/sport-types'),
                axios.get('http://localhost:5000/api/admin/users'), 
                axios.get('http://localhost:5000/api/config'),
                axios.get('http://localhost:5000/api/admin/all-courts'), 
                axios.get('http://localhost:5000/api/admin/dashboard-stats').catch(() => ({ data: { total_bookings: 0 } }))
            ]);

            setSportTypes(resSports.data || []);
            setUsers(resUsers.data || []);
            setConfig(resConfig.data || {});
            setCourts(resAllCourts.data || []); 

            if(resConfig.data?.logo_url) setPreviewLogo(getImgUrl(resConfig.data.logo_url));
            
            setStats({
                users: resStats.data.total_users || 0,
                facilities: resStats.data.total_facilities || 0,
                courts: resStats.data.total_courts || resAllCourts.data.length,
                bookings: resStats.data.total_bookings || 0
            });

        } catch (error) { console.error("Lỗi tải dữ liệu", error); }
    };

    useEffect(() => { fetchData(); }, []);

    // --- HANDLERS ---
    const handleLogout = () => { if(window.confirm("Đăng xuất?")) { localStorage.clear(); navigate('/login'); } };

    const handleUserStatus = async (userId, newStatus) => {
        try {
            await axios.put(`http://localhost:5000/api/admin/users/${userId}/status`, { status: newStatus });
            toast({ title: 'Cập nhật thành công', status: 'success' });
            fetchData();
        } catch (e) { toast({ status: 'error', title: 'Lỗi cập nhật' }); }
    };

    const handleDeleteUser = async (userId) => {
        if(window.confirm("CẢNH BÁO: Xóa vĩnh viễn user này?")) {
            try {
                await axios.delete(`http://localhost:5000/api/admin/users/${userId}`);
                toast({ title: 'Đã xóa user', status: 'success' });
                fetchData();
            } catch (e) { toast({ status: 'error', title: 'Lỗi xóa user' }); }
        }
    };

    const handleCourtStatus = async (courtId, newStatus) => {
        try {
            await axios.put(`http://localhost:5000/api/admin/courts/${courtId}/status`, { status: newStatus });
            setCourts(prev => prev.map(c => c.id === courtId ? {...c, status: newStatus} : c));
            toast({ title: `Đã chuyển trạng thái sân sang: ${newStatus}`, status: 'success' });
        } catch (e) { 
            console.error(e);
            toast({ title: 'Lỗi cập nhật', description: 'Kiểm tra Backend API', status: 'error' }); 
        }
    };

    const handleSaveConfig = async () => {
        const data = new FormData();
        data.append('website_name', config.website_name);
        if (logoFile) data.append('logo', logoFile);
        try {
            await axios.post('http://localhost:5000/api/config', data);
            toast({ title: 'Đã lưu!', status: 'success' });
            fetchData();
        } catch (e) { toast({ status: 'error', title: 'Lỗi' }); }
    };

    const handleLogoChange = (e) => { const f = e.target.files[0]; if (f) { setLogoFile(f); setPreviewLogo(URL.createObjectURL(f)); } };
    const handleFileChange = (e) => { const f = e.target.files[0]; if (f) { setFile(f); setPreviewUrl(URL.createObjectURL(f)); } };
    const handleLinkChange = (e) => { setFormData({ ...formData, icon_url_direct: e.target.value }); setPreviewUrl(e.target.value); };
    
    const handleSubmitSport = async (e) => {
        e.preventDefault();
        const data = new FormData();
        data.append('name', formData.name); data.append('code', formData.code);
        if (uploadMode === 'file') { if (file) data.append('icon', file); } 
        else { if (formData.icon_url_direct) data.append('icon_url_direct', formData.icon_url_direct); }
        try {
            await axios.post('http://localhost:5000/api/sport-types', data);
            toast({ title: 'Thêm thành công!', status: 'success' });
            setFormData({ name: '', code: '', icon_url_direct: '' }); setFile(null); setPreviewUrl(''); fetchData();
        } catch { toast({ title: 'Lỗi', status: 'error' }); }
    };

    const handleDeleteSport = async (id) => { if (window.confirm("Xóa?")) { await axios.delete(`http://localhost:5000/api/sport-types/${id}`); fetchData(); } };

    // --- FILTERS ---
    const filteredUsers = users.filter(u => 
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredCourts = useMemo(() => {
        return courts.filter(c => {
            const status = c.status || 'active'; 
            if (filterStatus === 'all') return true;
            return status === filterStatus;
        });
    }, [courts, filterStatus]);

    const chartData = {
        labels: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6'],
        datasets: [
            { label: 'User Mới', data: [12, 19, 3, 5, 2, 3], backgroundColor: 'rgba(54, 162, 235, 0.5)' },
            { label: 'Booking', data: [2, 3, 20, 5, 1, 4], backgroundColor: 'rgba(75, 192, 192, 0.5)' },
        ],
    };

    return (
        <Flex h="100vh" w="100vw" direction="column" bg={bg} overflow="hidden">
            <style>{customStyles}</style>

            {/* HEADER */}
            <Flex h="64px" bg={headerBg} shadow="sm" align="center" px={{base: 4, lg: 6}} justify="space-between" zIndex={2000} borderBottom="1px solid" borderColor={useColorModeValue('gray.200', 'gray.700')}>
                <HStack spacing={4}>
                    <IconButton icon={<FaBars />} variant="ghost" onClick={() => setSidebarOpen(!isSidebarOpen)} aria-label="Toggle Sidebar" display={{base:'flex', lg:'none'}} />
                    <HStack>
                        <Icon as={FaUserShield} boxSize={6} color="red.500" />
                        <Heading size="md" bgGradient="linear(to-r, red.500, orange.500)" bgClip="text" display={{base:'none', md:'block'}}>SUPER ADMIN GIS</Heading>
                    </HStack>
                </HStack>
                <HStack spacing={4}>
                    {previewLogo && <Image src={previewLogo} h="32px" objectFit="contain" />}
                    <IconButton icon={colorMode === 'light' ? <FaMoon/> : <FaSun/>} isRound size="sm" onClick={toggleColorMode} />
                    <Button leftIcon={<FaSignOutAlt/>} size="sm" colorScheme="gray" onClick={handleLogout}>Thoát</Button>
                </HStack>
            </Flex>

            {/* MAIN CONTENT */}
            <Flex flex={1} position="relative" overflow="hidden">
                
                {/* SIDEBAR (Responsive) */}
                <Box 
                    w={{base: '280px', lg: '240px'}} 
                    bg={headerBg} 
                    h="100%" 
                    borderRight="1px solid" 
                    borderColor={useColorModeValue('gray.200', 'gray.700')}
                    position={{base: 'absolute', lg: 'relative'}}
                    left={{base: isSidebarOpen ? 0 : '-280px', lg: 0}}
                    transition="left 0.3s ease"
                    zIndex={3000}
                    shadow={{base: '2xl', lg: 'none'}}
                >
                    <VStack align="stretch" p={4} spacing={2}>
                        <Button leftIcon={<FaChartLine/>} justifyContent="flex-start" variant={activeTab===0?"solid":"ghost"} colorScheme="blue" onClick={()=>{setActiveTab(0); if(isMobile) setSidebarOpen(false);}}>Dashboard</Button>
                        <Button leftIcon={<FaMapMarkedAlt/>} justifyContent="flex-start" variant={activeTab===1?"solid":"ghost"} colorScheme="blue" onClick={()=>{setActiveTab(1); if(isMobile) setSidebarOpen(false);}}>Quản lý Sân ({courts.length})</Button>
                        <Button leftIcon={<FaUserShield/>} justifyContent="flex-start" variant={activeTab===2?"solid":"ghost"} colorScheme="blue" onClick={()=>{setActiveTab(2); if(isMobile) setSidebarOpen(false);}}>Người dùng</Button>
                        <Button leftIcon={<FaGamepad/>} justifyContent="flex-start" variant={activeTab===3?"solid":"ghost"} colorScheme="blue" onClick={()=>{setActiveTab(3); if(isMobile) setSidebarOpen(false);}}>Danh mục</Button>
                        <Button leftIcon={<FaGlobe/>} justifyContent="flex-start" variant={activeTab===4?"solid":"ghost"} colorScheme="blue" onClick={()=>{setActiveTab(4); if(isMobile) setSidebarOpen(false);}}>Cấu hình</Button>
                    </VStack>
                </Box>

                {/* OVERLAY FOR MOBILE SIDEBAR */}
                {isMobile && isSidebarOpen && (
                    <Box position="absolute" inset={0} bg="blackAlpha.600" zIndex={2999} onClick={() => setSidebarOpen(false)} />
                )}

                {/* TAB CONTENT AREA */}
                <Box flex={1} overflowY="auto" className="hide-scrollbar" position="relative">
                    
                    {/* TAB 0: DASHBOARD */}
                    {activeTab === 0 && (
                        <Container maxW="container.xl" py={6}>
                            <SimpleGrid columns={{base: 1, md: 2, lg: 4}} spacing={6} mb={8}>
                                <Stat bg={cardBg} p={4} borderRadius="2xl" shadow="md" borderLeft="4px solid" borderColor="blue.400">
                                    <StatLabel color="gray.500">Tổng User</StatLabel>
                                    <StatNumber fontSize="3xl">{stats.users}</StatNumber>
                                </Stat>
                                <Stat bg={cardBg} p={4} borderRadius="2xl" shadow="md" borderLeft="4px solid" borderColor="purple.400">
                                    <StatLabel color="gray.500">Tổng Cơ Sở</StatLabel>
                                    <StatNumber fontSize="3xl">{stats.facilities}</StatNumber>
                                </Stat>
                                <Stat bg={cardBg} p={4} borderRadius="2xl" shadow="md" borderLeft="4px solid" borderColor="green.400">
                                    <StatLabel color="gray.500">Tổng Sân Lẻ</StatLabel>
                                    <StatNumber fontSize="3xl" color="green.500">{stats.courts}</StatNumber>
                                    <StatHelpText>Sân con hoạt động</StatHelpText>
                                </Stat>
                                <Stat bg={cardBg} p={4} borderRadius="2xl" shadow="md" borderLeft="4px solid" borderColor="orange.400">
                                    <StatLabel color="gray.500">Lượt Booking</StatLabel>
                                    <StatNumber fontSize="3xl">{stats.bookings}</StatNumber>
                                </Stat>
                            </SimpleGrid>
                            
                            <Card bg={cardBg} borderRadius="2xl" p={6} shadow="lg">
                                <Heading size="md" mb={6}>📈 Biểu đồ tăng trưởng</Heading>
                                <Box h="400px">
                                    <Bar data={chartData} options={{maintainAspectRatio: false, responsive: true}} />
                                </Box>
                            </Card>
                        </Container>
                    )}

                    {/* TAB 1: QUẢN LÝ SÂN (MAP & LIST) */}
                    {activeTab === 1 && (
                        <Flex h="100%" position="relative">
                            {/* LEFT LIST PANEL */}
                            <Box 
                                w={{base: '100%', lg: '380px'}} 
                                h="100%" 
                                bg={cardBg} 
                                borderRight="1px solid" 
                                borderColor={borderColor}
                                display="flex" 
                                flexDirection="column"
                                position={{base: 'absolute', lg: 'relative'}}
                                zIndex={1000}
                                transform={{base: 'translateY(60%)', lg: 'none'}} // Mobile thì ẩn bớt xuống dưới
                                transition="transform 0.3s ease"
                            >
                                <Box p={4} borderBottom="1px solid" borderColor={borderColor} bg={cardBg}>
                                    <Heading size="sm" mb={3}>Danh sách sân ({filteredCourts.length})</Heading>
                                    <Select size="sm" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} borderRadius="lg">
                                        <option value="all">Tất cả trạng thái</option>
                                        <option value="active">✅ Đang hoạt động</option>
                                        <option value="rejected">❌ Đã khóa</option>
                                        <option value="pending">⏳ Chờ duyệt</option>
                                    </Select>
                                </Box>
                                <Box flex={1} overflowY="auto" p={3} className="custom-scroll">
                                    <VStack spacing={3} align="stretch">
                                        {filteredCourts.map(c => (
                                            <Card key={c.id} variant="outline" size="sm" cursor="pointer" _hover={{borderColor: 'blue.400', shadow: 'md'}} borderRadius="xl" onClick={() => handleCourtStatus(c.id, 'active')}> {/* Click vào để focus map nếu cần */}
                                                <CardBody p={3}>
                                                    <Flex justify="space-between" align="start">
                                                        <Box>
                                                            <Text fontWeight="bold" fontSize="sm" noOfLines={1}>{c.name}</Text>
                                                            <Text fontSize="xs" color="gray.500">{c.owner_name}</Text>
                                                            <Badge mt={1} colorScheme={c.status==='active'?'green':c.status==='rejected'?'red':'yellow'}>{c.status || 'Active'}</Badge>
                                                        </Box>
                                                        <HStack>
                                                            {c.status !== 'active' && <IconButton size="xs" icon={<FaCheck/>} colorScheme="green" onClick={(e)=>{e.stopPropagation(); handleCourtStatus(c.id, 'active')}} aria-label="Mở"/>}
                                                            {c.status !== 'rejected' && <IconButton size="xs" icon={<FaBan/>} colorScheme="red" onClick={(e)=>{e.stopPropagation(); handleCourtStatus(c.id, 'rejected')}} aria-label="Khóa"/>}
                                                        </HStack>
                                                    </Flex>
                                                </CardBody>
                                            </Card>
                                        ))}
                                    </VStack>
                                </Box>
                            </Box>

                            {/* MAP AREA */}
                            <Box flex={1} h="100%" position="relative">
                                <MapContainer center={[10.7769, 106.7009]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                                    <TileLayer url={colorMode === 'light' ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"} />
                                    {filteredCourts.map(c => {
                                        let lat, lng;
                                        if (c.geometry && c.geometry.coordinates) { lat = c.geometry.coordinates[1]; lng = c.geometry.coordinates[0]; }
                                        else if (c.location) { const p = parsePostGISPoint(c.location); if(p) { lat = p.lat; lng = p.lng; } }

                                        if (!lat || !lng) return null;

                                        return (
                                            <Marker key={c.id} position={[lat, lng]} icon={createStatusIcon(c.status || 'active')}>
                                                <Popup>
                                                    <Text fontWeight="bold">{c.name}</Text>
                                                    <Badge colorScheme={c.status==='active'?'green':'red'}>{c.status}</Badge>
                                                    <Divider my={2}/>
                                                    <HStack>
                                                        <Button size="xs" colorScheme="green" onClick={()=>handleCourtStatus(c.id, 'active')}>Mở</Button>
                                                        <Button size="xs" colorScheme="red" onClick={()=>handleCourtStatus(c.id, 'rejected')}>Khóa</Button>
                                                    </HStack>
                                                </Popup>
                                            </Marker>
                                        );
                                    })}
                                </MapContainer>
                                
                                {/* Floating Legend */}
                                <Box position="absolute" top={4} right={4} bg="white" p={3} borderRadius="xl" shadow="lg" zIndex={1000} className="glass-panel">
                                    <VStack align="start" spacing={2}>
                                        <HStack><Box w="12px" h="12px" borderRadius="full" bg="green.500"/><Text fontSize="xs" fontWeight="bold">Hoạt động</Text></HStack>
                                        <HStack><Box w="12px" h="12px" borderRadius="full" bg="yellow.500"/><Text fontSize="xs" fontWeight="bold">Chờ duyệt</Text></HStack>
                                        <HStack><Box w="12px" h="12px" borderRadius="full" bg="red.500"/><Text fontSize="xs" fontWeight="bold">Đã khóa</Text></HStack>
                                    </VStack>
                                </Box>
                            </Box>
                        </Flex>
                    )}

                    {/* TAB 2: NGƯỜI DÙNG */}
                    {activeTab === 2 && (
                        <Container maxW="container.xl" py={6}>
                            <Card shadow="lg" borderRadius="2xl" bg={cardBg}>
                                <CardBody p={6}>
                                    <Flex mb={6} justify="space-between" align="center" wrap="wrap" gap={4}>
                                        <Heading size="md" color="gray.700">👥 Quản lý User ({users.length})</Heading>
                                        <InputGroup maxW="300px">
                                            <InputLeftElement children={<FaSearch color="gray.400"/>} />
                                            <Input placeholder="Tìm tên, email..." borderRadius="full" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
                                        </InputGroup>
                                    </Flex>

                                    <Box overflowX="auto">
                                        <Table variant="simple" size="sm">
                                            <Thead bg={useColorModeValue('gray.50', 'gray.700')}>
                                                <Tr><Th>User Info</Th><Th>Vai trò</Th><Th>Trạng thái</Th><Th>Hành động</Th></Tr>
                                            </Thead>
                                            <Tbody>
                                                {filteredUsers.map(u => (
                                                    <Tr key={u.id} _hover={{ bg: hoverTrBg }}>
                                                        <Td>
                                                            <HStack spacing={3}>
                                                                <Avatar size="sm" src={getImgUrl(u.avatar_url)} name={u.full_name} />
                                                                <VStack align="start" spacing={0}>
                                                                    <Text fontWeight="bold" fontSize="sm">{u.full_name}</Text>
                                                                    <Text fontSize="xs" color="gray.500">{u.email}</Text>
                                                                </VStack>
                                                            </HStack>
                                                        </Td>
                                                        <Td><Badge colorScheme={u.role==='vendor'?'purple':'blue'} borderRadius="full" px={2}>{u.role==='vendor'?'Chủ sân':'Khách'}</Badge></Td>
                                                        <Td><Badge colorScheme={u.status==='active'?'green':u.status==='blocked'?'red':'orange'} borderRadius="full" px={2}>{u.status}</Badge></Td>
                                                        <Td>
                                                            <HStack spacing={2}>
                                                                {u.status === 'blocked' ? 
                                                                    <Button size="xs" leftIcon={<FaUserCheck/>} colorScheme="green" onClick={() => handleUserStatus(u.id, 'active')}>Mở</Button> : 
                                                                    <Button size="xs" leftIcon={<FaUserTimes/>} colorScheme="orange" onClick={() => handleUserStatus(u.id, 'blocked')}>Khóa</Button>
                                                                }
                                                                <IconButton size="xs" icon={<FaTrash/>} colorScheme="red" variant="ghost" onClick={() => handleDeleteUser(u.id)}/>
                                                            </HStack>
                                                        </Td>
                                                    </Tr>
                                                ))}
                                            </Tbody>
                                        </Table>
                                    </Box>
                                </CardBody>
                            </Card>
                        </Container>
                    )}

                    {/* TAB 3: DANH MỤC (SPORT TYPE) */}
                    {activeTab === 3 && (
                        <Container maxW="container.xl" py={6}>
                            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
                                <Card shadow="lg" borderRadius="2xl" bg={cardBg}>
                                    <CardBody>
                                        <Heading size="md" mb={6} color="gray.700">Thêm Loại Sân</Heading>
                                        <VStack spacing={4} as="form" onSubmit={handleSubmitSport}>
                                            <FormControl isRequired>
                                                <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">TÊN LOẠI HÌNH</FormLabel>
                                                <InputGroup size="sm"><InputLeftElement children={<FaGamepad color="gray.400"/>} /><Input placeholder="VD: Bóng đá" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} borderRadius="md"/></InputGroup>
                                            </FormControl>
                                            <FormControl isRequired>
                                                <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">MÃ CODE (English)</FormLabel>
                                                <InputGroup size="sm"><InputLeftElement children={<FaCode color="gray.400"/>} /><Input placeholder="VD: football" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} borderRadius="md"/></InputGroup>
                                            </FormControl>
                                            <FormControl>
                                                <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">ICON ĐẠI DIỆN</FormLabel>
                                                <RadioGroup onChange={setUploadMode} value={uploadMode} mb={3} size="sm">
                                                    <Stack direction='row'><Radio value='file'>File ảnh</Radio><Radio value='link'>Link URL</Radio></Stack>
                                                </RadioGroup>
                                                {uploadMode === 'file' ? (
                                                    <Box w="100%" p={4} border="2px dashed" borderColor="gray.300" borderRadius="xl" textAlign="center" cursor="pointer" position="relative" bg="gray.50" _hover={{bg:'gray.100'}}>
                                                        <Input type="file" opacity={0} position="absolute" top={0} left={0} w="100%" h="100%" onChange={handleFileChange} accept="image/*" cursor="pointer"/>
                                                        <VStack spacing={1}><Icon as={FaUpload} color="gray.400" boxSize={6} /><Text fontSize="xs" color="gray.500">{file ? file.name : "Nhấn để chọn ảnh"}</Text></VStack>
                                                    </Box>
                                                ) : (
                                                    <InputGroup size="sm"><InputLeftElement children={<FaLink color="gray.400"/>} /><Input placeholder="https://..." value={formData.icon_url_direct} onChange={handleLinkChange} borderRadius="md"/></InputGroup>
                                                )}
                                            </FormControl>
                                            {previewUrl && <Box p={2} bg="gray.100" borderRadius="lg" w="100%" textAlign="center"><Image src={previewUrl} boxSize="60px" objectFit="contain" mx="auto" /></Box>}
                                            <Button type="submit" colorScheme="blue" w="100%" size="md" leftIcon={<FaPlus />} shadow="md">THÊM MỚI</Button>
                                        </VStack>
                                    </CardBody>
                                </Card>

                                <GridItem colSpan={{base: 1, lg: 2}}>
                                    <Card shadow="lg" borderRadius="2xl" bg={cardBg}>
                                        <CardBody p={0}>
                                            <Table variant="simple">
                                                <Thead bg={useColorModeValue('gray.50', 'gray.700')}><Tr><Th>Icon</Th><Th>Tên</Th><Th>Code</Th><Th isNumeric>Xóa</Th></Tr></Thead>
                                                <Tbody>{sportTypes.map((type) => (
                                                    <Tr key={type.id} _hover={{ bg: hoverTrBg }}>
                                                        <Td><Image src={type.icon_url} boxSize="40px" objectFit="contain" borderRadius="md"/></Td>
                                                        <Td fontWeight="bold">{type.name}</Td>
                                                        <Td><Badge colorScheme="green" borderRadius="full" px={2}>{type.code}</Badge></Td>
                                                        <Td isNumeric><IconButton size="sm" colorScheme="red" variant="ghost" icon={<FaTrash />} onClick={() => handleDeleteSport(type.id)} /></Td>
                                                    </Tr>
                                                ))}</Tbody>
                                            </Table>
                                        </CardBody>
                                    </Card>
                                </GridItem>
                            </SimpleGrid>
                        </Container>
                    )}

                    {/* TAB 4: CẤU HÌNH */}
                    {activeTab === 4 && (
                        <Container maxW="container.md" py={10}>
                            <Card shadow="xl" borderRadius="2xl" bg={cardBg}>
                                <CardBody p={8}>
                                    <Heading size="md" mb={8} textAlign="center" color="gray.600">⚙️ Cấu hình Hệ thống</Heading>
                                    <VStack spacing={6} align="stretch">
                                        <FormControl>
                                            <FormLabel fontWeight="bold" fontSize="sm" color="gray.500">TÊN WEBSITE</FormLabel>
                                            <InputGroup><InputLeftElement children={<FaGlobe color="gray.400"/>} /><Input value={config.website_name} onChange={(e) => setConfig({...config, website_name: e.target.value})} placeholder="VD: Sport Booking Pro" borderRadius="lg"/></InputGroup>
                                        </FormControl>
                                        <FormControl>
                                            <FormLabel fontWeight="bold" fontSize="sm" color="gray.500">LOGO HỆ THỐNG</FormLabel>
                                            <HStack align="center" spacing={6} p={6} border="1px solid" borderColor="gray.200" borderRadius="xl" bg="gray.50">
                                                <Box w="100px" h="100px" border="2px dashed" borderColor="gray.300" borderRadius="xl" display="flex" alignItems="center" justifyContent="center" bg="white" position="relative" overflow="hidden">
                                                    {previewLogo ? <Image src={previewLogo} w="100%" h="100%" objectFit="contain" /> : <Icon as={FaImage} color="gray.300" boxSize={10}/>}
                                                    <Input type="file" opacity={0} position="absolute" top={0} left={0} w="100%" h="100%" cursor="pointer" onChange={handleLogoChange} accept="image/*"/>
                                                </Box>
                                                <VStack align="start" spacing={2} flex={1}>
                                                    <Button size="sm" leftIcon={<FaUpload/>} onClick={()=>document.querySelector('input[type="file"]').click()} colorScheme="blue" variant="outline">Chọn ảnh mới</Button>
                                                    <Text fontSize="xs" color="gray.400">Định dạng PNG, JPG. Tối ưu 512x512.</Text>
                                                </VStack>
                                            </HStack>
                                        </FormControl>
                                        <Button colorScheme="green" size="lg" leftIcon={<FaSave/>} onClick={handleSaveConfig} w="100%" shadow="lg" mt={4}>LƯU CẤU HÌNH</Button>
                                    </VStack>
                                </CardBody>
                            </Card>
                        </Container>
                    )}

                </Box>
            </Flex>
        </Flex>
    );
}