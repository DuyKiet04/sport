import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, GeoJSON } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { 
    Box, Flex, Text, Button, IconButton, useBreakpointValue, 
    Drawer, DrawerOverlay, DrawerContent, DrawerBody, DrawerCloseButton, DrawerFooter, DrawerHeader,
    Image, Badge, VStack, HStack, useDisclosure, Input, 
    RangeSlider, RangeSliderTrack, RangeSliderFilledTrack, RangeSliderThumb,
    InputGroup, InputLeftElement, InputRightAddon, Container, Tag, Avatar,
    Card, Divider, Wrap, WrapItem, useToast, Icon, Tooltip, 
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Spinner,
    Switch, useColorMode, useColorModeValue, Select
} from '@chakra-ui/react';

// Icons
import { 
    FaSearch, FaLocationArrow, FaDirections, FaPhone, 
    FaStar, FaCheck, FaFilter, FaPaperPlane, FaChevronLeft, FaChevronRight, 
    FaTicketAlt, FaFacebook,
    FaRoute, FaTimes, FaUser, FaCamera, FaSignOutAlt, FaMoon, FaSun, FaBars, FaList, FaMap, FaClock
} from 'react-icons/fa';

import { BiCurrentLocation, BiMapAlt } from 'react-icons/bi';
import { SiZalo } from 'react-icons/si'; 
import { MdOutlineSportsSoccer } from "react-icons/md";

// 🔥 IMPORT CÁC COMPONENT ĐÃ TÁCH
import BookingModal from './BookingModal';
import MyTicketsModal from './MyTickets';

// --- HELPERS ---
const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url.substring(1) : url;
    return `http://localhost:5000/${cleanPath}`;
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

const getOperatingStatus = (openTime, closeTime) => {
    if (!openTime || !closeTime) return { status: 'Unknown', color: 'gray', text: '...' };
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);
    
    let openMinutes = openH * 60 + openM;
    let closeMinutes = closeH * 60 + closeM;
    if (closeMinutes < openMinutes) closeMinutes += 24 * 60; 

    let checkMinutes = currentMinutes;
    if (currentMinutes < openMinutes && closeMinutes > 24*60) checkMinutes += 24*60;

    if (checkMinutes < openMinutes || checkMinutes > closeMinutes) {
        return { status: 'Closed', color: 'red', text: 'Đã đóng cửa' };
    }
    if (closeMinutes - checkMinutes <= 60) {
        return { status: 'ClosingSoon', color: 'orange', text: 'Sắp đóng cửa' };
    }
    return { status: 'Open', color: 'green', text: 'Đang mở cửa' };
};

// Styles
const customStyles = `
  .hide-scrollbar::-webkit-scrollbar { display: none; }
  .custom-cluster-icon { background: none; border: none; }
  .cluster-content { width: 40px; height: 40px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: 800; border: 3px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-size: 12px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); }
  .user-pulse-marker { position: relative; width: 20px; height: 20px; }
  .user-pulse-ring { position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: #3B82F6; animation: pulse-ring 2s infinite; opacity: 0.7; }
  .user-pulse-dot { position: absolute; top: 20%; left: 20%; width: 60%; height: 60%; background-color: #2563EB; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px #2563EB; }
  @keyframes pulse-ring { 0% { transform: scale(0.33); opacity: 1; } 80%, 100% { transform: scale(2.5); opacity: 0; } }
  .leaflet-popup-content-wrapper { border-radius: 16px; overflow: hidden; padding: 0; box-shadow: 0 15px 30px rgba(0,0,0,0.2); }
  .leaflet-popup-content { margin: 0; width: 280px !important; }
  a.leaflet-popup-close-button { color: white !important; top: 10px !important; right: 10px !important; font-size: 18px !important; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
`;

const createClusterCustomIcon = (cluster) => { const count = cluster.getChildCount(); return L.divIcon({ html: `<div class="cluster-content"><span>${count}</span></div>`, className: 'custom-cluster-icon', iconSize: L.point(40, 40, true) }); };
const createCircleMarker = (iconUrl, type) => {
    const validUrl = iconUrl && !iconUrl.includes('placeholder') ? iconUrl : null;
    const innerHtml = validUrl ? `<img src="${validUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.style.display='none';this.parentElement.style.backgroundColor='#E2E8F0';">` : `<div style="width:100%;height:100%;background:#F7FAFC;display:flex;align-items:center;justify-content:center;color:#CBD5E0;"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="16px" width="16px" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path></svg></div>`;
    return L.divIcon({ className: 'user-marker', html: `<div style="width:44px;height:44px;background:white;border-radius:50%;border:3px solid #10B981;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;">${innerHtml}</div>`, iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -25] });
};
const userPulseIcon = L.divIcon({ className: 'user-marker-container', html: `<div class="user-pulse-marker"><div class="user-pulse-ring"></div><div class="user-pulse-dot"></div></div>`, iconSize: [20, 20], iconAnchor: [10, 10] });
const openGoogleMaps = (lat, lng) => window.open(`http://maps.google.com/maps?q=${lat},${lng}`, '_blank');

// Sub-components
const MapController = ({ center, courts, userLoc, colorMode, flyToPosition, wardBounds }) => {
    const map = useMap();
    useEffect(() => {
        map.eachLayer((layer) => { if (layer instanceof L.TileLayer) map.removeLayer(layer); });
        const tileUrl = colorMode === 'dark' ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'; 
        L.tileLayer(tileUrl, { attribution: '© OpenStreetMap & CartoDB' }).addTo(map);
    }, [colorMode, map]);
    
    useEffect(() => { if (userLoc) map.flyTo(userLoc, 14, { duration: 2 }); }, [userLoc, map]);
    useEffect(() => { if (flyToPosition) map.flyTo(flyToPosition, 16, { duration: 1.5 }); }, [flyToPosition, map]);

    // 🔥 TỰ ĐỘNG ZOOM VÀO PHƯỜNG XÃ KHI CHỌN (Phần nâng cấp duy nhất)
    useEffect(() => {
        if (wardBounds) {
            const geoJsonLayer = L.geoJSON(wardBounds);
            const bounds = geoJsonLayer.getBounds();
            if (bounds.isValid()) {
                map.flyToBounds(bounds, { padding: [20, 20], maxZoom: 15, duration: 1.5 });
            }
        }
    }, [wardBounds, map]);

    return null;
};

