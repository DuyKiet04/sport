import React, { useState, useEffect, useMemo } from 'react';
import { 
    Flex, useDisclosure, useBreakpointValue, HStack, Text, IconButton, Avatar, VStack, Icon, Button, 
    useColorMode, useColorModeValue, useToast, Box, Image, Divider, Tooltip,
    Drawer, DrawerOverlay, DrawerContent, DrawerBody,
    Input, InputGroup, InputLeftElement, Skeleton 
} from '@chakra-ui/react';
import { 
    FaBars, FaMoon, FaSun, FaTicketAlt, FaExpand, FaCompress, 
    FaCar, FaWalking, FaBicycle, FaTimes, FaCheckCircle, FaMapMarkerAlt, FaEyeSlash, FaHeart,
    FaList, FaHome, FaUser, FaMapMarkedAlt, FaPlus, FaSearch ,FaMotorcycle
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, LayerGroup, useMap, ZoomControl } from 'react-leaflet'; 
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Import Components
import SidebarList from './components/UserPage/SidebarList';
import MapComponent from './components/UserPage/MapComponent';
import FacilityDetailModal from './components/UserPage/FacilityDetailModal';
import CreateMatchModal from './components/UserPage/CreateMatchModal';
import UserProfileDrawer from './components/UserPage/UserProfileDrawer';
import BookingModal from './BookingModal';
import MyTicketsModal from './MyTickets';
import HeatmapLayer from './HeatmapLayer'; 
import PublicProfileModal from './components/UserPage/PublicProfileModal'; 
import FavoriteFacilitiesModal from './components/UserPage/FavoriteFacilitiesModal'; 
import NotificationBell from './components/UserPage/NotificationBell';

// ==========================================
// 🔥 1. Các hàm helpers 
// ==========================================

const getImgUrl = (url) => { 
    if (!url) return 'https://placehold.co/300x200?text=No+Image'; 
    if (url.includes('via.placeholder.com') || url.includes('placehold.co')) return url;
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
    return getPreviewTileUrl(layer.url);
};

const removeVietnameseTones = (str) => { if (!str) return ''; str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, ""); str = str.replace(/đ/g, "d").replace(/Đ/g, "D"); return str.toLowerCase().trim(); };
const getSportKeywords = (sportCode) => { if (!sportCode) return ''; const code = removeVietnameseTones(sportCode); const map = { 'football': 'bong da da banh san co nhan tao soccer', 'badminton': 'cau long vot cau', 'tennis': 'quan vot tennis', 'basketball': 'bong ro', 'swimming': 'bo loi ho boi', 'gym': 'gym the hinh yoga', 'billiard': 'bida bi a', 'bong da': 'bong da da banh football soccer', 'da banh': 'bong da da banh football', 'cau long': 'cau long badminton', 'quan vot': 'tennis quan vot' }; return map[code] || code; };
const parsePostGISPoint = (hex) => { if (!hex || typeof hex !== 'string' || hex.length < 40) return null; try { const buffer = new Uint8Array(hex.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16))).buffer; const view = new DataView(buffer); const isLittleEndian = view.getUint8(0) === 1; const lng = view.getFloat64(9, isLittleEndian); const lat = view.getFloat64(17, isLittleEndian); return { lat, lng }; } catch (e) { return null; } };
const getCourtLatLng = (court) => { if (court.geometry?.coordinates) return { lat: court.geometry.coordinates[1], lng: court.geometry.coordinates[0] }; if (court.location) return parsePostGISPoint(court.location); return null; };
const calculateDistance = (lat1, lon1, lat2, lon2) => { if (!lat1 || !lon1 || !lat2 || !lon2) return null; const R = 6371; const dLat = (lat2 - lat1) * (Math.PI / 180); const dLon = (lon2 - lon1) * (Math.PI / 180); const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return (R * c).toFixed(1); };

const customStyles = `
  .hide-scrollbar::-webkit-scrollbar { display: none; }
  .custom-cluster-icon { background: none; border: none; }
  .custom-tacke-marker { background: none; border: none; }
`;

