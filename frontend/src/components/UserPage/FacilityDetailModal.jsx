import React, { useState, useEffect, useMemo } from 'react';
import { 
    Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton, 
    Box, Image, Text, HStack, Badge, Button, Divider, Tabs, TabList, Tab, TabPanels, TabPanel, 
    VStack, Spinner, useColorModeValue, Icon, Tag, Flex, Avatar, IconButton, Input, useToast, Tooltip, 
    Popover, PopoverTrigger, PopoverContent, PopoverBody, PopoverArrow 
} from '@chakra-ui/react';
import { 
    FaClock, FaLocationArrow, FaRoute, FaDirections, FaPhone, FaFacebook, 
    FaStar, FaPaperPlane, FaTemperatureHigh, FaUmbrella, FaWind, FaCloudSun, 
    FaCamera, FaChevronLeft, FaChevronRight, FaTimes, FaInfoCircle
} from 'react-icons/fa';
import { SiZalo } from 'react-icons/si';
import axios from 'axios';

// 🔥 API Key thời tiết
const OPEN_WEATHER_API_KEY = '9664ec0f743a300f9f9ca359e63b7f68'; 

const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `http://localhost:5000/${url.startsWith('/') ? url.substring(1) : url}`;
};

const StarRating = ({ rating, setRating, isInteractive = false }) => (
    <HStack spacing={1}>
        {[1, 2, 3, 4, 5].map((star) => (
            <Icon 
                key={star} as={FaStar} 
                color={star <= rating ? "orange.400" : "gray.300"} 
                cursor={isInteractive ? "pointer" : "default"}
                onClick={() => isInteractive && setRating(star)}
                w={isInteractive ? 5 : 3} h={isInteractive ? 5 : 3}
            />
        ))}
    </HStack>
);

