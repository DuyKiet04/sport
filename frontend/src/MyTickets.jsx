import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
    Button, Text, VStack, Box, Flex, Badge, Divider, HStack, IconButton, Spinner, useToast, 
    useColorModeValue, Icon, Tooltip, SimpleGrid
} from '@chakra-ui/react';
import { FaTrashAlt, FaCalendarDay, FaClock, FaMapMarkerAlt, FaTicketAlt, FaTimesCircle, FaCheckCircle, FaHistory } from 'react-icons/fa';
import { motion } from 'framer-motion';

// --- Styles ---
const glassModalStyle = {
    bg: "rgba(255, 255, 255, 0.85)",
    backdropFilter: "blur(20px) saturate(180%)",
    border: "1px solid rgba(255, 255, 255, 0.6)",
    boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.15)"
};

const ticketCardStyle = {
    bg: "white",
    borderRadius: "2xl",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
    border: "1px solid",
    borderColor: "gray.100",
    transition: "all 0.2s ease-in-out",
    _hover: { transform: "translateY(-3px)", boxShadow: "lg", borderColor: "blue.200" }
};

const MyTickets = ({ isOpen, onClose }) => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(false);
    const toast = useToast();
    
    // Theme colors
    const textColor = useColorModeValue('gray.700', 'white');
    const subTextColor = useColorModeValue('gray.500', 'gray.400');
    const dateBg = useColorModeValue('blue.50', 'whiteAlpha.200');

    const fetchTickets = () => { 
        const user = JSON.parse(localStorage.getItem('user')); 
        if(user){ 
            setLoading(true); 
            axios.get(`http://localhost:5000/api/bookings/my-tickets?user_id=${user.id}`)
                .then(res => setTickets(res.data))
                .catch(() => setTickets([]))
                .finally(() => setLoading(false)); 
        }
    };

    useEffect(() => { if (isOpen) fetchTickets(); }, [isOpen]);

    const handleAction = async (id, action) => { 
        const msg = action === 'delete' ? 'xóa lịch sử vé này' : 'hủy đặt sân này';
        if(!window.confirm(`Bạn chắc chắn muốn ${msg}?`)) return; 
        
        try { 
            if(action === 'delete') await axios.delete(`http://localhost:5000/api/bookings/${id}`); 
            else await axios.put(`http://localhost:5000/api/bookings/${id}/cancel`); 
            
            toast({title: 'Thành công', status: 'success'}); 
            fetchTickets(); 
        } catch(e){ 
            toast({title: 'Lỗi thực hiện', status: 'error'}); 
        } 
    };

    const handleClearAll = async () => { 
        if(!window.confirm('Hành động này sẽ xóa toàn bộ lịch sử đặt vé của bạn. Tiếp tục?')) return; 
        const user = JSON.parse(localStorage.getItem('user')); 
        try {
            await axios.delete(`http://localhost:5000/api/bookings/clear-history/${user.id}`); 
            setTickets([]); 
            toast({title: 'Đã xóa sạch lịch sử', status: 'success'}); 
        } catch(e) {
            toast({title: 'Lỗi xóa lịch sử', status: 'error'});
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return {
            day: date.getDate(),
            month: `T${date.getMonth() + 1}`,
            full: date.toLocaleDateString('vi-VN')
        };
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered scrollBehavior="inside">
            <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(6px)" />
            <ModalContent borderRadius="3xl" overflow="hidden" bg="transparent" boxShadow="2xl">
                
                {/* --- HEADER --- */}
                <ModalHeader bg="white" borderBottom="1px solid" borderColor="gray.100" py={5}>
                    <HStack justify="space-between" pr={8}>
                        <HStack spacing={3}>
                            <Flex w={10} h={10} bg="blue.50" borderRadius="full" align="center" justify="center">
                                <Icon as={FaTicketAlt} color="blue.500" boxSize={5}/>
                            </Flex>
                            <Box>
                                <Text fontSize="lg" fontWeight="bold" color={textColor}>Vé của tôi</Text>
                                <Text fontSize="xs" color={subTextColor}>{tickets.length} vé đã đặt</Text>
                            </Box>
                        </HStack>
                        {tickets.length > 0 && (
                            <Button 
                                size="xs" leftIcon={<FaHistory/>} 
                                colorScheme="red" variant="ghost" 
                                borderRadius="full"
                                onClick={handleClearAll}
                            >
                                Xóa lịch sử
                            </Button>
                        )}
                    </HStack>
                </ModalHeader>
                <ModalCloseButton size="lg" top={4} right={4} borderRadius="full" />
                
                {/* --- BODY --- */}
                <ModalBody py={6} px={{base: 4, md: 6}} {...glassModalStyle} className="custom-scroll">
                    {loading ? (
                        <Flex justify="center" py={12}><Spinner size="xl" color="blue.500" thickness="3px"/></Flex>
                    ) : (
                        <VStack spacing={4}>
                            {tickets.length === 0 && (
                                <Flex direction="column" align="center" justify="center" py={12} opacity={0.6}>
                                    <Icon as={FaTicketAlt} boxSize={16} mb={4} color="gray.300" />
                                    <Text fontSize="lg" fontWeight="bold" color={subTextColor}>Chưa có vé nào</Text>
                                    <Text fontSize="sm" color={subTextColor}>Hãy đặt sân ngay để trải nghiệm!</Text>
                                </Flex>
                            )}
                            
                            {tickets.map(t => {
                                const dateInfo = formatDate(t.booking_date);
                                const isConfirmed = t.status === 'confirmed';
                                
                                return (
                                    <Flex key={t.id} w="100%" {...ticketCardStyle}>
                                        {/* Cột Ngày (Left Stub) */}
                                        <Flex 
                                            direction="column" align="center" justify="center" 
                                            w="90px" bg={isConfirmed ? "blue.500" : "gray.200"} 
                                            color="white"
                                            borderTopLeftRadius="2xl" borderBottomLeftRadius="2xl"
                                            position="relative"
                                            p={2}
                                        >
                                            <Text fontSize="3xl" fontWeight="900" lineHeight="1">{dateInfo.day}</Text>
                                            <Text fontSize="sm" fontWeight="bold" textTransform="uppercase" opacity={0.9}>{dateInfo.month}</Text>
                                            
                                            {/* Răng cưa trang trí (Dashed Line) */}
                                            <Box position="absolute" right="-1px" top="0" bottom="0" borderRight="2px dashed white" />
                                            {/* Hình tròn khuyết trên dưới */}
                                            <Box position="absolute" right="-10px" top="-10px" w="20px" h="20px" bg="white" borderRadius="full" />
                                            <Box position="absolute" right="-10px" bottom="-10px" w="20px" h="20px" bg="white" borderRadius="full" />
                                        </Flex>

                                        {/* Nội dung chính */}
                                        <Box p={4} flex={1} pl={6}>
                                            <Flex justify="space-between" align="start" mb={1}>
                                                <VStack align="start" spacing={0}>
                                                    <Text fontWeight="bold" fontSize="lg" color={textColor} noOfLines={1}>{t.court_name}</Text>
                                                    <Badge 
                                                        colorScheme={isConfirmed ? 'green' : 'red'} 
                                                        variant="subtle" fontSize="xs" borderRadius="md" mt={1} px={2}
                                                        display="flex" alignItems="center" width="fit-content"
                                                    >
                                                        <Icon as={isConfirmed ? FaCheckCircle : FaTimesCircle} mr={1} />
                                                        {isConfirmed ? 'Đã xác nhận' : 'Đã hủy'}
                                                    </Badge>
                                                </VStack>

                                                <VStack align="end" spacing={0}>
                                                    <Text fontWeight="800" color={isConfirmed ? "green.500" : "gray.400"} fontSize="lg">
                                                        {parseInt(t.price).toLocaleString()}đ
                                                    </Text>
                                                </VStack>
                                            </Flex>

                                            <Divider my={3} borderStyle="dashed" />

                                            <Flex justify="space-between" align="center">
                                                <HStack fontSize="sm" color={subTextColor} spacing={4}>
                                                    <HStack><Icon as={FaClock} color="orange.400"/><Text fontWeight="medium">{t.booking_time}</Text></HStack>
                                                    <HStack><Icon as={FaCalendarDay} color="blue.400"/><Text>{dateInfo.full}</Text></HStack>
                                                </HStack>

                                                <HStack>
                                                    {isConfirmed && (
                                                        <Button size="xs" colorScheme="orange" variant="outline" borderRadius="full" onClick={() => handleAction(t.id, 'cancel')}>
                                                            Hủy vé
                                                        </Button>
                                                    )}
                                                    <IconButton 
                                                        icon={<FaTrashAlt />} size="xs" 
                                                        variant="ghost" colorScheme="gray" 
                                                        borderRadius="full"
                                                        onClick={() => handleAction(t.id, 'delete')} 
                                                        aria-label="Delete"
                                                    />
                                                </HStack>
                                            </Flex>
                                        </Box>
                                    </Flex>
                                );
                            })}
                        </VStack>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default MyTickets;