// ==========================================
// 🔥 2. Component điều khiển map (Bổ sung z-index mobile)
// ==========================================
const MapControlGroup = ({ layers, activeLayer, onChangeLayer, showMarkers, setShowMarkers , onMatchOpen }) => {
    const map = useMap();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isHovered, setIsHovered] = useState(false); 
    const isMobile = useBreakpointValue({ base: true, lg: false });
    const btnSize = isMobile ? "lg" : "md";

    const neumorphBg = useColorModeValue('#edf2f7', '#2d3748');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '4px 4px 10px #1a202c, -4px -4px 10px #4a5568');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #1a202c, inset -4px -4px 8px #4a5568');

    const toggleFullscreen = () => { 
        if (!document.fullscreenElement) { document.documentElement.requestFullscreen().then(() => { setIsFullscreen(true); setTimeout(() => map.invalidateSize(), 100); }); } 
        else { document.exitFullscreen().then(() => { setIsFullscreen(false); setTimeout(() => map.invalidateSize(), 100); }); } 
    };

    useEffect(() => { 
        const handleChange = () => setIsFullscreen(!!document.fullscreenElement); 
        document.addEventListener('fullscreenchange', handleChange); 
        return () => document.removeEventListener('fullscreenchange', handleChange); 
    }, []);

    return (
        <Box position="absolute" bottom={isMobile ? "110px" : "30px"} left="10px" zIndex={1000}>
            <VStack align="start" spacing={4}>
                {!isMobile && (
                    <Tooltip label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"} placement="right" hasArrow>
                        <IconButton 
                            icon={isFullscreen ? <FaCompress /> : <FaExpand />} onClick={toggleFullscreen} 
                            isRound size={btnSize} aria-label="Fullscreen" 
                            bg={neumorphBg}  border="none" color={useColorModeValue('gray.600', 'gray.300')}
                        />
                    </Tooltip>
                )}
                <Tooltip label={showMarkers ? "Ẩn các địa điểm" : "Hiện các địa điểm"} placement="right" hasArrow>
                    <IconButton 
                        icon={showMarkers ? <FaMapMarkerAlt color="#E53E3E"/> : <FaEyeSlash color="gray"/>} onClick={() => setShowMarkers(!showMarkers)} 
                        isRound size={btnSize} aria-label="Toggle Markers" 
                        bg={neumorphBg}  border="none"
                    />
                </Tooltip>
                
                {isMobile && (
                <Tooltip label="Tạo kèo" placement="right" hasArrow>
                    <IconButton
                        icon={<FaPlus />} 
                        size="lg" isRound 
                        onClick={onMatchOpen} aria-label="Tạo kèo" 
                        bg={neumorphBg} color="blue.500"  border="none"
                    />
                </Tooltip>
                )}
                
                <Box position="relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} pb={2} pr={2}>
                    <Box w={isMobile ? "55px" : "50px"} h={isMobile ? "55px" : "50px"} borderRadius="full"  overflow="hidden" cursor="pointer" bg={neumorphBg} transition="all 0.3s" transform={isHovered ? "scale(1.05)" : "scale(1)"} border="4px solid" borderColor={neumorphBg}>
                        <Image src={getSmartThumbnail(activeLayer)} w="100%" h="100%" objectFit="cover" fallbackSrc="https://placehold.co/64?text=Map" borderRadius="full"/>
                    </Box>
                    
                    {isHovered && layers.length > 0 && (
                        <HStack position="absolute" left={isMobile ? "65px" : "60px"} bottom="0" bg={neumorphBg} p={2} borderRadius="xl" boxShadow={neumorphShadow} spacing={2} className="animate__animated animate__fadeInLeft" zIndex={1001} align="end">
                            {layers.map(layer => (
                                <VStack key={layer.id} spacing={1} cursor="pointer" onClick={() => onChangeLayer(layer)} role="group">
                                    <Box w="60px" h="45px" borderRadius="lg" overflow="hidden" boxShadow={activeLayer?.id === layer.id ? neumorphActiveShadow : neumorphShadow} position="relative" transition="0.2s" border="2px solid" borderColor={neumorphBg}>
                                        <Image src={getSmartThumbnail(layer)} w="100%" h="100%" objectFit="cover" />
                                        {activeLayer?.id === layer.id && <Icon as={FaCheckCircle} color="blue.500" position="absolute" top={1} right={1} bg="white" borderRadius="full" boxSize={3}/>}
                                    </Box>
                                    <Text fontSize="9px" fontWeight="bold" color={activeLayer?.id === layer.id ? "blue.500" : useColorModeValue("gray.600", "gray.300")} noOfLines={1} maxW="60px">{layer.name}</Text>
                                </VStack>
                            ))}
                        </HStack>
                    )}
                </Box>
            </VStack>
        </Box>
    );
};

