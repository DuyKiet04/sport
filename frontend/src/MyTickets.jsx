import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
    Button, Text, VStack, Box, Flex, Badge, Divider, HStack, IconButton, Spinner, useToast, 
    useColorModeValue, Icon, Tooltip, SimpleGrid
} from '@chakra-ui/react';
import { FaTrashAlt, FaCalendarDay, FaClock, FaMapMarkerAlt, FaTicketAlt, FaTimesCircle, FaCheckCircle, FaHistory } from 'react-icons/fa';

const MyTickets = ({ isOpen, onClose }) => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(false);
    const toast = useToast();
    
    // Theme colors
    const bgModal = useColorModeValue('white', 'gray.800');
    const bgCard = useColorModeValue('white', 'gray.700');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const dateBoxBg = useColorModeValue('blue.50', 'blue.900');
    const dateBoxColor = useColorModeValue('blue.600', 'blue.200');

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

    // Helper format ngày
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return {
            day: date.getDate(),
            month: `Tháng ${date.getMonth() + 1}`,
            full: date.toLocaleDateString('vi-VN')
        };
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered scrollBehavior="inside">
            <ModalOverlay backdropFilter="blur(2px)" />
            <ModalContent borderRadius="2xl" bg={bgModal}>
                <ModalHeader borderBottomWidth="1px" borderColor={borderColor}>
                    <HStack justify="space-between" pr={8}>
                        <HStack>
                            <Icon as={FaTicketAlt} color="blue.500" />
                            <Text>Vé của tôi</Text>
                            <Badge colorScheme="blue" borderRadius="full" px={2}>{tickets.length}</Badge>
                        </HStack>
                        {tickets.length > 0 && (
                            <Button 
                                size="xs" 
                                leftIcon={<FaHistory/>} 
                                colorScheme="red" 
                                variant="ghost" 
                                onClick={handleClearAll}
                            >
                                Xóa lịch sử
                            </Button>
                        )}
                    </HStack>
                </ModalHeader>
                <ModalCloseButton />
                
                <ModalBody py={6} px={4} className="hide-scrollbar" bg={useColorModeValue('gray.50', 'gray.900')}>
                    {loading ? (
                        <Flex justify="center" py={10}><Spinner size="xl" color="blue.500" thickness="4px"/></Flex>
                    ) : (
                        <VStack spacing={4}>
                            {tickets.length === 0 && (
                                <Flex direction="column" align="center" justify="center" py={10} color="gray.400">
                                    <Icon as={FaTicketAlt} boxSize={20} mb={4} opacity={0.3} />
                                    <Text fontSize="lg" fontWeight="bold">Chưa có vé nào</Text>
                                    <Text fontSize="sm">Hãy đặt sân ngay để trải nghiệm!</Text>
                                </Flex>
                            )}
                            
                            {tickets.map(t => {
                                const dateInfo = formatDate(t.booking_date);
                                const isConfirmed = t.status === 'confirmed';
                                const isCancelled = t.status === 'cancelled';

                                return (
                                    <Flex 
                                        key={t.id} 
                                        w="100%" 
                                        bg={bgCard} 
                                        borderRadius="xl" 
                                        overflow="hidden" 
                                        boxShadow="sm"
                                        border="1px solid"
                                        borderColor={isConfirmed ? 'green.200' : 'gray.200'}
                                        transition="all 0.2s"
                                        _hover={{ boxShadow: 'md', transform: 'translateY(-2px)' }}
                                    >
                                        {/* Cột Ngày Tháng (Bên trái) */}
                                        <Flex 
                                            direction="column" 
                                            align="center" 
                                            justify="center" 
                                            bg={isConfirmed ? dateBoxBg : 'gray.100'} 
                                            color={isConfirmed ? dateBoxColor : 'gray.500'}
                                            w="80px" 
                                            p={2}
                                            borderRight="1px dashed"
                                            borderColor="gray.300"
                                        >
                                            <Text fontSize="2xl" fontWeight="900" lineHeight="1">{dateInfo.day}</Text>
                                            <Text fontSize="xs" fontWeight="bold" textTransform="uppercase">{dateInfo.month}</Text>
                                        </Flex>

                                        {/* Nội dung chính (Bên phải) */}
                                        <Box p={3} flex={1}>
                                            <Flex justify="space-between" align="start" mb={2}>
                                                <VStack align="start" spacing={1}>
                                                    <Text fontWeight="bold" fontSize="md" noOfLines={1}>{t.court_name}</Text>
                                                    <HStack fontSize="xs" color="gray.500">
                                                        <Icon as={FaClock} />
                                                        <Text>{t.booking_time}</Text>
                                                        <Text>|</Text>
                                                        <Icon as={FaCalendarDay} />
                                                        <Text>{dateInfo.full}</Text>
                                                    </HStack>
                                                </VStack>
                                                
                                                <Badge 
                                                    colorScheme={isConfirmed ? 'green' : 'red'} 
                                                    variant="subtle" 
                                                    px={2} py={1} 
                                                    borderRadius="lg"
                                                    display="flex"
                                                    alignItems="center"
                                                    gap={1}
                                                >
                                                    <Icon as={isConfirmed ? FaCheckCircle : FaTimesCircle} />
                                                    {isConfirmed ? 'Đã đặt' : 'Đã hủy'}
                                                </Badge>
                                            </Flex>

                                            <Divider my={2} />

                                            <Flex justify="space-between" align="center">
                                                <Text fontWeight="800" color={isConfirmed ? "green.600" : "gray.400"} fontSize="md">
                                                    {parseInt(t.price).toLocaleString()} đ
                                                </Text>
                                                
                                                <HStack>
                                                    {isConfirmed && (
                                                        <Button 
                                                            size="xs" 
                                                            colorScheme="red" 
                                                            variant="outline" 
                                                            onClick={() => handleAction(t.id, 'cancel')}
                                                        >
                                                            Hủy vé
                                                        </Button>
                                                    )}
                                                    <Tooltip label="Xóa khỏi lịch sử">
                                                        <IconButton 
                                                            size="xs" 
                                                            icon={<FaTrashAlt />} 
                                                            variant="ghost"
                                                            colorScheme="gray"
                                                            onClick={() => handleAction(t.id, 'delete')} 
                                                            aria-label="Xóa vé"
                                                        />
                                                    </Tooltip>
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