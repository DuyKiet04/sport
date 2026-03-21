import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Modal, ModalOverlay, ModalContent, ModalCloseButton, ModalBody,
    Box, Image, Text, HStack, Badge, Button, Tabs, TabList, Tab, TabPanels, TabPanel, 
    VStack, Spinner, useColorModeValue, Icon, Flex, Avatar, IconButton, Input, useToast, 
    Tooltip, Divider, SimpleGrid, Menu, MenuButton, MenuList, MenuItem, useBreakpointValue ,useColorMode
} from '@chakra-ui/react';
import { 
    FaClock, FaLocationArrow, FaRoute, FaPhone, FaFacebook, 
    FaStar, FaUmbrella, FaWind, FaCamera, 
    FaChevronLeft, FaChevronRight, FaTimes, FaMapMarkedAlt, FaCheckCircle, FaHeart,
    FaImage, FaEllipsisV, FaEdit, FaTrash ,FaEye, FaFilter
} from 'react-icons/fa';
import { SiZalo } from 'react-icons/si';
import axios from 'axios';

const OPEN_WEATHER_API_KEY = import.meta.env.VITE_OPEN_WEATHER_API_KEY; 

const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `http://localhost:5000/${url.startsWith('/') ? url.substring(1) : url}`;
};

const StarRating = ({ rating, setRating, isInteractive = false, size = 4 }) => (
    <HStack spacing={1}>
        {[1, 2, 3, 4, 5].map((star) => (
            <Icon key={star} as={FaStar} color={star <= rating ? "orange.400" : "gray.300"} cursor={isInteractive ? "pointer" : "default"} onClick={() => isInteractive && setRating && setRating(star)} w={size} h={size} transition="color 0.2s" _hover={isInteractive ? { color: "orange.300", transform: 'scale(1.2)' } : {}}/>
        ))}
    </HStack>
);

