import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
    Box, Flex, Heading, VStack, HStack, Button, Input, 
    Table, Thead, Tbody, Tr, Th, Td, IconButton, Image, 
    useToast, Card, CardBody, Badge, 
    FormControl, FormLabel, InputGroup, InputLeftElement, Radio, RadioGroup, Stack, Container,
    Icon, Text, Avatar, useColorModeValue, SimpleGrid, useColorMode,
    GridItem, Select, Stat, StatLabel, StatNumber, StatHelpText, Divider,
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, useDisclosure,
    useBreakpointValue, Spinner, Checkbox
} from '@chakra-ui/react';
import { 
    FaTrash, FaPlus, FaLink, FaUpload, FaGamepad, FaCode, FaUserShield, 
    FaUserTimes, FaCheck, FaSave, FaGlobe, FaImage, FaSignOutAlt, FaMoon, FaSun, FaSearch,
    FaMapMarkedAlt, FaChartLine, FaBan, FaBars, FaChartPie, FaMoneyBillWave, FaStore, FaFutbol, FaUsers, FaEye, FaCheckDouble
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { 
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip as ChartTooltip, Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend, ArcElement, PointElement, LineElement, Filler);

// --- HELPERS ---
const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const cleanUrl = url.replace(/"/g, '').replace(/{/g, '').replace(/}/g, '');
    const cleanPath = cleanUrl.startsWith('/') ? cleanUrl.substring(1) : cleanUrl;
    return `http://localhost:5000/${cleanPath}`; 
};

const parseArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        let cleanStr = data.replace('{', '').replace('}', '').replace('[', '').replace(']', '');
        if (cleanStr.includes(',')) return cleanStr.split(',').map(item => item.trim().replace(/"/g, ''));
        return [cleanStr.trim().replace(/"/g, '')];
    }
    return [];
};

// 🔥 HÀM CHUẨN GIS: Parse tọa độ từ PostGIS Hex String
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

const customStyles = `
  .hide-scrollbar::-webkit-scrollbar { display: none; }
  .custom-cluster-icon { background: none; border: none; }
  .custom-table-container { height: calc(100vh - 250px); overflow-y: auto; }
`;

const createStatusIcon = (status) => {
    let color = '#38A169'; 
    if (status === 'pending') color = '#D69E2E'; 
    if (status === 'rejected' || status === 'blocked') color = '#E53E3E'; 
    return L.divIcon({ className: 'custom-pin', html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.4); transform: translate(-50%, -50%);"></div>`, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -10] });
};

// --- COMPONENTS CON ---
const UserDetailModal = ({ isOpen, onClose, user, onApprove, onReject }) => {
    if (!user) return null;
    const facilityImgs = parseArray(user.facility_images);
    const identityImgs = parseArray(user.identity_images);

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
            <ModalOverlay backdropFilter="blur(5px)" />
            <ModalContent>
                <ModalHeader>Hồ sơ: {user.full_name}</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <VStack align="stretch" spacing={4}>
                        <HStack spacing={4} bg="gray.50" p={3} borderRadius="lg">
                            <Avatar size="xl" src={getImgUrl(user.avatar_url)} name={user.full_name} border="2px solid green"/>
                            <Box>
                                <Text fontWeight="bold" fontSize="lg">{user.full_name}</Text>
                                <Text color="gray.500">{user.email}</Text>
                                <Text color="blue.500" fontSize="sm" mt={1}>Username: <b>{user.username}</b></Text>
                                <HStack mt={1}>
                                    <Badge colorScheme={user.role==='vendor'?'purple':'blue'}>{user.role}</Badge>
                                    <Badge colorScheme={user.status==='active'?'green':user.status==='pending'?'yellow':'red'}>{user.status}</Badge>
                                </HStack>
                            </Box>
                        </HStack>

                        {user.role === 'vendor' && (
                            <>
                                <Divider />
                                <Heading size="sm" color="blue.600">🏢 Thông tin Cơ sở</Heading>
                                <SimpleGrid columns={2} spacing={3} bg="blue.50" p={3} borderRadius="md">
                                    <Box><Text fontWeight="bold" fontSize="xs" color="gray.500">TÊN SÂN</Text><Text fontWeight="bold">{user.facility_name || '---'}</Text></Box>
                                    <Box><Text fontWeight="bold" fontSize="xs" color="gray.500">SỐ ĐIỆN THOẠI</Text><Text fontWeight="bold">{user.phone_number || '---'}</Text></Box>
                                    <Box gridColumn="span 2"><Text fontWeight="bold" fontSize="xs" color="gray.500">ĐỊA CHỈ</Text><Text>{user.facility_address || '---'}</Text></Box>
                                </SimpleGrid>

                                <Divider />
                                <Heading size="sm" color="purple.600">📸 Hồ sơ Xác minh (KYC)</Heading>
                                <Box>
                                    <Text fontWeight="bold" fontSize="xs" mb={2}>1. KHUÔN MẶT</Text>
                                    {user.face_image ? (
                                        <Image src={getImgUrl(user.face_image)} h="200px" borderRadius="md" objectFit="contain" border="1px solid #ddd" fallbackSrc="https://via.placeholder.com/150"/>
                                    ) : <Text color="red.400" fontStyle="italic">Thiếu ảnh</Text>}
                                </Box>
                                <Box>
                                    <Text fontWeight="bold" fontSize="xs" mb={2}>2. CCCD ({identityImgs.length} ảnh)</Text>
                                    {identityImgs.length > 0 ? (
                                        <SimpleGrid columns={2} spacing={3}>
                                            {identityImgs.map((img, i) => (
                                                <Image key={i} src={getImgUrl(img)} h="150px" w="100%" objectFit="cover" borderRadius="md" border="1px solid #ddd" fallbackSrc="https://via.placeholder.com/150"/>
                                            ))}
                                        </SimpleGrid>
                                    ) : <Text color="red.400" fontStyle="italic">Thiếu ảnh</Text>}
                                </Box>
                                <Box>
                                    <Text fontWeight="bold" fontSize="xs" mb={2}>3. ẢNH CƠ SỞ ({facilityImgs.length} ảnh)</Text>
                                    {facilityImgs.length > 0 ? (
                                        <SimpleGrid columns={3} spacing={2}>
                                            {facilityImgs.map((img, i) => (
                                                <Image key={i} src={getImgUrl(img)} h="100px" w="100%" objectFit="cover" borderRadius="md" border="1px solid #ddd" _hover={{transform: 'scale(1.05)', transition: '0.2s'}} fallbackSrc="https://via.placeholder.com/150"/>
                                            ))}
                                        </SimpleGrid>
                                    ) : <Text color="gray.400" fontStyle="italic">Không có ảnh</Text>}
                                </Box>
                            </>
                        )}
                    </VStack>
                </ModalBody>
                <ModalFooter bg="gray.50" borderTop="1px solid #eee">
                    {user.status === 'pending' ? (
                        <>
                            <Button colorScheme="red" mr={3} onClick={() => onReject(user.id)}>Từ chối</Button>
                            <Button colorScheme="green" onClick={() => onApprove(user.id)}>Duyệt Hồ Sơ</Button>
                        </>
                    ) : (
                        <Button onClick={onClose}>Đóng</Button>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

const StatCard = ({ icon, title, value, help, color }) => (
    <Stat px={4} py={5} shadow="xl" border="1px solid" borderColor={useColorModeValue('gray.100', 'gray.700')} rounded="2xl" bg={useColorModeValue('white', 'gray.800')}>
        <Flex justifyContent={'space-between'}><Box pl={2}><StatLabel fontWeight={'bold'} color="gray.500" isTruncated>{title}</StatLabel><StatNumber fontSize={'3xl'} fontWeight={'800'} color={`${color}.500`}>{value}</StatNumber>{help && <StatHelpText>{help}</StatHelpText>}</Box><Box my={'auto'} color={`${color}.400`}><Icon as={icon} w={10} h={10} opacity={0.8} /></Box></Flex>
    </Stat>
);

// --- MAIN COMPONENT ---
export default function SuperAdminPage() {
    // Data States
    const [sportTypes, setSportTypes] = useState([]);
    const [users, setUsers] = useState([]); 
    const [courts, setCourts] = useState([]); 
    const [facilities, setFacilities] = useState([]); 
    const [config, setConfig] = useState({ website_name: '', logo_url: '' });
    
    // Stats
    const [stats, setStats] = useState({ summary: { users: 0, vendors: 0, courts: 0, revenue: 0 }, pie_data: { users: 0, vendors: 0 } });
    const [wardStats, setWardStats] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI & Form States
    const [formData, setFormData] = useState({ name: '', code: '', icon_url_direct: '' });
    const [file, setFile] = useState(null); 
    const [logoFile, setLogoFile] = useState(null); 
    const [uploadMode, setUploadMode] = useState('file');
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewLogo, setPreviewLogo] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); 
    
    // Bulk Action State
    const [selectedIds, setSelectedIds] = useState([]);

    // Navigation & Layout
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [selectedUser, setSelectedUser] = useState(null);
    const { isOpen, onOpen, onClose } = useDisclosure();

    const toast = useToast();
    const navigate = useNavigate();
    const { colorMode, toggleColorMode } = useColorMode();
    const isMobile = useBreakpointValue({ base: true, lg: false });
    
    // Colors
    const bg = useColorModeValue('gray.50', 'gray.900');
    const cardBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');
    const headerBg = useColorModeValue('white', 'gray.800');
    const hoverTrBg = useColorModeValue('gray.50', 'gray.700'); 

    // --- FETCH DATA ---
    const fetchData = async () => {
        try {
            setLoading(true);
            const [resSports, resUsers, resConfig, resAllCourts, resDashboard, resWards, resFacilities] = await Promise.all([
                axios.get('http://localhost:5000/api/sport-types'),
                axios.get('http://localhost:5000/api/admin/users'), 
                axios.get('http://localhost:5000/api/config'),
                axios.get('http://localhost:5000/api/admin/all-courts'), 
                axios.get('http://localhost:5000/api/superadmin/dashboard-stats').catch(() => ({ data: { summary: {users:0, vendors:0, courts:0, revenue:0}, pie_data: {users:0, vendors:0} } })),
                axios.get('http://localhost:5000/api/superadmin/stats/courts-by-ward').catch(() => ({ data: [] })),
                axios.get('http://localhost:5000/api/admin/facilities').catch(() => ({ data: [] }))
            ]);

            setSportTypes(resSports.data || []);
            setUsers(resUsers.data || []);
            setConfig(resConfig.data || {});
            setCourts(resAllCourts.data || []); 
            setStats(resDashboard.data);
            setWardStats(resWards.data || []);
            setFacilities(resFacilities.data || []);

            if(resConfig.data?.logo_url) setPreviewLogo(getImgUrl(resConfig.data.logo_url));

        } catch (error) { console.error("Lỗi tải dữ liệu", error); } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    // --- HANDLERS ---
    const handleLogout = () => { if(window.confirm("Đăng xuất?")) { localStorage.clear(); navigate('/login'); } };

    // User Management
    const handleUserStatus = async (userId, newStatus) => {
        try { await axios.put(`http://localhost:5000/api/admin/users/${userId}/status`, { status: newStatus }); toast({ title: 'Cập nhật thành công', status: 'success' }); fetchData(); } catch (e) { toast({ status: 'error', title: 'Lỗi cập nhật' }); }
    };
    const handleApproveUser = async (userId) => {
        if(!window.confirm("Duyệt tài khoản này?")) return;
        try { await axios.put(`http://localhost:5000/api/admin/users/${userId}/status`, { status: 'active' }); toast({ title: 'Đã duyệt!', status: 'success' }); fetchData(); onClose(); } catch (e) { toast({ status: 'error', title: 'Lỗi' }); }
    };
    const handleRejectUser = async (userId) => {
        if(!window.confirm("Từ chối tài khoản này?")) return;
        try { await axios.put(`http://localhost:5000/api/admin/users/${userId}/status`, { status: 'rejected' }); toast({ title: 'Đã từ chối', status: 'warning' }); fetchData(); onClose(); } catch (e) { toast({ status: 'error', title: 'Lỗi' }); }
    };
    const handleDeleteUser = async (userId) => {
        if(window.confirm("CẢNH BÁO: Xóa vĩnh viễn user này?")) { try { await axios.delete(`http://localhost:5000/api/admin/users/${userId}`); toast({ title: 'Đã xóa user', status: 'success' }); fetchData(); } catch (e) { toast({ status: 'error', title: 'Lỗi xóa user' }); } }
    };
    const handleViewDetail = (user) => { setSelectedUser(user); onOpen(); };

    // Facility Management
    const handleFacilityStatus = async (facId, newStatus) => {
        try {
            await axios.put(`http://localhost:5000/api/admin/facilities/${facId}/status`, { status: newStatus });
            toast({ title: `Đã cập nhật: ${newStatus}`, status: 'success' });
            fetchData();
        } catch (e) { toast({ title: 'Lỗi cập nhật', status: 'error' }); }
    };

    // Court Management
    const handleCourtStatus = async (courtId, newStatus) => { 
        try { 
            await axios.put(`http://localhost:5000/api/admin/courts/${courtId}/status`, { status: newStatus }); 
            setCourts(prev => prev.map(c => c.id === courtId ? {...c, status: newStatus} : c)); 
            toast({ title: `Đã chuyển trạng thái sân sang: ${newStatus}`, status: 'success' }); 
        } catch (e) { console.error(e); toast({ title: 'Lỗi cập nhật', status: 'error' }); } 
    };

    const handleBulkAction = async (status) => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Bạn có chắc muốn chuyển ${selectedIds.length} sân sang trạng thái ${status}?`)) return;
        try {
            await axios.put('http://localhost:5000/api/admin/courts/bulk-status', { ids: selectedIds, status: status });
            toast({ title: "Thao tác hàng loạt thành công!", status: "success" });
            fetchData();
            setSelectedIds([]);
        } catch (error) { toast({ title: "Lỗi thao tác", status: "error" }); }
    };

    // Config & Sport Types
    const handleSaveConfig = async () => { const data = new FormData(); data.append('website_name', config.website_name); if (logoFile) data.append('logo', logoFile); try { await axios.post('http://localhost:5000/api/config', data); toast({ title: 'Đã lưu!', status: 'success' }); fetchData(); } catch (e) { toast({ status: 'error', title: 'Lỗi' }); } };
    const handleLogoChange = (e) => { const f = e.target.files[0]; if (f) { setLogoFile(f); setPreviewLogo(URL.createObjectURL(f)); } };
    const handleFileChange = (e) => { const f = e.target.files[0]; if (f) { setFile(f); setPreviewUrl(URL.createObjectURL(f)); } };
    const handleLinkChange = (e) => { setFormData({ ...formData, icon_url_direct: e.target.value }); setPreviewUrl(e.target.value); };
    const handleSubmitSport = async (e) => { e.preventDefault(); const data = new FormData(); data.append('name', formData.name); data.append('code', formData.code); if (uploadMode === 'file') { if (file) data.append('icon', file); } else { if (formData.icon_url_direct) data.append('icon_url_direct', formData.icon_url_direct); } try { await axios.post('http://localhost:5000/api/sport-types', data); toast({ title: 'Thêm thành công!', status: 'success' }); setFormData({ name: '', code: '', icon_url_direct: '' }); setFile(null); setPreviewUrl(''); fetchData(); } catch { toast({ title: 'Lỗi', status: 'error' }); } };
    const handleDeleteSport = async (id) => { if (window.confirm("Xóa?")) { await axios.delete(`http://localhost:5000/api/sport-types/${id}`); fetchData(); } };

    // --- FILTERS ---
    const filteredUsers = users.filter(u => u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const filteredCourts = useMemo(() => { 
        let res = courts.filter(c => { 
            const status = c.status || 'active'; 
            if (filterStatus === 'all') return true; 
            return status === filterStatus; 
        });
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            res = res.filter(c => 
                c.name.toLowerCase().includes(lowerSearch) || 
                (c.facility_name && c.facility_name.toLowerCase().includes(lowerSearch))
            );
        }
        return res;
    }, [courts, filterStatus, searchTerm]);

    const pieData = { labels: ['Khách Hàng', 'Chủ Sân'], datasets: [{ data: [stats.pie_data?.users || 0, stats.pie_data?.vendors || 0], backgroundColor: ['#3182CE', '#805AD5'], borderWidth: 1 }] };
    const wardChartData = { labels: wardStats.map(w => w.ward_name), datasets: [{ label: 'Số lượng sân', data: wardStats.map(w => w.count), backgroundColor: 'rgba(56, 161, 105, 0.7)', borderRadius: 5 }] };
    const lineData = { labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'], datasets: [{ label: 'GMV (VNĐ)', data: [10000000, 15000000, 12000000, 20000000, 25000000, stats.summary?.revenue || 0], borderColor: '#DD6B20', backgroundColor: 'rgba(221, 107, 32, 0.2)', fill: true, tension: 0.4 }] };

    return (
        <Flex h="100vh" w="100vw" direction="column" bg={bg} overflow="hidden">
            <style>{customStyles}</style>

            <Flex h="64px" bg={headerBg} shadow="sm" align="center" px={4} justify="space-between" zIndex={2000} borderBottom="1px solid" borderColor={useColorModeValue('gray.200', 'gray.700')}>
                <HStack spacing={4}>
                    <IconButton icon={<FaBars />} variant="ghost" onClick={() => setSidebarOpen(!isSidebarOpen)} aria-label="Toggle Sidebar" display={{base:'flex', lg:'none'}} />
                    <HStack><Icon as={FaUserShield} boxSize={6} color="red.500" /><Heading size="md" bgGradient="linear(to-r, red.500, orange.500)" bgClip="text" display={{base:'none', md:'block'}}>SUPER ADMIN GIS</Heading></HStack>
                </HStack>
                <HStack spacing={4}>
                    {previewLogo && <Image src={previewLogo} h="32px" objectFit="contain" />}
                    <IconButton icon={colorMode === 'light' ? <FaMoon/> : <FaSun/>} isRound size="sm" onClick={toggleColorMode} />
                    <Button leftIcon={<FaSignOutAlt/>} size="sm" colorScheme="gray" onClick={handleLogout}>Thoát</Button>
                </HStack>
            </Flex>

            <Flex flex={1} position="relative" overflow="hidden">
                <Box w={{base: '280px', lg: '240px'}} bg={headerBg} h="100%" borderRight="1px solid" borderColor={useColorModeValue('gray.200', 'gray.700')} position={{base: 'absolute', lg: 'relative'}} left={{base: isSidebarOpen ? 0 : '-280px', lg: 0}} transition="left 0.3s ease" zIndex={3000} shadow={{base: '2xl', lg: 'none'}}>
                    <VStack align="stretch" p={4} spacing={2}>
                        <Button leftIcon={<FaChartLine/>} justifyContent="flex-start" variant={activeTab===0?"solid":"ghost"} colorScheme="blue" onClick={()=>{setActiveTab(0); if(isMobile) setSidebarOpen(false);}}>Dashboard</Button>
                        <Button leftIcon={<FaStore/>} justifyContent="flex-start" variant={activeTab===5?"solid":"ghost"} colorScheme="blue" onClick={()=>{setActiveTab(5); if(isMobile) setSidebarOpen(false);}}>Duyệt Cơ Sở (Mới)</Button>
                        <Button leftIcon={<FaMapMarkedAlt/>} justifyContent="flex-start" variant={activeTab===1?"solid":"ghost"} colorScheme="blue" onClick={()=>{setActiveTab(1); if(isMobile) setSidebarOpen(false);}}>Quản lý Sân Con</Button>
                        <Button leftIcon={<FaUserShield/>} justifyContent="flex-start" variant={activeTab===2?"solid":"ghost"} colorScheme="blue" onClick={()=>{setActiveTab(2); if(isMobile) setSidebarOpen(false);}}>Người dùng</Button>
                        <Button leftIcon={<FaGamepad/>} justifyContent="flex-start" variant={activeTab===3?"solid":"ghost"} colorScheme="blue" onClick={()=>{setActiveTab(3); if(isMobile) setSidebarOpen(false);}}>Danh mục</Button>
                        <Button leftIcon={<FaGlobe/>} justifyContent="flex-start" variant={activeTab===4?"solid":"ghost"} colorScheme="blue" onClick={()=>{setActiveTab(4); if(isMobile) setSidebarOpen(false);}}>Cấu hình</Button>
                    </VStack>
                </Box>
                {isMobile && isSidebarOpen && <Box position="absolute" inset={0} bg="blackAlpha.600" zIndex={2999} onClick={() => setSidebarOpen(false)} />}

                <Box flex={1} overflowY="auto" className="hide-scrollbar" position="relative">
                    
                    {/* TAB 0: DASHBOARD */}
                    {activeTab === 0 && (
                        <Container maxW="container.xl" py={6}>
                             {loading ? <Flex justify="center" h="400px" align="center"><Spinner size="xl" color="blue.500"/></Flex> : (
                                <>
                                    <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
                                        <StatCard icon={FaUsers} title="Tổng User" value={(stats.summary?.users || 0) + (stats.summary?.vendors || 0)} color="blue" />
                                        <StatCard icon={FaStore} title="Chủ Sân" value={stats.summary?.vendors || 0} color="purple" />
                                        <StatCard icon={FaFutbol} title="Tổng Sân" value={stats.summary?.courts || 0} color="green" />
                                        <StatCard icon={FaMoneyBillWave} title="Tổng Giao Dịch (GMV)" value={`${(stats.summary?.revenue || 0).toLocaleString()} đ`} color="orange" />
                                    </SimpleGrid>
                                    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8}>
                                        <Card bg={cardBg} shadow="lg" borderRadius="xl"><CardBody><Heading size="sm" mb={4}>👥 Tỉ lệ User</Heading><Box h="250px" display="flex" justifyContent="center"><Pie data={pieData} /></Box></CardBody></Card>
                                        <Card bg={cardBg} shadow="lg" borderRadius="xl"><CardBody><Heading size="sm" mb={4}>📈 Tăng trưởng GMV</Heading><Box h="250px"><Line data={lineData} options={{maintainAspectRatio: false}} /></Box></CardBody></Card>
                                        <GridItem colSpan={{ base: 1, lg: 2 }}>
                                            <Card bg={cardBg} shadow="lg" borderRadius="xl" borderTop="4px solid" borderColor="green.400">
                                                <CardBody>
                                                    <Heading size="md" mb={4} color="green.700">📍 Thống kê Sân theo Phường/Xã</Heading>
                                                    <Box h="400px">{wardStats.length > 0 ? <Bar data={wardChartData} options={{ responsive: true, maintainAspectRatio: false }} /> : <Flex h="100%" justify="center" align="center" color="gray.400"><Text>Chưa có dữ liệu phân bố sân.</Text></Flex>}</Box>
                                                </CardBody>
                                            </Card>
                                        </GridItem>
                                    </SimpleGrid>
                                </>
                            )}
                        </Container>
                    )}

                    {/* TAB 5: DUYỆT CƠ SỞ */}
                    {activeTab === 5 && (
                        <Container maxW="container.xl" py={6}>
                            <Card shadow="lg" borderRadius="2xl" bg={cardBg}>
                                <CardBody p={6}>
                                    <Heading size="md" mb={6}>🏢 Danh sách Cơ Sở Đăng Ký</Heading>
                                    <Table variant="simple" size="sm">
                                        <Thead bg={useColorModeValue('gray.50', 'gray.700')}>
                                            <Tr><Th>Ảnh</Th><Th>Tên Cơ Sở</Th><Th>Chủ Sân</Th><Th>Trạng thái</Th><Th>Hành động</Th></Tr>
                                        </Thead>
                                        <Tbody>
                                            {facilities.map(fac => (
                                                <Tr key={fac.id}>
                                                    <Td><Image src={getImgUrl(fac.image_url)} boxSize="60px" objectFit="cover" borderRadius="md" fallbackSrc="https://placehold.co/50"/></Td>
                                                    <Td><Text fontWeight="bold">{fac.name}</Text><Text fontSize="xs" color="gray.500">{fac.address}</Text></Td>
                                                    <Td><Text fontWeight="bold" fontSize="sm">{fac.owner_name}</Text><Text fontSize="xs">{fac.owner_phone}</Text></Td>
                                                    <Td>
                                                        <Badge colorScheme={fac.status === 'active' ? 'green' : fac.status === 'pending' ? 'orange' : 'red'}>
                                                            {fac.status === 'active' ? 'HOẠT ĐỘNG' : fac.status === 'pending' ? 'CHỜ DUYỆT' : 'ĐÃ KHÓA'}
                                                        </Badge>
                                                    </Td>
                                                    <Td>
                                                        <HStack>
                                                            {fac.status !== 'active' && <Button size="xs" colorScheme="green" onClick={() => handleFacilityStatus(fac.id, 'active')}>Duyệt</Button>}
                                                            {fac.status !== 'blocked' && <Button size="xs" colorScheme="red" onClick={() => handleFacilityStatus(fac.id, 'blocked')}>Khóa</Button>}
                                                        </HStack>
                                                    </Td>
                                                </Tr>
                                            ))}
                                        </Tbody>
                                    </Table>
                                    {facilities.length === 0 && <Text textAlign="center" mt={4} color="gray.500">Chưa có dữ liệu.</Text>}
                                </CardBody>
                            </Card>
                        </Container>
                    )}

                    {/* 🔥 TAB 1: QUẢN LÝ SÂN CON - CHUẨN GIS (SPLIT VIEW) */}
                    {activeTab === 1 && (
                        <Flex h="100%" flexDirection={{base: 'column', lg: 'row'}}>
                            {/* PANEL TRÁI: DANH SÁCH & ACTION */}
                            <Box w={{base: '100%', lg: '40%'}} h="100%" bg={cardBg} borderRight="1px solid" borderColor={borderColor} display="flex" flexDirection="column">
                                <Box p={4} borderBottom="1px solid" borderColor={borderColor} bg={cardBg}>
                                    <Heading size="sm" mb={3}>Quản lý Sân Con ({filteredCourts.length})</Heading>
                                    <VStack spacing={3}>
                                        <HStack w="100%">
                                            <Select size="sm" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} borderRadius="lg">
                                                <option value="all">Tất cả trạng thái</option><option value="pending">⏳ Chờ duyệt</option><option value="active">✅ Đang hoạt động</option><option value="rejected">❌ Đã khóa</option>
                                            </Select>
                                            <InputGroup size="sm">
                                                <InputLeftElement children={<FaSearch color="gray.400"/>} />
                                                <Input placeholder="Tìm tên sân..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} borderRadius="lg"/>
                                            </InputGroup>
                                        </HStack>
                                        
                                        {/* BULK ACTIONS TOOLBAR */}
                                        {selectedIds.length > 0 && (
                                            <HStack w="100%" bg="blue.50" p={2} borderRadius="md" justify="space-between">
                                                <Text fontSize="xs" fontWeight="bold" color="blue.600">Đã chọn: {selectedIds.length}</Text>
                                                <HStack>
                                                    <IconButton size="xs" icon={<FaCheckDouble/>} colorScheme="green" onClick={() => handleBulkAction('active')} aria-label="Duyệt tất cả"/>
                                                    <IconButton size="xs" icon={<FaBan/>} colorScheme="red" onClick={() => handleBulkAction('rejected')} aria-label="Khóa tất cả"/>
                                                    <Button size="xs" onClick={() => setSelectedIds([])}>Hủy</Button>
                                                </HStack>
                                            </HStack>
                                        )}
                                    </VStack>
                                </Box>

                                {/* TABLE LIST */}
                                <Box flex={1} overflowY="auto" className="custom-scroll">
                                    <Table variant="simple" size="sm">
                                        <Thead position="sticky" top={0} bg={useColorModeValue('gray.100', 'gray.700')} zIndex={1}>
                                            <Tr>
                                                <Th w="30px"><Checkbox isChecked={selectedIds.length > 0 && selectedIds.length === filteredCourts.length} onChange={(e) => e.target.checked ? setSelectedIds(filteredCourts.map(c => c.id)) : setSelectedIds([])} /></Th>
                                                <Th>Tên Sân</Th>
                                                <Th>Trạng thái</Th>
                                                <Th>Hành động</Th>
                                            </Tr>
                                        </Thead>
                                        <Tbody>
                                            {filteredCourts.map(c => (
                                                <Tr key={c.id} _hover={{ bg: hoverTrBg }} cursor="pointer">
                                                    <Td><Checkbox isChecked={selectedIds.includes(c.id)} onChange={(e) => e.target.checked ? setSelectedIds([...selectedIds, c.id]) : setSelectedIds(selectedIds.filter(id => id !== c.id))} /></Td>
                                                    <Td>
                                                        <Text fontWeight="bold" fontSize="sm" noOfLines={1}>{c.name}</Text>
                                                        <Text fontSize="xs" color="gray.500" noOfLines={1}>{c.facility_name}</Text>
                                                    </Td>
                                                    <Td><Badge colorScheme={c.status==='active'?'green':c.status==='rejected'?'red':'orange'}>{c.status}</Badge></Td>
                                                    <Td>
                                                        <HStack spacing={1}>
                                                            {c.status !== 'active' && <IconButton size="xs" icon={<FaCheck/>} colorScheme="green" onClick={() => handleCourtStatus(c.id, 'active')} />}
                                                            {c.status !== 'rejected' && <IconButton size="xs" icon={<FaBan/>} colorScheme="red" onClick={() => handleCourtStatus(c.id, 'rejected')} />}
                                                        </HStack>
                                                    </Td>
                                                </Tr>
                                            ))}
                                        </Tbody>
                                    </Table>
                                </Box>
                            </Box>

                            {/* PANEL PHẢI: BẢN ĐỒ GIS */}
                            <Box w={{base: '100%', lg: '60%'}} h="100%" position="relative">
                                <MapContainer center={[10.7769, 106.7009]} zoom={13} style={{ height: "100%", width: "100%" }}>
                                    <LayersControl position="topright">
                                        <LayersControl.BaseLayer checked name="Đường phố"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></LayersControl.BaseLayer>
                                        <LayersControl.BaseLayer name="Vệ tinh"><TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" /></LayersControl.BaseLayer>
                                    </LayersControl>
                                    
                                    {filteredCourts.map(c => {
                                        let lat, lng;
                                        if (c.geometry && c.geometry.coordinates) { lat = c.geometry.coordinates[1]; lng = c.geometry.coordinates[0]; }
                                        else if (c.location) { const p = parsePostGISPoint(c.location); if(p) { lat = p.lat; lng = p.lng; } }
                                        
                                        if (!lat || !lng) return null;

                                        return (
                                            <Marker key={c.id} position={[lat, lng]} icon={createStatusIcon(c.status || 'active')}>
                                                <Popup>
                                                    <VStack align="start" spacing={1}>
                                                        <Text fontWeight="bold">{c.name}</Text>
                                                        <Text fontSize="xs">{c.facility_name}</Text>
                                                        <Badge colorScheme={c.status==='active'?'green':'red'}>{c.status}</Badge>
                                                        <Divider my={1}/>
                                                        <HStack>
                                                            <Button size="xs" colorScheme="green" onClick={()=>handleCourtStatus(c.id, 'active')}>Duyệt</Button>
                                                            <Button size="xs" colorScheme="red" onClick={()=>handleCourtStatus(c.id, 'rejected')}>Khóa</Button>
                                                        </HStack>
                                                    </VStack>
                                                </Popup>
                                            </Marker>
                                        );
                                    })}
                                </MapContainer>
                            </Box>
                        </Flex>
                    )}

                    {/* TAB 2: QUẢN LÝ NGƯỜI DÙNG */}
                    {activeTab === 2 && (
                        <Container maxW="container.xl" py={6}>
                            <Card shadow="lg" borderRadius="2xl" bg={cardBg}>
                                <CardBody p={6}>
                                    <Flex mb={6} justify="space-between" align="center" wrap="wrap" gap={4}>
                                        <Heading size="md" color="gray.700">👥 Quản lý User ({users.length})</Heading>
                                        <InputGroup maxW="300px"><InputLeftElement children={<FaSearch color="gray.400"/>} /><Input placeholder="Tìm tên, email..." borderRadius="full" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} /></InputGroup>
                                    </Flex>
                                    <Box overflowX="auto">
                                        <Table variant="simple" size="sm">
                                            <Thead bg={useColorModeValue('gray.50', 'gray.700')}><Tr><Th>User Info</Th><Th>Vai trò</Th><Th>Trạng thái</Th><Th>Hành động</Th></Tr></Thead>
                                            <Tbody>{filteredUsers.map(u => (<Tr key={u.id} _hover={{ bg: hoverTrBg }} bg={u.status === 'pending' ? 'yellow.50' : 'transparent'}><Td><HStack spacing={3}><Avatar size="sm" src={getImgUrl(u.avatar_url)} name={u.full_name} /><VStack align="start" spacing={0}><Text fontWeight="bold" fontSize="sm">{u.full_name}</Text><Text fontSize="xs" color="gray.500">{u.email}</Text></VStack></HStack></Td><Td><Badge colorScheme={u.role==='vendor'?'purple':'blue'}>{u.role}</Badge></Td><Td><Badge colorScheme={u.status==='active'?'green':u.status==='blocked'?'red':'orange'} borderRadius="full" px={2}>{u.status}</Badge></Td><Td><HStack spacing={2}><Button size="xs" leftIcon={<FaEye/>} colorScheme="blue" onClick={() => handleViewDetail(u)}>Xem Hồ Sơ</Button>{u.status !== 'blocked' && <Button size="xs" leftIcon={<FaUserTimes/>} colorScheme="orange" onClick={() => handleUserStatus(u.id, 'blocked')}>Khóa</Button>}<IconButton size="xs" icon={<FaTrash/>} colorScheme="red" variant="ghost" onClick={() => handleDeleteUser(u.id)}/></HStack></Td></Tr>))}</Tbody>
                                        </Table>
                                    </Box>
                                </CardBody>
                            </Card>
                        </Container>
                    )}

                    {/* TAB 3: DANH MỤC */}
                    {activeTab === 3 && (
                        <Container maxW="container.xl" py={6}>
                            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
                                <Card shadow="lg" borderRadius="2xl" bg={cardBg}>
                                    <CardBody>
                                        <Heading size="md" mb={6} color="gray.700">Thêm Loại Sân</Heading>
                                        <VStack spacing={4} as="form" onSubmit={handleSubmitSport}>
                                            <FormControl isRequired><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">TÊN LOẠI HÌNH</FormLabel><InputGroup size="sm"><InputLeftElement children={<FaGamepad color="gray.400"/>} /><Input placeholder="VD: Bóng đá" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} borderRadius="md"/></InputGroup></FormControl>
                                            <FormControl isRequired><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">MÃ CODE (English)</FormLabel><InputGroup size="sm"><InputLeftElement children={<FaCode color="gray.400"/>} /><Input placeholder="VD: football" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} borderRadius="md"/></InputGroup></FormControl>
                                            <FormControl><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">ICON</FormLabel><RadioGroup onChange={setUploadMode} value={uploadMode} mb={3} size="sm"><Stack direction='row'><Radio value='file'>File</Radio><Radio value='link'>Link</Radio></Stack></RadioGroup>{uploadMode === 'file' ? (<Box w="100%" p={4} border="2px dashed" borderColor="gray.300" borderRadius="xl" textAlign="center" cursor="pointer" position="relative" bg="gray.50"><Input type="file" opacity={0} position="absolute" top={0} left={0} w="100%" h="100%" onChange={handleFileChange} accept="image/*"/><VStack spacing={1}><Icon as={FaUpload} color="gray.400" boxSize={6} /><Text fontSize="xs" color="gray.500">{file ? file.name : "Chọn ảnh"}</Text></VStack></Box>) : (<InputGroup size="sm"><InputLeftElement children={<FaLink color="gray.400"/>} /><Input placeholder="https://..." value={formData.icon_url_direct} onChange={handleLinkChange} borderRadius="md"/></InputGroup>)}</FormControl>
                                            {previewUrl && <Box p={2} bg="gray.100" borderRadius="lg" w="100%" textAlign="center"><Image src={previewUrl} boxSize="60px" objectFit="contain" mx="auto" /></Box>}
                                            <Button type="submit" colorScheme="blue" w="100%" size="md" leftIcon={<FaPlus />} shadow="md">THÊM MỚI</Button>
                                        </VStack>
                                    </CardBody>
                                </Card>
                                <GridItem colSpan={{base: 1, lg: 2}}>
                                    <Card shadow="lg" borderRadius="2xl" bg={cardBg}>
                                        <CardBody p={0}>
                                            <Table variant="simple"><Thead bg={useColorModeValue('gray.50', 'gray.700')}><Tr><Th>Icon</Th><Th>Tên</Th><Th>Code</Th><Th isNumeric>Xóa</Th></Tr></Thead><Tbody>{sportTypes.map((type) => (<Tr key={type.id} _hover={{ bg: hoverTrBg }}><Td><Image src={type.icon_url} boxSize="40px" objectFit="contain" borderRadius="md"/></Td><Td fontWeight="bold">{type.name}</Td><Td><Badge colorScheme="green" borderRadius="full" px={2}>{type.code}</Badge></Td><Td isNumeric><IconButton size="sm" colorScheme="red" variant="ghost" icon={<FaTrash />} onClick={() => handleDeleteSport(type.id)} /></Td></Tr>))}</Tbody></Table>
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
                                        <FormControl><FormLabel fontWeight="bold" fontSize="sm" color="gray.500">TÊN WEBSITE</FormLabel><InputGroup><InputLeftElement children={<FaGlobe color="gray.400"/>} /><Input value={config.website_name} onChange={(e) => setConfig({...config, website_name: e.target.value})} placeholder="VD: Sport Booking Pro" borderRadius="lg"/></InputGroup></FormControl>
                                        <FormControl><FormLabel fontWeight="bold" fontSize="sm" color="gray.500">LOGO HỆ THỐNG</FormLabel><HStack align="center" spacing={6} p={6} border="1px solid" borderColor="gray.200" borderRadius="xl" bg="gray.50"><Box w="100px" h="100px" border="2px dashed" borderColor="gray.300" borderRadius="xl" display="flex" alignItems="center" justifyContent="center" bg="white" position="relative" overflow="hidden">{previewLogo ? <Image src={previewLogo} w="100%" h="100%" objectFit="contain" /> : <Icon as={FaImage} color="gray.300" boxSize={10}/>}<Input type="file" opacity={0} position="absolute" top={0} left={0} w="100%" h="100%" cursor="pointer" onChange={handleLogoChange} accept="image/*"/></Box><VStack align="start" spacing={2} flex={1}><Button size="sm" leftIcon={<FaUpload/>} onClick={()=>document.querySelector('input[type="file"]').click()} colorScheme="blue" variant="outline">Chọn ảnh mới</Button><Text fontSize="xs" color="gray.400">Định dạng PNG, JPG. Tối ưu 512x512.</Text></VStack></HStack></FormControl>
                                        <Button colorScheme="green" size="lg" leftIcon={<FaSave/>} onClick={handleSaveConfig} w="100%" shadow="lg" mt={4}>LƯU CẤU HÌNH</Button>
                                    </VStack>
                                </CardBody>
                            </Card>
                        </Container>
                    )}
                </Box>
            </Flex>

            {/* MODAL DUYỆT USER */}
            <UserDetailModal isOpen={isOpen} onClose={onClose} user={selectedUser} onApprove={handleApproveUser} onReject={handleRejectUser} />
        </Flex>
    );
}