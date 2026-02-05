import React, { useState, useEffect } from 'react';
import {
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
    Button, FormControl, FormLabel, Input, Select, VStack, HStack, Text, useToast, Image, Box, Badge, Spinner, Icon
} from '@chakra-ui/react';
import axios from 'axios';
import { FaCalendarAlt, FaClock, FaMoneyBillWave } from 'react-icons/fa';

const TIME_SLOTS = [
    "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
    "20:00", "21:00", "22:00"
];

const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `http://localhost:5000/${url.startsWith('/') ? url.substring(1) : url}`;
};

const BookingModal = ({ isOpen, onClose, court }) => {
    const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('');
    const [duration, setDuration] = useState(1);
    const [totalPrice, setTotalPrice] = useState(0);
    const [isChecking, setIsChecking] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [availabilityMsg, setAvailabilityMsg] = useState('');
    
    const toast = useToast();
    const user = JSON.parse(localStorage.getItem('user'));

    // Tự động tính tiền khi thay đổi giờ hoặc thời lượng
    useEffect(() => {
        if (court && duration) {
            setTotalPrice(court.price_per_hour * duration);
        }
    }, [court, duration]);

    // Reset form khi mở modal
    useEffect(() => {
        if (isOpen) {
            setAvailabilityMsg('');
            setStartTime('');
            setDuration(1); // Reset về 1h
        }
    }, [isOpen]);

    const handleCheckAvailability = async () => {
        if (!bookingDate || !startTime) {
            return toast({ title: "Chưa chọn ngày giờ!", status: "warning" });
        }
        
        setIsChecking(true);
        setAvailabilityMsg('');
        
        try {
            // Kiểm tra giờ bắt đầu
            const res = await axios.get(`http://localhost:5000/api/courts/${court.id}/check`, {
                params: {
                    date: bookingDate,
                    start: startTime
                }
            });

            if (res.data.available) {
                setAvailabilityMsg('✅ Sân trống, có thể đặt!');
            } else {
                setAvailabilityMsg('❌ Giờ này đã có người đặt.');
            }
        } catch (error) {
            console.error(error);
            setAvailabilityMsg('⚠️ Lỗi kết nối server.');
        } finally {
            setIsChecking(false);
        }
    };

    const handleBooking = async () => {
        if (!user) return toast({ title: "Vui lòng đăng nhập!", status: "error" });
        if (!startTime) return toast({ title: "Chưa chọn giờ!", status: "warning" });
        
        if (!availabilityMsg.includes('✅')) {
            return toast({ title: "Vui lòng kiểm tra sân trống trước!", status: "warning" });
        }

        setIsSubmitting(true);
        try {
            await axios.post('http://localhost:5000/api/bookings', {
                user_id: user.id,
                court_id: court.id,
                booking_date: bookingDate,
                start_time: startTime,
                total_price: totalPrice
            });

            toast({ title: "Đặt sân thành công!", status: "success" });
            onClose();
        } catch (error) {
            toast({ title: "Lỗi đặt sân", description: error.response?.data?.message || "Lỗi server", status: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!court) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
            <ModalOverlay backdropFilter="blur(2px)" />
            <ModalContent borderRadius="xl">
                <ModalHeader borderBottom="1px solid" borderColor="gray.100">
                    Đặt sân: {court.name}
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody py={6}>
                    <VStack spacing={5} align="stretch">
                        
                        <HStack align="start" spacing={4} bg="gray.50" p={3} borderRadius="lg">
                            <Image 
                                src={getImgUrl(court.image_url)} 
                                w="80px" h="80px" objectFit="cover" borderRadius="md"
                                fallbackSrc="https://placehold.co/80x80?text=San"
                            />
                            <Box>
                                <Text fontWeight="bold" fontSize="md">{court.name}</Text>
                                <Text fontSize="sm" color="gray.600">{court.address}</Text>
                                <Badge colorScheme="green" mt={1}>{parseInt(court.price_per_hour).toLocaleString()}đ / giờ</Badge>
                            </Box>
                        </HStack>

                        <FormControl>
                            <FormLabel fontSize="sm" fontWeight="bold"><Icon as={FaCalendarAlt} mr={2}/>Ngày đặt</FormLabel>
                            <Input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                        </FormControl>

                        <HStack>
                            <FormControl flex={1}>
                                <FormLabel fontSize="sm" fontWeight="bold"><Icon as={FaClock} mr={2}/>Giờ bắt đầu</FormLabel>
                                <Select placeholder="Chọn giờ" value={startTime} onChange={(e) => {setStartTime(e.target.value); setAvailabilityMsg('');}}>
                                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                </Select>
                            </FormControl>
                            
                            <FormControl w="120px">
                                <FormLabel fontSize="sm" fontWeight="bold">Thời lượng</FormLabel>
                                {/* 🔥 SỬA Ở ĐÂY: Dùng parseFloat để nhận số lẻ 1.5 */}
                                <Select value={duration} onChange={(e) => setDuration(parseFloat(e.target.value))}>
                                    <option value={1}>1 giờ</option>
                                    <option value={1.5}>1.5 giờ</option>
                                    <option value={2}>2 giờ</option>
                                    <option value={2.5}>2.5 giờ</option>
                                    <option value={3}>3 giờ</option>
                                </Select>
                            </FormControl>
                        </HStack>

                        <Box textAlign="center" py={2}>
                            {isChecking ? <Spinner size="sm" color="blue.500"/> : (
                                <>
                                    {!availabilityMsg && (
                                        <Button size="sm" onClick={handleCheckAvailability} colorScheme="teal" variant="outline" isDisabled={!startTime}>
                                            Kiểm tra trống
                                        </Button>
                                    )}
                                    {availabilityMsg && (
                                        <Text fontSize="sm" fontWeight="bold" color={availabilityMsg.includes('✅') ? 'green.500' : 'red.500'}>
                                            {availabilityMsg}
                                        </Text>
                                    )}
                                </>
                            )}
                        </Box>

                        <Box bg="orange.50" p={3} borderRadius="lg" border="1px dashed" borderColor="orange.300">
                            <HStack justify="space-between">
                                <Text fontWeight="bold" color="orange.800"><Icon as={FaMoneyBillWave} mr={2}/>Tổng tiền:</Text>
                                <Text fontWeight="900" fontSize="xl" color="orange.600">{totalPrice.toLocaleString()}đ</Text>
                            </HStack>
                        </Box>

                    </VStack>
                </ModalBody>

                <ModalFooter borderTop="1px solid" borderColor="gray.100">
                    <Button variant="ghost" mr={3} onClick={onClose}>Hủy</Button>
                    <Button 
                        colorScheme="blue" 
                        onClick={handleBooking} 
                        isLoading={isSubmitting}
                        isDisabled={!availabilityMsg.includes('✅')}
                    >
                        Xác nhận đặt
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default BookingModal;