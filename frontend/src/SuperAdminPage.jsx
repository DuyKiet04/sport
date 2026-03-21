import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMapEvents, useMap, GeoJSON } from 'react-leaflet';
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
    useBreakpointValue, Spinner, Checkbox, NumberInput, NumberInputField, Tooltip as ChakraTooltip,
    Menu, MenuButton, MenuList, MenuItem, MenuDivider 
} from '@chakra-ui/react';
import { 
    FaTrash, FaPlus, FaLink, FaUpload, FaGamepad, FaCode, FaUserShield, 
    FaUserTimes, FaCheck, FaSave, FaGlobe, FaImage, FaSignOutAlt, FaMoon, FaSun, FaSearch,
    FaMapMarkedAlt, FaChartLine, FaBan, FaBars, FaMoneyBillWave, FaStore, FaFutbol, FaUsers, FaEye, FaCheckDouble,
    FaLayerGroup, FaMapPin, FaToggleOn, FaToggleOff, FaEdit, FaFilter, FaChevronLeft, FaChevronRight, FaLock, FaStar,
    FaBell, FaCircle ,FaPhone, FaEllipsisH, FaTimes
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { 
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip as ChartTooltip, Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js';
import RatingChart from './components/RatingChart';
import ReviewManagementTab from './ReviewManagementTab';
import { Bar, Pie } from 'react-chartjs-2'; // 🔥 ĐÃ XÓA LINE BARCHART

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend, ArcElement, PointElement, LineElement, Filler);

// ==========================================
// 1. HELPERS & UTILS
// ==========================================
const getImgUrl = (url) => {
    if (!url) return '';
    if (url.includes('base64')) return url;
    if (url.startsWith('http')) return url;
    const cleanPath = url.replace(/\\/g, '/').replace(/^\/+/, '');
    return `http://localhost:5000/${cleanPath}`;
};

const getPreviewTileUrl = (templateUrl) => {
    if (!templateUrl) return '';
    const z = 12; const x = 3262; const y = 1925; 
    return templateUrl.replace(/\{z\}/gi, z).replace(/\{x\}/gi, x).replace(/\{y\}/gi, y).replace(/\{s\}/gi, 'a'); 
};

const getSmartThumbnail = (layer) => {
    if (layer.thumbnail_url) return getImgUrl(layer.thumbnail_url);
    if (layer.thumbnail) return getImgUrl(layer.thumbnail);
    if (layer.image_url) return getImgUrl(layer.image_url);
    return getPreviewTileUrl(layer.url);
};
const getLayerThumb = (layer) => {
    if (layer.thumbnail_url) return getImgUrl(layer.thumbnail_url);
    if (layer.thumbnail) return getImgUrl(layer.thumbnail);
    if (layer.image_url) return getImgUrl(layer.image_url);
    return getPreviewTileUrl(layer.url);
};

const parseArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        let cleanStr = data.replace('{', '').replace('}', '').replace('[', '').replace(']', '').replace(/"/g, '');
        if (cleanStr.trim() === '') return [];
        if (cleanStr.includes(',')) return cleanStr.split(',').map(item => item.trim());
        return [cleanStr.trim()];
    }
    return [];
};

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

// 🔥 HÀM TÌM TỌA ĐỘ CHỐNG NULL
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

const removeVietnameseTones = (str) => { 
    if (!str) return ''; 
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, ""); 
    str = str.replace(/đ/g, "d").replace(/Đ/g, "D"); 
    return str.toLowerCase().trim(); 
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

const customStyles = `.hide-scrollbar::-webkit-scrollbar { display: none; } .custom-cluster-icon { background: none; border: none; }`;

