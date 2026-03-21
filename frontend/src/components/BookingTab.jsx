import React, { useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
    Box, Container, Heading, Table, Thead, Tbody, Tr, Th, Td, 
    HStack, Avatar, Text, Badge, IconButton, useColorModeValue, useToast, 
    Flex, VStack, Button, Icon, Divider, useColorMode
} from '@chakra-ui/react';
import { FaCheck, FaTimes, FaTrash, FaTicketAlt, FaClock, FaMapMarkerAlt, FaChevronLeft, FaChevronRight, FaCalendarCheck } from 'react-icons/fa';
import { getImgUrl } from './MapTools';

const BookingTab = ({ bookings, user, fetchData, isMobile, searchTerm }) => {
    const toast = useToast();
    const scrollParentRef = useRef();
    const { colorMode } = useColorMode();

    // 🎨 CẤU HÌNH MÀU NEUMORPHISM ĐỒNG BỘ
    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '6px 6px 12px #0d1117, -4px -4px 10px #2d3748');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #0d1117, inset -4px -4px 8px #2d3748');
    
    const textColor = useColorModeValue('gray.700', 'gray.100');
    const textMuted = useColorModeValue('gray.500', 'gray.400');
    const accentColor = useColorModeValue('blue.500', 'blue.300');

    const [currentPage, setCurrentPage] = React.useState(1);
    const ITEMS_PER_PAGE = 10; 

    const filteredBookings = useMemo(() => {
        if (!searchTerm) return bookings;
        const lower = searchTerm.toLowerCase();
        return bookings.filter(b => 
            (b.user_name && b.user_name.toLowerCase().includes(lower)) ||
            (b.court_name && b.court_name.toLowerCase().includes(lower)) ||
            (b.ticket_code && b.ticket_code.toLowerCase().includes(lower))
        );
    }, [bookings, searchTerm]);

    const totalPages = Math.ceil(filteredBookings.length / ITEMS_PER_PAGE);
    const currentBookings = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredBookings.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredBookings, currentPage]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm]);

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        if (scrollParentRef.current) scrollParentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => { 
        if(window.confirm("Xóa vé này vĩnh viễn khỏi hệ thống?")) { 
            try { 
                await axios.delete(`${import.meta.env.VITE_API_URL}/api/vendor/bookings/${id}`, { data: { owner_id: user.id } }); 
                fetchData(); 
                toast({title:"Đã xóa vé", status:"success"});
            } catch { toast({title:"Lỗi khi xóa", status:"error"}); } 
        } 
    };
    
    const handleAction = async (id, action) => { 
        try { 
            await axios.put(`${import.meta.env.VITE_API_URL}/api/bookings/${id}/${action}`); 
            fetchData(); 
            toast({title: action === 'checkin' ? "Đã Check-in!" : "Đã hủy vé!", status:"success"});
        } catch { toast({title:"Lỗi xử lý", status:"error"}); } 
    };

    const getStatusInfo = (status) => {
        switch(status) {
            case 'confirmed': return { text: 'XÁC NHẬN', color: 'green', icon: FaCheck };
            case 'completed': return { text: 'CHECKED-IN', color: 'blue', icon: FaCalendarCheck };
            case 'cancelled': return { text: 'ĐÃ HỦY', color: 'red', icon: FaTimes };
            case 'pending': return { text: 'CHỜ DUYỆT', color: 'orange', icon: FaClock };
            default: return { text: status.toUpperCase(), color: 'gray', icon: FaTicketAlt };
        }
    };

    return (
        <Box ref={scrollParentRef} h="100%" overflowY="auto" p={isMobile ? 3 : 8} bg={neumorphBg} css={{scrollbarWidth: "none"}}>
            <Container maxW="container.xl" px={0}>
                
                {/* HEADER */}
                <Flex justify="space-between" align="center" mb={8} direction={{ base: 'column', md: 'row' }} gap={4}>
                    <VStack align="start" spacing={1} w={{ base: '100%', md: 'auto' }}>
                        <Heading color={textColor} size="lg" fontWeight="900" textTransform="uppercase" letterSpacing="tight">
                            📅 Quản lý Lịch Đặt
                        </Heading>
                        <HStack bg={neumorphBg} px={4} py={1} borderRadius="full" boxShadow={neumorphActiveShadow}>
                            <Text fontSize="xs" fontWeight="900" color={accentColor}>
                                {filteredBookings.length} VÉ TỔNG CỘNG
                            </Text>
                        </HStack>
                    </VStack>
                </Flex>

                {filteredBookings.length === 0 ? (
                    <VStack py={20} bg={neumorphBg} borderRadius="3xl" boxShadow={neumorphActiveShadow} spacing={4}>
                        <Icon as={FaTicketAlt} boxSize={12} color="gray.300" />
                        <Text color={textMuted} fontWeight="bold">Hộp thư vé đang trống rỗng...</Text>
                    </VStack>
                ) : (
                    <>
                        {/* 📱 MOBILE VIEW (CARDS) */}
                        {isMobile ? (
                            <VStack spacing={6} align="stretch" pb={10}>
                                {currentBookings.map(b => {
                                    const statusInfo = getStatusInfo(b.status);
                                    return (
                                        <Box 
                                            key={b.id} bg={neumorphBg} borderRadius="3xl" p={5} 
                                            boxShadow={neumorphShadow} position="relative"
                                            borderLeft="8px solid" borderColor={`${statusInfo.color}.400`}
                                        >
                                            <Flex justify="space-between" align="center" mb={4}>
                                                <Badge bg={neumorphBg} boxShadow={neumorphActiveShadow} color="purple.500" px={3} py={1} borderRadius="lg" fontSize="10px" fontWeight="900">
                                                    #{b.ticket_code || 'N/A'}
                                                </Badge>
                                                <Badge colorScheme={statusInfo.color} variant="subtle" fontSize="10px" px={2} borderRadius="md" border="none">
                                                    {statusInfo.text}
                                                </Badge>
                                            </Flex>

                                            <HStack mb={4} p={2} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow}>
                                                <Avatar size="sm" src={getImgUrl(b.avatar_url)} name={b.user_name} border="2px solid" borderColor={neumorphBg} />
                                                <Text fontWeight="900" fontSize="md" color={textColor}>{b.user_name}</Text>
                                            </HStack>

                                            <VStack align="start" spacing={3} mb={6} pl={2}>
                                                <HStack fontSize="sm" color={textColor}>
                                                    <Icon as={FaMapMarkerAlt} color="red.500"/> 
                                                    <Text fontWeight="bold">{b.court_name}</Text>
                                                </HStack>
                                                <HStack fontSize="sm" color={textMuted} fontWeight="bold">
                                                    <Icon as={FaClock} color="orange.400"/> 
                                                    <Text>{b.booking_time}</Text>
                                                    <Text color={textColor}>• {new Date(b.booking_date).toLocaleDateString('vi-VN')}</Text>
                                                </HStack>
                                                <Text fontWeight="900" color="green.500" fontSize="lg">
                                                    {parseInt(b.price).toLocaleString()}đ
                                                </Text>
                                            </VStack>

                                            <HStack spacing={3}>
                                                {b.status === 'confirmed' && (
                                                    <Button 
                                                        flex={1} size="sm" h="40px" borderRadius="xl" colorScheme="blue" 
                                                        bgGradient="linear(to-r, blue.400, blue.600)" color="white" boxShadow="lg"
                                                        onClick={() => handleAction(b.id, 'checkin')}
                                                    >
                                                        Check-in
                                                    </Button>
                                                )}
                                                {b.status !== 'cancelled' && (
                                                    <Button 
                                                        flex={1} size="sm" h="40px" borderRadius="xl" variant="ghost"
                                                        bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                                        onClick={() => handleAction(b.id, 'cancel')} color="orange.500"
                                                    >
                                                        Hủy vé
                                                    </Button>
                                                )}
                                                <IconButton 
                                                    icon={<FaTrash />} colorScheme="red" variant="ghost" isRound size="sm"
                                                    bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                                    onClick={() => handleDelete(b.id)} aria-label="Delete"
                                                />
                                            </HStack>
                                        </Box>
                                    );
                                })}
                            </VStack>
                        ) : (
                            /* 💻 DESKTOP VIEW (TABLE) */
                            <Box bg={neumorphBg} borderRadius="3xl" boxShadow={neumorphShadow} overflow="hidden" p={2}>
                                <Table variant="simple">
                                    <Thead>
                                        <Tr border="none">
                                            <Th color={textMuted} border="none" py={6}>MÃ VÉ</Th>
                                            <Th color={textMuted} border="none">KHÁCH HÀNG</Th>
                                            <Th color={textMuted} border="none">SÂN ĐẶT</Th>
                                            <Th color={textMuted} border="none">THỜI GIAN</Th>
                                            <Th color={textMuted} border="none">TRẠNG THÁI</Th>
                                            <Th textAlign="center" color={textMuted} border="none">THAO TÁC</Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {currentBookings.map(b => {
                                            const statusInfo = getStatusInfo(b.status);
                                            return (
                                                <Tr 
                                                    key={b.id} border="none" transition="all 0.2s"
                                                    _hover={{ bg: useColorModeValue('whiteAlpha.600', 'blackAlpha.300') }}
                                                >
                                                    <Td border="none">
                                                        <Badge bg={neumorphBg} boxShadow={neumorphActiveShadow} color="purple.500" p={2} borderRadius="lg" border="none">
                                                            #{b.ticket_code || 'N/A'}
                                                        </Badge>
                                                    </Td>
                                                    <Td border="none">
                                                        <HStack bg={neumorphBg} p={1.5} pr={4} borderRadius="full" boxShadow={neumorphShadow} w="fit-content">
                                                            <Avatar size="sm" src={getImgUrl(b.avatar_url)} border="2px solid" borderColor={neumorphBg} />
                                                            <Text fontWeight="900" fontSize="sm" color={textColor}>{b.user_name}</Text>
                                                        </HStack>
                                                    </Td>
                                                    <Td border="none">
                                                        <Text fontWeight="900" color="blue.500" fontSize="sm">{b.court_name}</Text>
                                                    </Td>
                                                    <Td border="none">
                                                        <VStack align="start" spacing={0}>
                                                            <Text fontSize="sm" fontWeight="900" color={textColor}>{b.booking_time}</Text>
                                                            <Text fontSize="xs" color={textMuted} fontWeight="bold">{new Date(b.booking_date).toLocaleDateString('vi-VN')}</Text>
                                                        </VStack>
                                                    </Td>
                                                    <Td border="none">
                                                        <Badge colorScheme={statusInfo.color} variant="subtle" px={3} py={1} borderRadius="full" border="none" fontSize="10px">
                                                            {statusInfo.text}
                                                        </Badge>
                                                    </Td>
                                                    <Td border="none">
                                                        <HStack spacing={3} justify="center">
                                                            {b.status === 'confirmed' && (
                                                                <IconButton 
                                                                    icon={<FaCheck/>} colorScheme="blue" isRound size="sm"
                                                                    bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                                                    onClick={()=>handleAction(b.id, 'checkin')} aria-label="Confirm"
                                                                />
                                                            )}
                                                            {b.status !== 'cancelled' && (
                                                                <IconButton 
                                                                    icon={<FaTimes/>} colorScheme="orange" variant="outline" isRound size="sm"
                                                                    bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                                                    onClick={()=>handleAction(b.id, 'cancel')} aria-label="Cancel"
                                                                />
                                                            )}
                                                            <IconButton 
                                                                icon={<FaTrash/>} colorScheme="red" variant="ghost" isRound size="sm"
                                                                bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                                                onClick={()=>handleDelete(b.id)} aria-label="Delete"
                                                            />
                                                        </HStack>
                                                    </Td>
                                                </Tr>
                                            );
                                        })}
                                    </Tbody>
                                </Table>
                            </Box>
                        )}

                        {/* 🕹️ PHÂN TRANG SOFT UI */}
                        {totalPages > 1 && (
                            <Flex justify="center" align="center" gap={6} py={12} pb={{base: 24, md: 12}}>
                                <IconButton 
                                    icon={<FaChevronLeft />} isDisabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} 
                                    bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                    isRound size="md" color={accentColor} border="none" aria-label="Prev"
                                />
                                
                                <HStack bg={neumorphBg} px={6} py={2} borderRadius="2xl" boxShadow={neumorphActiveShadow} spacing={2}>
                                    <Text fontWeight="900" color={accentColor}>{currentPage}</Text>
                                    <Text fontWeight="bold" color={textMuted}>/</Text>
                                    <Text fontWeight="bold" color={textMuted}>{totalPages}</Text>
                                </HStack>

                                <IconButton 
                                    icon={<FaChevronRight />} isDisabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)} 
                                    bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                    isRound size="md" color={accentColor} border="none" aria-label="Next"
                                />
                            </Flex>
                        )}
                    </>
                )}
            </Container>
        </Box>
    );
};

export default BookingTab;