const StarRating = ({ rating, count, size = 3 }) => (<HStack spacing={1} align="center"><Flex>{[...Array(5)].map((_, i) => (<Icon key={i} as={FaStar} color={i < Math.round(parseFloat(rating)||0) ? "#F59E0B" : "gray.300"} w={size} h={size} />))}</Flex>{count !== undefined && <Text fontSize="xs" color="gray.500" ml={1}>({count})</Text>}</HStack>);

const CourtCard = ({ court, onClick, onDrawRoute, isHorizontal = false }) => {
    const [imgError, setImgError] = useState(false);
    const validImg = court.image_url && !court.image_url.includes('placeholder') ? court.image_url : null;
    const bg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.100', 'gray.700');
    const opStatus = getOperatingStatus(court.open_time || '06:00', court.close_time || '22:00');

    return (
        <Card onClick={onClick} cursor="pointer" overflow="hidden" variant="outline" borderColor={borderColor} shadow="sm" _hover={{ shadow: 'lg', transform: 'translateY(-2px)', borderColor: 'green.300' }} transition="all 0.2s ease" bg={bg} w={isHorizontal ? "300px" : "100%"} borderRadius="xl" mb={isHorizontal ? 0 : 3} mr={isHorizontal ? 3 : 0} flexShrink={0}>
            <Flex direction={isHorizontal ? "row" : "column"} h="100%">
                <Box w={isHorizontal ? "110px" : "100%"} h={isHorizontal ? "100%" : "150px"} position="relative" bg="gray.100">
                    {!imgError && validImg ? <Image src={validImg} w="100%" h="100%" objectFit="cover" onError={() => setImgError(true)} /> : <Flex w="100%" h="100%" align="center" justify="center" flexDirection="column"><Icon as={MdOutlineSportsSoccer} boxSize={8} color="gray.400"/></Flex>}
                    <Badge position="absolute" top={2} left={2} bg="rgba(0,0,0,0.7)" color="white" px={2} fontSize="9px" borderRadius="md" textTransform="uppercase">{court.type}</Badge>
                </Box>
                <VStack p={3} align="stretch" justify="space-between" flex={1} spacing={1} w="100%">
                    <Box>
                        <Text fontWeight="bold" fontSize="sm" noOfLines={1} mb={1}>{court.name}</Text>
                        <StarRating rating={court.avg_rating} count={court.review_count} size={3} />
                        <HStack mt={1} spacing={2}>
                            <Avatar size="xs" src={getImgUrl(court.owner_avatar)} name={court.owner_name} border="1px solid white"/>
                            <Text fontSize="xs" color="gray.500" noOfLines={1}>{court.owner_name}</Text>
                        </HStack>
                    </Box>
                    <Flex justify="space-between" align="center" mt={2}>
                        <VStack align="start" spacing={0}>
                            <Text fontWeight="800" color="green.500" fontSize="sm">{parseInt(court.price_per_hour || 0).toLocaleString()}đ</Text>
                            <Text fontSize="9px" fontWeight="bold" color={`${opStatus.color}.500`}>{opStatus.text}</Text>
                        </VStack>
                        <HStack spacing={1}>
                            <IconButton size="xs" icon={<FaRoute/>} isRound colorScheme="orange" variant="ghost" onClick={(e)=>{e.stopPropagation(); onDrawRoute(court);}}/>
                            <Button size="xs" colorScheme="green" onClick={(e)=>{e.stopPropagation(); onClick();}} fontSize="10px" h="24px" px={3} borderRadius="full">ĐẶT</Button>
                        </HStack>
                    </Flex>
                </VStack>
            </Flex>
        </Card>
    );
};

const UserProfileDrawer = ({ isOpen, onClose, onOpenTickets }) => {
    const { colorMode, toggleColorMode } = useColorMode();
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || {});
    const [uploading, setUploading] = useState(false);
    const toast = useToast();
    const navigate = useNavigate();
    const fileInputRef = useRef();
    const handleUpload = async (e) => { const file = e.target.files[0]; if(!file) return; setUploading(true); const fd = new FormData(); fd.append('image', file); try { const res = await axios.post('http://localhost:5000/api/upload', fd); await axios.put(`http://localhost:5000/api/users/${user.id}/avatar`, {avatar_url: res.data.url}); const newUser = {...user, avatar: res.data.url}; localStorage.setItem('user', JSON.stringify(newUser)); setUser(newUser); toast({title:'Đổi ảnh thành công', status:'success'}); } catch(e){ toast({title:'Lỗi upload', status:'error'}); } finally { setUploading(false); } };
    return (
        <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="xs"><DrawerOverlay /><DrawerContent><DrawerCloseButton /><DrawerHeader>Hồ sơ cá nhân</DrawerHeader><DrawerBody><VStack spacing={6} mt={4}><Box position="relative"><Avatar size="2xl" src={getImgUrl(user.avatar)} name={user.name} border="4px solid" borderColor="green.400" />{uploading?<Spinner position="absolute" bottom={0} right={0}/>:<IconButton icon={<FaCamera/>} isRound size="sm" colorScheme="blue" position="absolute" bottom={0} right={0} onClick={()=>fileInputRef.current.click()}/>}<input type="file" ref={fileInputRef} style={{display:'none'}} accept="image/*" onChange={handleUpload}/></Box><VStack spacing={0}><Text fontWeight="bold" fontSize="xl">{user.name}</Text><Badge colorScheme={user.role==='vendor'?'purple':'green'}>{user.role}</Badge></VStack><Divider/><VStack w="100%" spacing={3}><Button w="100%" leftIcon={<FaTicketAlt/>} justifyContent="flex-start" variant="ghost" onClick={onOpenTickets}>Quản lý vé đặt</Button><HStack w="100%" justify="space-between" px={4}><HStack><Icon as={colorMode==='light'?FaSun:FaMoon}/><Text>Chế độ tối</Text></HStack><Switch isChecked={colorMode==='dark'} onChange={toggleColorMode} colorScheme="green"/></HStack></VStack></VStack></DrawerBody><DrawerFooter><Button w="100%" colorScheme="red" leftIcon={<FaSignOutAlt/>} onClick={()=>{localStorage.clear(); navigate('/login'); onClose();}}>Đăng xuất</Button></DrawerFooter></DrawerContent></Drawer>
    );
};