const createStatusIcon = (status) => {
    let color = '#38A169'; 
    if (status === 'pending') color = '#D69E2E'; 
    if (status === 'rejected' || status === 'blocked') color = '#E53E3E'; 
    return L.divIcon({ className: 'custom-pin', html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.4); transform: translate(-50%, -50%);"></div>`, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -10] });
};

const MAP_SUGGESTIONS = [
    { name: "Google Đường Phố", url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" },
    { name: "Google Vệ Tinh", url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" },
    { name: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" },
];

// ==========================================
// 2. COMPONENT CON
// ==========================================
const LocationPicker = ({ position, setPosition }) => {
    useMapEvents({ click(e) { setPosition([e.latlng.lat, e.latlng.lng]); } });
    return position ? <Marker position={position} icon={createStatusIcon('active')} /> : null;
};

const MapFlyTo = ({ center }) => {
    const map = useMap();
    useEffect(() => { if (center && center[0] && center[1]) { map.flyTo(center, 16, { animate: true }); } }, [center, map]);
    return null;
};

const MapBoundsFlyTo = ({ shape }) => {
    const map = useMap();
    useEffect(() => {
        if (shape) {
            try {
                const geoJsonLayer = L.geoJSON(shape);
                const bounds = geoJsonLayer.getBounds();
                if (bounds.isValid()) map.flyToBounds(bounds, { padding: [20, 20], animate: true, duration: 1.5 });
            } catch (e) {}
        }
    }, [shape, map]);
    return null;
};

const StatCard = ({ icon, title, value, help, color }) => {
    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '6px 6px 12px #0d1117, -4px -4px 10px #2d3748');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #0d1117, inset -4px -4px 8px #2d3748');
    const textMuted = useColorModeValue('gray.500', 'gray.400');
    return (
        <Stat px={6} py={6} borderRadius="3xl" bg={neumorphBg} boxShadow={neumorphShadow}>
            <Flex justifyContent={'space-between'} align="center">
                <Box>
                    <Text fontSize="xs" fontWeight="900" color={textMuted} letterSpacing="1px" mb={2}>{title.toUpperCase()}</Text>
                    <Text fontSize="2xl" fontWeight="900" color={`${color}.500`} lineHeight="1">{value}</Text>
                </Box>
                <Box p={3} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow}>
                    <Icon as={icon} boxSize={6} color={`${color}.400`} />
                </Box>
            </Flex>
        </Stat>
    );
};

const NotificationBell = ({ user }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const { colorMode } = useColorMode();
    
    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphShadow = useColorModeValue('5px 5px 10px #b8bec5, -5px -5px 10px #ffffff', '4px 4px 8px #0d1117, -4px -4px 8px #2d3748');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #0d1117, inset -4px -4px 8px #2d3748');
    const textColorDefault = useColorModeValue('gray.700', 'gray.200');
    const mutedColor = useColorModeValue('gray.600', 'gray.400');

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const res = await axios.get(`http://localhost:5000/api/notifications/${user.id}?limit=15`);
            setNotifications(res.data.notifications || []);
            setUnreadCount(res.data.unreadCount || 0);
        } catch (e) {}
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 15000); 
        return () => clearInterval(interval);
    }, [user]);

    const handleMarkAllRead = async () => {
        if (unreadCount === 0) return;
        try {
            await axios.put(`http://localhost:5000/api/notifications/${user.id}/read`);
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (e) {}
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        try {
            await axios.delete(`http://localhost:5000/api/notifications/item/${id}`);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (e) {}
    };

    return (
        <Menu placement="bottom-end" onOpen={handleMarkAllRead}>
            <MenuButton as={Box} position="relative" cursor="pointer" mr={2}>
                <Box p={2.5} borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}>
                    <Icon as={FaBell} color={unreadCount > 0 ? "red.500" : "gray.500"} boxSize={5} mb="-2px"/>
                    {unreadCount > 0 && (
                        <Badge position="absolute" top="-2px" right="-2px" colorScheme="red" borderRadius="full" px={1.5} fontSize="0.7em" border="2px solid" borderColor={neumorphBg} animation="pulse 2s infinite">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Box>
            </MenuButton>
            
            <MenuList minW="320px" maxW="350px" shadow="2xl" borderRadius="2xl" p={0} overflow="hidden" bg={neumorphBg} border="none" zIndex={3000}>
                <Flex bg="red.600" p={4} justify="center" align="center">
                    <Text fontWeight="900" color="white" fontSize="sm">CẢNH BÁO & THÔNG BÁO</Text>
                </Flex>
                
                <Box maxH="350px" overflowY="auto" className="hide-scrollbar" bg={neumorphBg} p={2}>
                    {notifications.length === 0 ? (
                        <Text p={6} textAlign="center" color="gray.400" fontSize="sm" fontWeight="bold">Chưa có biến gì xảy ra.</Text>
                    ) : (
                        notifications.map((noti) => (
                            <Box key={noti.id} mb={2}>
                                <MenuItem bg={noti.is_read ? neumorphBg : useColorModeValue('white', 'whiteAlpha.100')} borderRadius="xl" boxShadow={noti.is_read ? neumorphActiveShadow : 'md'} p={3} _hover={{ transform: 'scale(0.98)' }} transition="all 0.2s">
                                    <HStack w="100%" align="start" spacing={3}>
                                        <Box mt={1}>
                                            {!noti.is_read ? <Icon as={FaCircle} color="red.500" boxSize={2} /> : <Box w={2} />}
                                        </Box>
                                        <VStack align="start" spacing={1} flex={1}>
                                            <Text fontWeight="900" fontSize="xs" color={noti.type === 'review_report' ? 'red.500' : textColorDefault} noOfLines={1}>{noti.title}</Text>
                                            <Text fontSize="10px" color={mutedColor} whiteSpace="normal" noOfLines={3} fontWeight="bold">{noti.message}</Text>
                                            <Text fontSize="9px" color="blue.400" fontWeight="bold">{new Date(noti.created_at).toLocaleString('vi-VN')}</Text>
                                        </VStack>
                                        <IconButton icon={<FaTrash />} size="xs" variant="ghost" colorScheme="red" onClick={(e) => handleDelete(e, noti.id)} isRound/>
                                    </HStack>
                                </MenuItem>
                            </Box>
                        ))
                    )}
                </Box>
            </MenuList>
        </Menu>
    );
};

// ==========================================================
// 3. TRANG SUPER ADMIN CHÍNH
// ==========================================================
export default function SuperAdminPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const { colorMode, toggleColorMode } = useColorMode();
    const isMobile = useBreakpointValue({ base: true, lg: false });

    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '8px 8px 16px #0d1117, -4px -4px 10px #2d3748');
    const neumorphActiveShadow = useColorModeValue('inset 5px 5px 10px #b8bec5, inset -5px -5px 10px #ffffff', 'inset 5px 5px 10px #0d1117, inset -5px -5px 10px #2d3748');
    const textColor = useColorModeValue('gray.700', 'gray.100');
    const textMuted = useColorModeValue('gray.500', 'gray.400');
    const accentColor = useColorModeValue('blue.500', 'blue.300');
    const borderColor = useColorModeValue('gray.200', 'gray.700');
    const hoverTrBg = useColorModeValue('whiteAlpha.600', 'blackAlpha.300');
    const rowSelectedBg = useColorModeValue('orange.50', 'rgba(221, 107, 32, 0.15)');
    const rowPendingBg = useColorModeValue('yellow.50', 'rgba(236, 201, 75, 0.15)');
    
    const inputStyle = { bg: neumorphBg, border: "none", color: textColor, boxShadow: neumorphActiveShadow, borderRadius: "xl", fontSize: "sm", fontWeight: "bold", _focus: { boxShadow: neumorphActiveShadow, border: "1px solid", borderColor: "blue.400" }, _placeholder: { color: "gray.400" } };

    const { isOpen: isUserDetailOpen, onOpen: onUserDetailOpen, onClose: onUserDetailClose } = useDisclosure();

    // Data States
    const [reportedCount, setReportedCount] = useState(0);
    const [sportTypes, setSportTypes] = useState([]);
    const [users, setUsers] = useState([]); 
    const [courts, setCourts] = useState([]); 
    const [facilities, setFacilities] = useState([]); 
    const [config, setConfig] = useState({ website_name: '', logo_url: '', admin_zalo: '' });
    const [mapLayers, setMapLayers] = useState([]);
    const [activeMapLayer, setActiveMapLayer] = useState({ url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '&copy; OpenStreetMap', thumbnail: null });
    const [markerIcon, setMarkerIcon] = useState(''); 
    const [currentUser, setCurrentUser] = useState(null);
    const [wards, setWards] = useState([]);
    const [wardShape, setWardShape] = useState(null);
    const [stats, setStats] = useState({ summary: { users: 0, vendors: 0, courts: 0, revenue: 0 }, pie_data: { users: 0, vendors: 0 } });
    const [wardStats, setWardStats] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI States & Filters
    const [activeTab, setActiveTab] = useState(0);
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [searchTerm, setSearchTerm] = useState(''); 
    const [facSearchTerm, setFacSearchTerm] = useState('');
    const [facWardFilter, setFacWardFilter] = useState('all');
    const [facStatusFilter, setFacStatusFilter] = useState('all'); 
    const [filterStatus, setFilterStatus] = useState('all'); 
    const [courtWardFilter, setCourtWardFilter] = useState('all'); 
    const [courtFacilityFilter, setCourtFacilityFilter] = useState('all');
    
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectedFacIds, setSelectedFacIds] = useState([]); 
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [userRoleFilter, setUserRoleFilter] = useState('all');
    const [userStatusFilter, setUserStatusFilter] = useState('all');

    const ITEMS_PER_PAGE = 10;
    const [facPage, setFacPage] = useState(1);
    const [courtPage, setCourtPage] = useState(1);
    const [userPage, setUserPage] = useState(1); 

    const [newLayer, setNewLayer] = useState({ name: '', url: '', attribution: '' });
    const [layerFile, setLayerFile] = useState(null); 
    const [facPanelState, setFacPanelState] = useState('list'); 
    const [selectedUser, setSelectedUser] = useState(null);
    const [editingFac, setEditingFac] = useState(null);
    
    const [formData, setFormData] = useState({ name: '', code: '', icon_url_direct: '' });
    const [file, setFile] = useState(null); 
    const [logoFile, setLogoFile] = useState(null); 
    const [uploadMode, setUploadMode] = useState('file');
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewLogo, setPreviewLogo] = useState('');

    useEffect(() => {
        const fetchReportedCount = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/admin/reviews/reported-count');
                setReportedCount(res.data.count);
            } catch (e) {}
        };
        fetchReportedCount();
        const interval = setInterval(fetchReportedCount, 15000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        const u = JSON.parse(localStorage.getItem('user'));
        setCurrentUser(u);

        try {
            setLoading(true);
            const [resSports, resUsers, resConfig, resAllCourts, resDashboard, resWards, resFacilities, resMapLayers, resWardsList] = await Promise.all([
                axios.get('http://localhost:5000/api/sport-types'),
                axios.get('http://localhost:5000/api/admin/users'), 
                axios.get('http://localhost:5000/api/config'),
                axios.get('http://localhost:5000/api/admin/all-courts'), 
                axios.get('http://localhost:5000/api/superadmin/dashboard-stats').catch(() => ({ data: { summary: {users:0, vendors:0, courts:0, revenue:0}, pie_data: {users:0, vendors:0} } })),
                axios.get('http://localhost:5000/api/superadmin/stats/courts-by-ward').catch(() => ({ data: [] })),
                axios.get('http://localhost:5000/api/admin/facilities').catch(() => ({ data: [] })),
                axios.get('http://localhost:5000/api/map/layers').catch(() => ({ data: [] })),
                axios.get('http://localhost:5000/api/locations/wards').catch(() => ({ data: [] }))
            ]);

            setSportTypes(resSports.data || []);
            setUsers(resUsers.data || []);
            setConfig(resConfig.data || {});
            setCourts((resAllCourts.data || []).filter(c => !c.name.startsWith('[Ảo]')));
            setStats(resDashboard.data);
            setWardStats(resWards.data || []);
            setFacilities(resFacilities.data || []);
            setMapLayers(resMapLayers.data || []);
            setWards(resWardsList.data || []);

            const defaultLayer = (resMapLayers.data || []).find(layer => layer.active === true) || (resMapLayers.data || [])[0];
            if (defaultLayer) setActiveMapLayer({ url: defaultLayer.url, attribution: defaultLayer.attribution || '', thumbnail: getLayerThumb(defaultLayer) });

            if(resConfig.data?.logo_url) setPreviewLogo(getImgUrl(resConfig.data.logo_url));
            if(resConfig.data?.marker_icon_url) setMarkerIcon(getImgUrl(resConfig.data.marker_icon_url));

        } catch (error) { console.error("Lỗi tải dữ liệu", error); } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        const currentFilter = activeTab === 5 ? facWardFilter : (activeTab === 1 ? courtWardFilter : 'all');
        setWardShape(null); 

        if (currentFilter === 'all') return;

        const fetchShape = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/courts/by-ward/${currentFilter}`);
                if (res.data && res.data.shape) {
                    let shapeObj = res.data.shape;
                    if (typeof shapeObj === 'string') shapeObj = JSON.parse(shapeObj);
                    setWardShape(shapeObj);
                }
            } catch (err) {}
        };
        fetchShape();
    }, [facWardFilter, courtWardFilter, activeTab]);

    const groupedWards = useMemo(() => {
        const groups = {};
        wards.forEach(w => {
            const dist = w.district_name || 'Khác';
            if (!groups[dist]) groups[dist] = [];
            groups[dist].push(w);
        });
        return groups;
    }, [wards]);

    useEffect(() => { setFacPage(1); }, [facSearchTerm, facWardFilter, facStatusFilter]);
    const filteredFacilities = useMemo(() => {
        let res = facilities.filter(f => {
            if (facStatusFilter === 'all') return true;
            return f.status === facStatusFilter;
        });
        if (facSearchTerm) {
            const lowerSearch = removeVietnameseTones(facSearchTerm);
            res = res.filter(f => removeVietnameseTones(f.name).includes(lowerSearch) || (f.address && removeVietnameseTones(f.address).includes(lowerSearch)));
        }
        if (facWardFilter !== 'all') {
            res = res.filter(f => f.ward_id && f.ward_id.toString() === facWardFilter.toString());
        }
        return res;
    }, [facilities, facSearchTerm, facWardFilter, facStatusFilter]);
    const totalFacPages = Math.ceil(filteredFacilities.length / ITEMS_PER_PAGE);
    const paginatedFacilities = filteredFacilities.slice((facPage - 1) * ITEMS_PER_PAGE, facPage * ITEMS_PER_PAGE);

    useEffect(() => { setCourtPage(1); }, [searchTerm, filterStatus, courtWardFilter, courtFacilityFilter]);
    const filteredCourts = useMemo(() => { 
        let res = courts.filter(c => { 
            const status = c.status || 'active'; 
            if (filterStatus === 'all') return true; 
            return status === filterStatus; 
        });
        if (searchTerm) { 
            const lowerSearch = removeVietnameseTones(searchTerm); 
            res = res.filter(c => removeVietnameseTones(c.name).includes(lowerSearch) || (c.facility_name && removeVietnameseTones(c.facility_name).includes(lowerSearch))); 
        }
        if (courtWardFilter !== 'all') {
            res = res.filter(c => {
                const parentFac = facilities.find(f => f.id === c.facility_id);
                if (!parentFac) return false;
                return parentFac.ward_id && parentFac.ward_id.toString() === courtWardFilter.toString();
            });
        }
        if (courtFacilityFilter !== 'all') {
            res = res.filter(c => c.facility_id && c.facility_id.toString() === courtFacilityFilter.toString());
        }
        return res;
    }, [courts, filterStatus, searchTerm, courtWardFilter, courtFacilityFilter, facilities]);
    const totalCourtPages = Math.ceil(filteredCourts.length / ITEMS_PER_PAGE);
    const paginatedCourts = filteredCourts.slice((courtPage - 1) * ITEMS_PER_PAGE, courtPage * ITEMS_PER_PAGE);

    useEffect(() => { setUserPage(1); setSelectedUserIds([]); }, [searchTerm, userRoleFilter, userStatusFilter]);
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const lowerSearch = searchTerm.toLowerCase();
            const matchSearch = u.full_name?.toLowerCase().includes(lowerSearch) || u.email?.toLowerCase().includes(lowerSearch) || u.phone_number?.includes(searchTerm);
            if (!matchSearch) return false;
            if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
            if (userStatusFilter !== 'all' && u.status !== userStatusFilter) return false;
            return true;
        });
    }, [users, searchTerm, userRoleFilter, userStatusFilter]);
    const totalUserPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
    const paginatedUsers = filteredUsers.slice((userPage - 1) * ITEMS_PER_PAGE, userPage * ITEMS_PER_PAGE);

    const groupedCourts = useMemo(() => {
        const groups = {};
        filteredCourts.forEach(c => {
            let lat, lng;
            if (c.geometry && c.geometry.coordinates) { lat = c.geometry.coordinates[1]; lng = c.geometry.coordinates[0]; }
            else if (c.location) { const p = parsePostGISPoint(c.location); if(p) { lat = p.lat; lng = p.lng; } }
            if (!lat || !lng) return;
            if (!groups[c.facility_id]) {
                groups[c.facility_id] = { facility_id: c.facility_id, facility_name: c.facility_name, lat, lng, courts: [] };
            }
            groups[c.facility_id].courts.push(c);
        });
        return Object.values(groups);
    }, [filteredCourts]);

    // 🔥 XỬ LÝ DỮ LIỆU BAR CHART RATING SÂN
    const ratingChartData = useMemo(() => {
        // Lọc ra các sân đang bật và có lượt đánh giá > 0
        const activeFacs = facilities.filter(f => f.status === 'active' && f.avg_rating > 0);
        
        // Sắp xếp theo rating giảm dần
        const sortedByRatingDesc = [...activeFacs].sort((a, b) => b.avg_rating - a.avg_rating);
        
        // Lấy Top 5 cao nhất
        const top5Best = sortedByRatingDesc.slice(0, 5);
        
        // Lấy Top 5 thấp nhất (bằng cách đảo ngược mảng và lấy 5 phần tử đầu, nhưng lọc bỏ mấy sân chưa có review)
        const sortedByRatingAsc = [...activeFacs].sort((a, b) => a.avg_rating - b.avg_rating);
        const top5Worst = sortedByRatingAsc.slice(0, 5);

        // Gom data cho Biểu đồ
        const labels = [...top5Best.map(f => f.name), ...top5Worst.map(f => f.name)];
        const dataValues = [...top5Best.map(f => parseFloat(f.avg_rating).toFixed(1)), ...top5Worst.map(f => parseFloat(f.avg_rating).toFixed(1))];
        
        // Đổ màu Xanh lá cho Top tốt, Đỏ cho Top xấu
        const bgColors = [
            ...top5Best.map(() => 'rgba(56, 161, 105, 0.8)'), // Màu xanh lá Chakra (green.500)
            ...top5Worst.map(() => 'rgba(229, 62, 62, 0.8)')  // Màu đỏ Chakra (red.500)
        ];

        return {
            labels,
            datasets: [
                {
                    label: 'Điểm Đánh Giá (Sao)',
                    data: dataValues,
                    backgroundColor: bgColors,
                    borderRadius: 6,
                }
            ]
        };
    }, [facilities]);


    const handleLogout = () => { if(window.confirm("Đăng xuất?")) { localStorage.clear(); navigate('/login'); } };
    const handleUserStatus = async (userId, newStatus) => { try { await axios.put(`http://localhost:5000/api/admin/users/${userId}/status`, { status: newStatus }); toast({ title: 'Cập nhật thành công', status: 'success' }); fetchData(); } catch (e) {} };
    const handleDeleteUser = async (userId) => { if(window.confirm("CẢNH BÁO: Xóa vĩnh viễn user này?")) { try { await axios.delete(`http://localhost:5000/api/admin/users/${userId}`); toast({ title: 'Đã xóa user', status: 'success' }); fetchData(); } catch (e) {} } };
    const handleBulkUserStatus = async (status) => {
        if (selectedUserIds.length === 0) return;
        if (!window.confirm(`Chuyển ${selectedUserIds.length} user sang trạng thái ${status === 'active' ? 'Hoạt động' : 'Bị Khóa'}?`)) return;
        try { await axios.put('http://localhost:5000/api/admin/users/bulk-status', { ids: selectedUserIds, status }); toast({ title: "Đã cập nhật hàng loạt!", status: "success" }); fetchData(); setSelectedUserIds([]); } catch (e) {}
    };
    const handleBulkUserDelete = async () => {
        if (selectedUserIds.length === 0) return;
        if (!window.confirm(`⚠️ CẢNH BÁO MẠNH: Bạn đang XÓA VĨNH VIỄN ${selectedUserIds.length} users. Chắc chắn chưa?`)) return;
        try { await axios.post('http://localhost:5000/api/admin/users/bulk-delete', { ids: selectedUserIds }); toast({ title: "Đã xóa hàng loạt thành công!", status: "success" }); fetchData(); setSelectedUserIds([]); } catch (e) {}
    };
    const handleViewDetail = (user) => { setSelectedUser(user); onUserDetailOpen(); };
    const handleApproveUser = async (userId) => { if(!window.confirm("Duyệt tài khoản này?")) return; try { await axios.put(`http://localhost:5000/api/admin/users/${userId}/status`, { status: 'active' }); toast({ title: 'Đã duyệt!', status: 'success' }); fetchData(); onUserDetailClose(); } catch (e) {} };
    const handleRejectUser = async (userId) => { if(!window.confirm("Từ chối tài khoản này?")) return; try { await axios.put(`http://localhost:5000/api/admin/users/${userId}/status`, { status: 'rejected' }); toast({ title: 'Đã từ chối', status: 'warning' }); fetchData(); onUserDetailClose(); } catch (e) {} };

    const handleFacilityStatus = async (facId, newStatus) => { try { await axios.put(`http://localhost:5000/api/admin/facilities/${facId}/status`, { status: newStatus }); toast({ title: `Đã cập nhật: ${newStatus}`, status: 'success' }); fetchData(); } catch (e) {} };
    const handleDeleteFacility = async (facId) => { if (window.confirm("CẢNH BÁO: Xóa VĨNH VIỄN cơ sở này và toàn bộ sân con?")) { try { await axios.delete(`http://localhost:5000/api/facilities/${facId}`); toast({ title: 'Đã xóa!', status: 'success' }); fetchData(); } catch (e) {} } };
    const handleBulkFacAction = async (status) => { 
        if (selectedFacIds.length === 0) return; 
        if (!window.confirm(`Chuyển ${selectedFacIds.length} cơ sở sang trạng thái ${status}?`)) return; 
        try { await axios.put('http://localhost:5000/api/admin/facilities/bulk-status', { ids: selectedFacIds, status: status }); toast({ title: "Thao tác thành công!", status: "success" }); fetchData(); setSelectedFacIds([]); } catch (error) {} 
    };
    const handleBulkFacDelete = async () => { 
        if (selectedFacIds.length === 0) return; 
        if (!window.confirm(`🧨 CẢNH BÁO NGUY HIỂM: XÓA VĨNH VIỄN ${selectedFacIds.length} cơ sở?`)) return; 
        try { await axios.delete('http://localhost:5000/api/admin/facilities/bulk-delete', { data: { ids: selectedFacIds } }); toast({ title: "Đã xóa!", status: "success" }); fetchData(); setSelectedFacIds([]); } catch (error) {} 
    };

    const openCreateFacModal = () => { 
        setEditingFac(null); 
        setFacPanelState('create'); 
    };
    
    const openEditFacModal = (fac) => { 
        setEditingFac(fac); 
        setFacPanelState('edit'); 
    };

    const handleCourtStatus = async (courtId, newStatus) => { try { await axios.put(`http://localhost:5000/api/admin/courts/${courtId}/status`, { status: newStatus }); setCourts(prev => prev.map(c => c.id === courtId ? {...c, status: newStatus} : c)); toast({ title: `Đã chuyển sang: ${newStatus}`, status: 'success' }); } catch (e) {} };
    const handleBulkAction = async (status) => { if (selectedIds.length === 0) return; if (!window.confirm(`Chuyển ${selectedIds.length} sân sang trạng thái ${status}?`)) return; try { await axios.put('http://localhost:5000/api/admin/courts/bulk-status', { ids: selectedIds, status: status }); toast({ title: "Thao tác thành công!", status: "success" }); fetchData(); setSelectedIds([]); } catch (error) {} };

    const handleAddLayer = async () => {
        if (!newLayer.name || !newLayer.url) return toast({ title: "Thiếu thông tin!", status: "warning" });
        const layerData = new FormData(); 
        layerData.append('name', newLayer.name); layerData.append('url', newLayer.url); layerData.append('attribution', newLayer.attribution || '&copy; OpenStreetMap');
        if (layerFile) layerData.append('thumbnail', layerFile); else layerData.append('thumbnail_url', getPreviewTileUrl(newLayer.url));
        try { await axios.post('http://localhost:5000/api/admin/map/layers', layerData, { headers: { 'Content-Type': 'multipart/form-data' } }); toast({ title: 'Đã thêm lớp bản đồ!', status: 'success' }); setNewLayer({ name: '', url: '', attribution: '' }); setLayerFile(null); fetchData(); } catch (e) {}
    };
    
    const handleToggleLayer = async (id) => { await axios.put(`http://localhost:5000/api/admin/map/layers/${id}/toggle`); fetchData(); };
    const handleDeleteLayer = async (id) => { if(window.confirm('Xóa lớp này?')) { await axios.delete(`http://localhost:5000/api/admin/map/layers/${id}`); fetchData(); } };
    const handleUploadMarker = async (e) => { const file = e.target.files[0]; if(!file) return; const formData = new FormData(); formData.append('icon', file); try { await axios.post('http://localhost:5000/api/admin/map/marker-icon', formData); toast({ title: 'Đã đổi icon marker!', status: 'success' }); fetchData(); } catch (e) {} };

    const handleSaveConfig = async () => { const data = new FormData(); data.append('website_name', config.website_name); data.append('admin_zalo', config.admin_zalo || ''); if (logoFile) data.append('logo', logoFile); try { await axios.post('http://localhost:5000/api/config', data); toast({ title: 'Đã lưu!', status: 'success' }); fetchData(); } catch (e) {} };
    const handleLogoChange = (e) => { const f = e.target.files[0]; if (f) { setLogoFile(f); setPreviewLogo(URL.createObjectURL(f)); } };
    const handleFileChange = (e) => { const f = e.target.files[0]; if (f) { setFile(f); setPreviewUrl(URL.createObjectURL(f)); } };
    const handleLinkChange = (e) => { setFormData({ ...formData, icon_url_direct: e.target.value }); setPreviewUrl(e.target.value); };
    const handleSubmitSport = async (e) => { e.preventDefault(); const data = new FormData(); data.append('name', formData.name); data.append('code', formData.code); if (uploadMode === 'file') { if (file) data.append('icon', file); } else { if (formData.icon_url_direct) data.append('icon_url_direct', formData.icon_url_direct); } try { await axios.post('http://localhost:5000/api/sport-types', data); toast({ title: 'Thêm thành công!', status: 'success' }); setFormData({ name: '', code: '', icon_url_direct: '' }); setFile(null); setPreviewUrl(''); fetchData(); } catch {} };
    const handleDeleteSport = async (id) => { if (window.confirm("Xóa?")) { await axios.delete(`http://localhost:5000/api/sport-types/${id}`); fetchData(); } };

    const pieData = { labels: ['Khách Hàng', 'Chủ Sân'], datasets: [{ data: [stats.pie_data?.users || 0, stats.pie_data?.vendors || 0], backgroundColor: ['#3182CE', '#805AD5'], borderWidth: 0 }] };
    const wardChartData = { labels: wardStats.map(w => w.ward_name), datasets: [{ label: 'Số lượng sân', data: wardStats.map(w => w.total_courts), backgroundColor: '#38A169', borderRadius: 8 }] };

    const menuItems = [
        { id: 0, label: "DASHBOARD", icon: FaChartLine },
        { id: 5, label: "CƠ SỞ / SEEDING", icon: FaStore },
        { id: 1, label: "QUẢN LÝ SÂN CON", icon: FaMapMarkedAlt },
        { id: 2, label: "NGƯỜI DÙNG", icon: FaUserShield },
        { id: 7, label: "DUYỆT ĐÁNH GIÁ", icon: FaStar },
        { id: 3, label: "DANH MỤC MÔN", icon: FaGamepad },
        { id: 6, label: "LỚP BẢN ĐỒ", icon: FaLayerGroup },
        { id: 4, label: "HỆ THỐNG", icon: FaGlobe },
    ];

    return (
        <Flex h={{ base: "100dvh", lg: "100vh" }} w="100vw" direction="column" bg={neumorphBg} overflow="hidden">
            <style>{customStyles}</style>

            {/* 🔥 HEADER NEUMORPHISM CÓ LOGO */}
            <Flex h="70px" bg={neumorphBg} align="center" justify="space-between" px={6} boxShadow={neumorphShadow} zIndex={1200}>
                <HStack spacing={4}>
                    {!isMobile && <IconButton icon={<FaBars />} variant="ghost" bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} onClick={() => setSidebarOpen(!isSidebarOpen)} borderRadius="xl" border="none"/>}
                    <HStack spacing={3}>
                        {previewLogo ? (
                            <Box
      p={1.5}
      borderRadius="full"
      bg={neumorphBg}
      boxShadow={neumorphShadow}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Image
        src={previewLogo}
        boxSize={{ base: "28px", md: "34px" }}
        objectFit="cover"
        borderRadius="full"
      />
    </Box>
                        ) : (
                            <Box p={2} borderRadius="xl" bg={neumorphBg} boxShadow={neumorphShadow}><Icon as={FaUserShield} color="red.500" boxSize={5} /></Box>
                        )}
                        <Heading size="md" fontWeight="900" color={textColor} letterSpacing="tight" display={{base:'none', md:'block'}}>{config.website_name || "SUPER ADMIN"}</Heading>
                    </HStack>
                </HStack>
                <HStack spacing={5}>
                    <NotificationBell user={currentUser} />
                    <IconButton icon={colorMode === 'light' ? <FaMoon/> : <FaSun/>} isRound bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} onClick={toggleColorMode} border="none"/>
                    {!isMobile && <Button leftIcon={<FaSignOutAlt/>} colorScheme="red" variant="ghost" bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} onClick={handleLogout} borderRadius="xl" fontWeight="900" border="none">THOÁT</Button>}
                </HStack>
            </Flex>

            <Flex flex={1} position="relative" overflow="hidden">
                {/* 📌 SIDEBAR NEUMORPHISM */}
                {!isMobile && (
                    <VStack w={isSidebarOpen ? "260px" : "85px"} bg={neumorphBg} p={4} spacing={4} transition="width 0.3s ease" zIndex={1100} flexShrink={0}>
                        {menuItems.map(item => (
                            <Button
                                key={item.id} w="100%" h="55px" borderRadius="2xl" border="none"
                                leftIcon={<Icon as={item.icon} boxSize={5} />}
                                justifyContent={isSidebarOpen ? "flex-start" : "center"}
                                bg={neumorphBg} color={activeTab === item.id ? accentColor : textColor}
                                boxShadow={activeTab === item.id ? neumorphActiveShadow : neumorphShadow}
                                onClick={() => setActiveTab(item.id)} fontWeight="900" fontSize="xs"
                                transition="all 0.2s" _active={{ boxShadow: neumorphActiveShadow }}
                            >
                                {isSidebarOpen && item.label}
                                {item.id === 7 && isSidebarOpen && reportedCount > 0 && <Badge ml="auto" colorScheme="red" borderRadius="full">{reportedCount}</Badge>}
                            </Button>
                        ))}
                    </VStack>
                )}

                {/* 📌 NỘI DUNG CHÍNH */}
                <Box flex={1} overflowY="auto" p={isMobile ? 4 : 8} className="hide-scrollbar">
                    
                    {/* TAB DASHBOARD */}
                    {activeTab === 0 && (
                        <Container maxW="container.xl" p={0}>
                             {loading ? <Flex justify="center" h="400px" align="center"><Spinner size="xl" color="blue.500"/></Flex> : (
                                <VStack spacing={8} align="stretch">
                                    <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={8}>
                                        <StatCard icon={FaUsers} title="Tổng User" value={(stats.summary?.users || 0) + (stats.summary?.vendors || 0)} color="blue" />
                                        <StatCard icon={FaStore} title="Chủ Sân" value={stats.summary?.vendors || 0} color="purple" />
                                        <StatCard icon={FaFutbol} title="Tổng Sân" value={stats.summary?.courts || 0} color="green" />
                                        <StatCard icon={FaMoneyBillWave} title="Doanh Thu" value={`${(stats.summary?.revenue || 0).toLocaleString()}đ`} color="orange" />
                                    </SimpleGrid>

                                    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8}>
                                        <Box bg={neumorphBg} p={8} borderRadius="3xl" boxShadow={neumorphShadow} h="400px">
                                            <Text fontWeight="900" mb={6} color={textColor} fontSize="sm">👥 PHÂN BỔ THÀNH VIÊN</Text>
                                            <Box h="280px" display="flex" justifyContent="center">
                                                <Pie data={pieData} />
                                            </Box>
                                        </Box>

                                        {/*  FIX: BIỂU ĐỒ BAR CHART RANKING SÂN */}
                                        <Box bg={neumorphBg} p={8} borderRadius="3xl" boxShadow={neumorphShadow} h="400px">
                                           <RatingChart facilities={facilities} /> 
                                            
                                        </Box>

                                        <GridItem colSpan={{ base: 1, lg: 2 }}>
                                            <Box bg={neumorphBg} p={8} borderRadius="3xl" boxShadow={neumorphShadow}>
                                                <Text fontWeight="900" mb={8} color={textColor} fontSize="sm">📍 MẬT ĐỘ SÂN THEO KHU VỰC</Text>
                                                <Box h="400px">{wardStats.length > 0 ? <Bar data={wardChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { grid: { display: false } } } }} /> : <Text color={textColor}>Chưa có dữ liệu.</Text>}</Box>
                                            </Box>
                                        </GridItem>
                                    </SimpleGrid>
                                </VStack>
                            )}
                        </Container>
                    )}

                    {/* 🔥 TAB CƠ SỞ (SEEDING) - ĐÃ FIX LAYOUT TRÀN VIỀN */}
                    {activeTab === 5 && (
                        <Flex h="100%" flexDirection={{base: 'column', lg: 'row'}} gap={8}>
                            
                            {/* KHU VỰC BẢNG (FIX CỐ ĐỊNH CHIỀU RỘNG, KO CHO TRÀN) */}
                            <Box w={{base: '100%', lg: '45%'}} maxW={{lg: '550px'}} h="100%" bg={neumorphBg} p={6} borderRadius="3xl" boxShadow={neumorphShadow} display="flex" flexDirection="column" overflow="hidden" flexShrink={0}>
                                {facPanelState === 'list' ? (
                                    <VStack align="stretch" spacing={6} h="100%">
                                        <Flex justify="space-between" align="center">
                                            <Heading size="md" color={textColor} fontWeight="900">CƠ SỞ HỆ THỐNG ({filteredFacilities.length})</Heading>
                                            {/* 🔥 FIX: GỌI ĐÚNG HÀM openCreateFacModal ĐỂ RESET DATA */}
                                            <Button leftIcon={<FaPlus/>} colorScheme="blue" bgGradient="linear(to-r, blue.400, blue.600)" color="white" onClick={openCreateFacModal} borderRadius="xl" shadow="md">Thêm Seeding</Button>
                                        </Flex>
                                        
                                        <VStack spacing={3}>
                                            <HStack w="100%">
                                                <Select size="md" value={facStatusFilter} onChange={(e)=>setFacStatusFilter(e.target.value)} w="130px" flexShrink={0} {...inputStyle}>
                                                    <option value="all">Trạng thái</option><option value="pending">⏳ Chờ duyệt</option><option value="active">✅ Đang bật</option><option value="blocked">❌ Đã khóa</option>
                                                </Select>
                                                <Select size="md" value={facWardFilter} onChange={(e)=>setFacWardFilter(e.target.value)} icon={<FaFilter/>} {...inputStyle}>
                                                    <option value="all">Khu vực</option>
                                                    {Object.keys(groupedWards).map(district => (
                                                        <optgroup key={district} label={`- ${district} -`}>
                                                            {groupedWards[district].map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                        </optgroup>
                                                    ))}
                                                </Select>
                                            </HStack>
                                            <InputGroup size="md">
                                                <InputLeftElement children={<FaSearch color="gray.400"/>} h="full" />
                                                <Input placeholder="Tìm tên, địa chỉ..." value={facSearchTerm} onChange={(e) => setFacSearchTerm(e.target.value)} {...inputStyle} />
                                            </InputGroup>

                                            {selectedFacIds.length > 0 && (
                                                <HStack w="100%" bg={neumorphBg} p={3} borderRadius="2xl" boxShadow={neumorphActiveShadow} justify="space-between">
                                                    <Text fontSize="xs" fontWeight="900" color="blue.500">Đã chọn: {selectedFacIds.length}</Text>
                                                    <HStack spacing={2}>
                                                        <IconButton size="sm" icon={<FaCheckDouble/>} colorScheme="green" onClick={() => handleBulkFacAction('active')} isRound/>
                                                        <IconButton size="sm" icon={<FaBan/>} colorScheme="orange" onClick={() => handleBulkFacAction('blocked')} isRound/>
                                                        <IconButton size="sm" icon={<FaTrash/>} colorScheme="red" onClick={handleBulkFacDelete} isRound/>
                                                        <Button size="sm" onClick={() => setSelectedFacIds([])} variant="ghost" color={textColor}>Hủy</Button>
                                                    </HStack>
                                                </HStack>
                                            )}
                                        </VStack>

                                        <Box flex={1} overflowY="auto" overflowX="hidden" className="hide-scrollbar" position="relative">
                                            <Table variant="simple" size="sm" style={{ tableLayout: "fixed", width: "100%" }}>
                                                <Thead position="sticky" top={0} bg={neumorphBg} zIndex={1} boxShadow={neumorphShadow}>
                                                    <Tr border="none">
                                                        <Th w="40px" border="none">
                                                            <Checkbox 
                                                                isChecked={paginatedFacilities.length > 0 && paginatedFacilities.every(f => selectedFacIds.includes(f.id))} 
                                                                onChange={(e) => e.target.checked ? setSelectedFacIds([...new Set([...selectedFacIds, ...paginatedFacilities.map(f => f.id)])]) : setSelectedFacIds(selectedFacIds.filter(id => !paginatedFacilities.map(f => f.id).includes(id)))} 
                                                            />
                                                        </Th>
                                                        <Th border="none" color={textMuted} w="55%">Cơ Sở</Th>
                                                        <Th border="none" color={textMuted} w="20%">T.Thái</Th>
                                                        <Th border="none" color={textMuted}>Action</Th>
                                                    </Tr>
                                                </Thead>
                                                <Tbody>
                                                    {paginatedFacilities.map(fac => {
                                                        const safeCoords = getSafeCoords(fac);
                                                        return (
                                                            <Tr key={fac.id} border="none" _hover={{ bg: hoverTrBg }} bg={selectedFacIds.includes(fac.id) ? rowSelectedBg : 'transparent'}>
                                                                <Td border="none"><Checkbox isChecked={selectedFacIds.includes(fac.id)} onChange={(e) => e.target.checked ? setSelectedFacIds([...selectedFacIds, fac.id]) : setSelectedFacIds(selectedFacIds.filter(id => id !== fac.id))} /></Td>
                                                                <Td border="none" overflow="hidden" textOverflow="ellipsis">
                                                                    <HStack>
                                                                        <Image src={getImgUrl(fac.image_url)} boxSize="40px" objectFit="cover" borderRadius="xl" boxShadow={neumorphShadow} fallbackSrc="https://placehold.co/40" flexShrink={0}/>
                                                                        <VStack align="start" spacing={0} w="full" overflow="hidden">
                                                                            {/* 🔥 FIX: HIỆN TÊN CHUẨN XÁC, CÓ CHẶN TRÀN CHỮ */}
                                                                            <Text fontWeight="900" fontSize="xs" color={textColor} w="100%" isTruncated>
                                                                                {fac.name || "Chưa có tên"}
                                                                            </Text>
                                                                            <Text fontSize="10px" color="gray.500" w="100%" isTruncated>{fac.address}</Text>
                                                                            {!safeCoords && <Text fontSize="9px" color="red.500" fontWeight="900" animation="pulse 1.5s infinite">⚠️ LỖI TỌA ĐỘ</Text>}
                                                                        </VStack>
                                                                    </HStack>
                                                                </Td>
                                                                <Td border="none"><Badge fontSize="9px" colorScheme={fac.status === 'active' ? 'green' : fac.status === 'pending' ? 'orange' : 'red'}>{fac.status}</Badge></Td>
                                                                <Td border="none">
                                                                    <HStack spacing={2}>
                                                                        {/* 🔥 FIX: NẾU ROLE LÀ VENDOR -> KHÓA NÚT SỬA */}
                                                                        {fac.owner_role === 'vendor' ? (
                                                                            <IconButton 
                                                                                size="xs" icon={<FaLock/>} colorScheme="gray" variant="ghost" 
                                                                                bg={neumorphBg} boxShadow={neumorphShadow} isDisabled isRound title="Sân Chủ sân"
                                                                            />
                                                                        ) : (
                                                                            <IconButton 
                                                                                size="xs" icon={<FaEdit/>} colorScheme="blue" variant="ghost" 
                                                                                bg={neumorphBg} boxShadow={neumorphShadow} 
                                                                                onClick={() => openEditFacModal(fac)} isRound title="Sửa sân Seeding"
                                                                            />
                                                                        )}
                                                                        {fac.status !== 'active' && <IconButton size="xs" icon={<FaCheck/>} colorScheme="green" variant="ghost" bg={neumorphBg} boxShadow={neumorphShadow} onClick={() => handleFacilityStatus(fac.id, 'active')} isRound/>}
                                                                        {fac.status !== 'blocked' && <IconButton size="xs" icon={<FaBan/>} colorScheme="orange" variant="ghost" bg={neumorphBg} boxShadow={neumorphShadow} onClick={() => handleFacilityStatus(fac.id, 'blocked')} isRound/>}
                                                                        <IconButton size="xs" icon={<FaTrash/>} colorScheme="red" variant="ghost" bg={neumorphBg} boxShadow={neumorphShadow} onClick={() => handleDeleteFacility(fac.id)} isRound />
                                                                    </HStack>
                                                                </Td>
                                                            </Tr>
                                                        );
                                                    })}
                                                </Tbody>
                                            </Table>
                                            {paginatedFacilities.length === 0 && <Text textAlign="center" py={10} color="gray.500" fontWeight="bold">Chưa có dữ liệu.</Text>}
                                            
                                            {totalFacPages > 1 && (
                                                <Flex justify="center" mt={6} mb={4}>
                                                    <HStack spacing={4}>
                                                        <IconButton size="md" onClick={() => setFacPage(p => p - 1)} isDisabled={facPage === 1} icon={<FaChevronLeft/>} isRound bg={neumorphBg} boxShadow={neumorphShadow} border="none"/>
                                                        <Text fontSize="sm" fontWeight="900" color={accentColor}>{facPage} / {totalFacPages}</Text>
                                                        <IconButton size="md" onClick={() => setFacPage(p => p + 1)} isDisabled={facPage === totalFacPages} icon={<FaChevronRight/>} isRound bg={neumorphBg} boxShadow={neumorphShadow} border="none"/>
                                                    </HStack>
                                                </Flex>
                                            )}
                                        </Box>
                                    </VStack>
                                ) : (
                                    <FacilityFormPanel onClose={()=>setFacPanelState('list')} onRefresh={fetchData} sportTypes={sportTypes} editingFac={editingFac} />
                                )}
                            </Box>

                            {/* KHU VỰC BẢN ĐỒ */}
                            <Box flex={1} minH="400px" borderRadius="3xl" overflow="hidden" boxShadow={neumorphShadow} border="8px solid" borderColor={neumorphBg} position="relative">
                                <MapContainer center={[10.7769, 106.7009]} zoom={13} style={{ height: "100%", width: "100%", zIndex: 1 }} zoomControl={false}>
                                    <TileLayer key={activeMapLayer.url + colorMode} url={colorMode === 'dark' && activeMapLayer.url.includes('openstreetmap') ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : activeMapLayer.url} attribution={activeMapLayer.attribution} />
                                    {wardShape && <><GeoJSON data={wardShape} style={{ color: '#3182CE', weight: 3, fillOpacity: 0.15, dashArray: '5, 5' }} /><MapBoundsFlyTo shape={wardShape} /></>}
                                    
                                    {/* 🔥 FIX 9 SÂN 8 CHẤM: Sử dụng hàm lấy tọa độ an toàn */}
                                    {filteredFacilities.map(f => {
                                        const coords = getSafeCoords(f);
                                        if (!coords) return null;
                                        return (
                                            <Marker key={f.id} position={[coords.lat, coords.lng]} icon={createStatusIcon(f.status)}>
                                                <Popup>
                                                    <VStack align="start" spacing={1}>
                                                        <Text fontWeight="bold">{f.name}</Text>
                                                        <Text fontSize="xs">{f.address}</Text>
                                                        <Badge colorScheme={f.status==='active'?'green':'red'}>{f.status}</Badge>
                                                    </VStack>
                                                </Popup>
                                            </Marker>
                                        );
                                    })}
                                </MapContainer>
                                
                                {/* 🔥 MENU ĐỔI LAYER BẢN ĐỒ */}
                                <Box position="absolute" top="20px" right="20px" zIndex={1000}>
                                    <Menu placement="bottom-end">
                                        <MenuButton as={Box} cursor="pointer" boxSize="45px" bg={neumorphBg} borderRadius="full" boxShadow={neumorphShadow} p={1} border="3px solid" borderColor={neumorphBg} overflow="hidden" _active={{boxShadow: neumorphActiveShadow}}>
                                            {activeMapLayer.thumbnail ? <Image src={getImgUrl(activeMapLayer.thumbnail)} w="100%" h="100%" objectFit="cover" borderRadius="full" /> : <Flex w="100%" h="100%" align="center" justify="center"><Icon as={FaLayerGroup} color="blue.500" /></Flex>}
                                        </MenuButton>
                                        <MenuList minW="220px" bg={neumorphBg} borderRadius="2xl" border="none" boxShadow="2xl" p={3} zIndex={3000}>
                                            <Text fontSize="10px" fontWeight="900" color="gray.500" mb={3} letterSpacing="1px">BẢN ĐỒ NỀN</Text>
                                            <SimpleGrid columns={2} spacing={3}>
                                                {mapLayers.map((layer) => (
                                                    <Box key={layer.id} onClick={() => setActiveMapLayer({url: layer.url, attribution: layer.attribution, thumbnail: getLayerThumb(layer)})} cursor="pointer" borderRadius="xl" overflow="hidden" boxShadow={activeMapLayer.url === layer.url ? neumorphActiveShadow : neumorphShadow} p={1} transition="all 0.2s">
                                                        <Image src={getImgUrl(getLayerThumb(layer))} h="50px" w="100%" objectFit="cover" borderRadius="lg" fallbackSrc="https://placehold.co/50x50?text=Map" />
                                                        <Text mt={1} fontSize="9px" fontWeight="900" textAlign="center" color={activeMapLayer.url === layer.url ? "blue.500" : textColor}>{layer.name.toUpperCase()}</Text>
                                                    </Box>
                                                ))}
                                            </SimpleGrid>
                                        </MenuList>
                                    </Menu>
                                </Box>
                            </Box>
                        </Flex>
                    )}

                    {/* TAB SÂN CON */}
                    {activeTab === 1 && (
                        <Flex h="100%" flexDirection={{base: 'column', lg: 'row'}} gap={8}>
                            <Box w={{base: '100%', lg: '45%'}} h="100%" bg={neumorphBg} p={6} borderRadius="3xl" boxShadow={neumorphShadow} display="flex" flexDirection="column">
                                <Heading size="md" mb={6} color={textColor} fontWeight="900">QUẢN LÝ SÂN CON ({filteredCourts.length})</Heading>
                                <VStack spacing={4} mb={6}>
                                    <HStack w="100%" wrap="wrap" spacing={3}>
                                        <Select size="md" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} w={{base: "100%", md: "auto"}} {...inputStyle}>
                                            <option value="all">Trạng thái</option><option value="pending">⏳ Chờ</option><option value="active">✅ Bật</option><option value="rejected">❌ Khóa</option>
                                        </Select>
                                        <Select size="md" value={courtWardFilter} onChange={(e)=>setCourtWardFilter(e.target.value)} w={{base: "100%", md: "auto"}} {...inputStyle}>
                                            <option value="all">Khu vực</option>
                                            {Object.keys(groupedWards).map(district => (
                                                <optgroup key={district} label={`- ${district} -`}>
                                                    {groupedWards[district].map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                </optgroup>
                                            ))}
                                        </Select>
                                        <Select size="md" value={courtFacilityFilter} onChange={(e)=>setCourtFacilityFilter(e.target.value)} w={{base: "100%", md: "auto"}} {...inputStyle}>
                                            <option value="all">Tất cả Cơ Sở</option>
                                            {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                        </Select>
                                    </HStack>
                                    
                                    <InputGroup size="md">
                                        <InputLeftElement children={<FaSearch color="gray.400"/>} h="full" />
                                        <Input placeholder="Tìm tên sân..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} {...inputStyle}/>
                                    </InputGroup>

                                    {selectedIds.length > 0 && (
                                        <HStack w="100%" bg={neumorphBg} p={3} borderRadius="2xl" justify="space-between" boxShadow={neumorphActiveShadow}>
                                            <Text fontSize="xs" fontWeight="900" color="blue.500">Đã chọn: {selectedIds.length}</Text>
                                            <HStack spacing={2}>
                                                <IconButton size="sm" icon={<FaCheckDouble/>} colorScheme="green" onClick={() => handleBulkAction('active')} isRound/>
                                                <IconButton size="sm" icon={<FaBan/>} colorScheme="red" onClick={() => handleBulkAction('rejected')} isRound/>
                                                <Button size="sm" onClick={() => setSelectedIds([])} variant="ghost" fontWeight="bold">Hủy</Button>
                                            </HStack>
                                        </HStack>
                                    )}
                                </VStack>
                                
                                <Box flex={1} overflowY="auto" className="hide-scrollbar">
                                    <Table variant="simple" size="sm">
                                        <Thead position="sticky" top={0} bg={neumorphBg} zIndex={1} boxShadow={neumorphShadow}>
                                            <Tr border="none">
                                                <Th w="30px" border="none">
                                                    <Checkbox 
                                                        isChecked={paginatedCourts.length > 0 && paginatedCourts.every(c => selectedIds.includes(c.id))} 
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                const newIds = [...new Set([...selectedIds, ...paginatedCourts.map(c => c.id)])];
                                                                setSelectedIds(newIds);
                                                            } else {
                                                                const pageIds = paginatedCourts.map(c => c.id);
                                                                setSelectedIds(selectedIds.filter(id => !pageIds.includes(id)));
                                                            }
                                                        }} 
                                                    />
                                                </Th>
                                                <Th border="none" color={textMuted}>Tên Sân</Th>
                                                <Th border="none" color={textMuted}>Trạng thái</Th>
                                                <Th border="none" color={textMuted}>Hành động</Th>
                                            </Tr>
                                        </Thead>
                                        <Tbody>
                                            {paginatedCourts.map(c => (
                                                <Tr key={c.id} border="none" _hover={{ bg: hoverTrBg }} bg={selectedIds.includes(c.id) ? rowSelectedBg : 'transparent'}>
                                                    <Td border="none"><Checkbox isChecked={selectedIds.includes(c.id)} onChange={(e) => e.target.checked ? setSelectedIds([...selectedIds, c.id]) : setSelectedIds(selectedIds.filter(id => id !== c.id))} /></Td>
                                                    <Td border="none"><Text fontWeight="900" fontSize="xs" noOfLines={1} color={textColor}>{c.name}</Text><Text fontSize="10px" color="gray.500" noOfLines={1}>{c.facility_name}</Text></Td>
                                                    <Td border="none"><Badge colorScheme={c.status==='active'?'green':c.status==='rejected'?'red':'orange'}>{c.status}</Badge></Td>
                                                    <Td border="none">
                                                        <HStack spacing={2}>
                                                            {c.status !== 'active' && <IconButton size="xs" icon={<FaCheck/>} colorScheme="green" isRound bg={neumorphBg} boxShadow={neumorphShadow} onClick={() => handleCourtStatus(c.id, 'active')} />}
                                                            {c.status !== 'rejected' && <IconButton size="xs" icon={<FaBan/>} colorScheme="red" isRound bg={neumorphBg} boxShadow={neumorphShadow} onClick={() => handleCourtStatus(c.id, 'rejected')} />}
                                                        </HStack>
                                                    </Td>
                                                </Tr>
                                            ))}
                                        </Tbody>
                                    </Table>
                                    {paginatedCourts.length === 0 && <Text textAlign="center" py={10} color="gray.500" fontWeight="bold">Chưa có dữ liệu.</Text>}
                                    
                                    {totalCourtPages > 1 && (
                                        <Flex justify="center" mt={6} mb={4}>
                                            <HStack spacing={4}>
                                                <IconButton size="md" onClick={() => setCourtPage(p => p - 1)} isDisabled={courtPage === 1} icon={<FaChevronLeft/>} isRound bg={neumorphBg} boxShadow={neumorphShadow} border="none"/>
                                                <Text fontSize="sm" fontWeight="900" color={accentColor}>{courtPage} / {totalCourtPages}</Text>
                                                <IconButton size="md" onClick={() => setCourtPage(p => p + 1)} isDisabled={courtPage === totalCourtPages} icon={<FaChevronRight/>} isRound bg={neumorphBg} boxShadow={neumorphShadow} border="none"/>
                                            </HStack>
                                        </Flex>
                                    )}
                                </Box>
                            </Box>

                            <Box flex={1.2} minH="400px" borderRadius="3xl" overflow="hidden" boxShadow={neumorphShadow} border="8px solid" borderColor={neumorphBg} position="relative">
                                <MapContainer center={[10.7769, 106.7009]} zoom={13} style={{ height: "100%", width: "100%", zIndex: 1 }} zoomControl={false}>
                                    <TileLayer key={activeMapLayer.url + colorMode} url={colorMode === 'dark' && activeMapLayer.url.includes('openstreetmap') ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : activeMapLayer.url} attribution={activeMapLayer.attribution} />
                                    {wardShape && <><GeoJSON data={wardShape} style={{ color: '#38A169', weight: 3, fillOpacity: 0.15, dashArray: '5, 5' }} /><MapBoundsFlyTo shape={wardShape} /></>}
                                    
                                    {groupedCourts.map(group => {
                                        const hasPending = group.courts.some(c => c.status === 'pending');
                                        const markerStatus = hasPending ? 'pending' : 'active';
                                        return (
                                            <Marker key={`group-${group.facility_id}`} position={[group.lat, group.lng]} icon={createStatusIcon(markerStatus)}>
                                                <Popup minWidth={250}>
                                                    <Box minW="220px">
                                                        <Box bg="blue.600" p={2} borderRadius="xl" color="white" mb={3} shadow="md">
                                                            <Text fontWeight="bold" fontSize="sm">{group.facility_name}</Text>
                                                            <Text fontSize="xs">Tổng: {group.courts.length} sân</Text>
                                                        </Box>
                                                        <VStack align="stretch" spacing={2} maxH="250px" overflowY="auto" className="hide-scrollbar">
                                                            {group.courts.map(c => (
                                                                <Box key={c.id} p={3} bg="gray.50" borderRadius="xl" border="1px solid" borderColor="gray.200">
                                                                    <HStack justify="space-between" mb={2}>
                                                                        <Text fontWeight="bold" fontSize="xs" color="gray.700" noOfLines={1}>{c.name}</Text>
                                                                        <Badge fontSize="9px" colorScheme={c.status === 'active' ? 'green' : c.status === 'rejected' ? 'red' : 'orange'}>{c.status}</Badge>
                                                                    </HStack>
                                                                    <HStack spacing={2}>
                                                                        {c.status !== 'active' && <Button size="xs" flex={1} colorScheme="green" onClick={() => handleCourtStatus(c.id, 'active')}>Duyệt</Button>}
                                                                        {c.status !== 'rejected' && <Button size="xs" flex={1} colorScheme="red" onClick={() => handleCourtStatus(c.id, 'rejected')}>Khóa</Button>}
                                                                    </HStack>
                                                                </Box>
                                                            ))}
                                                        </VStack>
                                                    </Box>
                                                </Popup>
                                            </Marker>
                                        );
                                    })}
                                </MapContainer>

                                {/* 🔥 MENU ĐỔI LAYER BẢN ĐỒ */}
                                <Box position="absolute" top="20px" right="20px" zIndex={1000}>
                                    <Menu placement="bottom-end">
                                        <MenuButton as={Box} cursor="pointer" boxSize="45px" bg={neumorphBg} borderRadius="full" boxShadow={neumorphShadow} p={1} border="3px solid" borderColor={neumorphBg} overflow="hidden" _active={{boxShadow: neumorphActiveShadow}}>
                                            {activeMapLayer.thumbnail ? <Image src={getImgUrl(activeMapLayer.thumbnail)} w="100%" h="100%" objectFit="cover" borderRadius="full" /> : <Flex w="100%" h="100%" align="center" justify="center"><Icon as={FaLayerGroup} color="blue.500" /></Flex>}
                                        </MenuButton>
                                        <MenuList minW="220px" bg={neumorphBg} borderRadius="2xl" border="none" boxShadow="2xl" p={3} zIndex={3000}>
                                            <Text fontSize="10px" fontWeight="900" color="gray.500" mb={3} letterSpacing="1px">BẢN ĐỒ NỀN</Text>
                                            <SimpleGrid columns={2} spacing={3}>
                                                {mapLayers.map((layer) => (
                                                    <Box key={layer.id} onClick={() => setActiveMapLayer({url: layer.url, attribution: layer.attribution, thumbnail: getLayerThumb(layer)})} cursor="pointer" borderRadius="xl" overflow="hidden" boxShadow={activeMapLayer.url === layer.url ? neumorphActiveShadow : neumorphShadow} p={1} transition="all 0.2s">
                                                        <Image src={getImgUrl(getLayerThumb(layer))} h="50px" w="100%" objectFit="cover" borderRadius="lg" fallbackSrc="https://placehold.co/50x50?text=Map" />
                                                        <Text mt={1} fontSize="9px" fontWeight="900" textAlign="center" color={activeMapLayer.url === layer.url ? "blue.500" : textColor}>{layer.name.toUpperCase()}</Text>
                                                    </Box>
                                                ))}
                                            </SimpleGrid>
                                        </MenuList>
                                    </Menu>
                                </Box>
                            </Box>
                        </Flex>
                    )}

                    {/* TAB USER */}
                    {activeTab === 2 && (
                        <Box bg={neumorphBg} p={8} borderRadius="3xl" boxShadow={neumorphShadow}>
                            <Flex justify="space-between" align="center" mb={8} direction={{base: 'column', md: 'row'}} gap={4}>
                                <Heading size="md" color={textColor} fontWeight="900">👥 QUẢN LÝ NGƯỜI DÙNG ({filteredUsers.length})</Heading>
                                <HStack spacing={4}>
                                    <InputGroup maxW="300px">
                                        <InputLeftElement h="full"><Icon as={FaSearch} color="gray.400" /></InputLeftElement>
                                        <Input placeholder="Tìm email, tên..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} {...inputStyle} />
                                    </InputGroup>
                                    <Select value={userRoleFilter} onChange={e=>setUserRoleFilter(e.target.value)} w="150px" {...inputStyle}>
                                        <option value="all">Tất cả</option><option value="user">Khách</option><option value="vendor">Chủ sân</option>
                                    </Select>
                                </HStack>
                            </Flex>

                            {selectedUserIds.length > 0 && (
                                <HStack w="100%" bg={neumorphBg} p={3} borderRadius="2xl" justify="space-between" boxShadow={neumorphActiveShadow} mb={6}>
                                    <Text fontSize="sm" fontWeight="900" color="blue.500">Đã chọn: {selectedUserIds.length} User</Text>
                                    <HStack spacing={3}>
                                        <Button size="sm" leftIcon={<FaCheck/>} colorScheme="green" variant="outline" onClick={() => handleBulkUserStatus('active')} borderRadius="xl">Mở khóa/Duyệt</Button>
                                        <Button size="sm" leftIcon={<FaBan/>} colorScheme="orange" onClick={() => handleBulkUserStatus('blocked')} borderRadius="xl">Khóa Nhanh</Button>
                                        <Button size="sm" leftIcon={<FaTrash/>} colorScheme="red" onClick={handleBulkUserDelete} borderRadius="xl">Xóa Nhanh</Button>
                                        <Button size="sm" onClick={() => setSelectedUserIds([])} variant="ghost" fontWeight="bold">Hủy</Button>
                                    </HStack>
                                </HStack>
                            )}

                            <Box overflowX="auto" minH="400px">
                                <Table variant="simple" size="md">
                                    <Thead bg={neumorphBg} boxShadow={neumorphShadow}>
                                        <Tr border="none">
                                            <Th w="30px" border="none"><Checkbox isChecked={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedUserIds.includes(u.id))} onChange={(e) => e.target.checked ? setSelectedUserIds([...new Set([...selectedUserIds, ...paginatedUsers.map(u => u.id)])]) : setSelectedUserIds(selectedUserIds.filter(id => !paginatedUsers.map(u => u.id).includes(id)))} /></Th>
                                            <Th color={textMuted} border="none" py={5}>THÀNH VIÊN</Th>
                                            <Th color={textMuted} border="none">VAI TRÒ</Th>
                                            <Th color={textMuted} border="none">TRẠNG THÁI</Th>
                                            <Th border="none">XỬ LÝ</Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {paginatedUsers.map(u => (
                                            <Tr key={u.id} borderBottom="1px solid" borderColor={borderColor} _hover={{bg: hoverTrBg}} bg={selectedUserIds.includes(u.id) ? rowSelectedBg : (u.status === 'pending' ? rowPendingBg : 'transparent')}>
                                                <Td border="none"><Checkbox isChecked={selectedUserIds.includes(u.id)} onChange={(e) => e.target.checked ? setSelectedUserIds([...selectedUserIds, u.id]) : setSelectedUserIds(selectedUserIds.filter(id => id !== u.id))} /></Td>
                                                <Td border="none">
                                                    <HStack spacing={4}>
                                                        <Box p={1} borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow}><Avatar size="sm" src={getImgUrl(u.avatar_url)} name={u.full_name} /></Box>
                                                        <VStack align="start" spacing={0}><Text fontWeight="900" fontSize="sm" color={textColor}>{u.full_name}</Text><Text fontSize="xs" color="gray.500">{u.email}</Text></VStack>
                                                    </HStack>
                                                </Td>
                                                <Td border="none"><Badge colorScheme={u.role==='vendor'?'purple':'blue'} px={3} py={1} borderRadius="full" border="none">{u.role.toUpperCase()}</Badge></Td>
                                                <Td border="none"><Badge colorScheme={u.status==='active'?'green':'orange'} variant="subtle">{u.status}</Badge></Td>
                                                <Td border="none">
                                                    <HStack spacing={3}>
                                                        <IconButton icon={<FaEye/>} size="sm" isRound bg={neumorphBg} boxShadow={neumorphShadow} onClick={()=>{setSelectedUser(u); onUserDetailOpen();}} border="none" color="blue.500"/>
                                                        {u.status !== 'active' ? <IconButton icon={<FaCheck/>} size="sm" colorScheme="green" isRound bg={neumorphBg} boxShadow={neumorphShadow} onClick={()=>handleUserStatus(u.id, 'active')}/> : <IconButton icon={<FaBan/>} size="sm" colorScheme="orange" isRound bg={neumorphBg} boxShadow={neumorphShadow} onClick={()=>handleUserStatus(u.id, 'blocked')}/>}
                                                        <IconButton icon={<FaTrash/>} size="sm" variant="ghost" colorScheme="red" isRound bg={neumorphBg} boxShadow={neumorphShadow} onClick={()=>handleDeleteUser(u.id)}/>
                                                    </HStack>
                                                </Td>
                                            </Tr>
                                        ))}
                                    </Tbody>
                                </Table>
                                {paginatedUsers.length === 0 && <Text textAlign="center" py={10} color="gray.500" fontWeight="bold">Không tìm thấy người dùng.</Text>}
                            </Box>

                            {totalUserPages > 1 && (
                                <Flex justify="center" mt={8}>
                                    <HStack spacing={4}>
                                        <IconButton size="md" onClick={() => setUserPage(p => p - 1)} isDisabled={userPage === 1} icon={<FaChevronLeft/>} isRound bg={neumorphBg} boxShadow={neumorphShadow} border="none"/>
                                        <Text fontSize="sm" fontWeight="900" color={accentColor}>{userPage} / {totalUserPages}</Text>
                                        <IconButton size="md" onClick={() => setUserPage(p => p + 1)} isDisabled={userPage === totalUserPages} icon={<FaChevronRight/>} isRound bg={neumorphBg} boxShadow={neumorphShadow} border="none"/>
                                    </HStack>
                                </Flex>
                            )}
                        </Box>
                    )}

                    {/* TAB REVIEW */}
                    {activeTab === 7 && <ReviewManagementTab />}

                    {/* TAB DANH MỤC MÔN */}
                    {activeTab === 3 && (
                        <Flex gap={8} direction={{base: 'column', lg: 'row'}}>
                            <Box w={{base: '100%', lg: '40%'}} bg={neumorphBg} p={8} borderRadius="3xl" boxShadow={neumorphShadow}>
                                <Heading size="md" mb={8} color={textColor} fontWeight="900">THÊM LOẠI SÂN</Heading>
                                <VStack spacing={6} as="form" onSubmit={handleSubmitSport}>
                                    <FormControl isRequired><FormLabel fontSize="xs" fontWeight="900" color={textMuted}>TÊN LOẠI HÌNH</FormLabel><InputGroup><InputLeftElement h="full" children={<FaGamepad color="blue.400"/>} /><Input placeholder="VD: Bóng đá" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} {...inputStyle}/></InputGroup></FormControl>
                                    <FormControl isRequired><FormLabel fontSize="xs" fontWeight="900" color={textMuted}>MÃ CODE (English)</FormLabel><InputGroup><InputLeftElement h="full" children={<FaCode color="blue.400"/>} /><Input placeholder="VD: football" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} {...inputStyle}/></InputGroup></FormControl>
                                    <FormControl>
                                        <FormLabel fontSize="xs" fontWeight="900" color={textMuted}>ICON ĐẠI DIỆN</FormLabel>
                                        <RadioGroup onChange={setUploadMode} value={uploadMode} mb={4}>
                                            <Stack direction='row' spacing={6}>
                                                <Radio value='file' colorScheme="blue"><Text fontWeight="bold">Tải File</Text></Radio>
                                                <Radio value='link' colorScheme="blue"><Text fontWeight="bold">Nhập Link</Text></Radio>
                                            </Stack>
                                        </RadioGroup>
                                        {uploadMode === 'file' ? (
                                            <Box w="100%" p={6} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow} textAlign="center" cursor="pointer" position="relative">
                                                <Input type="file" opacity={0} position="absolute" top={0} left={0} w="100%" h="100%" onChange={handleFileChange} accept="image/*"/>
                                                <VStack spacing={2}><Icon as={FaUpload} color="blue.500" boxSize={8} /><Text fontSize="xs" color="blue.500" fontWeight="bold">{file ? file.name : "Bấm để chọn ảnh"}</Text></VStack>
                                            </Box>
                                        ) : (
                                            <InputGroup><InputLeftElement h="full" children={<FaLink color="blue.400"/>} /><Input placeholder="https://..." value={formData.icon_url_direct} onChange={handleLinkChange} {...inputStyle}/></InputGroup>
                                        )}
                                    </FormControl>
                                    {previewUrl && <Box p={4} bg={neumorphBg} boxShadow={neumorphActiveShadow} borderRadius="2xl" w="100%" textAlign="center"><Image src={previewUrl} boxSize="80px" objectFit="contain" mx="auto" /></Box>}
                                    <Button type="submit" colorScheme="blue" bgGradient="linear(to-r, blue.400, blue.600)" w="100%" h="55px" borderRadius="2xl" boxShadow="xl" leftIcon={<FaPlus />} fontWeight="900">TẠO DANH MỤC</Button>
                                </VStack>
                            </Box>
                            
                            <Box flex={1} bg={neumorphBg} p={8} borderRadius="3xl" boxShadow={neumorphShadow}>
                                <Heading size="md" mb={8} color={textColor} fontWeight="900">DANH SÁCH MÔN THỂ THAO</Heading>
                                <Table variant="simple">
                                    <Thead bg={neumorphBg} boxShadow={neumorphShadow}><Tr border="none"><Th color={textMuted} border="none">ICON</Th><Th color={textMuted} border="none">TÊN MÔN</Th><Th color={textMuted} border="none">MÃ CODE</Th><Th isNumeric border="none" color={textMuted}>XÓA</Th></Tr></Thead>
                                    <Tbody>
                                        {sportTypes.map((type) => (
                                            <Tr key={type.id} border="none" _hover={{ bg: hoverTrBg }}>
                                                <Td border="none"><Box p={2} bg={neumorphBg} boxShadow={neumorphActiveShadow} borderRadius="xl" w="fit-content"><Image src={type.icon_url} boxSize="45px" objectFit="contain" /></Box></Td>
                                                <Td border="none"><Text fontWeight="900" color={textColor} fontSize="md">{type.name}</Text></Td>
                                                <Td border="none"><Badge colorScheme="green" borderRadius="md" px={3} py={1} border="none">{type.code}</Badge></Td>
                                                <Td border="none" isNumeric><IconButton size="md" colorScheme="red" isRound bg={neumorphBg} boxShadow={neumorphShadow} icon={<FaTrash />} onClick={() => handleDeleteSport(type.id)} border="none" /></Td>
                                            </Tr>
                                        ))}
                                    </Tbody>
                                </Table>
                            </Box>
                        </Flex>
                    )}

                    {/* TAB LỚP BẢN ĐỒ */}
                    {activeTab === 6 && (
                        <Flex gap={8} direction={{base: 'column', lg: 'row'}}>
                            <Box w={{base: '100%', lg: '40%'}} bg={neumorphBg} p={8} borderRadius="3xl" boxShadow={neumorphShadow}>
                                <Heading size="md" mb={8} color={textColor} fontWeight="900">📍 ICON ĐỊA ĐIỂM (MARKER)</Heading>
                                <HStack spacing={6} mb={10}>
                                    <Box p={4} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow} display="flex" alignItems="center" justifyContent="center" w="100px" h="100px">
                                        {markerIcon ? <Image src={markerIcon} boxSize="64px" objectFit="contain" /> : <Icon as={FaMapPin} boxSize={12} color="blue.500" />}
                                    </Box>
                                    <VStack align="start" flex={1}>
                                        <Text fontSize="xs" color={textMuted} fontWeight="bold">Upload ảnh PNG/SVG để đổi icon ghim trên bản đồ.</Text>
                                        <Input type="file" accept="image/*" onChange={handleUploadMarker} p={1} border="none" fontSize="sm" fontWeight="bold"/>
                                    </VStack>
                                </HStack>

                                <Divider borderColor={borderColor} mb={8}/>

                                <Heading size="md" mb={8} color={textColor} fontWeight="900">➕ THÊM LỚP NỀN MỚI</Heading>
                                <VStack spacing={6} align="stretch">
                                    <Box>
                                        <Text fontSize="xs" fontWeight="900" color={textMuted} mb={3}>CHỌN MẪU NHANH:</Text>
                                        <Flex wrap="wrap" gap={3}>
                                            {MAP_SUGGESTIONS.map((map) => (
                                                <Button key={map.name} size="sm" borderRadius="xl" bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} color="blue.500" onClick={() => setNewLayer({ ...newLayer, name: map.name, url: map.url, attribution: "Map Data" })}>{map.name}</Button>
                                            ))}
                                        </Flex>
                                    </Box>
                                    <FormControl isRequired><FormLabel fontSize="xs" fontWeight="900" color={textMuted}>TÊN HIỂN THỊ</FormLabel><Input placeholder="VD: Bản đồ Vệ tinh" value={newLayer.name} onChange={e=>setNewLayer({...newLayer, name: e.target.value})} {...inputStyle}/></FormControl>
                                    <FormControl isRequired><FormLabel fontSize="xs" fontWeight="900" color={textMuted}>URL BẢN ĐỒ (XYZ Tile)</FormLabel><Input placeholder="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" value={newLayer.url} onChange={e=>setNewLayer({...newLayer, url: e.target.value})} {...inputStyle} /><Text fontSize="10px" color="blue.400" mt={2} fontWeight="bold">Hệ thống sẽ tự động thay thế {'{z}, {x}, {y}'}</Text></FormControl>
                                    
                                    <FormControl>
                                        <FormLabel fontSize="xs" fontWeight="900" color={textMuted}>ẢNH MINH HỌA (THUMBNAIL)</FormLabel>
                                        <Box w="100%" h="180px" borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow} display="flex" alignItems="center" justifyContent="center" overflow="hidden" position="relative">
                                            {newLayer.url ? (
                                                <Image src={getPreviewTileUrl(newLayer.url)} w="100%" h="100%" objectFit="cover" transition="transform 0.3s" _hover={{ transform: 'scale(1.05)' }}/>
                                            ) : (
                                                <VStack opacity={0.5}><Icon as={FaImage} boxSize={12} color="blue.500" /><Text fontSize="sm" color="blue.500" fontWeight="bold">Preview Bản đồ</Text></VStack>
                                            )}
                                        </Box>
                                    </FormControl>
                                    
                                    <FormControl><FormLabel fontSize="xs" fontWeight="900" color={textMuted}>NGUỒN (ATTRIBUTION)</FormLabel><Input placeholder="&copy; OpenStreetMap" value={newLayer.attribution} onChange={e=>setNewLayer({...newLayer, attribution: e.target.value})} {...inputStyle}/></FormControl>
                                    <Button colorScheme="blue" bgGradient="linear(to-r, blue.400, blue.600)" w="100%" h="55px" borderRadius="2xl" onClick={handleAddLayer} isDisabled={!newLayer.url} shadow="xl" fontWeight="900">LƯU LỚP BẢN ĐỒ</Button>
                                </VStack>
                            </Box>

                            <Box flex={1} bg={neumorphBg} p={8} borderRadius="3xl" boxShadow={neumorphShadow}>
                                <Heading size="md" mb={8} color={textColor} fontWeight="900">🌍 QUẢN LÝ LỚP BẢN ĐỒ</Heading>
                                <Table variant="simple">
                                    <Thead bg={neumorphBg} boxShadow={neumorphShadow}><Tr border="none"><Th color={textMuted} border="none">Hình Ảnh</Th><Th color={textMuted} border="none">Tên Layer</Th><Th color={textMuted} border="none">URL</Th><Th color={textMuted} border="none">Bật</Th><Th color={textMuted} border="none">Xóa</Th></Tr></Thead>
                                    <Tbody>
                                        {mapLayers.map(layer => (
                                            <Tr key={layer.id} border="none" _hover={{ bg: hoverTrBg }}>
                                                <Td border="none"><Box p={1} bg={neumorphBg} borderRadius="xl" boxShadow={neumorphActiveShadow} w="fit-content"><Image src={getSmartThumbnail(layer)} boxSize="60px" objectFit="cover" borderRadius="lg" fallbackSrc="https://placehold.co/60x60?text=Map"/></Box></Td>
                                                <Td border="none"><Text fontWeight="900" color={textColor} fontSize="sm">{layer.name}</Text></Td>
                                                <Td border="none"><Text maxW="250px" isTruncated fontSize="xs" color="gray.500" fontWeight="bold">{layer.url}</Text></Td>
                                                <Td border="none"><IconButton icon={layer.active ? <FaToggleOn size="24px"/> : <FaToggleOff size="24px"/>} colorScheme={layer.active ? "green" : "gray"} variant="ghost" onClick={()=>handleToggleLayer(layer.id)} border="none" /></Td>
                                                <Td border="none"><IconButton icon={<FaTrash/>} colorScheme="red" isRound bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} onClick={()=>handleDeleteLayer(layer.id)} border="none" /></Td>
                                            </Tr>
                                        ))}
                                    </Tbody>
                                </Table>
                            </Box>
                        </Flex>
                    )}

                    {/* TAB HỆ THỐNG */}
                    {activeTab === 4 && (
                        <Container maxW="container.md" py={10}>
                            <Box bg={neumorphBg} p={10} borderRadius="3xl" boxShadow={neumorphShadow} textAlign="center">
                                <Icon as={FaGlobe} boxSize={16} color="blue.500" mb={6}/>
                                <Heading size="lg" mb={8} color={textColor} fontWeight="900">CẤU HÌNH HỆ THỐNG</Heading>
                                <VStack spacing={8} align="stretch" maxW="500px" mx="auto">
                                    <FormControl>
                                        <FormLabel fontWeight="900" color={textMuted} fontSize="xs" ml={2}>TÊN WEBSITE</FormLabel>
                                        <Input h="55px" value={config.website_name} onChange={e=>setConfig({...config, website_name: e.target.value})} placeholder="VD: Sport Booking Pro" {...inputStyle}/>
                                    </FormControl>
                                    <FormControl>
                                        <FormLabel fontWeight="900" color={textMuted} fontSize="xs" ml={2}>SĐT ZALO HỖ TRỢ</FormLabel>
                                        <InputGroup>
                                            <InputLeftElement h="full"><Icon as={FaPhone} color="blue.400"/></InputLeftElement>
                                            <Input h="55px" value={config.admin_zalo} onChange={e=>setConfig({...config, admin_zalo: e.target.value})} placeholder="Số Zalo nhận hồ sơ..." {...inputStyle} pl={10}/>
                                        </InputGroup>
                                    </FormControl>
                                    <FormControl>
                                        <FormLabel fontWeight="900" color={textMuted} fontSize="xs" ml={2}>LOGO HỆ THỐNG</FormLabel>
                                        <HStack align="center" spacing={6} p={6} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow}>
                                            <Box w="120px" h="120px" borderRadius="2xl" display="flex" alignItems="center" justifyContent="center" bg={neumorphBg} boxShadow={neumorphShadow} position="relative" overflow="hidden">
                                                {previewLogo ? <Image src={previewLogo} w="100%" h="100%" objectFit="contain" /> : <Icon as={FaImage} color="blue.500" boxSize={12}/>}
                                                <Input type="file" opacity={0} position="absolute" top={0} left={0} w="100%" h="100%" cursor="pointer" onChange={handleLogoChange} accept="image/*"/>
                                            </Box>
                                            <VStack align="start" spacing={3} flex={1}>
                                                <Button size="md" borderRadius="xl" leftIcon={<FaUpload/>} onClick={()=>document.querySelector('input[type="file"]').click()} bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} color="blue.500" fontWeight="900">Chọn ảnh Logo</Button>
                                                <Text fontSize="xs" color={textMuted} fontWeight="bold">Định dạng PNG, JPG. Tối ưu 512x512.</Text>
                                            </VStack>
                                        </HStack>
                                    </FormControl>
                                    <Button colorScheme="blue" h="60px" w="100%" borderRadius="2xl" boxShadow="xl" bgGradient="linear(to-r, blue.400, blue.600)" fontWeight="900" onClick={handleSaveConfig}>LƯU CẤU HÌNH</Button>
                                </VStack>
                            </Box>
                        </Container>
                    )}

                </Box>
            </Flex>

            {/* 🔥 MOBILE BOTTOM NAV SANG CHẢNH */}
            {isMobile && (
                <Flex position="fixed" bottom={0} left={0} right={0} bg={neumorphBg} h="75px" borderTopLeftRadius="3xl" borderTopRightRadius="3xl" boxShadow="0 -10px 20px rgba(0,0,0,0.05)" justify="space-around" align="center" zIndex={1200} pb="env(safe-area-inset-bottom)">
                    <VStack spacing={1} onClick={()=>setActiveTab(0)} cursor="pointer" flex={1}>
                        <Box p={2.5} borderRadius="xl" bg={neumorphBg} boxShadow={activeTab === 0 ? neumorphActiveShadow : neumorphShadow} transition="all 0.2s">
                            <Icon as={FaChartLine} boxSize={5} color={activeTab === 0 ? accentColor : textMuted}/>
                        </Box>
                    </VStack>
                    <VStack spacing={1} onClick={()=>setActiveTab(5)} cursor="pointer" flex={1}>
                        <Box p={2.5} borderRadius="xl" bg={neumorphBg} boxShadow={activeTab === 5 ? neumorphActiveShadow : neumorphShadow} transition="all 0.2s">
                            <Icon as={FaStore} boxSize={5} color={activeTab === 5 ? accentColor : textMuted}/>
                        </Box>
                    </VStack>
                    <Box flex={1} position="relative" display="flex" justifyContent="center">
                        <Box position="absolute" top="-35px" p={2} borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow}>
                            <Flex w="55px" h="55px" bg={neumorphBg} color={activeTab === 1 ? "white" : accentColor} bgGradient={activeTab === 1 ? "linear(to-br, blue.400, blue.600)" : "none"} borderRadius="full" justify="center" align="center" boxShadow={activeTab === 1 ? neumorphActiveShadow : neumorphShadow} cursor="pointer" onClick={() => setActiveTab(1)}>
                                <Icon as={FaMapMarkedAlt} boxSize={6} />
                            </Flex>
                        </Box>
                    </Box>
                    <VStack spacing={1} onClick={()=>setActiveTab(2)} cursor="pointer" flex={1}>
                        <Box p={2.5} borderRadius="xl" bg={neumorphBg} boxShadow={activeTab === 2 ? neumorphActiveShadow : neumorphShadow} transition="all 0.2s">
                            <Icon as={FaUserShield} boxSize={5} color={activeTab === 2 ? accentColor : textMuted}/>
                        </Box>
                    </VStack>
                    <Menu placement="top-end">
                        <MenuButton as={Box} flex={1} cursor="pointer" display="flex" justifyContent="center">
                            <Box p={2.5} borderRadius="xl" bg={neumorphBg} boxShadow={neumorphShadow} mx="auto" w="fit-content">
                                <Icon as={FaEllipsisH} boxSize={5} color={textMuted}/>
                            </Box>
                        </MenuButton>
                        <MenuList shadow="2xl" borderRadius="2xl" zIndex={1300} bg={neumorphBg} border="none" mb={4} p={2}>
                            <MenuItem bg={neumorphBg} borderRadius="lg" icon={<FaGamepad />} onClick={() => setActiveTab(3)} color={textColor} fontWeight="bold">Danh mục Môn</MenuItem>
                            <MenuItem bg={neumorphBg} borderRadius="lg" icon={<FaLayerGroup />} onClick={() => setActiveTab(6)} color={textColor} fontWeight="bold">Bản đồ</MenuItem>
                            <MenuItem bg={neumorphBg} borderRadius="lg" icon={<FaGlobe />} onClick={() => setActiveTab(4)} color={textColor} fontWeight="bold">Hệ thống</MenuItem>
                            <MenuDivider borderColor={borderColor} />
                            <MenuItem bg={neumorphBg} borderRadius="lg" icon={<FaStar />} onClick={() => setActiveTab(7)} color={textColor} fontWeight="bold">
                                <HStack justify="space-between" w="100%">
                                    <Text>Duyệt Review</Text>
                                    {reportedCount > 0 && <Badge colorScheme="red" borderRadius="full">{reportedCount > 99 ? '99+' : reportedCount}</Badge>}
                                </HStack>
                            </MenuItem>
                        </MenuList>
                    </Menu>
                </Flex>
            )}

            {/* 🔥 ĐÃ GẮN USER DETAIL MODAL VÀO ĐÂY ĐỂ BẤM CON MẮT NÓ LÊN */}
            <UserDetailModal 
                isOpen={isUserDetailOpen} 
                onClose={onUserDetailClose} 
                user={selectedUser} 
                onApprove={handleApproveUser} 
                onReject={handleRejectUser} 
            />
        </Flex>
    );
}

