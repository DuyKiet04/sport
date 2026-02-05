import React, { useState, useEffect, useMemo } from 'react';
import { 
    Flex, useDisclosure, useBreakpointValue, HStack, Text, IconButton, Avatar, VStack, Icon, Button, 
    useColorMode, useColorModeValue, useToast, Box, Image, Divider
} from '@chakra-ui/react';

// 🔥 IMPORT ĐẦY ĐỦ ICONS (Không thiếu cái nào nữa)
import { 
    FaBars, FaMoon, FaSun, FaTicketAlt, FaUser, FaMap, FaList, FaTimes, 
    FaCar, FaWalking, FaBicycle, FaExpand, FaCompress, FaSearch, FaFilter, 
    FaGlobe, FaFire, FaHandshake, FaPlus, FaTrophy
} from 'react-icons/fa';
import { BiCurrentLocation, BiMapAlt } from 'react-icons/bi';

import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, LayersControl, LayerGroup, useMap, Polyline, Marker, Popup } from 'react-leaflet'; 
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Import Components Con
import SidebarList from './components/UserPage/SidebarList';
import MapComponent from './components/UserPage/MapComponent';
import FacilityDetailModal from './components/UserPage/FacilityDetailModal';
import CreateMatchModal from './components/UserPage/CreateMatchModal';
import UserProfileDrawer from './components/UserPage/UserProfileDrawer';
import BookingModal from './BookingModal';
import MyTicketsModal from './MyTickets';
import HeatmapLayer from './HeatmapLayer'; 
import PublicProfileModal from './components/UserPage/PublicProfileModal'; 

// --- CẤU HÌNH ---
const MAP_LAYERS = {
    osm: { name: "🌐 Đường phố", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '&copy; OSM' },
    googleSatellite: { name: "🛰️ Vệ tinh", url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", attribution: '&copy; Google' },
    cartoDark: { name: "🌙 Chế độ Tối", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attribution: '&copy; CartoDB' }
};

const getImgUrl = (url) => { if (!url) return ''; if (url.includes('via.placeholder.com')) return 'https://placehold.co/300x200?text=No+Image'; if (url.startsWith('http')) return url; const cleanPath = url.startsWith('/') ? url.substring(1) : url; return `http://localhost:5000/${cleanPath}`; };
const removeVietnameseTones = (str) => { if (!str) return ''; str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, ""); str = str.replace(/đ/g, "d").replace(/Đ/g, "D"); return str.toLowerCase().trim(); };
const getSportKeywords = (sportCode) => { if (!sportCode) return ''; const code = removeVietnameseTones(sportCode); const map = { 'football': 'bong da da banh san co nhan tao soccer', 'badminton': 'cau long vot cau', 'tennis': 'quan vot tennis', 'basketball': 'bong ro', 'swimming': 'bo loi ho boi', 'gym': 'gym the hinh yoga', 'billiard': 'bida bi a', 'bong da': 'bong da da banh football soccer', 'da banh': 'bong da da banh football', 'cau long': 'cau long badminton', 'quan vot': 'tennis quan vot' }; return map[code] || code; };
const parsePostGISPoint = (hex) => { if (!hex || typeof hex !== 'string' || hex.length < 40) return null; try { const buffer = new Uint8Array(hex.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16))).buffer; const view = new DataView(buffer); const isLittleEndian = view.getUint8(0) === 1; const lng = view.getFloat64(9, isLittleEndian); const lat = view.getFloat64(17, isLittleEndian); return { lat, lng }; } catch (e) { return null; } };
const getCourtLatLng = (court) => { if (court.geometry?.coordinates) return { lat: court.geometry.coordinates[1], lng: court.geometry.coordinates[0] }; if (court.location) return parsePostGISPoint(court.location); return null; };
const calculateDistance = (lat1, lon1, lat2, lon2) => { if (!lat1 || !lon1 || !lat2 || !lon2) return 99999; const R = 6371; const dLat = (lat2 - lat1) * (Math.PI / 180); const dLon = (lon2 - lon1) * (Math.PI / 180); const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return R * c; };