// ==========================================
// 3. MAIN COMPONENT: USER PAGE
// ==========================================
export default function UserPage() {
    const [allFacilities, setAllFacilities] = useState([]);
    const [top5Facilities, setTop5Facilities] = useState([]); 
    const [matches, setMatches] = useState([]);
    const [wards, setWards] = useState([]);
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(true);
    
    // Map States
    const [mapLayers, setMapLayers] = useState([]);
    const [activeLayer, setActiveLayer] = useState(null); 
    const [showMarkers, setShowMarkers] = useState(true); 
    const [realHeatPoints, setRealHeatPoints] = useState([]);

    const [userLoc, setUserLoc] = useState(null);
    const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user')));
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');
    const [selectedWard, setSelectedWard] = useState('');
    const [priceRange, setPriceRange] = useState(1000000);
    const [showMatches, setShowMatches] = useState(false);
    const [isHeatmap, setIsHeatmap] = useState(false); 
    const [iconUrlMap, setIconUrlMap] = useState({});
    const [searchRadius, setSearchRadius] = useState(5);
    const [wardShape, setWardShape] = useState(null);
    const [wardBounds, setWardBounds] = useState(null);
    const [routeCoords, setRouteCoords] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null);
    const [travelMode, setTravelMode] = useState('driving'); 
    const [activeRouteTarget, setActiveRouteTarget] = useState(null);
    const [selectedFacility, setSelectedFacility] = useState(null);
    const [selectedCourt, setSelectedCourt] = useState(null);
    const [flyToPosition, setFlyToPosition] = useState(null);
    
    const isMobile = useBreakpointValue({ base: true, lg: false });
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [activeTab, setActiveTab] = useState("explore"); 
    const { isOpen: isListDrawerOpen, onOpen: onListDrawerOpen, onClose: onListDrawerClose } = useDisclosure(); 
    
    const [viewingUser, setViewingUser] = useState(null); 
    const [matchToEdit, setMatchToEdit] = useState(null);

    const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();
    const { isOpen: isBookingOpen, onOpen: onBookingOpen, onClose: onBookingClose } = useDisclosure();
    const { isOpen: isMatchOpen, onOpen: onMatchOpen, onClose: onMatchClose } = useDisclosure();
    const { isOpen: isProfileOpen, onOpen: onProfileOpen, onClose: onProfileClose } = useDisclosure();
    const { isOpen: isTicketOpen, onOpen: onTicketOpen, onClose: onTicketClose } = useDisclosure();
    const { isOpen: isPublicProfileOpen, onOpen: onPublicProfileOpen, onClose: onPublicProfileClose } = useDisclosure(); 
    const { isOpen: isFavOpen, onOpen: onFavOpen, onClose: onFavClose } = useDisclosure();

    const navigate = useNavigate();
    const toast = useToast();
    const { colorMode, toggleColorMode } = useColorMode();
    
    // 🔥 BẢNG MÀU NEUMORPHISM (XÁM NHẠT HOẶC ĐEN NHẠT)
    const neumorphBg = useColorModeValue('#edf2f7', '#2d3748');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '4px 4px 10px #1a202c, -4px -4px 10px #4a5568');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #1a202c, inset -4px -4px 8px #4a5568');
    
    const textColor = useColorModeValue('gray.700', 'white');
    const bottomNavIconColor = useColorModeValue('gray.500', 'gray.400');
    const bottomNavActiveColor = useColorModeValue('blue.500', 'blue.300');
    const accentColor = useColorModeValue('blue.500', 'blue.300');

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => { const loc = [pos.coords.latitude, pos.coords.longitude]; setUserLoc(loc); setFlyToPosition(loc); },
                (err) => console.error("GPS Error:", err)
            );
        }
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const localUser = JSON.parse(localStorage.getItem('user'));
            const facSearchUrl = `http://localhost:5000/api/user/facilities-search${localUser ? '?user_id=' + localUser.id : ''}`;
            
            const [facRes, typesRes, matchRes, wardRes, configRes, layersRes, top5Res, heatRes] = await Promise.all([
                axios.get(facSearchUrl),
                axios.get('http://localhost:5000/api/sport-types'),
                axios.get('http://localhost:5000/api/matches'),
                axios.get('http://localhost:5000/api/locations/wards'),
                axios.get('http://localhost:5000/api/config'),
                axios.get('http://localhost:5000/api/map/layers').catch(() => ({ data: [] })),
                axios.get('http://localhost:5000/api/facilities/top-suggestions').catch(() => ({ data: [] })),
                axios.get('http://localhost:5000/api/map/real-heatmap').catch(() => ({ data: [] }))
            ]);
            
            setAllFacilities(facRes.data || []);
            setTop5Facilities(top5Res.data || []);
            setMatches(matchRes.data || []);
            setWards(wardRes.data || []);
            setConfig(configRes.data || {});
            setRealHeatPoints(heatRes.data || []);

            if (layersRes.data) {
                const activeLayers = layersRes.data.filter(l => l.active) || [];
                setMapLayers(activeLayers);
                if (activeLayers.length > 0) setActiveLayer(activeLayers[0]);
            }
            
            const map = {}; 
            typesRes.data.forEach(t => map[t.code] = t.icon_url); 
            setIconUrlMap(map);

        } catch (e) { console.error("Load Data Error:", e); }
        finally { setLoading(false); }
    };
    useEffect(() => { loadData(); }, []);

    // Handlers
    const handleMatchCreated = () => { loadData(); setShowMatches(true); };
    const handleAvatarUpdate = (newUrl) => { setCurrentUser(prev => ({ ...prev, avatar: newUrl })); loadData(); };
    const handleViewProfile = (user) => { setViewingUser(user); onPublicProfileOpen(); };
    const handleDeleteMatch = async (matchId) => { if (!window.confirm("Xóa kèo này?")) return; try { await axios.delete(`http://localhost:5000/api/matches/${matchId}`, { data: { user_id: currentUser.id } }); toast({ title: 'Đã xóa kèo!', status: 'success' }); loadData(); } catch (e) { toast({ title: 'Lỗi', status: 'error' }); } };
    const handleKickUser = async (matchId, userIdToKick) => { if (!window.confirm("Đuổi người này?")) return; try { await axios.delete(`http://localhost:5000/api/matches/${matchId}/kick/${userIdToKick}`, { data: { host_id: currentUser.id } }); toast({ title: 'Đã đuổi!', status: 'success' }); loadData(); } catch (e) { toast({ title: 'Lỗi', status: 'error' }); } };
    const handleLockMatch = async (matchId, currentStatus) => { const newStatus = currentStatus === 'locked' ? 'open' : 'locked'; try { await axios.put(`http://localhost:5000/api/matches/${matchId}/lock`, { user_id: currentUser.id, status: newStatus }); toast({ title: newStatus === 'locked' ? 'Đã khóa kèo' : 'Đã mở kèo', status: 'success' }); loadData(); } catch (e) { toast({ title: 'Lỗi', status: 'error' }); } };
    const handleJoinMatch = async (matchId) => { const user = JSON.parse(localStorage.getItem('user')); if (!user) { if(window.confirm('Cần đăng nhập. Đi tới đăng nhập?')) navigate('/login'); return; } try { await axios.post('http://localhost:5000/api/matches/join', { match_id: matchId, user_id: user.id }); toast({ title: 'Tham gia thành công!', status: 'success' }); loadData(); } catch (error) { toast({ title: 'Lỗi', description: error.response?.data?.message, status: 'error' }); } };
    const handleSelectWard = async (wardId) => { setSelectedWard(wardId); setSearchRadius(''); if(!wardId) { setWardShape(null); setWardBounds(null); loadData(); return; } try { const res = await axios.get(`http://localhost:5000/api/courts/by-ward/${wardId}`); setAllFacilities(res.data.courts || []); setWardShape(res.data.shape); setWardBounds(res.data.bounds); toast({ title: `Đã lọc: ${res.data.courts.length} địa điểm`, status: 'success' }); } catch (e) { toast({ title: "Lỗi", status: 'error' }); } };
    const handleFindNearby = async () => { if(!userLoc) return toast({ title: "Vui lòng bật GPS!", status: 'warning' }); setSelectedWard(''); setWardShape(null); setWardBounds(null); try { const res = await axios.get(`http://localhost:5000/api/courts/nearby`, { params: { lat: userLoc[0], lng: userLoc[1], distance: searchRadius * 1000 } }); const mapped = res.data.map(c => ({ ...c, lat: c.geometry?.coordinates[1] || c.lat, lng: c.geometry?.coordinates[0] || c.lng, sports: c.sports || [] })); setAllFacilities(mapped); setFlyToPosition(userLoc); toast({ title: `Tìm thấy ${mapped.length} địa điểm gần bạn!`, status: 'success' }); } catch (e) { console.error(e); } };
    
    const handleDrawRoute = async (target, mode = null) => { 
        const selectedMode = mode || travelMode; 
        if (!userLoc) return toast({ title: 'Hãy bật định vị (GPS) trước!', status: 'warning', position: 'top' }); 
        
        if (isMobile) { onListDrawerClose(); if (onDetailClose) onDetailClose(); } 
        else { if (onDetailClose) onDetailClose(); } 
        
        setActiveRouteTarget(target); 
        let targetLat, targetLng; 
        if(target.lat && target.lng) { 
            targetLat = target.lat; targetLng = target.lng; 
        } else { 
            const pos = getCourtLatLng(target); 
            if(pos) { targetLat = pos.lat; targetLng = pos.lng; } 
        } 
        if(!targetLat || !targetLng) return toast({ title: 'Địa điểm lỗi tọa độ', status: 'error' }); 

        const url = `https://router.project-osrm.org/route/v1/driving/${userLoc[1]},${userLoc[0]};${targetLng},${targetLat}?overview=full&geometries=geojson`; 
        
        try { 
            const res = await axios.get(url); 
            if (res.data.routes && res.data.routes.length > 0) { 
                const route = res.data.routes[0]; 
                const distanceKm = (route.distance / 1000).toFixed(2); 
                const distNum = parseFloat(distanceKm);
                
                let speed = 30; 
                if (selectedMode === 'motorcycle') speed = 40;
                if (selectedMode === 'cycling') speed = 15;
                if (selectedMode === 'walking') speed = 5;

                if (selectedMode !== 'walking') {
                    if (distNum > 5) speed *= 1.2;
                    if (distNum < 2) speed *= 0.8;
                    const hour = new Date().getHours();
                    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
                        if (selectedMode === 'driving') speed *= 0.6;
                        if (selectedMode === 'motorcycle') speed *= 0.8; 
                        if (selectedMode === 'cycling') speed *= 0.9;
                    }
                }

                let durationMinutes = (distNum / speed) * 60;
                const minTime = Math.max(1, Math.floor(durationMinutes * 0.9)); 
                const maxTime = Math.max(1, Math.ceil(durationMinutes * 1.2));
                const timeDisplay = minTime === maxTime ? `${minTime} phút` : `${minTime} - ${maxTime} phút`;
                
                setRouteCoords(route.geometry.coordinates.map(c => [c[1], c[0]])); 
                setRouteInfo({ distance: distanceKm, durationText: timeDisplay }); 
                setTravelMode(selectedMode); 
                
                const modeNames = { 'driving': 'Ô tô', 'motorcycle': 'Xe máy', 'cycling': 'Xe đạp', 'walking': 'Đi bộ' };
                toast({ title: `Chỉ đường bằng ${modeNames[selectedMode]}`, description: `${distanceKm} km - Khoảng ${timeDisplay}`, status: 'info', position: 'top' }); 
            } 
        } catch (err) { toast({ title: 'Lỗi tìm đường', status: 'error' }); } 
    };
    const handleClearRoute = () => { setRouteCoords(null); setRouteInfo(null); setActiveRouteTarget(null); };
    
    const handleFacilityClick = async (fac) => { 
        setSelectedFacility(fac); 
        if (fac.lat && fac.lng) { setFlyToPosition([fac.lat, fac.lng]); }
        onDetailOpen(); 

        try {
            await axios.post(`http://localhost:5000/api/facilities/${fac.id}/view`);
            setAllFacilities(prev => prev.map(f => f.id === fac.id ? { ...f, view_count: (f.view_count || 0) + 1 } : f));
        } catch (error) {}
    };
    
    const handleBookCourt = (court) => { const user = localStorage.getItem('user'); if (!user) { if(window.confirm('Bạn cần đăng nhập để đặt sân. Đi tới đăng nhập?')) navigate('/login'); return; } setSelectedCourt(court); onBookingOpen(); };

    const dynamicMarkerIcon = useMemo(() => {
        let iconUrl = config.marker_icon_url ? getImgUrl(config.marker_icon_url) : 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png';
        let borderColor = '#3182CE'; 

        let activeSportCode = filterType; 

        if (!activeSportCode && searchTerm.trim().length >= 2) {
            const normalizedSearch = removeVietnameseTones(searchTerm);
            const foundCode = Object.keys(iconUrlMap).find(code => {
                const keywords = getSportKeywords(code); 
                return keywords.includes(normalizedSearch) || 
                       (normalizedSearch.includes('bong da') && code === 'football') ||
                       (normalizedSearch.includes('da banh') && code === 'football') ||
                       (normalizedSearch.includes('cau long') && code === 'badminton') ||
                       (normalizedSearch.includes('tennis') && code === 'tennis') ||
                       (normalizedSearch.includes('quan vot') && code === 'tennis') ||
                       (normalizedSearch.includes('bong ro') && code === 'basketball') ||
                       (normalizedSearch.includes('boi') && code === 'swimming') ||
                       (normalizedSearch.includes('gym') && code === 'gym') ||
                       (normalizedSearch.includes('bida') && code === 'billiard') ||
                       (normalizedSearch.includes('bi a') && code === 'billiard');
            });
            if (foundCode) activeSportCode = foundCode; 
        }

        if (activeSportCode && iconUrlMap[activeSportCode]) {
            iconUrl = getImgUrl(iconUrlMap[activeSportCode]);
            borderColor = '#3182CE'; 
        }

        return L.divIcon({
            className: 'custom-tacke-marker',
            html: `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; transform: translateY(-5px);">
                    <div style="
                        background-color: white; 
                        width: 36px; height: 36px; 
                        border-radius: 50%; 
                        border: 3px solid ${borderColor}; 
                        box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                        display: flex; align-items: center; justify-content: center;
                        overflow: hidden;
                        transition: all 0.3s ease;
                    ">
                        <img src="${iconUrl}" style="width: 22px; height: 22px; object-fit: contain;" onerror="this.src='https://placehold.co/22x22?text=S'" />
                    </div>
                    <div style="
                        width: 0; height: 0; 
                        border-left: 6px solid transparent;
                        border-right: 6px solid transparent;
                        border-top: 8px solid ${borderColor};
                        margin-top: -1px;
                    "></div>
                </div>
            `,
            iconSize: [36, 46], iconAnchor: [18, 46], popupAnchor: [0, -40]
        });
    }, [config.marker_icon_url, filterType, searchTerm, iconUrlMap]);


    const filteredItems = useMemo(() => {
        if (showMatches) return matches;
        const normalizedSearch = removeVietnameseTones(searchTerm);
        let filtered = allFacilities.filter(fac => {
            const matchType = filterType === '' ? true : (fac.sports && Array.isArray(fac.sports) && fac.sports.includes(filterType));
            const matchPrice = parseInt(fac.min_price || 0) <= priceRange;
            let matchSearch = true;
            if (normalizedSearch) {
                const name = removeVietnameseTones(fac.name || '');
                const address = removeVietnameseTones(fac.address || '');
                const facilitySports = fac.sports || [];
                const sportKeywords = facilitySports.map(code => { const k = getSportKeywords(code); const r = removeVietnameseTones(code); return `${k} ${r}`; }).join(' ');
                matchSearch = name.includes(normalizedSearch) || address.includes(normalizedSearch) || sportKeywords.includes(normalizedSearch);
            }
            return matchType && matchPrice && matchSearch;
        });
        if (userLoc) { 
            filtered = filtered.map(f => ({ ...f, calculated_distance: calculateDistance(userLoc[0], userLoc[1], f.lat, f.lng) })).sort((a, b) => (parseFloat(a.calculated_distance) || 999) - (parseFloat(b.calculated_distance) || 999)); 
        }
        return filtered;
    }, [searchTerm, filterType, priceRange, allFacilities, matches, showMatches, userLoc]);

    const top5WithDistance = useMemo(() => { 
        if (showMatches) return []; 
        let mapped = [...top5Facilities];
        if (userLoc) mapped = mapped.map(f => ({ ...f, calculated_distance: calculateDistance(userLoc[0], userLoc[1], f.lat, f.lng) }));
        return mapped;
    }, [top5Facilities, userLoc, showMatches]);

    return (
        <Flex h={{ base: "100dvh", lg: "100vh" }} w="100vw" direction="column" overflow="hidden" className="notranslate" translate="no" bg={neumorphBg}>
            <style>{customStyles}</style>

            {/* 🔥 Gắn thanh seach ngang ở đầu màn hình (Có màu nền + Đổ bóng) */}
            {isMobile ? (
                <Box 
                    position="absolute" top="0" left="0" w="100%" zIndex={1200} 
                    px={4} pt={4} pb={4} 
                    bg={neumorphBg} 
                    borderBottomRadius="3xl"
                    boxShadow={neumorphShadow}
                    pointerEvents={isListDrawerOpen ? "none" : "auto"} 
                    opacity={isListDrawerOpen ? 0 : 1} 
                    transition="opacity 0.2s"
                >
                    <HStack spacing={3} w="100%">
                        {config.logo_url && (
                            <Flex borderRadius="full" w="48px" h="48px" align="center" justify="center" flexShrink={0} boxShadow={neumorphShadow} bg={neumorphBg}>
                                <Image src={getImgUrl(config.logo_url)} maxH="100%" maxW="100%" objectFit="cover" borderRadius="full" p={1}/>
                            </Flex>
                        )} 
                        
                        <InputGroup boxShadow={neumorphActiveShadow} bg={neumorphBg} borderRadius="full" overflow="hidden" size="lg" flex={1} border="none">
                            <InputLeftElement pointerEvents="none"><Icon as={FaSearch} color="gray.500" /></InputLeftElement>
                            <Input 
                                placeholder="Tìm sân, môn thể thao..." value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)}  
                                fontWeight="500" fontSize="sm" color={textColor}
                                
                                borderRadius="full" bg={neumorphBg} border="none" 
                                boxShadow={neumorphActiveShadow}
                                _focus={{ boxShadow: neumorphActiveShadow }}
                            />
                        </InputGroup>
                        
                        {/* NÚT CHUÔNG VÀ ĐỔI THEME CHUNG 1 CỤM */}
                        <HStack spacing={1} align="center" bg={neumorphBg} p={1} borderRadius="2xl" boxShadow={neumorphShadow}>
                            <NotificationBell/>
                            <IconButton 
                                icon={colorMode === 'light' ? <FaMoon /> : <FaSun />} 
                                boxShadow={neumorphActiveShadow}
                                isRound variant="ghost" size="md" onClick={toggleColorMode} 
                                border="none" color={useColorModeValue('gray.600', 'gray.300')}
                            />
                        </HStack>
                    </HStack>

                    {/* Quick Filters lơ lửng phong cách Neumorphism */}
                    <HStack mt={4} overflowX="auto" className="hide-scrollbar" sx={{ scrollbarWidth: "none" }} pb={2} spacing={3} px={1}>
                        <Button 
                            size="sm" borderRadius="full" flexShrink={0}
                            color={filterType === '' ? "blue.500" : useColorModeValue('gray.600', 'gray.300')} 
                            bg={neumorphBg} 
                            boxShadow={filterType === '' ? neumorphActiveShadow : neumorphShadow}
                            onClick={() => setFilterType('')}
                            border="none"
                        >
                            Tất cả
                        </Button>
                        {Object.keys(iconUrlMap).map(type => (
                            <Button 
                                key={type} size="sm" borderRadius="full" flexShrink={0}
                                color={filterType === type ? "orange.500" : useColorModeValue('gray.600', 'gray.300')} 
                                bg={neumorphBg} 
                                boxShadow={filterType === type ? neumorphActiveShadow : neumorphShadow}
                                onClick={() => setFilterType(type)}
                                textTransform="capitalize" border="none"
                                leftIcon={iconUrlMap[type] ? <Image src={getImgUrl(iconUrlMap[type])} boxSize="14px" ignoreFallback /> : null}
                            >
                                {type}
                            </Button>
                        ))}
                    </HStack>
                </Box>
            ) : (
                <Flex h="64px" bg={neumorphBg}  align="center" px={6} justify="space-between" zIndex={1200} borderBottom="none">
                    <HStack spacing={4}>
                        <IconButton icon={<FaBars />} boxShadow={neumorphShadow} _hover={{ boxShadow: neumorphActiveShadow }} transition="all 0.2s" _active={{ boxShadow: neumorphActiveShadow }} variant="ghost" onClick={() => setSidebarOpen(!isSidebarOpen)} />
                        {config.logo_url && (
    <Box
      p={1.5}
      borderRadius="full"
      bg={neumorphBg}
      boxShadow={neumorphShadow}
      _hover={{ boxShadow: neumorphActiveShadow }}
      _active={{ boxShadow: neumorphActiveShadow }}
      transition="all 0.2s"
      cursor="pointer"
    >
      <Image
        src={getImgUrl(config.logo_url)}
        boxSize={{ base: "30px", md: "40px" }}
        objectFit="cover"
        borderRadius="full"
        fallbackSrc="https://placehold.co/40?text=Logo"
      />
    </Box>
  )}
                        <Text fontWeight="900" borderRadius="full"   fontSize="lg" color="blue.500">{config.website_name || 'Sport Booking'}</Text>
                    </HStack>
                    <HStack spacing={2}>
                        {currentUser && <Button leftIcon={<FaTicketAlt />} size="sm" boxShadow={neumorphShadow} _hover={{ boxShadow: neumorphActiveShadow }} transition="all 0.2s" _active={{ boxShadow: neumorphActiveShadow }} variant="ghost" onClick={onTicketOpen}>Vé của tôi</Button>}
                        <NotificationBell />
                        {currentUser && <Tooltip label="Sân Yêu Thích"><IconButton icon={<FaHeart />} boxShadow={neumorphShadow} _active={{ boxShadow: neumorphActiveShadow }} _hover={{ boxShadow: neumorphActiveShadow }} transition="all 0.2s" colorScheme="red" variant="ghost" isRound onClick={onFavOpen} aria-label="Favorites"/></Tooltip>}
                        <IconButton icon={colorMode === 'light' ? <FaMoon /> : <FaSun />} _active={{ boxShadow: neumorphActiveShadow }} _hover={{ boxShadow: neumorphActiveShadow }} transition="all 0.2s" boxShadow={neumorphShadow} isRound variant="ghost" onClick={toggleColorMode} />
                        <HStack spacing={3}>
  {currentUser ? (
    // ✅ AVATAR
    <Box
      p={1}
      borderRadius="full"
      bg={neumorphBg}
      boxShadow={neumorphShadow}
      _hover={{ boxShadow: neumorphActiveShadow }}
      _active={{ boxShadow: neumorphActiveShadow }}
      transition="all 0.2s"
      cursor="pointer"
      onClick={onProfileOpen}
    >
      <Avatar
        size="sm"
        src={getImgUrl(currentUser?.avatar)}
        name={currentUser.full_name || "User"}
      />
    </Box>
  ) : (
    // ✅ LOGIN BUTTON
    <Box
      borderRadius="xl"
      bg={neumorphBg}
      boxShadow={neumorphShadow}
      _hover={{ boxShadow: neumorphActiveShadow }}
      _active={{ boxShadow: neumorphActiveShadow }}
      transition="all 0.2s"
    >
      <Button
        size="sm"
        variant="ghost"
        colorScheme='blue'
        onClick={() => navigate('/login')}
      >
        Đăng nhập
      </Button>
    </Box>
  )}
</HStack>
                    </HStack>
                </Flex>
            )}

            <Flex flex={1} position="relative" overflow="hidden" pb={{ base: "80px", lg: "0" }}>
                
                {/* Danh sách Desktop */}
                {!isMobile && (
                    <SidebarList 
                        isMobile={false} isSidebarOpen={isSidebarOpen} headerBg={neumorphBg}
                        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                        showMatches={showMatches} setShowMatches={setShowMatches}
                        iconUrlMap={iconUrlMap} filterType={filterType} setFilterType={setFilterType}
                        filteredItems={filteredItems} handleFacilityClick={handleFacilityClick}
                        setFlyToPosition={setFlyToPosition} onCreateMatchOpen={onMatchOpen}
                        wards={wards} selectedWard={selectedWard} handleSelectWard={handleSelectWard}
                        searchRadius={searchRadius} setSearchRadius={setSearchRadius} handleFindNearby={handleFindNearby}
                        priceRange={priceRange} setPriceRange={setPriceRange}
                        isHeatmap={isHeatmap} setIsHeatmap={setIsHeatmap} 
                        top5={top5WithDistance}
                        handleJoinMatch={handleJoinMatch} handleDrawRoute={handleDrawRoute}
                        handleViewProfile={handleViewProfile} currentUser={currentUser}
                        handleDeleteMatch={handleDeleteMatch} handleKickUser={handleKickUser}
                        handleLockMatch={handleLockMatch} getImgUrl={getImgUrl} handleEditMatch={setMatchToEdit}
                    />
                )}

                {/* BẢN ĐỒ FULL MÀN HÌNH */}
                <Box flex={1} position="relative" zIndex={0} >
                    {loading && (
                        <Box position="absolute" inset={0} zIndex={1001} bg="blackAlpha.200" display="flex" alignItems="center" justifyContent="center">
                            <Skeleton height="100px" w="300px" borderRadius="xl" shadow="2xl"/>
                        </Box>
                    )}
                    
                    {routeInfo && (
                        <Box position="absolute" top={isMobile ? "140px" : "10px"} left="50%" transform="translateX(-50%)" zIndex={1000} bg={neumorphBg} px={4} py={2} borderRadius="xl" boxShadow={neumorphShadow} border="none" minW="280px">
                            <VStack spacing={2}>
                                <HStack spacing={4} justify="center">
                                    <IconButton aria-label="Ô tô" icon={<FaCar/>} isRound size="sm" color={travelMode==='driving'?'blue.500':'gray.500'} bg={neumorphBg} boxShadow={travelMode==='driving'?neumorphActiveShadow:neumorphShadow} onClick={()=>handleDrawRoute(activeRouteTarget, 'driving')}/>
                                    <IconButton aria-label="Xe máy" icon={<FaMotorcycle/>} isRound size="sm" color={travelMode==='motorcycle'?'blue.500':'gray.500'} bg={neumorphBg} boxShadow={travelMode==='motorcycle'?neumorphActiveShadow:neumorphShadow} onClick={()=>handleDrawRoute(activeRouteTarget, 'motorcycle')}/>
                                    <IconButton aria-label="Xe đạp" icon={<FaBicycle/>} isRound size="sm" color={travelMode==='cycling'?'blue.500':'gray.500'} bg={neumorphBg} boxShadow={travelMode==='cycling'?neumorphActiveShadow:neumorphShadow} onClick={()=>handleDrawRoute(activeRouteTarget, 'cycling')}/>
                                    <IconButton aria-label="Đi bộ" icon={<FaWalking/>} isRound size="sm" color={travelMode==='walking'?'blue.500':'gray.500'} bg={neumorphBg} boxShadow={travelMode==='walking'?neumorphActiveShadow:neumorphShadow} onClick={()=>handleDrawRoute(activeRouteTarget, 'walking')}/>
                                    <IconButton aria-label="Đóng" icon={<FaTimes/>} size="sm" isRound color="red.500" bg={neumorphBg} boxShadow={neumorphShadow} onClick={handleClearRoute}/>
                                </HStack>
                                <Divider borderColor={useColorModeValue("gray.300", "gray.600")}/>
                                <Text fontWeight="800" fontSize="lg" color="blue.500" textAlign="center">
                                    {routeInfo.distance} km • ~ {routeInfo.durationText}
                                </Text>
                            </VStack>
                        </Box>
                    )}

                    <MapContainer 
                        center={[10.7769, 106.7009]} zoom={13} maxZoom={20} 
                        style={{ height: "100%", width: "100%" }} zoomControl={false}
                        preferCanvas={true} zoomAnimation={true} fadeAnimation={true} markerZoomAnimation={false} 
                        tap={true} touchZoom={true} bounceAtZoomLimits={true} 
                    >
                        {!isMobile && <ZoomControl position="topright" />}

                        {showMarkers && (
                            <MapComponent 
                                items={filteredItems} showMatches={showMatches} userLoc={userLoc} 
                                flyToPosition={flyToPosition} onMarkerClick={handleFacilityClick} 
                                routeCoords={routeCoords} wardShape={wardShape} wardBounds={wardBounds}
                                customIcon={dynamicMarkerIcon} 
                                onDrawRoute={handleDrawRoute}
                            />
                        )}

                        {activeLayer ? <TileLayer url={activeLayer.url} attribution={activeLayer.attribution} /> : <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />}
                        
                        <Box display={isHeatmap && realHeatPoints.length > 0 ? "block" : "none"}>
                            <HeatmapLayer points={realHeatPoints} />
                        </Box>
                        
                        {mapLayers.length > 0 && (
                            <MapControlGroup layers={mapLayers} activeLayer={activeLayer} onChangeLayer={setActiveLayer} showMarkers={showMarkers} setShowMarkers={setShowMarkers} onMatchOpen={onMatchOpen} />
                        )}
                    </MapContainer>
                </Box>

            </Flex>

            {/* 🔥 DRAWER DANH SÁCH (Mobile) */}
            {isMobile && (
                <Drawer placement="bottom" onClose={onListDrawerClose} isOpen={isListDrawerOpen}>
                    <DrawerOverlay backdropFilter="blur(2px)"/>
                    <DrawerContent h="80vh" borderTopRadius="3xl" bg={neumorphBg} boxShadow={neumorphShadow} overflow="hidden" pb={20}>
                        <Box w="50px" h="6px" bg={useColorModeValue('gray.300', 'gray.600')} borderRadius="full" mx="auto" mt={3} mb={1} />
                        <DrawerBody p={0} className="hide-scrollbar" position="relative">
                            <SidebarList 
                                isMobile={true} isSidebarOpen={true} headerBg={neumorphBg}
                                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                                showMatches={showMatches} setShowMatches={setShowMatches}
                                iconUrlMap={iconUrlMap} filterType={filterType} setFilterType={setFilterType}
                                filteredItems={filteredItems} handleFacilityClick={handleFacilityClick}
                                setFlyToPosition={(pos) => { setFlyToPosition(pos); onListDrawerClose(); }} 
                                onCreateMatchOpen={onMatchOpen}
                                wards={wards} selectedWard={selectedWard} handleSelectWard={handleSelectWard}
                                searchRadius={searchRadius} setSearchRadius={setSearchRadius} handleFindNearby={handleFindNearby}
                                priceRange={priceRange} setPriceRange={setPriceRange}
                                isHeatmap={isHeatmap} setIsHeatmap={setIsHeatmap} top5={top5WithDistance}
                                handleJoinMatch={handleJoinMatch} handleDrawRoute={(tgt, md) => { handleDrawRoute(tgt, md); onListDrawerClose(); }}
                                handleViewProfile={handleViewProfile} currentUser={currentUser}
                                handleDeleteMatch={handleDeleteMatch} handleKickUser={handleKickUser}
                                handleLockMatch={handleLockMatch} getImgUrl={getImgUrl} handleEditMatch={setMatchToEdit}
                            />
                        </DrawerBody>
                    </DrawerContent>
                </Drawer>
            )}

            {/* 🔥 BOTTOM NAVIGATION GỒM 5 NÚT (NÚT GIỮA NỔI LÊN) */}
            {isMobile && (
                <Flex 
                    h="75px" w="100%" position="fixed" bottom={0} zIndex={1400} 
                    bg={neumorphBg} borderTopRadius="3xl" boxShadow="0 -10px 20px rgba(0,0,0,0.05)"
                    justify="space-around" align="center" pb="env(safe-area-inset-bottom)" px={2}
                >
                    {/* 1. KHÁM PHÁ (BẢN ĐỒ) */}
                    <VStack spacing={1} flex={1} cursor="pointer" onClick={() => { setActiveTab('explore'); onListDrawerClose(); }}>
                        <Box p={2.5} borderRadius="xl" bg={neumorphBg} boxShadow={activeTab === 'explore' && !isListDrawerOpen ? neumorphActiveShadow : neumorphShadow} transition="all 0.2s">
                            <Icon as={FaMapMarkedAlt} boxSize={5} color={activeTab === 'explore' && !isListDrawerOpen ? accentColor : bottomNavIconColor}/>
                        </Box>
                        <Text fontSize="9px" fontWeight="900" color={activeTab === 'explore' && !isListDrawerOpen ? accentColor : bottomNavIconColor}>Bản đồ</Text>
                    </VStack>

                    {/* 2. DANH SÁCH */}
                    <VStack spacing={1} flex={1} cursor="pointer" onClick={() => { setActiveTab('explore'); onListDrawerOpen(); }}>
                        <Box p={2.5} borderRadius="xl" bg={neumorphBg} boxShadow={isListDrawerOpen ? neumorphActiveShadow : neumorphShadow} transition="all 0.2s">
                            <Icon as={FaList} boxSize={5} color={isListDrawerOpen ? accentColor : bottomNavIconColor}/>
                        </Box>
                        <Text fontSize="9px" fontWeight="900" color={isListDrawerOpen ? accentColor : bottomNavIconColor}>Danh sách</Text>
                    </VStack>

                    {/* 3. VÉ ĐẶT (NÚT TRUNG TÂM NỔI LÊN) */}
                    <Box flex={1} position="relative" display="flex" justifyContent="center">
                        <Box 
                            position="absolute" top="-40px" p={2} borderRadius="full" bg={neumorphBg} 
                            boxShadow={neumorphShadow}
                        >
                            <Flex
                                w="55px" h="55px"
                                bg={neumorphBg}
                                color={activeTab === 'tickets' ? "white" : accentColor}
                                bgGradient={activeTab === 'tickets' ? "linear(to-br, blue.400, blue.600)" : "none"}
                                borderRadius="full"
                                justify="center" align="center"
                                boxShadow={activeTab === 'tickets' ? neumorphActiveShadow : neumorphShadow}
                                cursor="pointer"
                                onClick={() => { setActiveTab('tickets'); currentUser ? onTicketOpen() : navigate('/login'); }}
                                transition="all 0.3s"
                                _active={{ transform: 'scale(0.9)', boxShadow: neumorphActiveShadow }}
                            >
                                <Icon as={FaTicketAlt} boxSize={6} />
                            </Flex>
                        </Box>
                        <Text mt="25px" fontSize="9px" fontWeight="900" color={activeTab === 'tickets' ? accentColor : bottomNavIconColor}>Vé đặt</Text>
                    </Box>

                    {/* 4. ĐÃ LƯU */}
                    <VStack spacing={1} flex={1} cursor="pointer" onClick={() => { setActiveTab('favorites'); currentUser ? onFavOpen() : navigate('/login'); }}>
                        <Box p={2.5} borderRadius="xl" bg={neumorphBg} boxShadow={activeTab === 'favorites' ? neumorphActiveShadow : neumorphShadow} transition="all 0.2s">
                            <Icon as={FaHeart} boxSize={5} color={activeTab === 'favorites' ? accentColor : bottomNavIconColor}/>
                        </Box>
                        <Text fontSize="9px" fontWeight="900" color={activeTab === 'favorites' ? accentColor : bottomNavIconColor}>Đã lưu</Text>
                    </VStack>

                    {/* 5. TÀI KHOẢN */}
                    <VStack spacing={1} flex={1} cursor="pointer" onClick={() => { setActiveTab('profile'); currentUser ? onProfileOpen() : navigate('/login'); }}>
                        <Box p={1} borderRadius="full" bg={neumorphBg} boxShadow={activeTab === 'profile' ? neumorphActiveShadow : neumorphShadow} transition="all 0.2s">
                            {currentUser ? <Avatar size="sm" src={getImgUrl(currentUser?.avatar)} name={currentUser.full_name} border="none"/> : <Icon as={FaUser} boxSize={5} m={1.5} color={bottomNavIconColor}/>}
                        </Box>
                        <Text fontSize="9px" fontWeight="900" color={activeTab === 'profile' ? accentColor : bottomNavIconColor}>{currentUser ? 'Tài khoản' : 'Đăng nhập'}</Text>
                    </VStack>

                </Flex>
            )}  
                
      
            {/* --- MODALS --- */}
            <FacilityDetailModal isOpen={isDetailOpen} onClose={onDetailClose} facility={selectedFacility} onBookCourt={handleBookCourt} onDrawRoute={(fac) => handleDrawRoute(fac, 'driving')}/>
            <CreateMatchModal isOpen={isMatchOpen} onClose={() => { onMatchClose(); setMatchToEdit(null); }} facilities={allFacilities} onMatchCreated={handleMatchCreated} editMatch={matchToEdit} />
            <UserProfileDrawer isOpen={isProfileOpen} onClose={() => { onProfileClose(); setActiveTab('explore'); }} onOpenTickets={()=>{onProfileClose(); onTicketOpen();}} onAvatarUpdate={handleAvatarUpdate} />
            <PublicProfileModal isOpen={isPublicProfileOpen} onClose={onPublicProfileClose} user={viewingUser} />
            {selectedCourt && (<BookingModal court={selectedCourt} isOpen={isBookingOpen} onClose={onBookingClose}/>)}
            <MyTicketsModal isOpen={isTicketOpen} onClose={() => { onTicketClose(); setActiveTab('explore'); }}/>
            <FavoriteFacilitiesModal isOpen={isFavOpen} onClose={() => { onFavClose(); setActiveTab('explore'); }} onSelectFacility={handleFacilityClick} />
        </Flex>
    );
}