const FacilityDetailModal = ({ isOpen, onClose, facility, onBookCourt, onDrawRoute }) => {
    const [courts, setCourts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [weather, setWeather] = useState(null);
    const [reviews, setReviews] = useState([]);
    
    // State cho form đánh giá
    const [newRating, setNewRating] = useState(5);
    const [newComment, setNewComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    
    // State Tab & Lightbox
    const [tabIndex, setTabIndex] = useState(0);
    const [lightboxIndex, setLightboxIndex] = useState(-1);
    const [lightboxImages, setLightboxImages] = useState([]); 
    const [lightboxTitle, setLightboxTitle] = useState('');   
    
    const bg = useColorModeValue('white', 'gray.800');
    const toast = useToast();
    const currentUser = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        if (isOpen && facility) {
            setLoading(true);
            setTabIndex(0);
            const fetchData = async () => {
                try {
                    const courtsRes = await axios.get(`http://localhost:5000/api/facilities/${facility.id}/courts-detail`);
                    setCourts(courtsRes.data);

                    const reviewRes = await axios.get(`http://localhost:5000/api/reviews/facility/${facility.id}`); 
                    setReviews(reviewRes.data);

                    if (facility.lat && facility.lng) {
                        try {
                            const weatherRes = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${facility.lat}&lon=${facility.lng}&appid=${OPEN_WEATHER_API_KEY}&units=metric&lang=vi`);
                            setWeather(weatherRes.data);
                        } catch (e) {}
                    }
                } catch (e) { console.error(e); } 
                finally { setLoading(false); }
            };
            fetchData();
        }
    }, [isOpen, facility]);

    // Hàm gửi đánh giá
    const handleSubmitReview = async () => {
        if (!currentUser) return toast({ title: "Vui lòng đăng nhập!", status: "warning", position: "top" });
        if (!newComment.trim()) return toast({ title: "Nhập nội dung đi bạn ơi!", status: "warning", position: "top" });
        if (courts.length === 0) return toast({ title: "Chưa có sân để đánh giá!", status: "error", position: "top" });

        setSubmittingReview(true);
        try {
            await axios.post('http://localhost:5000/api/reviews', {
                court_id: courts[0].id,
                user_id: currentUser.id,
                rating: newRating,
                comment: newComment
            });
            toast({ title: "Đánh giá thành công!", status: "success", position: "top" });
            setNewComment('');
            setNewRating(5);
            const reviewRes = await axios.get(`http://localhost:5000/api/reviews/facility/${facility.id}`);
            setReviews(reviewRes.data);
        } catch (error) {
            toast({ title: "Lỗi rồi!", status: "error", position: "top" });
        } finally {
            setSubmittingReview(false);
        }
    };

    const groupedCourts = useMemo(() => {
        const groups = {};
        courts.forEach(c => { if (!groups[c.type]) groups[c.type] = []; groups[c.type].push(c); });
        return groups;
    }, [courts]);

    const sportTypes = Object.keys(groupedCourts);

    const currentTabImages = useMemo(() => {
        if (sportTypes.length === 0) return facility?.image_url ? [facility.image_url] : [];
        const currentType = sportTypes[tabIndex];
        const courtsInTab = groupedCourts[currentType] || [];
        let imgs = [];
        courtsInTab.forEach(c => {
            if (c.image_url) imgs.push(c.image_url);
            if (c.images && Array.isArray(c.images)) imgs.push(...c.images);
        });
        if (imgs.length === 0 && facility?.image_url) imgs.push(facility.image_url);
        return [...new Set(imgs)].filter(url => url && url.length > 5);
    }, [groupedCourts, tabIndex, facility, sportTypes]);

    const handleOpenLightbox = (index, imageList, title = '') => {
        setLightboxImages(imageList);
        setLightboxIndex(index);
        setLightboxTitle(title);
    };

    const closeLightbox = () => setLightboxIndex(-1);
    const nextImage = (e) => { e.stopPropagation(); setLightboxIndex((prev) => (prev + 1) % lightboxImages.length); };
    const prevImage = (e) => { e.stopPropagation(); setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length); };

    if (!facility) return null;

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered scrollBehavior="inside">
                <ModalOverlay backdropFilter="blur(5px)" />
                <ModalContent borderRadius="xl" maxH="90vh" overflow="hidden">
                    
                    {/* HEADER ẢNH */}
                    <Box position="relative" h="250px" cursor="pointer" onClick={() => handleOpenLightbox(0, currentTabImages, `Tổng quan ${sportTypes[tabIndex] || ''}`)}>
                        <Image 
                            src={getImgUrl(currentTabImages[0] || facility.image_url)} 
                            w="100%" h="100%" objectFit="cover" 
                            fallbackSrc="https://placehold.co/800x400?text=San+The+Thao"
                        />
                        <Box position="absolute" inset={0} bgGradient="linear(to-t, blackAlpha.900, transparent)" />
                        <ModalCloseButton zIndex={10} bg="whiteAlpha.200" color="white" borderRadius="full" top={4} right={4}/>
                        
                        <Badge position="absolute" top={4} left={4} bg="blackAlpha.600" color="white" px={3} py={1} borderRadius="full" display="flex" alignItems="center">
                            <Icon as={FaCamera} mr={2}/> {currentTabImages.length} Ảnh Tổng Quan
                        </Badge>

                        <Box position="absolute" bottom={0} left={0} right={0} p={6}>
                            <HStack align="end" justify="space-between">
                                <Box>
                                    <Text color="white" fontSize="3xl" fontWeight="900">{facility.name}</Text>
                                    <HStack mt={2} spacing={3}>
                                        <Badge colorScheme="green">Mở cửa</Badge>
                                        <Text color="gray.300" fontSize="sm" fontWeight="bold"><Icon as={FaClock} mr={1}/>{facility.open_time} - {facility.close_time}</Text>
                                        <HStack spacing={1}><Icon as={FaStar} color="yellow.400"/><Text color="white" fontWeight="bold">{parseFloat(facility.avg_rating || 5).toFixed(1)}</Text></HStack>
                                    </HStack>
                                </Box>
                                {/* 🔥 ĐÃ SỬA LINK GOOGLE MAPS Ở ĐÂY */}
                                <Button 
                                    size="sm" 
                                    colorScheme="blue" 
                                    leftIcon={<FaDirections/>} 
                                    onClick={(e) => {
                                        e.stopPropagation(); 
                                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`, '_blank');
                                    }}
                                >
                                    Google Map
                                </Button>
                            </HStack>
                        </Box>
                    </Box>

                    <ModalBody p={0} bg={bg}>
                        <Flex direction={{base: 'column', md: 'row'}}>
                            {/* CỘT TRÁI */}
                            <Box flex={2} p={6} borderRight="1px solid" borderColor="gray.100">
                                {/* Thông tin chủ sân */}
                                <Box mb={6} bg="blue.50" p={4} borderRadius="xl" border="1px dashed" borderColor="blue.200">
                                    <HStack justify="space-between">
                                        <HStack spacing={3}>
                                            <Avatar size="md" src={getImgUrl(facility.owner_avatar)} name={facility.owner_name} border="2px solid white" shadow="sm"/>
                                            <Box><Text fontWeight="bold" fontSize="md">{facility.owner_name}</Text><Text fontSize="xs" color="gray.600">Chủ sở hữu</Text></Box>
                                        </HStack>
                                        <HStack>
                                            {facility.phone_number && <Tooltip label="Gọi ngay"><IconButton icon={<FaPhone/>} isRound colorScheme="green" size="sm" as="a" href={`tel:${facility.phone_number}`}/></Tooltip>}
                                            {facility.zalo_url && <Tooltip label="Zalo"><IconButton icon={<SiZalo/>} isRound colorScheme="blue" size="sm" onClick={() => window.open(facility.zalo_url, '_blank')}/></Tooltip>}
                                            {facility.facebook_url && <Tooltip label="Facebook"><IconButton icon={<FaFacebook/>} isRound colorScheme="facebook" size="sm" onClick={() => window.open(facility.facebook_url, '_blank')}/></Tooltip>}
                                        </HStack>
                                    </HStack>
                                </Box>

                                {/* Thời tiết */}
                                {weather && (
                                    <HStack mb={6} spacing={4} bg="orange.50" p={3} borderRadius="lg" border="1px solid" borderColor="orange.200">
                                        <Image src={`http://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`} w="60px"/>
                                        <Box>
                                            <Text fontWeight="bold" fontSize="lg" color="orange.700">{Math.round(weather.main.temp)}°C - {weather.weather[0].description}</Text>
                                            <HStack fontSize="xs" color="gray.600" spacing={3}><Text><Icon as={FaUmbrella} mr={1}/>Ẩm: {weather.main.humidity}%</Text><Text><Icon as={FaWind} mr={1}/>Gió: {weather.wind.speed} m/s</Text></HStack>
                                        </Box>
                                    </HStack>
                                )}

                                <HStack mb={4} justify="space-between">
                                    <Text fontWeight="bold" fontSize="lg">Danh sách sân bãi</Text>
                                    <Button size="sm" leftIcon={<FaRoute />} colorScheme="orange" onClick={() => { onClose(); onDrawRoute(facility); }}>Dẫn đường (App)</Button>
                                </HStack>

                                {/* DANH SÁCH SÂN */}
                                {loading ? <Flex justify="center" py={10}><Spinner /></Flex> : (
                                    <Tabs variant="soft-rounded" colorScheme="blue" size="sm" index={tabIndex} onChange={(index) => setTabIndex(index)}>
                                        <TabList mb={4} overflowX="auto" py={1}>
                                            {sportTypes.map(type => (
                                                <Tab key={type} textTransform="capitalize" px={4}>{type} ({groupedCourts[type].length})</Tab>
                                            ))}
                                        </TabList>
                                        <TabPanels>
                                            {sportTypes.map(type => (
                                                <TabPanel key={type} p={0}>
                                                    <VStack spacing={3} align="stretch">
                                                        {groupedCourts[type].map(court => {
                                                            const thisCourtImages = [];
                                                            if (court.image_url) thisCourtImages.push(court.image_url);
                                                            if (court.images) thisCourtImages.push(...court.images);
                                                            
                                                            const amenitiesList = court.amenities ? court.amenities.split(',') : [];
                                                            const displayAmenities = amenitiesList.slice(0, 2);
                                                            const hiddenCount = amenitiesList.length - 2;

                                                            return (
                                                                <HStack key={court.id} p={3} border="1px solid" borderColor="gray.200" borderRadius="lg" justify="space-between" _hover={{borderColor:'blue.400', shadow:'md', bg:'blue.50'}} transition="all 0.2s">
                                                                    <HStack spacing={4}>
                                                                        <Box position="relative" cursor="zoom-in" onClick={() => handleOpenLightbox(0, thisCourtImages, court.name)}>
                                                                            <Image 
                                                                                src={getImgUrl(court.image_url || facility.image_url)} 
                                                                                w="80px" h="80px" objectFit="cover" borderRadius="md" 
                                                                                fallbackSrc="https://placehold.co/80"
                                                                            />
                                                                            {thisCourtImages.length > 1 && (
                                                                                <Badge position="absolute" bottom={1} right={1} bg="blackAlpha.700" color="white" fontSize="9px">+{thisCourtImages.length - 1}</Badge>
                                                                            )}
                                                                        </Box>

                                                                        <Box>
                                                                            <Text fontWeight="bold" fontSize="md" color="blue.700">{court.name}</Text>
                                                                            <HStack mt={1} spacing={2}>
                                                                                <Tag size="sm" colorScheme={court.name.includes('VIP')?'orange':'gray'}>{court.name.includes('VIP')?'VIP':'Thường'}</Tag>
                                                                                {displayAmenities.map((am, i) => <Tag key={i} size="sm" variant="outline" colorScheme="teal">{am}</Tag>)}
                                                                                {hiddenCount > 0 && (
                                                                                    <Popover trigger="hover" placement="top">
                                                                                        <PopoverTrigger>
                                                                                            <Tag size="sm" variant="solid" colorScheme="gray" cursor="pointer">+{hiddenCount}</Tag>
                                                                                        </PopoverTrigger>
                                                                                        <PopoverContent w="auto" maxW="200px">
                                                                                            <PopoverArrow />
                                                                                            <PopoverBody fontSize="xs">
                                                                                                <Text fontWeight="bold" mb={1}>Tiện ích đầy đủ:</Text>
                                                                                                <VStack align="start" spacing={1}>
                                                                                                    {amenitiesList.map((am, idx) => <Text key={idx}>• {am}</Text>)}
                                                                                                </VStack>
                                                                                            </PopoverBody>
                                                                                        </PopoverContent>
                                                                                    </Popover>
                                                                                )}
                                                                            </HStack>
                                                                        </Box>
                                                                    </HStack>
                                                                    <VStack align="end" spacing={1}>
                                                                        <Text fontWeight="900" color="green.600" fontSize="lg">{parseInt(court.price_per_hour).toLocaleString()}đ</Text>
                                                                        <Button size="sm" colorScheme="green" onClick={() => onBookCourt(court)}>Đặt ngay</Button>
                                                                    </VStack>
                                                                </HStack>
                                                            );
                                                        })}
                                                    </VStack>
                                                </TabPanel>
                                            ))}
                                        </TabPanels>
                                    </Tabs>
                                )}
                            </Box>

                            {/* CỘT PHẢI (REVIEW) */}
                            <Box flex={1} p={6} bg="gray.50">
                                <Text fontWeight="bold" fontSize="lg" mb={4}>Đánh giá & Bình luận</Text>
                                <Box bg="white" p={4} borderRadius="lg" shadow="sm" mb={4} border="1px solid" borderColor="gray.200">
                                    <Text fontSize="xs" fontWeight="bold" mb={2}>Viết đánh giá của bạn:</Text>
                                    <HStack mb={2}>
                                        <StarRating rating={newRating} setRating={setNewRating} isInteractive={true} />
                                        <Text fontSize="xs" color="gray.500">({newRating}/5)</Text>
                                    </HStack>
                                    <HStack>
                                        <Input 
                                            placeholder={currentUser ? "Nhập bình luận..." : "Đăng nhập để bình luận"} 
                                            size="sm" 
                                            value={newComment} 
                                            onChange={e=>setNewComment(e.target.value)}
                                            isDisabled={!currentUser}
                                        />
                                        <IconButton 
                                            icon={<FaPaperPlane/>} 
                                            size="sm" 
                                            colorScheme="blue" 
                                            onClick={handleSubmitReview} 
                                            isLoading={submittingReview}
                                            isDisabled={!currentUser}
                                        />
                                    </HStack>
                                </Box>

                                <VStack align="stretch" spacing={3} maxH="400px" overflowY="auto" className="custom-scroll" pr={1}>
                                    {reviews.length === 0 && <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>Chưa có đánh giá nào.</Text>}
                                    {reviews.map(r => (
                                        <Box key={r.id} bg="white" p={3} borderRadius="lg" shadow="sm">
                                            <HStack align="start" spacing={3}>
                                                <Avatar size="xs" src={getImgUrl(r.avatar_url)} name={r.full_name} />
                                                <Box>
                                                    <HStack>
                                                        <Text fontWeight="bold" fontSize="xs">{r.full_name || 'Người dùng'}</Text>
                                                        <StarRating rating={r.rating}/>
                                                    </HStack>
                                                    <Text fontSize="sm" mt={1}>{r.comment}</Text>
                                                    <Text fontSize="xs" color="gray.400" mt={1}>{new Date(r.created_at).toLocaleDateString('vi-VN')}</Text>
                                                </Box>
                                            </HStack>
                                        </Box>
                                    ))}
                                </VStack>
                            </Box>
                        </Flex>
                    </ModalBody>
                </ModalContent>
            </Modal>

            {/* LIGHTBOX */}
            {lightboxIndex >= 0 && (
                <Box position="fixed" top={0} left={0} right={0} bottom={0} zIndex={9999} bg="rgba(0,0,0,0.95)" display="flex" alignItems="center" justifyContent="center" onClick={closeLightbox}>
                    <IconButton icon={<FaTimes/>} position="absolute" top={4} right={4} colorScheme="whiteAlpha" isRound onClick={closeLightbox} size="lg"/>
                    <IconButton icon={<FaChevronLeft/>} position="absolute" left={4} colorScheme="whiteAlpha" isRound onClick={prevImage} size="lg"/>
                    
                    <VStack>
                        <Image src={getImgUrl(lightboxImages[lightboxIndex])} maxH="85vh" maxW="90vw" objectFit="contain" onClick={(e)=>e.stopPropagation()}/>
                        {lightboxTitle && <Text color="white" fontWeight="bold" fontSize="lg" mt={2}>{lightboxTitle}</Text>}
                        <Text color="gray.300" fontSize="sm">{lightboxIndex + 1} / {lightboxImages.length}</Text>
                    </VStack>

                    <IconButton icon={<FaChevronRight/>} position="absolute" right={4} colorScheme="whiteAlpha" isRound onClick={nextImage} size="lg"/>
                </Box>
            )}
        </>
    );
};

export default FacilityDetailModal;