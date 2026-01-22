import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
    Box, SimpleGrid, FormControl, FormLabel, Input, Button, Divider, Text,
    HStack, VStack, Image, Badge, Icon, Flex, useToast, Spinner, Skeleton, useColorModeValue
} from '@chakra-ui/react';
import { FaSearch, FaCrown, FaCalendarAlt, FaClock, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { MdSportsSoccer } from "react-icons/md";

// Helper lấy ảnh
const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url.substring(1) : url;
    return `http://localhost:5000/${cleanPath}`;
};

const BookingModal = ({ court, isOpen, onClose }) => {
    const today = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState(today);
    const [startTime, setStartTime] = useState('17:00');
    const [endTime, setEndTime] = useState('18:00');
    
    const [availableCourts, setAvailableCourts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const toast = useToast();

    // Theme colors
    const bgInput = useColorModeValue('white', 'gray.700');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const cardHoverBorder = useColorModeValue('blue.400', 'blue.300');

    // 1. Kiểm tra sân trống
    const handleCheckAvailability = async () => {
        if (!court) return;
        setLoading(true);
        setHasSearched(true);
        // Ưu tiên dùng facility_id nếu có
        const facilityId = court.facility_id || court.id; 

        try {
            const res = await axios.get(`http://localhost:5000/api/facilities/${facilityId}/check`, {
                params: { date, start: startTime, end: endTime }
            });
            setAvailableCourts(res.data);
        } catch (err) {
            console.error(err);
            toast({ title: 'Lỗi tìm sân', description: 'Có thể quán này chưa cấu hình API check', status: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // 2. Đặt sân
    const handleBooking = async (selectedSubCourt) => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return toast({ title: 'Vui lòng đăng nhập!', status: 'warning' });
        
        try {
            await axios.post('http://localhost:5000/api/bookings', {
                user_id: user.id,
                court_id: selectedSubCourt.id,
                booking_date: date,
                start_time: startTime,
                end_time: endTime,
                total_price: selectedSubCourt.price_per_hour
            });
            
            toast({ title: 'Đặt sân thành công!', status: 'success' });
            handleCheckAvailability(); // Load lại để cập nhật trạng thái
        } catch (err) {
            console.error(err);
            toast({ title: 'Đặt thất bại', description: err.response?.data?.message || 'Lỗi server', status: 'error' });
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside" isCentered>
            <ModalOverlay backdropFilter="blur(4px)" />
            <ModalContent borderRadius="2xl" overflow="hidden">
                {/* HEADER CÓ ẢNH NỀN */}
                <Box position="relative" h="120px" bg="blue.600">
                    <Image 
                        src={getImgUrl(court?.image_url)} 
                        w="100%" h="100%" objectFit="cover" opacity={0.6} 
                        fallbackSrc="https://via.placeholder.com/600x120"
                    />
                    <Box position="absolute" top={0} left={0} right={0} bottom={0} bgGradient="linear(to-b, transparent, rgba(0,0,0,0.8))" />
                    <VStack position="absolute" bottom={4} left={6} align="start" spacing={0}>
                        <Badge colorScheme="yellow" mb={1} fontSize="xs">{court?.type || 'Thể thao'}</Badge>
                        <Text color="white" fontWeight="900" fontSize="2xl" textShadow="0 2px 4px rgba(0,0,0,0.6)">
                            {court?.name}
                        </Text>
                    </VStack>
                    <ModalCloseButton color="white" size="lg" top={3} right={3} />
                </Box>

                <ModalBody p={6} bg={useColorModeValue('gray.50', 'gray.800')}>
                    {/* KHUNG CHỌN NGÀY GIỜ */}
                    <Box bg={useColorModeValue('white', 'gray.700')} p={5} borderRadius="xl" shadow="sm" mb={6} border="1px solid" borderColor={borderColor}>
                        <Text fontWeight="bold" mb={4} display="flex" alignItems="center" gap={2}>
                            <Icon as={FaCalendarAlt} color="blue.500"/> Chọn thời gian chơi
                        </Text>
                        <SimpleGrid columns={{base: 1, md: 3}} spacing={4} mb={4}>
                            <FormControl>
                                <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">NGÀY</FormLabel>
                                <Input type="date" bg={bgInput} value={date} min={today} onChange={e => setDate(e.target.value)} size="sm" borderRadius="md"/>
                            </FormControl>
                            <FormControl>
                                <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">BẮT ĐẦU</FormLabel>
                                <Input type="time" bg={bgInput} value={startTime} onChange={e => setStartTime(e.target.value)} size="sm" borderRadius="md"/>
                            </FormControl>
                            <FormControl>
                                <FormLabel fontSize="xs" fontWeight="bold" color="gray.500">KẾT THÚC</FormLabel>
                                <Input type="time" bg={bgInput} value={endTime} onChange={e => setEndTime(e.target.value)} size="sm" borderRadius="md"/>
                            </FormControl>
                        </SimpleGrid>
                        <Button 
                            w="100%" colorScheme="blue" size="md" 
                            leftIcon={loading ? <Spinner size="xs"/> : <FaSearch />} 
                            onClick={handleCheckAvailability} 
                            isLoading={loading}
                            loadingText="Đang tìm sân..."
                            borderRadius="lg"
                            shadow="md"
                            _hover={{ transform: 'translateY(-2px)', shadow: 'lg' }}
                        >
                            Kiểm tra sân trống
                        </Button>
                    </Box>

                    {/* KẾT QUẢ TÌM KIẾM */}
                    {hasSearched && (
                        <Box>
                            <HStack justify="space-between" mb={3}>
                                <Text fontWeight="bold" fontSize="md">Kết quả tìm kiếm</Text>
                                <Badge colorScheme={availableCourts.length > 0 ? "green" : "red"}>
                                    {availableCourts.length} sân trống
                                </Badge>
                            </HStack>
                            
                            {/* Loading Skeleton */}
                            {loading && (
                                <SimpleGrid columns={1} spacing={3}>
                                    <Skeleton height="80px" borderRadius="lg"/>
                                    <Skeleton height="80px" borderRadius="lg"/>
                                </SimpleGrid>
                            )}

                            {/* Empty State */}
                            {!loading && availableCourts.length === 0 && (
                                <Flex direction="column" align="center" justify="center" py={8} bg="white" borderRadius="xl" border="1px dashed" borderColor="gray.300">
                                    <Icon as={FaExclamationCircle} boxSize={10} color="gray.400" mb={2}/>
                                    <Text color="gray.500" fontWeight="medium">Hết sân trong khung giờ này!</Text>
                                    <Text fontSize="xs" color="gray.400">Vui lòng chọn giờ khác.</Text>
                                </Flex>
                            )}

                            {/* Court List */}
                            {!loading && availableCourts.length > 0 && (
                                <VStack spacing={3} align="stretch" maxH="300px" overflowY="auto" pr={1} className="custom-scroll">
                                    {availableCourts.map((c) => (
                                        <Box 
                                            key={c.id} 
                                            p={3} 
                                            bg={useColorModeValue('white', 'gray.700')} 
                                            borderRadius="xl" 
                                            border="1px solid" 
                                            borderColor={borderColor}
                                            transition="all 0.2s"
                                            _hover={{ borderColor: cardHoverBorder, shadow: 'md' }}
                                        >
                                            <Flex justify="space-between" align="center">
                                                <HStack spacing={3}>
                                                    <Image 
                                                        src={getImgUrl(c.image_url)} 
                                                        boxSize="50px" borderRadius="lg" objectFit="cover" 
                                                        fallbackSrc="https://via.placeholder.com/50?text=San"
                                                    />
                                                    <VStack align="start" spacing={0}>
                                                        <HStack>
                                                            <Text fontWeight="bold" fontSize="sm">{c.name}</Text>
                                                            {(c.price_per_hour >= 100000 || c.name.toLowerCase().includes('vip')) && (
                                                                <Icon as={FaCrown} color="yellow.400" boxSize={3}/>
                                                            )}
                                                        </HStack>
                                                        <Text fontSize="xs" color="gray.500">{c.type || 'Sân tiêu chuẩn'}</Text>
                                                    </VStack>
                                                </HStack>

                                                <VStack align="end" spacing={1}>
                                                    <Text fontWeight="bold" color="green.500" fontSize="md">
                                                        {parseInt(c.price_per_hour).toLocaleString()} đ
                                                    </Text>
                                                    <Button 
                                                        size="xs" colorScheme="green" px={4} 
                                                        onClick={() => handleBooking(c)}
                                                        leftIcon={<FaCheckCircle/>}
                                                    >
                                                        Đặt ngay
                                                    </Button>
                                                </VStack>
                                            </Flex>
                                        </Box>
                                    ))}
                                </VStack>
                            )}
                        </Box>
                    )}

                    {!hasSearched && !loading && (
                        <Flex direction="column" align="center" justify="center" py={10} opacity={0.6}>
                            <Icon as={MdSportsSoccer} boxSize={16} color="gray.300" mb={3}/>
                            <Text color="gray.500">Vui lòng chọn ngày giờ và bấm "Kiểm tra"</Text>
                        </Flex>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default BookingModal;