import React, { useState, useEffect, useMemo } from 'react';
import {
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
    Button, FormControl, FormLabel, Input, Select, VStack, HStack, Text, useToast, Image, Box, Badge, Spinner, Icon,
    useColorModeValue, Divider
} from '@chakra-ui/react';
import axios from 'axios';
import { FaCalendarAlt, FaClock, FaMoneyBillWave, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `http://localhost:5000/${url.startsWith('/') ? url.substring(1) : url}`;
};

const generateDynamicTimeSlots = (openTime, closeTime) => {
    let startH = 6; let endH = 22;
    if (openTime) startH = parseInt(openTime.split(':')[0]);
    if (closeTime) endH = parseInt(closeTime.split(':')[0]);

    const slots = [];
    if (startH <= endH) {
        for (let i = startH; i <= endH; i++) slots.push(`${i.toString().padStart(2, '0')}:00`);
    } else {
        for (let i = startH; i <= 23; i++) slots.push(`${i.toString().padStart(2, '0')}:00`);
        for (let i = 0; i <= endH; i++) slots.push(`${i.toString().padStart(2, '0')}:00`);
    }
    return slots;
};

const BookingModal = ({ isOpen, onClose, court, facility }) => {
    const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('');
    const [duration, setDuration] = useState(1);
    const [totalPrice, setTotalPrice] = useState(0);
    const [isChecking, setIsChecking] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [availabilityMsg, setAvailabilityMsg] = useState('');
    
    // 🎨 MÀU SẮC NEUMORPHISM ĐỒNG BỘ DARK MODE
    const neumorphBg = useColorModeValue('#edf2f7', '#2d3748');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '4px 4px 10px #1a202c, -4px -4px 10px #4a5568');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #1a202c, inset -4px -4px 8px #4a5568');
    
    const textColor = useColorModeValue("gray.700", "gray.200");
    const textMuted = useColorModeValue("gray.500", "gray.400");
    const headerTitleColor = useColorModeValue("blue.600", "blue.300");

    // Style chung cho Input Neumorphism (Chìm xuống)
    const inputStyle = {
        h: "45px",
        bg: neumorphBg,
        color: textColor,
        border: "none",
        boxShadow: neumorphActiveShadow,
        rounded: "xl",
        fontSize: "sm",
        fontWeight: "bold",
        _focus: {
            boxShadow: neumorphActiveShadow,
            border: "1px solid",
            borderColor: "blue.400"
        },
        _hover: { opacity: 0.9 },
        transition: "all 0.3s"
    };

    const toast = useToast();
    const user = JSON.parse(localStorage.getItem('user'));

    const dynamicTimeSlots = useMemo(() => {
        const open = facility?.open_time || court?.open_time;
        const close = facility?.close_time || court?.close_time;
        return generateDynamicTimeSlots(open, close);
    }, [court, facility]);

    const endTime = useMemo(() => {
        if (!startTime) return '';
        const [h, m] = startTime.split(':').map(Number);
        const totalMin = h * 60 + m + duration * 60;
        const endH = Math.floor(totalMin / 60) % 24; 
        const endM = totalMin % 60;
        return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
    }, [startTime, duration]);

    useEffect(() => {
        if (court && duration) setTotalPrice(court.price_per_hour * duration);
    }, [court, duration]);

    useEffect(() => {
        if (isOpen) {
            setBookingDate(new Date().toISOString().split('T')[0]);
            setAvailabilityMsg(''); setStartTime(''); setDuration(1); 
        }
    }, [isOpen]);

    const getAvailableTimeSlots = useMemo(() => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentHour = now.getHours();
        
        return dynamicTimeSlots.map(slot => {
            const slotHour = parseInt(slot.split(':')[0]);
            let isDisabled = false;
            if (bookingDate === todayStr && slotHour <= currentHour) isDisabled = true;
            return { time: slot, isDisabled };
        });
    }, [bookingDate, dynamicTimeSlots]);

    useEffect(() => {
        if (startTime) {
            const slotData = getAvailableTimeSlots.find(s => s.time === startTime);
            if (slotData && slotData.isDisabled) {
                setStartTime(''); setAvailabilityMsg('');
                toast({ title: "Giờ này đã trôi qua, vui lòng chọn giờ khác!", status: "info" });
            }
        }
    }, [bookingDate, getAvailableTimeSlots, startTime, toast]);

    const handleCheckAvailability = async () => {
        if (!bookingDate || !startTime) return toast({ title: "Chưa chọn ngày giờ!", status: "warning" });
        setIsChecking(true); setAvailabilityMsg('');
        try {
            const res = await axios.get(`http://localhost:5000/api/courts/${court.id}/check`, { 
                params: { date: bookingDate, start: startTime, end: endTime } 
            });
            if (res.data.available) setAvailabilityMsg('ok');
            else setAvailabilityMsg('booked');
        } catch (error) { setAvailabilityMsg('error'); } 
        finally { setIsChecking(false); }
    };

    const handleBooking = async () => {
        if (!user) return toast({ title: "Vui lòng đăng nhập!", status: "error" });
        if (!startTime) return toast({ title: "Chưa chọn giờ!", status: "warning" });
        if (availabilityMsg !== 'ok') return toast({ title: "😑 Vui lòng kiểm tra sân trống trước!", status: "warning" });

        setIsSubmitting(true);
        try {
            await axios.post('http://localhost:5000/api/bookings', {
                user_id: user.id,
                court_id: court.id,
                booking_date: bookingDate,
                start_time: startTime,
                end_time: endTime, 
                total_price: totalPrice
            });
            toast({ title: "😘 Đặt sân thành công!", status: "success" });
            window.dispatchEvent(new Event('refresh_notifications'));
            onClose();
        } catch (error) { toast({ title: "🤣 Lỗi đặt sân", description: error.response?.data?.message || "🥶 Lỗi server", status: "error" }); } 
        finally { setIsSubmitting(false); }
    };

    if (!court) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered motionPreset="scale">
            <ModalOverlay backdropFilter="blur(5px)" bg="blackAlpha.600" />
            <ModalContent borderRadius="3xl" bg={neumorphBg} border="none" shadow="2xl">
                <ModalHeader borderBottom="none" pb={2} pt={6} textAlign="center">
                    <Text fontSize="xl" fontWeight="900" color={headerTitleColor} textTransform="uppercase">Đặt lịch sân</Text>
                </ModalHeader>
                <ModalCloseButton color={textColor} mt={4} mr={4} bg={neumorphBg} boxShadow={neumorphShadow} borderRadius="full" _active={{boxShadow: neumorphActiveShadow}} border="none" />
                
                <ModalBody py={4} px={8}>
                    <VStack spacing={6} align="stretch">
                        
                        {/* THÔNG TIN SÂN - KHỐI NỔI LÊN */}
                        <HStack align="start" spacing={4} bg={neumorphBg} p={4} borderRadius="2xl" boxShadow={neumorphShadow} border="none">
                            <Box borderRadius="xl" overflow="hidden" boxShadow={neumorphActiveShadow} border="3px solid" borderColor={neumorphBg} w="80px" h="80px" flexShrink={0}>
                                <Image src={getImgUrl(court.image_url)} w="100%" h="100%" objectFit="cover" fallbackSrc="https://placehold.co/80x80?text=San" />
                            </Box>
                            <Box flex={1}>
                                <Text fontWeight="900" fontSize="md" color={textColor} noOfLines={1}>{court.name}</Text>
                                <Text fontSize="xs" color={textMuted} noOfLines={2} mb={2}>{court.address || 'Đang cập nhật địa chỉ'}</Text>
                                <Badge colorScheme="green" bg={useColorModeValue('green.100', 'rgba(72, 187, 120, 0.2)')} color="green.500" px={3} py={1} borderRadius="full" border="none">
                                    {parseInt(court.price_per_hour).toLocaleString()}đ / giờ
                                </Badge>
                            </Box>
                        </HStack>

                        <Divider borderColor={useColorModeValue('gray.300', 'gray.600')} opacity={0.4} />

                        {/* VÙNG CHỌN NGÀY GIỜ */}
                        <VStack spacing={4} align="stretch">
                            <FormControl>
                                <FormLabel fontSize="xs" fontWeight="bold" color={textMuted} textTransform="uppercase" ml={2} mb={1}><Icon as={FaCalendarAlt} mr={2} color="blue.500"/>Ngày đặt</FormLabel>
                                <Input type="date" value={bookingDate} onChange={(e) => {setBookingDate(e.target.value); setAvailabilityMsg('');}} min={new Date().toISOString().split('T')[0]} css={{ "::-webkit-calendar-picker-indicator": { filter: useColorModeValue("none", "invert(1)") } }} {...inputStyle} />
                            </FormControl>

                            <HStack spacing={4}>
                                <FormControl flex={1}>
                                    <FormLabel fontSize="xs" fontWeight="bold" color={textMuted} textTransform="uppercase" ml={2} mb={1}><Icon as={FaClock} mr={2} color="orange.500"/>Bắt đầu</FormLabel>
                                    <Select placeholder="Chọn giờ" value={startTime} onChange={(e) => {setStartTime(e.target.value); setAvailabilityMsg('');}} {...inputStyle}>
                                        {getAvailableTimeSlots.map(slot => (
                                            <option key={slot.time} value={slot.time} disabled={slot.isDisabled}>{slot.time} {slot.isDisabled ? '(Qua giờ)' : ''}</option>
                                        ))}
                                    </Select>
                                </FormControl>
                                
                                <FormControl w="110px">
                                    <FormLabel fontSize="xs" fontWeight="bold" color={textMuted} textTransform="uppercase" ml={2} mb={1}>Đá mấy tiếng</FormLabel>
                                    <Select value={duration} onChange={(e) => {setDuration(parseFloat(e.target.value)); setAvailabilityMsg('');}} {...inputStyle}>
                                        <option value={1}>1.0 h</option><option value={1.5}>1.5 h</option><option value={2}>2.0 h</option><option value={2.5}>2.5 h</option><option value={3}>3.0 h</option>
                                    </Select>
                                </FormControl>
                            </HStack>

                            {/* KHUNG HIỂN THỊ KẾT QUẢ KIỂM TRA GIỜ */}
                            <Box minH="40px" display="flex" alignItems="center" justifyContent="center">
                                {isChecking ? <Spinner size="sm" color="blue.500"/> : (
                                    <>
                                        {!availabilityMsg && startTime && (
                                            <Button size="sm" onClick={handleCheckAvailability} colorScheme="blue" bgGradient="linear(to-r, blue.400, teal.400)" color="white" borderRadius="full" px={6} boxShadow="lg" _active={{transform: 'translateY(2px)'}}>Kiểm tra lịch trống</Button>
                                        )}
                                        {availabilityMsg === 'ok' && (
                                            <HStack bg={useColorModeValue('green.50', 'rgba(72, 187, 120, 0.1)')} p={2} px={4} borderRadius="full" border="1px dashed" borderColor="green.400">
                                                <Icon as={FaCheckCircle} color="green.500" />
                                                <Text fontSize="sm" fontWeight="bold" color="green.500">Tuyệt vời! Sân trống từ {startTime} đến {endTime}</Text>
                                            </HStack>
                                        )}
                                        {availabilityMsg === 'booked' && (
                                            <HStack bg={useColorModeValue('red.50', 'rgba(245, 101, 101, 0.1)')} p={2} px={4} borderRadius="full" border="1px dashed" borderColor="red.400">
                                                <Icon as={FaExclamationCircle} color="red.500" />
                                                <Text fontSize="sm" fontWeight="bold" color="red.500">Giờ này đã có khách chốt rồi!</Text>
                                            </HStack>
                                        )}
                                        {availabilityMsg === 'error' && (
                                            <Text fontSize="sm" fontWeight="bold" color="orange.400">Lỗi kết nối, vui lòng thử lại.</Text>
                                        )}
                                    </>
                                )}
                            </Box>
                        </VStack>

                        {/* KHỐI TỔNG TIỀN - NỔI LÊN MỘT CHÚT */}
                        <Box bg={neumorphBg} p={5} borderRadius="2xl" boxShadow={neumorphShadow} border="none" mt={2}>
                            <HStack justify="space-between" align="center">
                                <VStack align="start" spacing={0}>
                                    <Text fontWeight="bold" color={textMuted} fontSize="xs" textTransform="uppercase"><Icon as={FaMoneyBillWave} mr={1.5} color="green.500"/>Tổng chi phí</Text>
                                    {startTime && <Text fontSize="10px" color="blue.500" fontWeight="bold">Từ {startTime} - {endTime}</Text>}
                                </VStack>
                                <Text fontWeight="900" fontSize="3xl" color={useColorModeValue("green.500", "green.300")} lineHeight="1">{totalPrice.toLocaleString()}đ</Text>
                            </HStack>
                        </Box>

                    </VStack>
                </ModalBody>

                <ModalFooter bg={neumorphBg} borderTop="none" p={8} pt={4} borderBottomRadius="3xl">
                    <HStack w="100%" justify="space-between" spacing={4}>
                        <Button w="120px" h="55px" borderRadius="xl" bg={neumorphBg} color={textColor} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} border="none" onClick={onClose}>Hủy</Button>
                        <Button flex={1} h="55px" borderRadius="xl" colorScheme="blue" bgGradient="linear(to-r, blue.400, teal.400)" color="white" boxShadow="xl" _active={{transform: "translateY(2px)"}} onClick={handleBooking} isLoading={isSubmitting} isDisabled={availabilityMsg !== 'ok'}>
                            Xác Nhận Đặt Sân
                        </Button>
                    </HStack>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default BookingModal;