// ==========================================
// 4. CÁC COMPONENT MODAL PHỤ
// ==========================================
const UserDetailModal = ({ isOpen, onClose, user, onApprove, onReject }) => {
    const [lightboxImg, setLightboxImg] = useState(null);

    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '6px 6px 12px #0d1117, -4px -4px 10px #2d3748');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #0d1117, inset -4px -4px 8px #2d3748');
    const textColor = useColorModeValue('gray.700', 'gray.100');
    const mutedText = useColorModeValue('gray.500', 'gray.400');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    const facilityImgs = parseArray(user?.facility_images);
    const identityImgs = parseArray(user?.identity_images);
    const faceImg = user?.face_image ? getImgUrl(user.face_image) : null;

    const renderImages = (imgs, title) => {
        if (!imgs || imgs.length === 0) return <Text fontSize="sm" color={mutedText} fontStyle="italic">Không có ảnh trên hệ thống</Text>;
        return (
            <Box mb={4}>
                <Text fontSize="xs" fontWeight="bold" color={mutedText} mb={2}>{title}</Text>
                <HStack overflowX="auto" pb={2} spacing={3} className="hide-scrollbar">
                    {imgs.map((img, idx) => (
                        <Image key={idx} src={getImgUrl(img)} boxSize="80px" objectFit="cover" borderRadius="md" border="1px solid" borderColor={borderColor} cursor="zoom-in" onClick={() => setLightboxImg(getImgUrl(img))} _hover={{ transform: 'scale(1.05)', shadow: 'md' }} transition="all 0.2s" />
                    ))}
                </HStack>
            </Box>
        );
    };

    if (!user) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered scrollBehavior="inside">
            <ModalOverlay backdropFilter="blur(6px)" bg="blackAlpha.600" />
            <ModalContent borderRadius="3xl" bg={neumorphBg} border="none" p={4}>
                <ModalHeader fontWeight="900" textAlign="center" color={textColor}>HỒ SƠ THÀNH VIÊN</ModalHeader>
                <ModalCloseButton mt={4} mr={4} borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} border="none" />
                <ModalBody pb={8}>
                    <VStack spacing={6}>
                        <Box p={2} borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow}>
                            <Avatar size="2xl" src={getImgUrl(user.avatar_url)} name={user.full_name} border="4px solid" borderColor={neumorphBg} />
                        </Box>
                        <VStack spacing={1}>
                            <Heading size="md" color={textColor} fontWeight="900">{user.full_name}</Heading>
                            <Text fontWeight="bold" color="blue.500">{user.email}</Text>
                            <Badge colorScheme={user.role === 'vendor' ? 'purple' : 'blue'} px={4} py={1} borderRadius="full">{user.role.toUpperCase()}</Badge>
                        </VStack>

                        <SimpleGrid columns={2} spacing={6} w="100%">
                            <Box p={4} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow} textAlign="center">
                                <Text fontSize="10px" fontWeight="900" color="gray.500" mb={1}>SỐ ĐIỆN THOẠI</Text>
                                <Text fontWeight="bold" color={textColor}>{user.phone_number || 'N/A'}</Text>
                            </Box>
                            <Box p={4} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow} textAlign="center">
                                <Text fontSize="10px" fontWeight="900" color="gray.500" mb={1}>NGÀY GIA NHẬP</Text>
                                <Text fontWeight="bold" color={textColor}>{new Date(user.created_at).toLocaleDateString('vi-VN')}</Text>
                            </Box>
                        </SimpleGrid>

                        {user.role === 'vendor' && (
                            <Box w="100%" p={6} borderRadius="3xl" bg={neumorphBg} boxShadow={neumorphShadow}>
                                <HStack mb={4} color="orange.500"><Icon as={FaStore} /><Text fontWeight="900" fontSize="sm">CƠ SỞ ĐĂNG KÝ</Text></HStack>
                                <VStack align="start" spacing={3}>
                                    <Text fontSize="sm" fontWeight="bold" color={textColor}>Tên: {user.facility_name}</Text>
                                    <Text fontSize="sm" color="gray.500" fontWeight="bold">Địa chỉ: {user.facility_address}</Text>
                                </VStack>
                                
                                {(identityImgs.length > 0 || facilityImgs.length > 0 || faceImg) && (
                                    <Box mt={6} p={4} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow}>
                                        <Text fontSize="xs" fontWeight="bold" color={mutedText} mb={3}>Dữ liệu hệ thống cũ (Nếu có):</Text>
                                        {renderImages(identityImgs, "📸 CĂN CƯỚC CÔNG DÂN (2 MẶT)")}
                                        <Box mb={4}>
                                            <Text fontSize="xs" fontWeight="bold" color={mutedText} mb={2}>📸 ẢNH CHÂN DUNG</Text>
                                            {faceImg ? (
                                                <Image src={faceImg} boxSize="80px" objectFit="cover" borderRadius="md" border="1px solid" borderColor={borderColor} cursor="zoom-in" onClick={() => setLightboxImg(faceImg)} _hover={{ transform: 'scale(1.05)', shadow: 'md' }} transition="all 0.2s" />
                                            ) : <Text fontSize="sm" color={mutedText} fontStyle="italic">Không có ảnh trên hệ thống</Text>}
                                        </Box>
                                        {renderImages(facilityImgs, "🏟️ ẢNH SÂN BÃI THỰC TẾ")}
                                    </Box>
                                )}

                                <Box mt={6} p={4} borderRadius="xl" bg={useColorModeValue('orange.50', 'orange.900')} border="1px dashed" borderColor="orange.300" textAlign="center">
                                    <Text fontSize="xs" fontWeight="900" color="orange.600">⚠️ VUI LÒNG CHECK ZALO TRƯỚC KHI DUYỆT KHÁCH HÀNG</Text>
                                </Box>
                            </Box>
                        )}
                    </VStack>
                </ModalBody>
                <ModalFooter bg={neumorphBg} borderBottomRadius="3xl" borderTop="none" p={6}>
                    <HStack spacing={4} w="100%">
                        {user.status === 'pending' ? (
                            <>
                                <Button flex={1} h="50px" borderRadius="xl" colorScheme="red" variant="outline" onClick={() => onReject(user.id)}>TỪ CHỐI</Button>
                                <Button flex={1} h="50px" borderRadius="xl" colorScheme="green" bgGradient="linear(to-r, green.400, green.600)" color="white" onClick={() => onApprove(user.id)}>DUYỆT HỒ SƠ</Button>
                            </>
                        ) : (
                            <Button w="100%" h="50px" borderRadius="xl" bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} onClick={onClose} fontWeight="900">ĐÓNG BẢNG</Button>
                        )}
                    </HStack>
                </ModalFooter>
            </ModalContent>

            {lightboxImg && (
                <Box position="fixed" inset={0} zIndex={9999} bg="rgba(0,0,0,0.8)" display="flex" alignItems="center" justifyContent="center" onClick={() => setLightboxImg(null)}>
                    <Image src={lightboxImg} maxH="90vh" maxW="90vw" objectFit="contain" borderRadius="md" shadow="dark-lg" onClick={(e) => e.stopPropagation()} />
                    <IconButton icon={<FaTimes />} position="absolute" top={4} right={4} colorScheme="whiteAlpha" isRound onClick={() => setLightboxImg(null)} />
                </Box>
            )}
        </Modal>
    );
};