const FacilityDetailModal = ({ isOpen, onClose, facility, onBookCourt, onDrawRoute }) => {
    const [courts, setCourts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [weather, setWeather] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [sportTypesData, setSportTypesData] = useState([]);
    const [isFavorite, setIsFavorite] = useState(false);
    
    const [newRating, setNewRating] = useState(5);
    const [newComment, setNewComment] = useState('');
    const [reviewImage, setReviewImage] = useState(null);
    const [reviewImagePreview, setReviewImagePreview] = useState(null);
    const [submittingReview, setSubmittingReview] = useState(false);
    const [editReviewId, setEditReviewId] = useState(null);
    const fileInputRef = useRef(null);

    const [tabIndex, setTabIndex] = useState(0);
    const [lightboxIndex, setLightboxIndex] = useState(-1);
    const [lightboxImages, setLightboxImages] = useState([]); 
    const [lightboxTitle, setLightboxTitle] = useState('');   
    
    // 🔥 LOGIC PHÂN TRANG VÀ LỌC SAO
    const [filterStar, setFilterStar] = useState('all'); 
    const [currentPage, setCurrentPage] = useState(1);
    const REVIEWS_PER_PAGE = 5;

    // 🎨 MÀU SẮC NEUMORPHISM ĐỒNG BỘ
    const neumorphBg = useColorModeValue('#edf2f7', '#2d3748');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '4px 4px 10px #1a202c, -4px -4px 10px #4a5568');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #1a202c, inset -4px -4px 8px #4a5568');
    const { colorMode } = useColorMode();
    const textColor = useColorModeValue('gray.700', 'gray.100');
    const textMuted = useColorModeValue('gray.500', 'gray.400');
    const borderColor = useColorModeValue('gray.200', 'gray.700');
    
    const toast = useToast();
    const isMobile = useBreakpointValue({ base: true, lg: false });
    const currentUser = JSON.parse(localStorage.getItem('user'));

    const fetchReviews = async () => {
        try {
            const reviewRes = await axios.get(`http://localhost:5000/api/reviews/facility/${facility.id}`);
            setReviews(reviewRes.data);
        } catch (e) { }
    };

    useEffect(() => {
        if (isOpen && facility) {
            setLoading(true); setTabIndex(0); setFilterStar('all'); setCurrentPage(1); 
            const fetchData = async () => {
                try {
                    const [courtsRes, typesRes] = await Promise.all([
                        axios.get(`http://localhost:5000/api/facilities/${facility.id}/courts-detail`),
                        axios.get(`http://localhost:5000/api/sport-types`)
                    ]);
                    const validCourts = (courtsRes.data || []).filter(c => !c.name.startsWith('[Ảo]'));
                    setCourts(validCourts);
                    setSportTypesData(typesRes.data || []);
                    await fetchReviews();
                    
                    if (currentUser) {
                        try {
                            const favRes = await axios.get(`http://localhost:5000/api/favorites/${currentUser.id}`);
                            setIsFavorite(favRes.data.includes(facility.id));
                        } catch (e) { }
                    }
                    if (facility.lat && facility.lng) {
                        try {
                            const weatherRes = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${facility.lat}&lon=${facility.lng}&appid=${OPEN_WEATHER_API_KEY}&units=metric&lang=vi`);
                            setWeather(weatherRes.data);
                        } catch (e) { }
                    }
                } catch (e) { console.error(e); } 
                finally { setLoading(false); }
            };
            fetchData();
        }
    }, [isOpen, facility]);

    useEffect(() => { setCurrentPage(1); }, [filterStar, reviews.length]);

    const handleContactClick = () => {
        if (!facility) return;
        try { axios.post(`http://localhost:5000/api/facilities/${facility.id}/contact`); } 
        catch (e) { console.log(e); }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) { setReviewImage(file); setReviewImagePreview(URL.createObjectURL(file)); }
    };
    
    const clearReviewForm = () => {
        setNewComment(''); setNewRating(5); setReviewImage(null); setReviewImagePreview(null); setEditReviewId(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSubmitReview = async () => {
        if (!currentUser) return toast({ title: "Vui lòng đăng nhập!", status: "warning" });
        if (!newComment.trim()) return toast({ title: "Nhập nội dung đi bạn ơi!", status: "warning" });

        setSubmittingReview(true);
        const formData = new FormData();
        formData.append('facility_id', facility.id);
        if (courts.length > 0) formData.append('court_id', courts[0].id);
        formData.append('user_id', currentUser.id);
        formData.append('rating', newRating);
        formData.append('comment', newComment);
        
        if (reviewImage) formData.append('image', reviewImage);
        else if (editReviewId && !reviewImagePreview) formData.append('keep_old_image', 'false');
        else formData.append('keep_old_image', 'true');

        try {
            if (editReviewId) {
                await axios.put(`http://localhost:5000/api/reviews/${editReviewId}`, formData);
                toast({ title: "Đã cập nhật đánh giá!", status: "success" });
            } else {
                await axios.post('http://localhost:5000/api/reviews', formData);
                toast({ title: "Đánh giá thành công!", status: "success" });
            }
            clearReviewForm();
            setFilterStar('all'); 
            await fetchReviews();
        } catch (error) { toast({ title: "Lỗi thực hiện!", status: "error" }); } 
        finally { setSubmittingReview(false); }
    };

    const handleEditClick = (review) => {
        setEditReviewId(review.id); setNewComment(review.comment); setNewRating(review.rating);
        setReviewImage(null); setReviewImagePreview(review.image_url ? getImgUrl(review.image_url) : null);
    };

    const handleDeleteReview = async (reviewId) => {
        if(!window.confirm("Bạn chắc chắn muốn xóa bình luận này?")) return;
        try {
            await axios.delete(`http://localhost:5000/api/reviews/${reviewId}`, { data: { facility_id: facility.id, user_id: currentUser.id } });
            toast({ title: "Đã xóa đánh giá!", status: "success" });
            await fetchReviews();
        } catch (error) { toast({ title: "Lỗi xóa đánh giá", status: "error" }); }
    };

    const handleToggleFavorite = async (e) => {
        e.stopPropagation();
        if (!currentUser) return toast({ title: "Vui lòng đăng nhập!", status: "warning" });
        try {
            await axios.post('http://localhost:5000/api/favorites', { user_id: currentUser.id, facility_id: facility.id });
            setIsFavorite(!isFavorite);
            toast({ title: !isFavorite ? "Đã lưu sân ưa thích" : "Đã bỏ lưu", status: "success" });
        } catch (error) { toast({ title: "Lỗi kết nối", status: "error" }); }
    };

    const handleBookClick = (court) => {
        const courtWithTime = {
            ...court,
            open_time: facility.open_time,
            close_time: facility.close_time
        };
        onBookCourt(courtWithTime);
    };

    const groupedCourts = useMemo(() => {
        const groups = {}; courts.forEach(c => { if (!groups[c.type]) groups[c.type] = []; groups[c.type].push(c); }); return groups;
    }, [courts]);
    const sportTypes = Object.keys(groupedCourts);

    const currentTabImages = useMemo(() => {
        if (sportTypes.length === 0) return facility?.image_url ? [facility.image_url] : [];
        const courtsInTab = groupedCourts[sportTypes[tabIndex]] || [];
        let imgs = [];
        courtsInTab.forEach(c => { if (c.image_url) imgs.push(c.image_url); if (c.images && Array.isArray(c.images)) imgs.push(...c.images); });
        if (imgs.length === 0 && facility?.image_url) imgs.push(facility.image_url);
        return [...new Set(imgs)].filter(url => url && url.length > 5);
    }, [groupedCourts, tabIndex, facility, sportTypes]);

    const handleOpenLightbox = (index, imageList, title = '') => { setLightboxImages(imageList); setLightboxIndex(index); setLightboxTitle(title); };
    const closeLightbox = () => setLightboxIndex(-1);
    const nextImage = (e) => { e.stopPropagation(); setLightboxIndex((prev) => (prev + 1) % lightboxImages.length); };
    const prevImage = (e) => { e.stopPropagation(); setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length); };

    const facilityAmenities = useMemo(() => {
        if (!facility || !facility.amenities) return [];
        let ams = facility.amenities;
        if (Array.isArray(ams)) return ams;
        if (typeof ams === 'string') {
            try {
                const parsed = JSON.parse(ams);
                if (Array.isArray(parsed)) return parsed;
                return [parsed];
            } catch (e) {
                return ams.split(',').map(item => item.trim()).filter(Boolean);
            }
        }
        return [];
    }, [facility]);

    const isAdminFacility = facility?.owner_role === 'admin' || facility?.owner_role === 'super_admin' || facility?.owner_id === 3;

    const avgRatingCalc = useMemo(() => {
        if (reviews.length === 0) return 5.0;
        const total = reviews.reduce((sum, r) => sum + r.rating, 0);
        return (total / reviews.length).toFixed(1);
    }, [reviews]);

    const starCounts = useMemo(() => {
        const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(r => { if (counts[r.rating] !== undefined) counts[r.rating]++; });
        return counts;
    }, [reviews]);

    const filteredReviews = useMemo(() => {
        if (filterStar === 'all') return reviews;
        return reviews.filter(r => r.rating === filterStar);
    }, [reviews, filterStar]);

    const totalPages = Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE);
    
    const currentReviews = useMemo(() => {
        const start = (currentPage - 1) * REVIEWS_PER_PAGE;
        return filteredReviews.slice(start, start + REVIEWS_PER_PAGE);
    }, [filteredReviews, currentPage]);

    const scrollToTopReview = () => {
        const reviewBox = document.getElementById('review-scroll-box');
        if(reviewBox) reviewBox.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (!facility) return null;

    const hasPhone = facility.phone_number && facility.phone_number !== 'Đang cập nhật';
    const hasZalo = facility.zalo_url && facility.zalo_url !== 'Đang cập nhật';
    const hasFb = facility.facebook_url && facility.facebook_url !== 'Đang cập nhật';
    const hasTime = facility.open_time && facility.close_time;

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} size={{ base: "full", lg: "6xl" }} scrollBehavior="inside" motionPreset="slideInBottom">
                <ModalOverlay backdropFilter="blur(8px)" bg="blackAlpha.700" />
                <ModalContent borderRadius={{ base: "0", lg: "3xl" }} overflow="hidden" maxH={{ base: "100vh", lg: "90vh" }} bg={neumorphBg} shadow="2xl" display="flex" flexDirection="column">
                    
                    <Box position="relative" flexShrink={0} h={{base: "220px", md: "340px"}} cursor="pointer" onClick={() => handleOpenLightbox(0, currentTabImages, `Tổng quan`)} role="group">
                        <Image src={getImgUrl(currentTabImages[0] || facility.image_url)} w="100%" h="100%" objectFit="cover" transition="transform 0.8s ease" _groupHover={{ transform: 'scale(1.03)' }} fallbackSrc="https://placehold.co/800x400?text=San+The+Thao" />
                        <Box position="absolute" inset={0} bgGradient="linear(to-t, blackAlpha.900 0%, blackAlpha.600 40%, transparent 100%)" />
                        <ModalCloseButton zIndex={10} bg="rgba(255,255,255,0.2)" backdropFilter="blur(5px)" color="white" borderRadius="full" top={4} right={4} _hover={{bg:'rgba(255,255,255,0.4)', transform: 'rotate(90deg)'}} transition="all 0.3s" border="none"/>
                        
                        <Tooltip label={isFavorite ? "Bỏ yêu thích" : "Lưu sân này"} placement="left">
                            <IconButton 
                                icon={<Icon as={FaHeart} color={isFavorite ? "red.500" : "white"} boxSize={5} />} 
                                position="absolute" top={4} right={14} zIndex={10} isRound 
                                bg="rgba(255,255,255,0.2)" backdropFilter="blur(5px)" border="none"
                                _hover={{ bg: "rgba(255,255,255,0.4)", transform: "scale(1.1)" }} 
                                onClick={handleToggleFavorite} aria-label="Favorite"
                            />
                        </Tooltip>
                        
                        <Badge position="absolute" top={4} left={4} bg="rgba(0,0,0,0.5)" backdropFilter="blur(5px)" color="white" px={3} py={1.5} borderRadius="full" display="flex" alignItems="center" fontSize="xs" fontWeight="bold" textTransform="none" border="none"><Icon as={FaCamera} mr={2}/> {currentTabImages.length} ẢNH</Badge>

                        <Box position="absolute" bottom={0} left={0} right={0} p={{base: 4, md: 8}}>
                            <Flex justify="space-between" align="end" direction={{base:'column', md:'row'}}>
                                <Box flex={1}>
                                    <HStack mb={3}>
                                        <Badge bg="green.500" color="white" px={2.5} py={0.5} borderRadius="md" fontSize="10px" border="none">MỞ CỬA</Badge>
                                        <Badge bg="blue.500" color="white" px={2.5} py={0.5} borderRadius="md" fontSize="10px" ml={2} display="flex" alignItems="center" border="none">
                                            <Icon as={FaEye} mr={1} /> {facility.view_count || 0} Lượt xem
                                        </Badge>
                                        <Text color="gray.200" fontSize="sm" fontWeight="600" display="flex" alignItems="center">
                                            <Icon as={FaClock} mr={1.5}/>
                                            {hasTime ? `${facility.open_time.substring(0,5)} - ${facility.close_time.substring(0,5)}` : 'Giờ: Đang cập nhật'}
                                        </Text>
                                    </HStack>
                                    <Text color="white" fontSize={{base:"2xl", md:"4xl"}} fontWeight="900" lineHeight="1.2" textShadow="0 2px 10px rgba(0,0,0,0.5)">{facility.name}</Text>
                                    <HStack mt={2} color="gray.300" fontSize="sm"><Icon as={FaLocationArrow} color="orange.400"/><Text noOfLines={1} fontWeight="500">{facility.address}</Text></HStack>
                                </Box>
                                <HStack mt={{base:4, md:0}} spacing={3}>
                                    <Button size="sm" variant="solid" bg="rgba(255,255,255,0.9)" color="gray.800" leftIcon={<FaMapMarkedAlt color="blue.500"/>} onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps?q=${facility.lat},${facility.lng}`, '_blank'); }} borderRadius="xl" border="none" _hover={{bg: "white", transform: "translateY(-2px)"}}>Bản đồ</Button>
                                    <Button size="sm" colorScheme="orange" bgGradient="linear(to-r, orange.400, red.400)" leftIcon={<FaRoute />} onClick={(e) => { e.stopPropagation(); onClose(); onDrawRoute(facility); }} borderRadius="xl" border="none" _hover={{transform: "translateY(-2px)"}}>Chỉ đường</Button>
                                </HStack>
                            </Flex>
                        </Box>
                    </Box>

                    <ModalBody p={0} bg={neumorphBg} display="flex" flexDirection={{ base: 'column', lg: 'row' }}>
                        
                        {/* CỘT TRÁI */}
                        <Box flex={6.5} p={{base: 4, md: 8}} borderRight={{lg: "1px solid"}} borderColor={borderColor}>
                            <SimpleGrid columns={{base: 1, md: 2}} spacing={6} mb={8}>
                                <Box bg={neumorphBg} p={5} borderRadius="2xl" boxShadow={neumorphShadow}>
                                    <HStack spacing={4} mb={4}>
                                        <Avatar size="lg" src={getImgUrl(facility.owner_avatar)} name={facility.owner_name} border="3px solid" borderColor={neumorphBg} boxShadow={neumorphShadow}/>
                                        <Box>
                                            <Text fontWeight="800" fontSize="lg" color={textColor}>{facility.owner_name}</Text>
                                            <Text fontSize="xs" color="blue.500" fontWeight="bold" letterSpacing="1px" textTransform="uppercase">{isAdminFacility ? 'Hệ thống / Admin' : 'Quản lý sân'}</Text>
                                        </Box>
                                    </HStack>
                                    
                                    <Divider borderColor={borderColor} opacity={0.3} mb={4}/>
                                    
                                    <HStack spacing={3} wrap="wrap">
                                        {hasPhone ? <Button onClick={handleContactClick} size="sm" bg={neumorphBg} color="green.500" boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} leftIcon={<FaPhone/>} as="a" href={`tel:${facility.phone_number}`} flex={1} border="none"></Button> : <Button size="sm" bg={neumorphBg} color="gray.400" boxShadow={neumorphActiveShadow} leftIcon={<FaPhone/>} flex={1} isDisabled border="none">Đang cập nhật</Button>}
                                        {hasZalo && <Button onClick={handleContactClick} size="sm" bg={neumorphBg} color="blue.500" boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} leftIcon={<SiZalo/>} as="a" href={facility.zalo_url.startsWith('http') ? facility.zalo_url : `https://zalo.me/${facility.zalo_url}`} target="_blank" flex={1} border="none"></Button>}
                                        {hasFb && <Button onClick={handleContactClick} size="sm" bg={neumorphBg} color="facebook.500" boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} leftIcon={<FaFacebook/>} as="a" href={facility.facebook_url.startsWith('http') ? facility.facebook_url : `https://facebook.com/${facility.facebook_url}`} target="_blank" flex={1} border="none"></Button>}
                                    </HStack>
                                    
                                    {facilityAmenities.length > 0 && (
                                        <Flex wrap="wrap" gap={3} mt={5}>
                                            {facilityAmenities.map((am, idx) => (
                                                <Badge key={idx} bg={neumorphBg} color={textColor} boxShadow={neumorphShadow} borderRadius="full" px={3} py={1.5} fontSize="10px" fontWeight="bold" border="none" display="flex" alignItems="center">
                                                    <Icon as={FaCheckCircle} mr={1.5} w={3} h={3} color="green.500"/>{am}
                                                </Badge>
                                            ))}
                                        </Flex>
                                    )}
                                </Box>

                                {weather && (
                                    <Box bg={neumorphBg} p={5} borderRadius="2xl" boxShadow={neumorphShadow} position="relative" overflow="hidden" display="flex" flexDirection="column" justifyContent="center">
                                        <Box position="absolute" top="-20px" right="-20px" opacity={0.05}><Icon as={FaUmbrella} boxSize="120px" color={textColor}/></Box>
                                        <Text fontSize="xs" fontWeight="bold" color={textMuted} letterSpacing="1px" textTransform="uppercase" mb={2}>Thời tiết khu vực</Text>
                                        <HStack justify="space-between" align="center" zIndex={1} position="relative">
                                            <Box>
                                                <Text fontWeight="900" fontSize="5xl" color={textColor} lineHeight="1">{Math.round(weather.main.temp)}°<Text as="span" fontSize="2xl" color={textMuted}>C</Text></Text>
                                                <Text fontSize="md" color={textColor} textTransform="capitalize" mt={1} fontWeight="bold">{weather.weather[0].description}</Text>
                                            </Box>
                                            <Box bg={neumorphBg} borderRadius="full" boxShadow={neumorphActiveShadow} p={2}>
                                                <Image src={`http://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`} w="60px" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))"/>
                                            </Box>
                                        </HStack>
                                        <HStack fontSize="xs" color={textMuted} mt={4} spacing={5} fontWeight="bold" bg={neumorphBg} p={2} borderRadius="xl" boxShadow={neumorphActiveShadow} justify="center">
                                            <Text display="flex" alignItems="center"><Icon as={FaUmbrella} mr={1.5} color="blue.400" boxSize={3}/>{weather.main.humidity}% Độ ẩm</Text>
                                            <Text display="flex" alignItems="center"><Icon as={FaWind} mr={1.5} color="teal.400" boxSize={3}/>{weather.wind.speed} m/s Gió</Text>
                                        </HStack>
                                    </Box>
                                )}
                            </SimpleGrid>

                            <Text fontWeight="900" fontSize="2xl" color={textColor} mb={6}>Danh sách Sân ({courts.length})</Text>
                            {loading ? <Flex justify="center" py={10}><Spinner color="blue.500" thickness="4px" size="xl"/></Flex> : courts.length === 0 ? (
                                <Flex direction="column" align="center" justify="center" py={10} bg={neumorphBg} borderRadius="2xl" boxShadow={neumorphActiveShadow}>
                                    <Icon as={FaPhone} boxSize={12} color="gray.400" mb={4} />
                                    <Text color={textColor} fontWeight="bold" fontSize="lg">Cơ sở này nhận đặt lịch trực tiếp</Text>
                                    <Text fontSize="sm" color={textMuted} mt={2} textAlign="center" maxW="80%">Hệ thống đặt lịch tự động đang cập nhật. Vui lòng liên hệ trực tiếp chủ sân để chốt giờ.</Text>
                                </Flex>
                            ) : (
                                <Tabs variant="unstyled" index={tabIndex} onChange={setTabIndex}>
                                    <TabList mb={6} gap={4} overflowX="auto" className="hide-scrollbar" px={2} py={2}>
                                        {sportTypes.map(type => {
                                            const matchedSport = sportTypesData.find(t => t.name === type || t.code === type);
                                            const iconSrc = matchedSport ? getImgUrl(matchedSport.icon_url) : null;
                                            const isSelected = tabIndex === sportTypes.indexOf(type);
                                            return (
                                                <Tab 
                                                    key={type} color={isSelected ? "blue.500" : textMuted} fontWeight="bold" flexShrink={0} 
                                                    px={6} py={3} borderRadius="full" border="none" 
                                                    bg={neumorphBg} boxShadow={isSelected ? neumorphActiveShadow : neumorphShadow}
                                                    transition="all 0.2s"
                                                >
                                                    <HStack spacing={2}>
                                                        {iconSrc && <Image src={iconSrc} boxSize="18px" filter={isSelected && colorMode==='dark' ? 'brightness(0) invert(1)' : 'none'} />}
                                                        <Text textTransform="capitalize">{type} <Text as="span" opacity={0.6} ml={1}>({groupedCourts[type].length})</Text></Text>
                                                    </HStack>
                                                </Tab>
                                            );
                                        })}
                                    </TabList>
                                    <TabPanels>
                                        {sportTypes.map(type => (
                                            <TabPanel key={type} p={0}>
                                                <VStack spacing={5} align="stretch">
                                                    {groupedCourts[type].map(court => {
                                                        const thisCourtImages = court.images?.length > 0 ? court.images : (court.image_url ? [court.image_url] : [facility.image_url]);
                                                        const matchedSport = sportTypesData.find(t => t.name === court.type || t.code === court.type);
                                                        const iconSrc = matchedSport ? getImgUrl(matchedSport.icon_url) : null;
                                                        let courtAmenitiesList = [];
                                                        if (court.amenities) {
                                                            if (Array.isArray(court.amenities)) courtAmenitiesList = court.amenities;
                                                            else if (typeof court.amenities === 'string') { try { courtAmenitiesList = JSON.parse(court.amenities); if (!Array.isArray(courtAmenitiesList)) courtAmenitiesList = [courtAmenitiesList]; } catch(e) { courtAmenitiesList = court.amenities.split(',').map(s => s.trim()).filter(Boolean); } }
                                                        }
                                                        const courtPrice = parseInt(court.price_per_hour);
                                                        const isPriceZero = isNaN(courtPrice) || courtPrice === 0;

                                                        return (
                                                            <Flex key={court.id} bg={neumorphBg} p={5} borderRadius="2xl" boxShadow={neumorphShadow} border="none" align={{base: 'start', sm: 'center'}} direction={{base: 'column', sm: 'row'}} _hover={{ transform: 'translateY(-2px)' }} transition="all 0.2s">
                                                                <Box position="relative" w={{base: '100%', sm: '140px'}} h="110px" borderRadius="xl" overflow="hidden" flexShrink={0} cursor="zoom-in" onClick={() => handleOpenLightbox(0, thisCourtImages, court.name)} mr={{sm: 6}} mb={{base: 4, sm: 0}} border="4px solid" borderColor={neumorphBg} boxShadow={neumorphShadow}>
                                                                    <Image src={getImgUrl(thisCourtImages[0])} w="100%" h="100%" objectFit="cover" />
                                                                    {thisCourtImages.length > 1 && <Badge position="absolute" bottom={2} right={2} bg="rgba(0,0,0,0.7)" color="white" fontSize="10px" borderRadius="md" border="none">+{thisCourtImages.length - 1}</Badge>}
                                                                </Box>
                                                                <Flex flex={1} w="100%" justify="space-between" align="center" direction={{base: 'column', sm: 'row'}}>
                                                                    <Box flex={1} mb={{base: 4, sm: 0}}>
                                                                        <HStack align="center" mb={2} spacing={2}>{iconSrc && <Image src={iconSrc} boxSize="20px" />}<Text fontWeight="900" fontSize="xl" color={textColor}>{court.name}</Text></HStack>
                                                                        <HStack mt={2} spacing={2} wrap="wrap">
                                                                            {court.name.toLowerCase().includes('vip') && <Badge colorScheme="orange" fontSize="10px" px={2.5} py={1} borderRadius="md" border="none">VIP</Badge>}
                                                                            {courtAmenitiesList.slice(0, 3).map((am, i) => <Badge key={i} bg={useColorModeValue('blue.50', 'blue.900')} color="blue.500" fontSize="10px" px={2.5} py={1} borderRadius="md" textTransform="none" border="none">{am}</Badge>)}
                                                                        </HStack>
                                                                    </Box>
                                                                    <VStack align={{base: 'start', sm: 'end'}} spacing={3} minW="140px" borderLeft={{sm: "1px dashed"}} borderColor={borderColor} pl={{sm: 6}}>
                                                                        <Box textAlign={{base: 'left', sm: 'right'}}>
                                                                            <Text fontSize="10px" color={textMuted} fontWeight="bold" textTransform="uppercase" letterSpacing="1px" mb={1}>Giá mỗi giờ</Text>
                                                                            <Text fontWeight="900" color={isPriceZero ? "gray.500" : "green.500"} fontSize={isPriceZero ? "sm" : "2xl"} lineHeight="1">{isPriceZero ? "Đang cập nhật" : `${courtPrice.toLocaleString()}đ`}</Text>
                                                                        </Box>
                                                                        {isAdminFacility || isPriceZero ? <Button w="100%" size="sm" colorScheme="gray" variant="outline" borderRadius="full" isDisabled border="none" boxShadow={neumorphActiveShadow}>Liên hệ để chốt giá</Button> : 
                                                                        <Button w="100%" size="md" colorScheme="blue" borderRadius="xl" onClick={() => handleBookClick(court)} bgGradient="linear(to-r, blue.400, teal.400)" color="white" boxShadow="xl" _hover={{transform: 'translateY(-2px)', shadow: '2xl'}}>Đặt sân ngay</Button>}
                                                                    </VStack>
                                                                </Flex>
                                                            </Flex>
                                                        );
                                                    })}
                                                </VStack>
                                            </TabPanel>
                                        ))}
                                    </TabPanels>
                                </Tabs>
                            )}
                        </Box>

                        {/* CỘT PHẢI: REVIEW */}
                        <Flex flex={3.5} bg={neumorphBg} direction="column" position="relative" id="review-scroll-box" borderLeft={{lg: "1px solid"}} borderColor={borderColor}>
                            
                            <Box p={6} pb={4} bg={neumorphBg}>
                                <Text fontWeight="900" fontSize="xl" mb={4} color={textColor}>Đánh giá ({reviews.length})</Text>
                                <Flex align="center" bg={neumorphBg} p={5} borderRadius="2xl" boxShadow={neumorphActiveShadow}>
                                    <Box textAlign="center" mr={5} pr={5} borderRight="1px solid" borderColor={borderColor}>
                                        <Text fontSize="5xl" fontWeight="900" color={textColor} lineHeight="1">{avgRatingCalc}</Text>
                                        <Box mt={2}><StarRating rating={Math.round(avgRatingCalc)} size={4}/></Box>
                                    </Box>
                                    <VStack align="start" spacing={1} flex={1}>
                                        <Text fontSize="md" fontWeight="bold" color={textColor}>{avgRatingCalc >= 4 ? 'Tuyệt vời' : avgRatingCalc >= 3 ? 'Khá tốt' : 'Bình thường'}</Text>
                                        <Text fontSize="sm" color={textMuted}>Dựa trên {reviews.length} đánh giá</Text>
                                    </VStack>
                                </Flex>
                            </Box>

                            {/* 🔥 BỘ LỌC SAO */}
                            <Box px={6} py={2} bg={neumorphBg}>
                                <HStack overflowX="auto" className="hide-scrollbar" spacing={3} pb={2}>
                                    <Button size="sm" borderRadius="full" flexShrink={0} onClick={() => setFilterStar('all')} color={filterStar === 'all' ? "blue.500" : textColor} bg={neumorphBg} boxShadow={filterStar === 'all' ? neumorphActiveShadow : neumorphShadow} border="none">
                                        Tất cả
                                    </Button>
                                    {[5, 4, 3, 2, 1].map(star => (
                                        <Button key={star} size="sm" borderRadius="full" flexShrink={0} onClick={() => setFilterStar(star)} color={filterStar === star ? "orange.500" : textColor} bg={neumorphBg} boxShadow={filterStar === star ? neumorphActiveShadow : neumorphShadow} border="none" leftIcon={<Icon as={FaStar} color={filterStar === star ? "orange.500" : "gray.400"} />}>
                                            {star} ({starCounts[star]})
                                        </Button>
                                    ))}
                                </HStack>
                            </Box>

                            <Box flex={1} p={6} pb={6} bg={neumorphBg}>
                                <VStack align="stretch" spacing={5}>
                                    {currentReviews.length === 0 ? (
                                        <Text fontSize="sm" color={textMuted} textAlign="center" py={10} fontStyle="italic" bg={neumorphBg} p={4} borderRadius="xl" boxShadow={neumorphActiveShadow}>
                                            {filterStar === 'all' ? "Chưa có đánh giá nào. Hãy là người đầu tiên!" : `Không có đánh giá ${filterStar} sao nào.`}
                                        </Text>
                                    ) : (
                                        currentReviews.map(r => (
                                            <Box key={r.id} bg={neumorphBg} p={5} borderRadius="2xl" boxShadow={neumorphShadow} border="none">
                                                <HStack align="start" spacing={4} justify="space-between">
                                                    <HStack align="start" spacing={3}>
                                                        <Avatar size="sm" src={getImgUrl(r.avatar_url)} name={r.full_name} border="2px solid" borderColor={neumorphBg} boxShadow={neumorphShadow}/>
                                                        <Box>
                                                            <HStack align="center">
                                                                <Text fontWeight="800" fontSize="sm" color={textColor}>{r.full_name || 'Khách'}</Text>
                                                                <Text fontSize="10px" color={textMuted} fontWeight="bold">• {new Date(r.created_at).toLocaleDateString('vi-VN')}</Text>
                                                            </HStack>
                                                            <Box mt={1.5} mb={2}><StarRating rating={r.rating} size={3} /></Box>
                                                            <Text fontSize="sm" color={textColor} lineHeight="1.6">{r.comment}</Text>
                                                            {r.image_url && (
                                                                <Box mt={3} borderRadius="lg" overflow="hidden" display="inline-block" cursor="zoom-in" onClick={() => handleOpenLightbox(0, [r.image_url])} border="2px solid" borderColor={neumorphBg} boxShadow={neumorphShadow}>
                                                                    <Image src={getImgUrl(r.image_url)} h="80px" w="100px" objectFit="cover" />
                                                                </Box>
                                                            )}
                                                        </Box>
                                                    </HStack>
                                                    
                                                    {currentUser && currentUser.id === r.user_id && (
                                                        <Menu>
                                                            <MenuButton as={IconButton} icon={<FaEllipsisV />} size="sm" bg={neumorphBg} color={textMuted} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} borderRadius="full" border="none"/>
                                                            <MenuList minW="120px" py={2} shadow="2xl" bg={neumorphBg} border="none" borderRadius="xl">
                                                                <MenuItem icon={<FaEdit />} fontSize="sm" bg={neumorphBg} _hover={{boxShadow: neumorphActiveShadow}} onClick={() => handleEditClick(r)} color={textColor}>Sửa</MenuItem>
                                                                <MenuItem icon={<FaTrash />} fontSize="sm" color="red.500" bg={neumorphBg} _hover={{boxShadow: neumorphActiveShadow}} onClick={() => handleDeleteReview(r.id)}>Xóa</MenuItem>
                                                            </MenuList>
                                                        </Menu>
                                                    )}
                                                </HStack>
                                            </Box>
                                        ))
                                    )}

                                    {/* 🔥 PHÂN TRANG */}
                                    {totalPages > 1 && (
                                        <Flex justify="center" mt={4} mb={2} gap={4} align="center">
                                            <IconButton icon={<FaChevronLeft/>} size="sm" isRound bg={neumorphBg} color="blue.500" boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} border="none" isDisabled={currentPage === 1} onClick={() => { setCurrentPage(p => p - 1); scrollToTopReview(); }} />
                                            <Text fontSize="sm" fontWeight="bold" color={textMuted}>Trang <Text as="span" color="blue.500" fontWeight="900">{currentPage}</Text> / {totalPages}</Text>
                                            <IconButton icon={<FaChevronRight/>} size="sm" isRound bg={neumorphBg} color="blue.500" boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} border="none" isDisabled={currentPage === totalPages} onClick={() => { setCurrentPage(p => p + 1); scrollToTopReview(); }} />
                                        </Flex>
                                    )}

                                </VStack>
                            </Box>

                            <Box p={5} bg={neumorphBg} position="sticky" bottom={-1} zIndex={100} boxShadow="0 -10px 20px rgba(0,0,0,0.05)" mt="auto" borderTop="1px solid" borderColor={borderColor}>
                                <VStack spacing={4} align="stretch">
                                    <HStack justify="space-between" px={2}>
                                        <Text fontSize="xs" fontWeight="bold" color={textMuted} textTransform="uppercase">{editReviewId ? "Sửa đánh giá:" : "Xếp hạng:"}</Text>
                                        <StarRating rating={newRating} setRating={setNewRating} isInteractive={true} size={6} />
                                    </HStack>
                                    
                                    {reviewImagePreview && (
                                        <Box position="relative" display="inline-block" w="fit-content" mb={2}>
                                            <Image src={reviewImagePreview} h="70px" borderRadius="lg" border="3px solid" borderColor={neumorphBg} boxShadow={neumorphShadow} />
                                            <IconButton icon={<FaTimes />} size="xs" position="absolute" top={-2} right={-2} isRound bg="red.500" color="white" boxShadow={neumorphShadow} border="none" onClick={() => { setReviewImage(null); setReviewImagePreview(null); if(fileInputRef.current) fileInputRef.current.value = ""; }} />
                                        </Box>
                                    )}

                                    <Flex bg={neumorphBg} p={2} borderRadius="2xl" boxShadow={neumorphActiveShadow} align="center">
                                        <Input type="file" accept="image/*" display="none" ref={fileInputRef} onChange={handleImageChange} />
                                        <IconButton icon={<FaImage/>} bg="transparent" color="blue.500" size="sm" isRound onClick={() => fileInputRef.current.click()} isDisabled={!currentUser} aria-label="Upload Image" border="none"/>
                                        <Input placeholder={currentUser ? "Chia sẻ trải nghiệm..." : "Đăng nhập để đánh giá"} variant="unstyled" px={3} fontSize="sm" fontWeight="bold" color={textColor} value={newComment} onChange={e=>setNewComment(e.target.value)} isDisabled={!currentUser} />
                                        {editReviewId && <Button size="sm" variant="ghost" colorScheme="gray" mr={2} onClick={clearReviewForm}>Hủy</Button>}
                                        <Button size="md" colorScheme="blue" onClick={handleSubmitReview} isLoading={submittingReview} isDisabled={!currentUser || !newComment.trim()} borderRadius="xl" px={6} shadow="lg" bgGradient="linear(to-r, blue.400, teal.400)">{editReviewId ? "Cập nhật" : "Gửi"}</Button>
                                    </Flex>
                                </VStack>
                            </Box>
                        </Flex>
                    </ModalBody>
                </ModalContent>
            </Modal>

            {lightboxIndex >= 0 && (
                <Box position="fixed" inset={0} zIndex={9999} bg="rgba(0,0,0,0.9)" backdropFilter="blur(10px)" display="flex" alignItems="center" justifyContent="center" onClick={closeLightbox}>
                    <IconButton icon={<FaTimes/>} position="absolute" top={6} right={6} colorScheme="whiteAlpha" isRound onClick={closeLightbox} size="lg" shadow="dark-lg"/>
                    <IconButton icon={<FaChevronLeft/>} position="absolute" left={6} colorScheme="whiteAlpha" isRound onClick={prevImage} size="lg" shadow="dark-lg"/>
                    <VStack spacing={4} maxW="90vw"><Image src={getImgUrl(lightboxImages[lightboxIndex])} maxH="85vh" objectFit="contain" borderRadius="xl" onClick={(e)=>e.stopPropagation()} shadow="dark-lg"/></VStack>
                    <IconButton icon={<FaChevronRight/>} position="absolute" right={6} colorScheme="whiteAlpha" isRound onClick={nextImage} size="lg" shadow="dark-lg"/>
                </Box>
            )}
        </>
    );
};

export default FacilityDetailModal;