const DetailContent = ({ court, reviews, newRating, setNewRating, newComment, setNewComment, handleSubmitReview, submittingReview, onDrawRoute }) => {
    const gallery = useMemo(() => {
        if (court.images && court.images.length > 0) return court.images;
        if (court.image_url) return [court.image_url];
        return [];
    }, [court]);

    const [currentSlide, setCurrentSlide] = useState(0);
    const [imgError, setImgError] = useState(false);
    const bg = useColorModeValue('white', 'gray.800');
    const opStatus = getOperatingStatus(court.open_time || '06:00', court.close_time || '22:00');
    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % gallery.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + gallery.length) % gallery.length);

    return (
        <>
            <Box position="relative" h="280px" w="100%" bg="gray.100" overflow="hidden">
                {gallery.length > 0 ? (
                    <Image key={currentSlide} src={getImgUrl(gallery[currentSlide])} h="100%" w="100%" objectFit="cover" transition="all 0.3s" onError={() => setImgError(true)} />
                ) : (
                    <Flex h="100%" w="100%" align="center" justify="center" flexDirection="column" color="gray.400"><Icon as={MdOutlineSportsSoccer} boxSize={12} /><Text>Không có hình ảnh</Text></Flex>
                )}
                <Box position="absolute" top={0} left={0} right={0} height="80px" bgGradient="linear(to-b, blackAlpha.700, transparent)" />
                <Badge position="absolute" top={4} left={4} colorScheme="blue" px={3} py={1} borderRadius="lg" fontSize="sm" shadow="lg" backdropFilter="blur(5px)">{court.type}</Badge>
                {gallery.length > 1 && <Badge position="absolute" bottom={4} right={4} bg="blackAlpha.700" color="white" px={2} py={1} borderRadius="full" fontSize="xs">{currentSlide + 1} / {gallery.length}</Badge>}
                {gallery.length > 1 && <><IconButton icon={<FaChevronLeft />} isRound size="sm" position="absolute" top="50%" left={2} transform="translateY(-50%)" bg="blackAlpha.400" color="white" _hover={{ bg: "blackAlpha.700" }} onClick={prevSlide} zIndex={2}/><IconButton icon={<FaChevronRight />} isRound size="sm" position="absolute" top="50%" right={2} transform="translateY(-50%)" bg="blackAlpha.400" color="white" _hover={{ bg: "blackAlpha.700" }} onClick={nextSlide} zIndex={2}/></>}
            </Box>

            <Container px={0} mt={-6} position="relative" zIndex={2}>
                <Box bg={bg} borderRadius="2xl" p={5} shadow="xl" mx={4}>
                    <HStack justify="space-between" align="start"><Box flex={1}><Text fontSize="2xl" fontWeight="900" lineHeight="1.1">{court.name}</Text><Box mt={1}><StarRating rating={court.avg_rating} count={court.review_count} size={4} /></Box></Box><VStack align="end" spacing={0}><Text fontSize="xs" color="gray.500">Giá từ</Text><Text fontSize="xl" color="green.600" fontWeight="900">{parseInt(court.price_per_hour || 0).toLocaleString()}đ</Text></VStack></HStack>
                    <Divider my={4}/>
                    <HStack align="start" spacing={3} mb={2}><Icon as={FaLocationArrow} color="red.500" mt={1}/><Text fontWeight="medium" fontSize="sm" color="gray.600">{court.address}</Text></HStack>
                    <HStack spacing={4} mb={4}><HStack><Icon as={FaClock} color="gray.400"/><Text fontSize="sm">{court.open_time || '06:00'} - {court.close_time || '22:00'}</Text></HStack><Badge colorScheme={opStatus.color} variant="solid" borderRadius="full">{opStatus.text}</Badge></HStack>
                    <Box bg={useColorModeValue('blue.50', 'whiteAlpha.100')} p={3} borderRadius="lg" mb={4}><HStack><Avatar src={getImgUrl(court.owner_avatar)} name={court.owner_name} border="2px solid white"/><Box flex={1}><Text fontWeight="bold" fontSize="sm">{court.owner_name}</Text><Text fontSize="xs" color="gray.500">Chủ sân</Text></Box><HStack>{court.phone_number && <IconButton icon={<FaPhone/>} isRound size="sm" colorScheme="green" as="a" href={`tel:${court.phone_number}`}/>}{court.zalo_url && <IconButton icon={<SiZalo/>} isRound size="sm" colorScheme="blue" as="a" href={court.zalo_url} target="_blank"/>}{court.facebook_url && <IconButton icon={<FaFacebook/>} isRound size="sm" colorScheme="facebook" as="a" href={court.facebook_url} target="_blank"/>}</HStack></HStack></Box>
                    <HStack mb={4}><Button flex={1} size="sm" leftIcon={<FaRoute />} colorScheme="orange" onClick={() => onDrawRoute(court)}>Dẫn đường</Button><Button flex={1} size="sm" leftIcon={<FaDirections/>} variant="outline" colorScheme="blue" onClick={() => openGoogleMaps(court.geometry.coordinates[1], court.geometry.coordinates[0])}>Google Maps</Button></HStack>
                    <Text fontWeight="bold" mb={3} fontSize="sm" textTransform="uppercase" color="gray.500" letterSpacing="wide">Tiện ích</Text><Wrap spacing={2} mb={5}>{court.amenities ? court.amenities.split(',').map((am,i) => (<WrapItem key={i}><Tag size="md" colorScheme="teal" borderRadius="full" variant="subtle"><Icon as={FaCheck} mr={1} boxSize={3}/>{am}</Tag></WrapItem>)) : <Text color="gray.500" fontSize="sm">Chưa cập nhật</Text>}</Wrap>
                </Box>
                
                <Box bg={useColorModeValue('white', 'gray.900')} borderRadius="2xl" p={5} mt={4} shadow="md" mx={4} mb={6}>
                    <Text fontWeight="bold" mb={3} fontSize="md">Đánh giá & Bình luận</Text>
                    <VStack align="start" spacing={2} mb={4} w="100%">
                        <Text fontSize="xs" fontWeight="bold" color="gray.500">Đánh giá của bạn:</Text>
                        <HStack spacing={1}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Icon key={star} as={FaStar} boxSize={6} color={star <= newRating ? "#F59E0B" : "gray.300"} cursor="pointer" onClick={() => setNewRating(star)} transition="color 0.2s" _hover={{ transform: 'scale(1.1)' }}/>
                            ))}
                            <Text fontSize="sm" color="gray.500" ml={2} fontWeight="bold">({newRating} sao)</Text>
                        </HStack>
                        <HStack w="100%">
                            <Input placeholder="Viết cảm nhận của bạn..." value={newComment} onChange={(e) => setNewComment(e.target.value)} bg={useColorModeValue('gray.50', 'gray.800')} borderRadius="full"/>
                            <IconButton icon={<FaPaperPlane />} colorScheme="blue" isRound onClick={handleSubmitReview} isLoading={submittingReview} />
                        </HStack>
                    </VStack>
                    <VStack align="stretch" spacing={4}>
                        {reviews.length === 0 ? <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>Chưa có đánh giá nào.</Text> : reviews.map(r => (
                            <Box key={r.id}><HStack align="start" spacing={3}><Avatar size="sm" src={getImgUrl(r.avatar_url)} name={r.full_name} /><Box flex={1}><HStack justify="space-between"><Text fontWeight="bold" fontSize="sm">{r.full_name}</Text><Text fontSize="xs" color="gray.500">{new Date(r.created_at).toLocaleDateString()}</Text></HStack><StarRating rating={r.rating} size={2}/><Text fontSize="sm" mt={1} color="gray.600">{r.comment}</Text></Box></HStack></Box>
                        ))}
                    </VStack>
                </Box>
            </Container>
        </>
    );
};