const FacilityFormPanel = ({ onClose, onRefresh, sportTypes, editingFac }) => { 
    const [data, setData] = useState({
        name: '', address: '', description: '', lat: 10.7769, lng: 106.7009,
        owner_name: '', phone_number: '', facebook_url: '', zalo_url: '', 
        open_time: '06:00', close_time: '22:00',
        qty_normal: 1, price_normal: 100000, qty_vip: 0, price_vip: 200000
    });

    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '6px 6px 12px #0d1117, -4px -4px 10px #2d3748');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #0d1117, inset -4px -4px 8px #2d3748');
    const textColor = useColorModeValue('gray.700', 'gray.100');
    const textMuted = useColorModeValue('gray.500', 'gray.400');

    const inputStyle = {
        bg: neumorphBg, border: "none", color: textColor, boxShadow: neumorphActiveShadow,
        borderRadius: "xl", height: "50px", fontWeight: "bold", fontSize: "sm",
        _focus: { boxShadow: neumorphActiveShadow, border: "1px solid", borderColor: "blue.400" }
    };

    const [searchMap, setSearchMap] = useState(''); 
    const [coordInput, setCoordInput] = useState('');
    const [amenities, setAmenities] = useState([]);
    const [facFiles, setFacFiles] = useState([]);
    const [selectedSports, setSelectedSports] = useState([]);
    const [is24h, setIs24h] = useState(false);
    const [hasCourtInfo, setHasCourtInfo] = useState(false);
    const toast = useToast();
    const isEditing = !!editingFac;

    useEffect(() => {
        if (isEditing && editingFac) {
            const coords = getSafeCoords(editingFac) || { lat: 10.7769, lng: 106.7009 };
            setData({
                ...editingFac,
                lat: coords.lat,
                lng: coords.lng,
                owner_name: editingFac.owner_name === 'Đang cập nhật' ? '' : (editingFac.owner_name || ''),
                phone_number: editingFac.phone_number === 'Đang cập nhật' ? '' : (editingFac.phone_number || ''),
                open_time: editingFac.open_time ? editingFac.open_time.substring(0, 5) : '',
                close_time: editingFac.close_time ? editingFac.close_time.substring(0, 5) : ''
            });
            setIs24h(editingFac.open_time === '00:00:00' && editingFac.close_time === '23:59:00');
            try { setAmenities(JSON.parse(editingFac.amenities || '[]')); } catch(e){ setAmenities([]); }
            setHasCourtInfo(false); 
            setSelectedSports([]); 
        } else {
            setData({ name: '', address: '', lat: 10.7769, lng: 106.7009, owner_name: '', phone_number: '', facebook_url: '', zalo_url: '', open_time: '', close_time: '', qty_normal: 0, price_normal: 0, qty_vip: 0, price_vip: 0 });
            setIs24h(false); setAmenities([]); setHasCourtInfo(false); setSelectedSports([]);
        }
    }, [editingFac, isEditing]);

    const AMENITY_OPTIONS = ["Wifi miễn phí", "Bãi đỗ xe", "Căn tin", "WC sạch sẽ", "Cho thuê giày", "Trọng tài", "Tủ đồ"];
    const handleAmenityChange = (opt) => setAmenities(prev => prev.includes(opt) ? prev.filter(a => a !== opt) : [...prev, opt]);

    const handleSearchLocation = async () => {
        if(!searchMap) return;
        try {
            const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchMap + ', Vietnam')}`);
            if (res.data && res.data.length > 0) {
                setData(prev => ({ ...prev, lat: parseFloat(res.data[0].lat), lng: parseFloat(res.data[0].lon) }));
                toast({ title: 'Đã tìm thấy vị trí', status: 'success' });
            } else toast({ title: 'Không tìm thấy', status: 'warning' });
        } catch (e) {}
    };

    const handlePinCoordinates = () => {
        if (!coordInput) return;
        const parts = coordInput.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            const lat = parseFloat(parts[0]); const lng = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
                setData(prev => ({ ...prev, lat, lng }));
                toast({ title: 'Đã ghim tọa độ!', status: 'success' }); setCoordInput(''); 
            }
        }
    };

    const handleSubmit = async () => {
        if (!data.name || !data.address) return toast({ title: 'Tên và Địa chỉ là bắt buộc!', status: 'warning' });
        if (!isEditing && selectedSports.length === 0) return toast({ title: 'Chọn ít nhất 1 môn thể thao!', status: 'warning' });

        const formData = new FormData();
        Object.keys(data).forEach(key => formData.append(key, data[key]));
        formData.append('amenities', JSON.stringify(amenities));
        formData.append('owner_name', data.owner_name || 'Đang cập nhật');
        formData.append('phone_number', data.phone_number || 'Đang cập nhật');
        const adminUser = JSON.parse(localStorage.getItem('user'));
        if (adminUser) formData.append('owner_id', adminUser.id);

        if (!isEditing) {
            formData.append('sport_ids', JSON.stringify(selectedSports));
            formData.append('qty_normal', hasCourtInfo ? data.qty_normal : 0);
            formData.append('price_normal', hasCourtInfo ? data.price_normal : 0); 
            formData.append('qty_vip', hasCourtInfo ? data.qty_vip : 0);
            formData.append('price_vip', hasCourtInfo ? data.price_vip : 0);
        }
        for (let i = 0; i < facFiles.length; i++) formData.append('facility_images', facFiles[i]);

        try {
            if (isEditing) await axios.put(`http://localhost:5000/api/admin/facilities/${editingFac.id}`, formData);
            else await axios.post('http://localhost:5000/api/admin/facilities', formData);
            toast({ title: 'Thành công!', status: 'success' }); onRefresh(); onClose();
        } catch (e) { toast({ title: 'Lỗi', status: 'error' }); }
    };

    return (
        <Box h="100%" display="flex" flexDirection="column" bg={neumorphBg}>
            <Flex p={4} justify="space-between" align="center" bg={neumorphBg} boxShadow={neumorphShadow} zIndex={10}>
                <Heading size="sm" color="blue.500" fontWeight="900">{isEditing ? "SỬA CƠ SỞ" : "TẠO CƠ SỞ SEEDING"}</Heading>
                <IconButton icon={<FaTimes />} size="sm" isRound bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} onClick={onClose} border="none"/>
            </Flex>
            
            <Box p={6} flex={1} overflowY="auto" className="hide-scrollbar">
                <VStack spacing={6} align="stretch" pb={10}>
                    <Box p={6} borderRadius="3xl" bg={neumorphBg} boxShadow={neumorphShadow}>
                        <Heading size="xs" mb={4} color="gray.500" letterSpacing="1px">1. THÔNG TIN CHÍNH</Heading>
                        <VStack spacing={4}>
                            <FormControl isRequired><FormLabel fontSize="xs" fontWeight="900" color="gray.500" ml={2}>TÊN CƠ SỞ</FormLabel><Input {...inputStyle} value={data.name} onChange={e=>setData({...data, name: e.target.value})}/></FormControl>
                            <FormControl isRequired><FormLabel fontSize="xs" fontWeight="900" color="gray.500" ml={2}>ĐỊA CHỈ</FormLabel><Input {...inputStyle} value={data.address} onChange={e=>setData({...data, address: e.target.value})}/></FormControl>
                            
                            <Box w="100%" p={4} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow}>
                                <Text fontSize="xs" fontWeight="900" color="blue.500" mb={3} textAlign="center">📍 GHIM TỌA ĐỘ BẢN ĐỒ</Text>
                                <HStack mb={3}>
                                    <Input placeholder="Tọa độ..." value={coordInput} onChange={(e)=>setCoordInput(e.target.value)} {...inputStyle} h="40px" />
                                    <Button colorScheme="orange" h="40px" borderRadius="xl" onClick={handlePinCoordinates}>Ghim</Button>
                                </HStack>
                                <HStack mb={4}>
                                    <Input placeholder="Tìm địa chỉ..." value={searchMap} onChange={(e)=>setSearchMap(e.target.value)} {...inputStyle} h="40px"/>
                                    <Button colorScheme="teal" h="40px" borderRadius="xl" onClick={handleSearchLocation}>Tìm</Button>
                                </HStack>
                                <Box h="200px" borderRadius="xl" overflow="hidden" position="relative" border="4px solid" borderColor={neumorphBg} boxShadow={neumorphShadow}>
                                    <Badge position="absolute" top={2} right={2} zIndex={1000} colorScheme="blue" borderRadius="md">Click dời ghim</Badge>
                                    <MapContainer center={[data.lat, data.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                                        <TileLayer url={useColorModeValue("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png")}/>
                                        <MapFlyTo center={[data.lat, data.lng]} />
                                        <LocationPicker position={[data.lat, data.lng]} setPosition={(pos) => setData({...data, lat: pos[0], lng: pos[1]})} />
                                    </MapContainer>
                                </Box>
                            </Box>
                        </VStack>
                    </Box>

                    <Box p={6} borderRadius="3xl" bg={neumorphBg} boxShadow={neumorphShadow}>
                        <Heading size="xs" mb={4} color="gray.500" letterSpacing="1px">2. THÔNG TIN THÊM</Heading>
                        <VStack spacing={4} align="stretch">
                            <SimpleGrid columns={2} spacing={4}>
                                <FormControl><FormLabel fontSize="xs" fontWeight="900" color="gray.500" ml={2}>NGƯỜI LIÊN HỆ</FormLabel><Input {...inputStyle} value={data.owner_name} onChange={e=>setData({...data, owner_name: e.target.value})} /></FormControl>
                                <FormControl><FormLabel fontSize="xs" fontWeight="900" color="gray.500" ml={2}>ĐIỆN THOẠI</FormLabel><Input {...inputStyle} value={data.phone_number} onChange={e=>setData({...data, phone_number: e.target.value})} /></FormControl>
                                <FormControl><FormLabel fontSize="xs" fontWeight="900" color="gray.500" ml={2}>ZALO</FormLabel><Input {...inputStyle} value={data.zalo_url} onChange={e=>setData({...data, zalo_url: e.target.value})} /></FormControl>
                                <FormControl><FormLabel fontSize="xs" fontWeight="900" color="gray.500" ml={2}>FACEBOOK</FormLabel><Input {...inputStyle} value={data.facebook_url} onChange={e=>setData({...data, facebook_url: e.target.value})} /></FormControl>
                            </SimpleGrid>
                            
                            <Box bg={neumorphBg} p={4} borderRadius="2xl" boxShadow={neumorphActiveShadow}>
                                <Checkbox colorScheme="green" isChecked={is24h} onChange={(e) => { setIs24h(e.target.checked); if(e.target.checked) setData({...data, open_time: '00:00', close_time: '23:59'}); else setData({...data, open_time: '', close_time: ''}); }} mb={3}>
                                    <Text fontWeight="900" color="green.500" fontSize="sm">Mở cửa 24/24</Text>
                                </Checkbox>
                                <HStack opacity={is24h ? 0.4 : 1} pointerEvents={is24h ? "none" : "auto"}>
                                    <FormControl><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">Giờ mở</FormLabel><Input type="time" {...inputStyle} value={data.open_time} onChange={e=>setData({...data, open_time: e.target.value})}/></FormControl>
                                    <FormControl><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">Giờ đóng</FormLabel><Input type="time" {...inputStyle} value={data.close_time} onChange={e=>setData({...data, close_time: e.target.value})}/></FormControl>
                                </HStack>
                            </Box>
                            
                            <FormControl>
                                <FormLabel fontSize="xs" fontWeight="900" color="gray.500" ml={2}>TIỆN ÍCH</FormLabel>
                                <SimpleGrid columns={2} spacing={3} p={4} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow}>
                                    {AMENITY_OPTIONS.map(opt => <Checkbox key={opt} isChecked={amenities.includes(opt)} onChange={() => handleAmenityChange(opt)} colorScheme="blue"><Text fontSize="xs" color={textColor}>{opt}</Text></Checkbox>)}
                                </SimpleGrid>
                            </FormControl>
                            <FormControl><FormLabel fontSize="xs" fontWeight="900" color="gray.500" ml={2}>ẢNH CƠ SỞ</FormLabel><Input type="file" multiple accept="image/*" onChange={e => setFacFiles(e.target.files)} pt={1} border="none" bg={neumorphBg} boxShadow={neumorphActiveShadow} borderRadius="xl" h="45px"/></FormControl>
                        </VStack>
                    </Box>

                    {!isEditing && (
                        <Box p={6} borderRadius="3xl" bg={neumorphBg} boxShadow={neumorphShadow}>
                            <FormControl isRequired mb={6}>
                                <FormLabel fontSize="sm" color="purple.500" fontWeight="900">3. CHỌN MÔN THỂ THAO</FormLabel>
                                <SimpleGrid columns={2} spacing={4} bg={neumorphBg} p={4} borderRadius="2xl" boxShadow={neumorphActiveShadow}>
                                    {sportTypes.map(s => (
                                        <Checkbox key={s.id} colorScheme="purple" isChecked={selectedSports.includes(s.id)} onChange={(e) => {
                                            if(e.target.checked) setSelectedSports([...selectedSports, s.id]);
                                            else setSelectedSports(selectedSports.filter(id => id !== s.id));
                                        }}><Text fontWeight="900" color={textColor} fontSize="sm">{s.name}</Text></Checkbox>
                                    ))}
                                </SimpleGrid>
                            </FormControl>
                            
                            <Box bg={neumorphBg} p={4} borderRadius="2xl" boxShadow={neumorphActiveShadow} mb={4}>
                                <Checkbox colorScheme="green" size="lg" isChecked={hasCourtInfo} onChange={(e) => setHasCourtInfo(e.target.checked)}>
                                    <Text fontWeight="900" fontSize="sm" color={hasCourtInfo ? "green.500" : "gray.500"}>Kèm giá/số lượng Sân con</Text>
                                </Checkbox>
                            </Box>
                            
                            <Box opacity={hasCourtInfo ? 1 : 0.4} pointerEvents={hasCourtInfo ? "auto" : "none"} transition="all 0.3s">
                                <Text fontWeight="900" mb={3} color="blue.500" fontSize="sm">🅰️ SÂN THƯỜNG</Text>
                                <SimpleGrid columns={2} spacing={4} mb={6}>
                                    <FormControl><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">Số lượng</FormLabel><NumberInput min={0} value={data.qty_normal} onChange={(v)=>setData({...data, qty_normal: v})}><NumberInputField {...inputStyle}/></NumberInput></FormControl>
                                    <FormControl><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">Giá/Giờ</FormLabel><NumberInput min={0} step={10000} value={data.price_normal} onChange={(v)=>setData({...data, price_normal: v})}><NumberInputField {...inputStyle}/></NumberInput></FormControl>
                                </SimpleGrid>
                                <Divider borderColor={useColorModeValue('gray.300', 'gray.700')} mb={6}/>
                                <Text fontWeight="900" mb={3} color="orange.500" fontSize="sm">👑 SÂN VIP</Text>
                                <SimpleGrid columns={2} spacing={4}>
                                    <FormControl><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">Số lượng</FormLabel><NumberInput min={0} value={data.qty_vip} onChange={(v)=>setData({...data, qty_vip: v})}><NumberInputField {...inputStyle}/></NumberInput></FormControl>
                                    <FormControl><FormLabel fontSize="xs" fontWeight="bold" color="gray.500">Giá/Giờ</FormLabel><NumberInput min={0} step={10000} value={data.price_vip} onChange={(v)=>setData({...data, price_vip: v})}><NumberInputField {...inputStyle}/></NumberInput></FormControl>
                                </SimpleGrid>
                            </Box>
                        </Box>
                    )}

                    {isEditing && (
                        <Box bg={useColorModeValue('orange.50', 'rgba(221, 107, 32, 0.1)')} p={4} borderRadius="lg" border="1px dashed" borderColor="orange.400" textAlign="center">
                            <Text fontWeight="900" color="orange.500" fontSize="sm">Lưu ý Sửa Cơ Sở:</Text>
                            <Text fontSize="xs" color="gray.500" fontWeight="bold">Sang tab <b>"Quản lý Sân con"</b> để sửa số lượng sân / giá tiền.</Text>
                        </Box>
                    )}
                    <Button h="60px" borderRadius="2xl" colorScheme="blue" bgGradient="linear(to-r, blue.400, blue.600)" color="white" boxShadow="xl" _active={{transform: 'scale(0.98)'}} onClick={handleSubmit} w="100%" fontWeight="900" fontSize="md">
                        {isEditing ? "LƯU THAY ĐỔI CƠ SỞ" : "TẠO CƠ SỞ SEEDING"}
                    </Button>
                </VStack>
            </Box>
        </Box>
    );
};