const FullscreenControl = () => { const map = useMap(); const [isFullscreen, setIsFullscreen] = useState(false); const toggleFullscreen = () => { if (!document.fullscreenElement) { document.documentElement.requestFullscreen().then(() => { setIsFullscreen(true); setTimeout(() => map.invalidateSize(), 100); }).catch(err => console.log(err)); } else { document.exitFullscreen().then(() => { setIsFullscreen(false); setTimeout(() => map.invalidateSize(), 100); }); } }; useEffect(() => { const handleChange = () => setIsFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', handleChange); return () => document.removeEventListener('fullscreenchange', handleChange); }, []); return ( <Box position="absolute" bottom="30px" right="20px" zIndex={2000}> <IconButton icon={isFullscreen ? <FaCompress size="20"/> : <FaExpand size="20"/>} onClick={toggleFullscreen} colorScheme="blue" isRound size="lg" shadow="dark-lg" aria-label="Fullscreen" _hover={{ transform: 'scale(1.1)' }} /> </Box> ); };

// --- MAIN COMPONENT ---
export default function UserPage() {
    const [allFacilities, setAllFacilities] = useState([]);
    const [matches, setMatches] = useState([]);
    const [wards, setWards] = useState([]);
    const [config, setConfig] = useState({});
    
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
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [mobileViewMode, setMobileViewMode] = useState('map');
    const [viewingUser, setViewingUser] = useState(null); 

    const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();
    const { isOpen: isBookingOpen, onOpen: onBookingOpen, onClose: onBookingClose } = useDisclosure();
    const { isOpen: isMatchOpen, onOpen: onMatchOpen, onClose: onMatchClose } = useDisclosure();
    const { isOpen: isProfileOpen, onOpen: onProfileOpen, onClose: onProfileClose } = useDisclosure();
    const { isOpen: isTicketOpen, onOpen: onTicketOpen, onClose: onTicketClose } = useDisclosure();
    const { isOpen: isPublicProfileOpen, onOpen: onPublicProfileOpen, onClose: onPublicProfileClose } = useDisclosure(); 

    const navigate = useNavigate();
    const toast = useToast();
    const { colorMode, toggleColorMode } = useColorMode();
    const isMobile = useBreakpointValue({ base: true, lg: false });
    const headerBg = useColorModeValue('white', 'gray.800');

    useEffect(() => { if (navigator.geolocation) { navigator.geolocation.getCurrentPosition( (pos) => { const loc = [pos.coords.latitude, pos.coords.longitude]; setUserLoc(loc); setFlyToPosition(loc); }, (err) => console.error("GPS Error:", err) ); } }, []);

    const loadData = async () => {
        try {
            const [facRes, typesRes, matchRes, wardRes, configRes] = await Promise.all([
                axios.get('http://localhost:5000/api/user/facilities-search'),
                axios.get('http://localhost:5000/api/sport-types'),
                axios.get('http://localhost:5000/api/matches'),
                axios.get('http://localhost:5000/api/locations/wards'),
                axios.get('http://localhost:5000/api/config')
            ]);
            setAllFacilities(facRes.data || []);
            const map = {}; typesRes.data.forEach(t => map[t.code] = t.icon_url); setIconUrlMap(map);
            setMatches(matchRes.data || []);
            setWards(wardRes.data || []);
            setConfig(configRes.data || {});
        } catch (e) { console.error("Load Data Error:", e); }
    };
    useEffect(() => { loadData(); }, []);

    const handleMatchCreated = () => { loadData(); setShowMatches(true); toast({ title: "Đã chuyển sang chế độ xem Kèo!", status: "info", position: "top" }); };
    const handleAvatarUpdate = (newUrl) => { setCurrentUser(prev => ({ ...prev, avatar: newUrl })); loadData(); };
    const handleViewProfile = (user) => { setViewingUser(user); onPublicProfileOpen(); };

    // --- CÁC HÀM XỬ LÝ CHỦ KÈO (HOST ACTIONS) ---
    const handleDeleteMatch = async (matchId) => {
        if (!window.confirm("Mày chắc chắn muốn xóa kèo này chứ?")) return;
        try {
            await axios.delete(`http://localhost:5000/api/matches/${matchId}`, { data: { user_id: currentUser.id } });
            toast({ title: 'Đã xóa kèo!', status: 'success' });
            loadData();
        } catch (e) { toast({ title: 'Lỗi', description: e.response?.data?.error, status: 'error' }); }
    };

    const handleKickUser = async (matchId, userIdToKick) => {
        if (!window.confirm("Đuổi thẳng cổ thằng này?")) return;
        try {
            await axios.delete(`http://localhost:5000/api/matches/${matchId}/kick/${userIdToKick}`, { data: { host_id: currentUser.id } });
            toast({ title: 'Đã đuổi người!', status: 'success' });
            loadData();
        } catch (e) { toast({ title: 'Lỗi', description: e.response?.data?.error, status: 'error' }); }
    };

    const handleLockMatch = async (matchId, currentStatus) => {
        const newStatus = currentStatus === 'locked' ? 'open' : 'locked';
        try {
            await axios.put(`http://localhost:5000/api/matches/${matchId}/lock`, { user_id: currentUser.id, status: newStatus });
            toast({ title: newStatus === 'locked' ? 'Đã khóa kèo' : 'Đã mở kèo', status: 'success' });
            loadData();
        } catch (e) { toast({ title: 'Lỗi', description: e.response?.data?.error, status: 'error' }); }
    };

    const handleJoinMatch = async (matchId) => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) { if(window.confirm('Cần đăng nhập. Đi tới đăng nhập?')) navigate('/login'); return; }
        try { await axios.post('http://localhost:5000/api/matches/join', { match_id: matchId, user_id: user.id }); toast({ title: 'Tham gia thành công!', status: 'success' }); loadData(); } catch (error) { toast({ title: 'Lỗi', description: error.response?.data?.message, status: 'error' }); }
    };

    const handleSelectWard = async (wardId) => { setSelectedWard(wardId); setSearchRadius(''); if(!wardId) { setWardShape(null); setWardBounds(null); const res = await axios.get('http://localhost:5000/api/user/facilities-search'); setAllFacilities(res.data || []); return; } try { const res = await axios.get(`http://localhost:5000/api/courts/by-ward/${wardId}`); setAllFacilities(res.data.courts || []); setWardShape(res.data.shape); setWardBounds(res.data.bounds); toast({ title: `Đã lọc: ${res.data.courts.length} địa điểm`, status: 'success' }); } catch (e) { toast({ title: "Lỗi lọc phường", status: 'error' }); } };
    const handleFindNearby = async () => { if(!userLoc) return toast({ title: "Vui lòng bật GPS!", status: 'warning' }); setSelectedWard(''); setWardShape(null); setWardBounds(null); try { const res = await axios.get(`http://localhost:5000/api/courts/nearby`, { params: { lat: userLoc[0], lng: userLoc[1], distance: searchRadius * 1000 } }); const mapped = res.data.map(c => ({ ...c, lat: c.geometry?.coordinates[1] || c.lat, lng: c.geometry?.coordinates[0] || c.lng, sports: c.sports || [] })); setAllFacilities(mapped); setFlyToPosition(userLoc); toast({ title: `Tìm thấy ${mapped.length} địa điểm gần bạn!`, status: 'success' }); } catch (e) { console.error(e); } };
    const handleDrawRoute = async (target, mode = null) => { const selectedMode = mode || travelMode; if (!userLoc) return toast({ title: 'Hãy bật định vị (GPS) trước!', status: 'warning', position: 'top' }); if (isMobile) { setMobileViewMode('map'); if (onDetailClose) onDetailClose(); } else { if (onDetailClose) onDetailClose(); } setActiveRouteTarget(target); let targetLat, targetLng; if(target.lat && target.lng) { targetLat = target.lat; targetLng = target.lng; } else { const pos = getCourtLatLng(target); if(pos) { targetLat = pos.lat; targetLng = pos.lng; } } if(!targetLat || !targetLng) return toast({ title: 'Địa điểm lỗi tọa độ', status: 'error' }); const url = `https://router.project-osrm.org/route/v1/driving/${userLoc[1]},${userLoc[0]};${targetLng},${targetLat}?overview=full&geometries=geojson`; try { const res = await axios.get(url); if (res.data.routes && res.data.routes.length > 0) { const route = res.data.routes[0]; const distanceMeters = route.distance; const distanceKm = (distanceMeters / 1000).toFixed(2); let durationMinutes = 0; if (selectedMode === 'driving') durationMinutes = route.duration / 60; else if (selectedMode === 'cycling') durationMinutes = distanceMeters / 250; else if (selectedMode === 'walking') durationMinutes = distanceMeters / 83; setRouteCoords(route.geometry.coordinates.map(c => [c[1], c[0]])); setRouteInfo({ distance: distanceKm, duration: durationMinutes.toFixed(0) }); setTravelMode(selectedMode); toast({ title: `Đã tìm đường`, description: `${distanceKm} km - ${durationMinutes.toFixed(0)} phút`, status: 'success', position: 'top' }); } } catch (err) { toast({ title: 'Lỗi tìm đường', status: 'error' }); } };
    const handleClearRoute = () => { setRouteCoords(null); setRouteInfo(null); setActiveRouteTarget(null); };
    const handleFacilityClick = (fac) => { setSelectedFacility(fac); setFlyToPosition([fac.lat, fac.lng]); onDetailOpen(); };
    const handleBookCourt = (court) => { const user = localStorage.getItem('user'); if (!user) { if(window.confirm('Bạn cần đăng nhập để đặt sân. Đi tới đăng nhập?')) navigate('/login'); return; } setSelectedCourt(court); onBookingOpen(); };

    const filteredItems = useMemo(() => { if (showMatches) return matches; const normalizedSearch = removeVietnameseTones(searchTerm); let filtered = allFacilities.filter(fac => { const matchType = filterType === '' ? true : (fac.sports && Array.isArray(fac.sports) && fac.sports.includes(filterType)); const matchPrice = parseInt(fac.min_price || 0) <= priceRange; let matchSearch = true; if (normalizedSearch) { const name = removeVietnameseTones(fac.name || ''); const address = removeVietnameseTones(fac.address || ''); const facilitySports = fac.sports || []; const sportKeywords = facilitySports.map(code => { const k = getSportKeywords(code); const r = removeVietnameseTones(code); return `${k} ${r}`; }).join(' '); matchSearch = name.includes(normalizedSearch) || address.includes(normalizedSearch) || sportKeywords.includes(normalizedSearch); } return matchType && matchPrice && matchSearch; }); if (userLoc) { filtered = filtered.map(f => ({ ...f, calculated_distance: calculateDistance(userLoc[0], userLoc[1], f.lat, f.lng) })).sort((a, b) => a.calculated_distance - b.calculated_distance); } return filtered; }, [searchTerm, filterType, priceRange, allFacilities, matches, showMatches, userLoc]);
    const top5Recommendations = useMemo(() => { if (!userLoc || showMatches) return []; return [...filteredItems].sort((a, b) => ((parseFloat(a.avg_rating||0)*2)-(a.calculated_distance||99)*0.5) - ((parseFloat(b.avg_rating||0)*2)-(b.calculated_distance||99)*0.5)).slice(0,5); }, [filteredItems, userLoc, showMatches]);

    return (
        <Flex h="100vh" w="100vw" direction="column" overflow="hidden" className="notranslate" translate="no">
            <Flex h="64px" bg={headerBg} shadow="sm" align="center" px={4} justify="space-between" zIndex={2000} borderBottom="1px solid" borderColor="gray.200">
                <HStack>
                    {!isMobile && <IconButton icon={<FaBars />} variant="ghost" onClick={() => setSidebarOpen(!isSidebarOpen)} />}
                    {config.logo_url && <Image src={getImgUrl(config.logo_url)} h="40px" objectFit="contain" mr={2} fallbackSrc="https://placehold.co/40?text=Logo"/>}
                    <Text fontWeight="900" fontSize="lg" bgGradient="linear(to-r, blue.500, teal.400)" bgClip="text">{config.website_name || 'Sport Booking'}</Text>
                </HStack>
                <HStack>
                    {!isMobile && <Button leftIcon={<FaTicketAlt />} size="sm" variant="ghost" onClick={onTicketOpen}>Vé của tôi</Button>}
                    <IconButton icon={colorMode === 'light' ? <FaMoon /> : <FaSun />} isRound variant="ghost" onClick={toggleColorMode} />
                    <Avatar size="sm" src={getImgUrl(currentUser?.avatar)} cursor="pointer" onClick={onProfileOpen} />
                </HStack>
            </Flex>

            <Flex flex={1} position="relative" overflow="hidden">
                {(!isMobile || mobileViewMode === 'list') && (
                    <SidebarList 
                        isMobile={isMobile} isSidebarOpen={isSidebarOpen} headerBg={headerBg}
                        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                        showMatches={showMatches} setShowMatches={setShowMatches}
                        iconUrlMap={iconUrlMap} filterType={filterType} setFilterType={setFilterType}
                        filteredItems={filteredItems} handleFacilityClick={handleFacilityClick}
                        setFlyToPosition={setFlyToPosition} onCreateMatchOpen={onMatchOpen}
                        wards={wards} selectedWard={selectedWard} handleSelectWard={handleSelectWard}
                        searchRadius={searchRadius} setSearchRadius={setSearchRadius} handleFindNearby={handleFindNearby}
                        priceRange={priceRange} setPriceRange={setPriceRange}
                        isHeatmap={isHeatmap} setIsHeatmap={setIsHeatmap} 
                        top5={top5Recommendations}
                        handleJoinMatch={handleJoinMatch} 
                        handleDrawRoute={handleDrawRoute}
                        handleViewProfile={handleViewProfile}
                        // 🔥 TRUYỀN THÊM CÁC HÀM QUYỀN LỰC XUỐNG SIDEBAR
                        currentUser={currentUser}
                        handleDeleteMatch={handleDeleteMatch}
                        handleKickUser={handleKickUser}
                        handleLockMatch={handleLockMatch}
                    />
                )}

                {(!isMobile || mobileViewMode === 'map') && (
                    <Box flex={1} position="relative" zIndex={0}>
                        {routeInfo && (
                            <Box position="absolute" top={4} left="50%" transform="translateX(-50%)" zIndex={1000} bg="white" px={4} py={2} borderRadius="xl" shadow="dark-lg" border="1px solid" borderColor="blue.500" minW="280px">
                                <VStack spacing={2}>
                                    <HStack spacing={4} justify="center">
                                        <IconButton icon={<FaCar/>} isRound size="sm" colorScheme={travelMode==='driving'?'blue':'gray'} onClick={()=>handleDrawRoute(activeRouteTarget, 'driving')}/>
                                        <IconButton icon={<FaBicycle/>} isRound size="sm" colorScheme={travelMode==='cycling'?'blue':'gray'} onClick={()=>handleDrawRoute(activeRouteTarget, 'cycling')}/>
                                        <IconButton icon={<FaWalking/>} isRound size="sm" colorScheme={travelMode==='walking'?'blue':'gray'} onClick={()=>handleDrawRoute(activeRouteTarget, 'walking')}/>
                                        <IconButton icon={<FaTimes/>} size="sm" isRound colorScheme="red" variant="ghost" onClick={handleClearRoute}/>
                                    </HStack>
                                    <Divider/>
                                    <Text fontWeight="800" fontSize="lg" color="blue.600" textAlign="center">{routeInfo.distance} km - {routeInfo.duration} phút</Text>
                                    <Text fontSize="xs" color="gray.500" textAlign="center">({travelMode==='driving'?'Ô tô':travelMode==='cycling'?'Xe đạp':'Đi bộ'})</Text>
                                </VStack>
                            </Box>
                        )}

                        <MapContainer center={[10.7769, 106.7009]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                            <FullscreenControl />
                            <LayersControl position="topright">
                                <LayersControl.BaseLayer checked name={MAP_LAYERS.osm.name}><TileLayer url={MAP_LAYERS.osm.url} attribution={MAP_LAYERS.osm.attribution}/></LayersControl.BaseLayer>
                                <LayersControl.BaseLayer name={MAP_LAYERS.googleSatellite.name}><TileLayer url={MAP_LAYERS.googleSatellite.url} attribution={MAP_LAYERS.googleSatellite.attribution}/></LayersControl.BaseLayer>
                                <LayersControl.BaseLayer name={MAP_LAYERS.cartoDark.name}><TileLayer url={MAP_LAYERS.cartoDark.url} attribution={MAP_LAYERS.cartoDark.attribution}/></LayersControl.BaseLayer>
                                <LayersControl.Overlay checked name="📍 Địa điểm thể thao">
                                    <LayerGroup>
                                        <MapComponent items={filteredItems} showMatches={showMatches} userLoc={userLoc} flyToPosition={flyToPosition} onMarkerClick={handleFacilityClick} routeCoords={routeCoords} wardShape={wardShape} wardBounds={wardBounds}/>
                                    </LayerGroup>
                                </LayersControl.Overlay>
                            </LayersControl>
                            {isHeatmap && (<HeatmapLayer points={allFacilities.map(f => [parseFloat(f.lat || f.geometry?.coordinates[1] || 0), parseFloat(f.lng || f.geometry?.coordinates[0] || 0), 1]).filter(p => p[0] !== 0 && p[1] !== 0)} />)}
                        </MapContainer>
                    </Box>
                )}
            </Flex>

            <FacilityDetailModal isOpen={isDetailOpen} onClose={onDetailClose} facility={selectedFacility} onBookCourt={handleBookCourt} onDrawRoute={(fac) => handleDrawRoute(fac, 'driving')}/>
            <CreateMatchModal isOpen={isMatchOpen} onClose={onMatchClose} facilities={allFacilities} onMatchCreated={handleMatchCreated}/>
            <UserProfileDrawer isOpen={isProfileOpen} onClose={onProfileClose} onOpenTickets={()=>{onProfileClose(); onTicketOpen();}} onAvatarUpdate={handleAvatarUpdate} />
            <PublicProfileModal isOpen={isPublicProfileOpen} onClose={onPublicProfileClose} user={viewingUser} />
            {selectedCourt && (<BookingModal court={selectedCourt} isOpen={isBookingOpen} onClose={onBookingClose}/>)}
            <MyTicketsModal isOpen={isTicketOpen} onClose={onTicketClose}/>
        </Flex>
    );
}