// --- MAIN PAGE ---
export default function UserPage() {
    const [allCourts, setAllCourts] = useState([]); 
    const [userLoc, setUserLoc] = useState(null);
    const [selectedCourt, setSelectedCourt] = useState(null); 
    const [previewCourt, setPreviewCourt] = useState(null);   
    const [iconUrlMap, setIconUrlMap] = useState({});
    const [config, setConfig] = useState({}); 

    // 🔥 STATE CHO PHƯỜNG XÃ (GEOJSON)
    const [wards, setWards] = useState([]);
    const [wardBounds, setWardBounds] = useState(null);
    const [wardShape, setWardShape] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');
    const [maxPrice, setMaxPrice] = useState(1000000);
    const [searchRadius, setSearchRadius] = useState(5000); 

    const [routeCoords, setRouteCoords] = useState(null); 
    const [routeInfo, setRouteInfo] = useState(null);
    
    // 🔥 BIẾN BỊ THIẾU ĐÃ ĐƯỢC THÊM LẠI
    const [reviews, setReviews] = useState([]);
    const [newRating, setNewRating] = useState(5);
    const [newComment, setNewComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    
    const [flyToPosition, setFlyToPosition] = useState(null); 
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [mobileViewMode, setMobileViewMode] = useState('map'); 
    
    const { isOpen: isTicketOpen, onOpen: onTicketOpen, onClose: onTicketClose } = useDisclosure(); 
    const { isOpen: isMobileFilterOpen, onOpen: onMobileFilterOpen, onClose: onMobileFilterClose } = useDisclosure(); 
    const { isOpen: isProfileOpen, onOpen: onProfileOpen, onClose: onProfileClose } = useDisclosure();
    const { isOpen: isDrawerOpen, onOpen: onDrawerOpen, onClose: onDrawerClose } = useDisclosure(); 
    const { isOpen: isBookingOpen, onOpen: onBookingOpen, onClose: onBookingClose } = useDisclosure();
    
    // 🔥 ĐÃ ĐỔI TÊN BIẾN VỀ CHUẨN CŨ (isDetailModalOpen)
    const { isOpen: isDetailModalOpen, onOpen: onDetailModalOpen, onClose: onDetailModalClose } = useDisclosure();

    const navigate = useNavigate();
    const isMobile = useBreakpointValue({ base: true, lg: false }); 
    const toast = useToast();
    const { colorMode, toggleColorMode } = useColorMode();
    const bg = useColorModeValue('#F9FAFB', 'gray.900');
    const headerBg = useColorModeValue('white', 'gray.800');
    

    useEffect(() => {
        const load = async () => {
            try {
                const [types, courts, conf, wardsRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/sport-types'), 
                    axios.get('http://localhost:5000/api/courts'),
                    axios.get('http://localhost:5000/api/config'),
                    axios.get('http://localhost:5000/api/locations/wards')
                ]);
                const map = {}; types.data.forEach(t => map[t.code] = t.icon_url); setIconUrlMap(map);
                setAllCourts(courts.data || []);
                setConfig(conf.data || {});
                setWards(wardsRes.data || []);
            } catch (e) { console.error(e); }
        };
        load();
    }, []);

    useEffect(() => { if (previewCourt) axios.get(`http://localhost:5000/api/reviews/${previewCourt.id}`).then(res => setReviews(res.data)).catch(console.error); }, [previewCourt]);

    const handleSelectWard = async (e) => {
        const wardId = e.target.value;
        if (!wardId) {
            const res = await axios.get('http://localhost:5000/api/courts');
            setAllCourts(res.data);
            setWardBounds(null); setWardShape(null);
            return;
        }
        try {
            const res = await axios.get(`http://localhost:5000/api/courts/by-ward/${wardId}`);
            setAllCourts(res.data.courts || []);
            setWardBounds(res.data.bounds);
            setWardShape(res.data.shape); // 🔥 Vẽ hình phường
            toast({ title: `Tìm thấy ${res.data.courts.length} sân`, status: 'success', position: 'top' });
        } catch (err) { toast({ title: 'Lỗi tìm kiếm', status: 'error' }); }
    };

    const filteredCourts = useMemo(() => {
        return allCourts.filter(court => {
            const matchName = (court.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (court.address || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchType = filterType === '' ? true : court.type === filterType;
            const price = Number(court.price_per_hour) || 0;
            return matchName && matchType && (price <= maxPrice);
        }).sort((a, b) => (parseFloat(b.avg_rating) || 0) - (parseFloat(a.avg_rating) || 0));
    }, [searchTerm, filterType, maxPrice, allCourts]);

    const handleFindNearby = () => {
        if (!navigator.geolocation) return alert("Vui lòng bật GPS!");
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const lat = pos.coords.latitude; const lng = pos.coords.longitude;
            setUserLoc([lat, lng]); 
            try {
                const res = await axios.get(`http://localhost:5000/api/courts/nearby`, { params: { lat, lng, distance: searchRadius } });
                setAllCourts(res.data || []);
                toast({ title: 'Đã tìm thấy sân!', description: `Có ${res.data.length} sân trong bán kính ${searchRadius/1000}km`, status: 'success', position: 'top' });
            } catch (err) { toast({ title: 'Lỗi tìm kiếm', status: 'error' }); }
        });
    };

    const handleDrawRoute = async (court) => {
        if (!userLoc) return toast({ title: 'Hãy bật định vị (GPS) trước!', status: 'warning', position: 'top' });
        if (isMobile) onDrawerClose(); else onDetailModalClose();
        
        let targetLat, targetLng;
        if(court.geometry && court.geometry.coordinates) {
            targetLat = court.geometry.coordinates[1];
            targetLng = court.geometry.coordinates[0];
        } else if (court.location) {
            const parsed = parsePostGISPoint(court.location);
            if(parsed) { targetLat = parsed.lat; targetLng = parsed.lng; }
        }

        if(!targetLat || !targetLng) return toast({ title: 'Sân này chưa có tọa độ', status: 'error' });

        try {
            const res = await axios.get(`https://router.project-osrm.org/route/v1/driving/${userLoc[1]},${userLoc[0]};${targetLng},${targetLat}?overview=full&geometries=geojson`);
            if (res.data.routes && res.data.routes.length > 0) {
                const route = res.data.routes[0];
                setRouteCoords(route.geometry.coordinates.map(c => [c[1], c[0]]));
                setRouteInfo({ distance: (route.distance/1000).toFixed(1), duration: (route.duration/60).toFixed(0) });
                toast({ title: 'Đang dẫn đường...', status: 'info', duration: 2000 });
            }
        } catch (err) { toast({ title: 'Không tìm thấy đường', status: 'error' }); }
    };

    const handleClearRoute = () => { setRouteCoords(null); setRouteInfo(null); };
    
    const handleCourtClick = (court) => { 
        setPreviewCourt(court); 
        let targetLat, targetLng;
        if (court.geometry && court.geometry.coordinates) {
            targetLat = court.geometry.coordinates[1];
            targetLng = court.geometry.coordinates[0];
        } else if (court.location) {
            const parsed = parsePostGISPoint(court.location);
            if(parsed) { targetLat = parsed.lat; targetLng = parsed.lng; }
        }

        if (targetLat && targetLng) {
            setFlyToPosition([targetLat, targetLng]);
        }
        if (isMobile) { onDrawerOpen(); } else { onDetailModalOpen(); }
    };
    
    const handleBookingAction = (court) => { const user = localStorage.getItem('user'); if (!user) { if(window.confirm('Đăng nhập?')) navigate('/login'); } else { setSelectedCourt(court); onBookingOpen(); } };
    
    // 🔥 HÀM GỬI REVIEW
    const handleSubmitReview = async () => { 
        const user = JSON.parse(localStorage.getItem('user')); 
        if(!user) return toast({title:'Đăng nhập để đánh giá', status:'error'}); 
        setSubmittingReview(true);
        try { 
            await axios.post('http://localhost:5000/api/reviews', {
                court_id: previewCourt.id, 
                user_id: user.id, 
                rating: newRating, 
                comment: newComment
            }); 
            toast({title:'Đánh giá thành công', status:'success'}); 
            setNewComment(''); 
            const res = await axios.get(`http://localhost:5000/api/reviews/${previewCourt.id}`); 
            setReviews(res.data); 
        } catch(e) { 
            toast({title:'Lỗi', status:'error'}); 
        } finally {
            setSubmittingReview(false);
        }
    };

    return (
        <Flex h="100vh" w="100vw" direction="column" bg={bg}  overflow="hidden">
            <style>{customStyles}</style>

            <Flex h="64px" bg={headerBg} shadow="sm" align="center" px={{base: 4, lg: 6}} justify="space-between" zIndex={2000} borderBottom="1px solid" borderColor={useColorModeValue('gray.200', 'gray.700')}>
                <HStack spacing={4}>
                    {!isMobile && (
                        <IconButton icon={<FaBars />} variant="ghost" onClick={() => setSidebarOpen(!isSidebarOpen)} aria-label="Toggle Sidebar" />
                    )}
                    <HStack>
                        {config.logo_url && <Image src={getImgUrl(config.logo_url)} h="36px" w="auto" objectFit="contain" />}
                        <Text fontWeight="900" fontSize="lg" bgGradient="linear(to-r, blue.500, teal.400)" bgClip="text">
                            {config.website_name || 'Sport Booking'}
                        </Text>
                    </HStack>
                </HStack>

                <HStack spacing={2}>
                    {!isMobile && <Button leftIcon={<FaTicketAlt />} size="sm" variant="ghost" onClick={onTicketOpen}>Vé của tôi</Button>}
                    <IconButton icon={colorMode === 'light' ? <FaMoon /> : <FaSun />} isRound variant="ghost" onClick={toggleColorMode} />
                    <Avatar 
                        size="sm" 
                        src={getImgUrl(JSON.parse(localStorage.getItem('user'))?.avatar)} 
                        cursor="pointer" 
                        onClick={() => { const user = localStorage.getItem('user'); if (user) onProfileOpen(); else navigate('/login'); }}
                    />
                </HStack>
            </Flex>

            <Flex flex={1} position="relative" overflow="hidden">
                <Box 
                    w="380px" 
                    display={{ base: 'none', lg: 'flex' }} 
                    flexDirection="column" 
                    bg={headerBg} 
                    borderRight="1px solid" 
                    borderColor={useColorModeValue('gray.200', 'gray.700')} 
                    zIndex={1000} 
                    shadow="xl" 
                    position="absolute" 
                    left={isSidebarOpen ? "0" : "-380px"} 
                    top="0" 
                    bottom="0" 
                    transition="left 0.3s ease-in-out"
                >
                    <VStack p={4} spacing={4} align="stretch" overflowY="auto" className="hide-scrollbar" flex={1}>
                        <Box bg={useColorModeValue('blue.50', 'whiteAlpha.100')} p={4} borderRadius="xl">
                            <Text fontSize="xs" fontWeight="bold" color="blue.500" mb={3} textTransform="uppercase" letterSpacing="wider">📍 Tìm kiếm thông minh</Text>
                            <VStack spacing={3}>
                                <InputGroup size="md">
                                    <InputLeftElement pointerEvents="none" children={<FaSearch color="gray.400" />} />
                                    <Input placeholder="Tên sân, địa chỉ..." bg={useColorModeValue('white', 'gray.800')} borderRadius="lg" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} shadow="sm"/>
                                </InputGroup>
                                
                                {/* 🔥 DROPDOWN CHỌN PHƯỜNG XÃ */}
                                <Select 
                                    placeholder="Chọn Phường/Xã..." 
                                    bg={useColorModeValue('white', 'gray.800')} 
                                    onChange={handleSelectWard} 
                                    size="sm" 
                                    borderRadius="lg"
                                    icon={<BiMapAlt/>}
                                >
                                    {wards.map(w => (
                                        <option key={w.id} value={w.id}>
                                            {w.district_name} - {w.name}
                                        </option>
                                    ))}
                                </Select>

                                <HStack w="100%">
                                    <InputGroup size="sm" flex={1}>
                                        <Input type="number" placeholder="Km" value={searchRadius / 1000} onChange={(e) => setSearchRadius(Number(e.target.value) * 1000)} bg={useColorModeValue('white', 'gray.800')} borderRadius="lg" />
                                        <InputRightAddon children="km" />
                                    </InputGroup>
                                    <Button leftIcon={<BiCurrentLocation/>} colorScheme="blue" size="sm" onClick={handleFindNearby} shadow="sm">Tìm quanh đây</Button>
                                </HStack>
                            </VStack>
                        </Box>

                        <Box>
                            <Text fontSize="xs" fontWeight="bold" color="gray.500" mb={2} px={1}>MÔN THỂ THAO</Text>
                            <Wrap spacing={2}>
                                {Object.keys(iconUrlMap).map(type => (
                                    <WrapItem key={type}>
                                        <Button size="xs" variant={filterType===type?'solid':'outline'} colorScheme="teal" borderRadius="full" onClick={()=>setFilterType(filterType===type?'':type)} textTransform="capitalize" px={3}>{type}</Button>
                                    </WrapItem>
                                ))}
                            </Wrap>
                        </Box>

                        <Box px={1}>
                            <Flex justify="space-between" mb={2}>
                                <Text fontSize="xs" fontWeight="bold" color="gray.500">GIÁ TỐI ĐA</Text>
                                <Badge colorScheme="green" borderRadius="md" px={2}>{ (maxPrice/1000).toLocaleString() }k</Badge>
                            </Flex>
                            <RangeSlider min={0} max={1000000} step={50000} value={[0, maxPrice]} onChange={(val) => setMaxPrice(val[1])}>
                                <RangeSliderTrack bg="gray.200"><RangeSliderFilledTrack bg='teal.500'/></RangeSliderTrack>
                                <RangeSliderThumb boxSize={4} index={1} bg="white" shadow="md" borderColor="teal.500" border="2px solid"/>
                            </RangeSlider>
                        </Box>
                        
                        <Divider />
                        <HStack justify="space-between" px={1}>
                            <Text fontWeight="bold" fontSize="md">Kết quả ({filteredCourts.length})</Text>
                            <Text fontSize="xs" color="gray.500">Sắp xếp theo đánh giá</Text>
                        </HStack>
                        <VStack spacing={3} align="stretch" pb={4}>
                            {filteredCourts.map(c => <CourtCard key={c.id} court={c} onClick={() => handleCourtClick(c)} onDrawRoute={handleDrawRoute} />)}
                        </VStack>
                    </VStack>
                </Box>
                
                {isMobile && mobileViewMode === 'list' && (
                    <Box position="absolute" top={0} left={0} right={0} bottom="65px" zIndex={900} bg={bg} overflowY="auto" p={4} pb={20}>
                        <HStack justify="space-between" mb={4}>
                            <Text fontWeight="bold" fontSize="lg">Danh sách sân ({filteredCourts.length})</Text>
                            <IconButton icon={<FaFilter />} size="sm" onClick={onMobileFilterOpen} />
                        </HStack>
                        <InputGroup mb={4}>
                            <InputLeftElement pointerEvents="none" children={<FaSearch color="gray.400" />} />
                            <Input placeholder="Tìm sân..." bg="white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </InputGroup>
                        <VStack spacing={4}>
                            {filteredCourts.map(c => <CourtCard key={c.id} court={c} onClick={() => handleCourtClick(c)} onDrawRoute={handleDrawRoute} />)}
                        </VStack>
                    </Box>
                )}

                <Box flex={1} position="relative" zIndex={0} display={isMobile && mobileViewMode === 'list' ? 'none' : 'block'}>
                    {routeCoords && (
                        <Box position="absolute" top={4} left="50%" transform="translateX(-50%)" zIndex={1000} bg={headerBg} px={5} py={2} borderRadius="full" shadow="2xl" border="1px solid" borderColor="green.400" display="flex" alignItems="center" gap={4}>
                            <VStack spacing={0} align="start">
                                <Text fontSize="xx-small" fontWeight="bold" color="gray.500" textTransform="uppercase">Quãng đường</Text>
                                <Text fontWeight="800" fontSize="lg" color="green.600">{routeInfo?.distance} km <span style={{fontSize:'12px', color:'gray', fontWeight:'normal'}}>({routeInfo?.duration} phút)</span></Text>
                            </VStack>
                            <Divider orientation="vertical" h="30px" />
                            <IconButton icon={<FaTimes />} size="sm" isRound colorScheme="red" variant="ghost" onClick={handleClearRoute} />
                        </Box>
                    )}

                    <Box display={{ base: 'block', lg: 'none' }} position="absolute" top={4} left={4} right={4} zIndex={500}>
                        <HStack bg={headerBg} p={2} borderRadius="2xl" shadow="xl" spacing={2} border="1px solid" borderColor={useColorModeValue('gray.100', 'gray.700')}>
                            <Icon as={FaSearch} color="gray.400" ml={2} />
                            <Input placeholder="Tìm sân..." variant="unstyled" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            <Divider orientation="vertical" h="20px" />
                            <IconButton icon={<FaFilter />} size="sm" variant="ghost" colorScheme="blue" onClick={onMobileFilterOpen} />
                        </HStack>
                    </Box>

                    {!routeCoords && isMobile && filteredCourts.length > 0 && (
                        <Box position="absolute" bottom="80px" left={0} right={0} zIndex={400} overflowX="auto" className="hide-scrollbar" px={4} pb={2} whiteSpace="nowrap" display="flex" gap={3}>
                            {filteredCourts.map(court => (
                                <CourtCard key={court.id} court={court} isHorizontal={true} onClick={() => handleCourtClick(court)} onDrawRoute={handleDrawRoute} />
                            ))}
                        </Box>
                    )}

                    <MapContainer center={[10.7769, 106.7009]} zoom={13} style={{ height: "100%", width: "100%", zIndex: 0 }} zoomControl={false}>
                        {/* 🔥 TRUYỀN wardBounds VÀO ĐỂ MAP TỰ ZOOM */}
                        <MapController center={[10.7769, 106.7009]} courts={filteredCourts} userLoc={userLoc} colorMode={colorMode} flyToPosition={flyToPosition} wardBounds={wardBounds} />
                        
                        {/* 🔥 VẼ HÌNH DÁNG PHƯỜNG LÊN BẢN ĐỒ */}
                        {wardShape && (
                            <GeoJSON 
                                key={JSON.stringify(wardShape)} // Buộc React vẽ lại khi shape thay đổi
                                data={wardShape} 
                                style={{
                                    color: '#3182CE', 
                                    weight: 2, 
                                    fillColor: '#63B3ED', 
                                    fillOpacity: 0.2
                                }} 
                            />
                        )}

                        {routeCoords && <Polyline positions={routeCoords} color="#3B82F6" weight={6} opacity={0.8} />}
                        {userLoc && <Marker position={userLoc} icon={userPulseIcon}><Popup>Bạn đang ở đây</Popup></Marker>}
                        
                        <MarkerClusterGroup chunkedLoading iconCreateFunction={createClusterCustomIcon} spiderfyOnMaxZoom={true} showCoverageOnHover={false}>
                            {filteredCourts.map((court) => { 
                                // Logic lấy tọa độ cho Marker
                                let lat, lng;
                                if (court.geometry && court.geometry.coordinates) {
                                    lat = court.geometry.coordinates[1];
                                    lng = court.geometry.coordinates[0];
                                } else if (court.location) {
                                    const parsed = parsePostGISPoint(court.location);
                                    if(parsed) { lat = parsed.lat; lng = parsed.lng; }
                                }

                                if (!lat || !lng) return null;

                                return (
                                    <Marker 
                                        key={court.id} 
                                        position={[lat, lng]} 
                                        icon={createCircleMarker(iconUrlMap[court.type], court.type)} 
                                        eventHandlers={{ click: () => { if (isMobile) handleCourtClick(court); else setSelectedCourt(court); }}} 
                                    >
                                        {!isMobile && (
                                            <Popup closeButton={true} className="custom-popup">
                                                <Box w="100%" p={0}>
                                                    <Box position="relative" h="140px" bg="gray.100">
                                                        <Image src={court.image_url || 'https://via.placeholder.com/300'} w="100%" h="100%" objectFit="cover" fallbackSrc="https://via.placeholder.com/300"/>
                                                        <Badge position="absolute" bottom={2} left={2} colorScheme="green" variant="solid" fontSize="xs" px={2} borderRadius="md" boxShadow="md">{parseInt(court.price_per_hour).toLocaleString()}đ/h</Badge>
                                                    </Box>
                                                    <Box p={4}>
                                                        <Text fontWeight="800" fontSize="md" mb={1} lineHeight="1.2">{court.name}</Text>
                                                        <HStack mb={2} spacing={1}><StarRating rating={court.avg_rating} size={3}/><Text fontSize="xs" color="gray.500">({court.review_count})</Text></HStack>
                                                        <HStack fontSize="xs" color="gray.600" mb={4} align="start"><Icon as={FaLocationArrow} color="red.500" mt={0.5} /><Text noOfLines={2}>{court.address}</Text></HStack>
                                                        <HStack spacing={2} w="100%"><Button flex={1} size="sm" leftIcon={<FaRoute/>} colorScheme="orange" variant="solid" borderRadius="full" onClick={()=>handleDrawRoute(court)}>Dẫn đường</Button><Button flex={1} size="sm" colorScheme="green" variant="solid" borderRadius="full" onClick={()=>handleBookingAction(court)}>Đặt sân</Button></HStack>
                                                    </Box>
                                                </Box>
                                            </Popup>
                                        )}
                                    </Marker>
                                ) 
                            })}
                        </MarkerClusterGroup>
                    </MapContainer>

                    <Tooltip label="Vị trí của tôi" placement="left">
                        <IconButton display={{ base: 'flex', lg: 'none' }} icon={<BiCurrentLocation size={24}/>} isRound bg="white" shadow="xl" position="absolute" bottom={routeCoords ? "20px" : "240px"} right="16px" zIndex={300} onClick={handleFindNearby} color="blue.500" size="lg" />
                    </Tooltip>
                </Box>
            </Flex>
            
            <Flex display={{ base: 'flex', lg: 'none' }} bg={headerBg} h="65px" w="100%" position="fixed" bottom={0} zIndex={1000} boxShadow="0 -4px 20px rgba(0,0,0,0.05)" justify="space-around" align="center" pb="safe-area-inset-bottom" borderTop="1px solid" borderColor={useColorModeValue('gray.100', 'gray.700')}>
                <VStack spacing={0} color={mobileViewMode === 'map' ? 'blue.600' : 'gray.400'} onClick={() => setMobileViewMode('map')} cursor="pointer">
                    <Icon as={FaMap} size={20} />
                    <Text fontSize="10px" fontWeight="bold" mt={1}>Bản đồ</Text>
                </VStack>
                <VStack spacing={0} color={mobileViewMode === 'list' ? 'blue.600' : 'gray.400'} onClick={() => setMobileViewMode('list')} cursor="pointer">
                    <Icon as={FaList} size={20} />
                    <Text fontSize="10px" fontWeight="bold" mt={1}>Danh sách</Text>
                </VStack>
                <VStack spacing={0} onClick={onTicketOpen} color="gray.400" cursor="pointer"><FaTicketAlt size={20} /><Text fontSize="10px" fontWeight="bold" mt={1}>Vé của tôi</Text></VStack>
                <VStack spacing={0} onClick={() => { const user = localStorage.getItem('user'); if (user) onProfileOpen(); else navigate('/login'); }} color="gray.400" cursor="pointer">
                    {localStorage.getItem('user') ? <Avatar size="xs" src={getImgUrl(JSON.parse(localStorage.getItem('user')).avatar)} /> : <FaUser size={20} />}
                    <Text fontSize="10px" fontWeight="bold" mt={1}>{localStorage.getItem('user') ? 'Tài khoản' : 'Đăng nhập'}</Text>
                </VStack>
            </Flex>
            
            <Drawer placement="bottom" onClose={onMobileFilterClose} isOpen={isMobileFilterOpen} size="sm"><DrawerOverlay /><DrawerContent borderTopRadius="24px"><DrawerHeader borderBottomWidth="1px">Bộ lọc</DrawerHeader><DrawerBody py={6}>
                <Text fontWeight="bold" mb={2}>Phường / Xã</Text>
                <Select placeholder="Chọn khu vực..." mb={4} onChange={handleSelectWard}>
                    {wards.map(w => <option key={w.id} value={w.id}>{w.district_name} - {w.name}</option>)}
                </Select>
                <Text fontWeight="bold">Giá tối đa</Text><RangeSlider min={0} max={1000000} step={50000} value={[0, maxPrice]} onChange={(val) => setMaxPrice(val[1])}><RangeSliderTrack bg="gray.100"><RangeSliderFilledTrack bg='blue.500'/></RangeSliderTrack><RangeSliderThumb boxSize={6} index={1} bg="white" shadow="md" borderColor="blue.500" border="2px solid"/></RangeSlider>
            </DrawerBody></DrawerContent></Drawer>
            <Drawer placement="bottom" onClose={onDrawerClose} isOpen={isDrawerOpen && isMobile}><DrawerOverlay /><DrawerContent borderTopRadius="24px" h="85vh" bg={bg} display="flex" flexDirection="column"><DrawerCloseButton bg="white" zIndex={10} top={4} left={4} size="lg" shadow="md" borderRadius="full" /><DrawerBody p={0} flex={1} overflowY="auto" className="hide-scrollbar">{previewCourt && <DetailContent court={previewCourt} reviews={reviews} newRating={newRating} setNewRating={setNewRating} newComment={newComment} setNewComment={setNewComment} handleSubmitReview={handleSubmitReview} submittingReview={submittingReview} onDrawRoute={handleDrawRoute} />}</DrawerBody><DrawerFooter borderTopWidth="1px" bg="white" pb={6} pt={4} boxShadow="0 -4px 20px rgba(0,0,0,0.05)"><Button w="100%" colorScheme="green" size="lg" fontSize="lg" fontWeight="bold" shadow="lg" onClick={() => handleBookingAction(previewCourt)}>ĐẶT SÂN NGAY</Button></DrawerFooter></DrawerContent></Drawer>
            <Modal isOpen={isDetailModalOpen && !isMobile} onClose={onDetailModalClose} size="xl" isCentered scrollBehavior="inside"><ModalOverlay backdropFilter="blur(3px)" /><ModalContent borderRadius="xl" maxH="85vh"><ModalHeader borderBottomWidth="1px" pb={2} fontSize="lg">Chi tiết sân</ModalHeader><ModalCloseButton /><ModalBody p={0} className="hide-scrollbar">{previewCourt && <DetailContent court={previewCourt} reviews={reviews} newRating={newRating} setNewRating={setNewRating} newComment={newComment} setNewComment={setNewComment} handleSubmitReview={handleSubmitReview} submittingReview={submittingReview} onDrawRoute={handleDrawRoute} />}</ModalBody><ModalFooter borderTopWidth="1px" bg="gray.5"><Button variant="ghost" mr={3} onClick={onDetailModalClose}>Đóng</Button><Button colorScheme="green" size="md" onClick={() => handleBookingAction(previewCourt)}>ĐẶT SÂN NGAY</Button></ModalFooter></ModalContent></Modal>
            
            {/* Sử dụng Component đã tách */}
            {selectedCourt && <BookingModal court={selectedCourt} isOpen={isBookingOpen} onClose={onBookingClose} />}
            <MyTicketsModal isOpen={isTicketOpen} onClose={onTicketClose} />
            <UserProfileDrawer isOpen={isProfileOpen} onClose={onProfileClose} onOpenTickets={() => { onProfileClose(); onTicketOpen(); }} />
        </Flex>
    );
}