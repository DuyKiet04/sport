import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
    Button, Text, VStack, Box, Flex, Badge, Divider, HStack, IconButton, Spinner, useToast, 
    useColorModeValue, Icon, Image
} from '@chakra-ui/react';
import { FaTrashAlt, FaCalendarDay, FaClock, FaTicketAlt, FaTimesCircle, FaCheckCircle, FaHistory, FaDownload, FaMapMarkerAlt, FaQrcode } from 'react-icons/fa';
import html2canvas from 'html2canvas'; 

const formatCurrency = (amount) => {
    if (!amount) return '0 đ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const getImgUrl = (url) => { 
    if (!url) return '';
    if (url.startsWith('https//')) return url; 
    const cleanPath = url.replace(/\\/g, '/').replace(/^\/+/, ''); 
    return `${import.meta.env.VITE_API_URL}/${cleanPath}`; 
};

const MyTickets = ({ isOpen, onClose }) => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({}); 
    const toast = useToast();

    const ticketRef = useRef(null);
    const [downloadingTicket, setDownloadingTicket] = useState(null);
    
    // 🎨 MÀU SẮC NEUMORPHISM ĐỒNG BỘ DARK MODE
    const neumorphBg = useColorModeValue('#edf2f7', '#2d3748');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '4px 4px 10px #1a202c, -4px -4px 10px #4a5568');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #1a202c, inset -4px -4px 8px #4a5568');

    const textColor = useColorModeValue('gray.700', 'gray.100');
    const textMuted = useColorModeValue('gray.500', 'gray.400');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    const fetchTickets = async () => { 
        const user = JSON.parse(localStorage.getItem('user')); 
        if(user){ 
            setLoading(true); 
            try {
                const [ticketsRes, configRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_API_URL}/api/bookings/my-tickets?user_id=${user.id}`),
                    axios.get(`${import.meta.env.VITE_API_URL}/api/config`)
                ]);
                setTickets(ticketsRes.data);
                setConfig(configRes.data || {});
            } catch (e) {
                setTickets([]);
            } finally {
                setLoading(false);
            }
        }
    };

    useEffect(() => { if (isOpen) fetchTickets(); }, [isOpen]);

    const handleAction = async (id, action) => { 
        const msg = action === 'delete' ? 'xóa lịch sử vé này' : 'hủy đặt sân này';
        if(!window.confirm(`Bạn chắc chắn muốn ${msg}?`)) return; 
        
        try { 
            if(action === 'delete') await axios.delete(`${import.meta.env.VITE_API_URL}/api/bookings/${id}`); 
            else await axios.put(`${import.meta.env.VITE_API_URL}/api/bookings/${id}/cancel`); 
            
            toast({title: 'Thành công', status: 'success'}); 
            fetchTickets(); 
        } catch(e){ 
            toast({title: 'Lỗi thực hiện', status: 'error'}); 
        } 
    };

    const handleClearAll = async () => { 
        if(!window.confirm('Hành động này sẽ xóa toàn bộ lịch sử đặt vé. Tiếp tục?')) return; 
        const user = JSON.parse(localStorage.getItem('user')); 
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/bookings/clear-history/${user.id}`); 
            setTickets([]); 
            toast({title: 'Đã xóa sạch lịch sử', status: 'success'}); 
        } catch(e) {
            toast({title: 'Lỗi xóa lịch sử', status: 'error'});
        }
    };

    const handleDownloadTicketImage = async (bookingId) => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/bookings/ticket/${bookingId}`);
            setDownloadingTicket({ ...res.data, ticket_code: tickets.find(t => t.id === bookingId)?.ticket_code });
            toast({ title: "Đang tạo ảnh vé...", status: "info", duration: 1500 });

            setTimeout(async () => {
                if (ticketRef.current) {
                    const canvas = await html2canvas(ticketRef.current, { scale: 3, useCORS: true, backgroundColor: null });
                    const imageURL = canvas.toDataURL("image/png");
                    const link = document.createElement("a");
                    link.href = imageURL;
                    link.download = `Ve_SportBooking_${bookingId}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setDownloadingTicket(null);
                    toast({ title: "Đã tải ảnh vé về máy!", status: "success" });
                }
            }, 800);
        } catch (error) {
            toast({ title: "Lỗi khi tải vé", status: "error" });
            setDownloadingTicket(null);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return { day: date.getDate(), month: `THÁNG ${date.getMonth() + 1}`, full: date.toLocaleDateString('vi-VN') };
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered scrollBehavior="inside" motionPreset="slideInBottom">
            <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(6px)" />
            <ModalContent 
                borderRadius="3xl" overflow="hidden" 
                bg={neumorphBg} border="none"
                boxShadow={neumorphShadow}
            >
                <ModalHeader bg={neumorphBg} borderBottom="none" py={6}>
                    <HStack justify="space-between" pr={10}>
                        <HStack spacing={4}>
                            <Box bg={neumorphBg} p={3} borderRadius="xl" boxShadow={neumorphShadow} display="flex" alignItems="center" justifyContent="center">
                                <Icon as={FaTicketAlt} color="blue.500" boxSize={6}/>
                            </Box>
                            <VStack align="start" spacing={0}>
                                <Text fontSize="xl" fontWeight="900" color={textColor} textTransform="uppercase" letterSpacing="1px">Vé của tôi</Text>
                                <Text fontSize="xs" color={textMuted} fontWeight="bold">{tickets.length} vé trong danh sách</Text>
                            </VStack>
                        </HStack>
                        {tickets.length > 0 && (
                            <IconButton 
                                icon={<FaHistory/>} colorScheme="red" variant="ghost" isRound 
                                onClick={handleClearAll} aria-label="Clear All" size="sm"
                                boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                            />
                        )}
                    </HStack>
                </ModalHeader>
                <ModalCloseButton size="lg" top={6} right={6} borderRadius="full" color={textColor} bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} border="none" />
                
                <ModalBody py={6} px={{base: 4 , md: 6}} bg={neumorphBg}>
                    {loading ? (
                        <Flex justify="center" py={12}><Spinner size="xl" color="blue.500" thickness="3px"/></Flex>
                    ) : (
                        <VStack spacing={6} align="stretch">
                            {tickets.length === 0 && (
                                <VStack py={16} bg={neumorphBg} borderRadius="2xl" boxShadow={neumorphActiveShadow} opacity={0.8}>
                                    <Icon as={FaTicketAlt} boxSize={16} mb={4} color="gray.300" />
                                    <Text fontSize="lg" fontWeight="900" color={textMuted}>Hộp vé trống rỗng</Text>
                                    <Text fontSize="sm" color={textMuted}>Hãy đặt sân để nhận ngay vé xịn!</Text>
                                </VStack>
                            )}
                            
                            {tickets.map(t => {
                                const dateInfo = formatDate(t.booking_date);
                                const isConfirmed = t.status === 'confirmed';
                                const isCancelled = t.status === 'cancelled';
                                
                                return (
                                    <Flex 
                                        key={t.id} w="100%" 
                                        bg={neumorphBg} 
                                        borderRadius="3xl" 
                                        boxShadow={isCancelled ? neumorphActiveShadow : neumorphShadow}
                                        transition="all 0.2s" 
                                        _hover={!isCancelled ? { transform: "scale(0.99)", boxShadow: neumorphActiveShadow } : {}}
                                        overflow="hidden"
                                        position="relative"
                                        opacity={isCancelled ? 0.6 : 1}
                                    >
                                        {/* Cột Ngày (Left Stub) - Dập nổi */}
                                        <Flex 
                                            direction="column" align="center" justify="center" 
                                            w="95px" bg={neumorphBg} 
                                            position="relative" p={3}
                                            boxShadow={isCancelled ? "none" : "inset -4px 0 10px rgba(0,0,0,0.05)"}
                                        >
                                            <VStack spacing={0}>
                                                <Text fontSize="3xl" fontWeight="900" color={isConfirmed ? "blue.500" : "gray.400"} lineHeight="1">{dateInfo.day}</Text>
                                                <Text fontSize="9px" fontWeight="900" color={textMuted} textAlign="center" mt={1}>{dateInfo.month}</Text>
                                            </VStack>
                                            
                                            {/* Răng cưa phân tách */}
                                            <Box position="absolute" right="-2px" top="15%" bottom="15%" borderRight="2px dashed" borderColor={useColorModeValue('gray.300', 'gray.600')} opacity={0.5} />
                                            
                                            {/* Lỗ đục vé Neumorphism */}
                                            <Box position="absolute" right="-10px" top="-10px" w="20px" h="20px" bg={neumorphBg} borderRadius="full" boxShadow={neumorphActiveShadow} />
                                            <Box position="absolute" right="-10px" bottom="-10px" w="20px" h="20px" bg={neumorphBg} borderRadius="full" boxShadow={neumorphActiveShadow} />
                                        </Flex>

                                        {/* Thân vé */}
                                        <Box p={4} flex={1} pl={6}>
                                            <Flex justify="space-between" align="start" mb={2}>
                                                <VStack align="start" spacing={1}>
                                                    <Text fontWeight="900" fontSize="md" color={textColor} noOfLines={1}>{t.court_name}</Text>
                                                    <HStack spacing={2}>
                                                        <Badge colorScheme={isConfirmed ? 'green' : 'red'} variant="subtle" fontSize="9px" borderRadius="md" px={2} border="none">
                                                            {isConfirmed ? 'XÁC NHẬN' : 'ĐÃ HỦY'}
                                                        </Badge>
                                                        {t.ticket_code && (
                                                            <Badge colorScheme="purple" fontSize="9px" borderRadius="md" px={2} border="none" letterSpacing="1px">
                                                                #{t.ticket_code}
                                                            </Badge>
                                                        )}
                                                    </HStack>
                                                </VStack>
                                                <Text fontWeight="900" color={isConfirmed ? "green.500" : "gray.400"} fontSize="lg">
                                                    {parseInt(t.price).toLocaleString()}đ
                                                </Text>
                                            </Flex>

                                            <HStack fontSize="xs" color={textMuted} spacing={4} mt={3} fontWeight="bold">
                                                <HStack><Icon as={FaClock} color="orange.400"/><Text>{t.booking_time}</Text></HStack>
                                                <HStack><Icon as={FaCalendarDay} color="blue.400"/><Text>{dateInfo.full}</Text></HStack>
                                            </HStack>

                                            <Divider my={4} borderColor={useColorModeValue('gray.200', 'gray.700')} opacity={0.5} />

                                            <Flex justify="flex-end" align="center" gap={3}>
                                                {isConfirmed && (
                                                    <>
                                                        <Button 
                                                            size="xs" colorScheme="blue" variant="solid" borderRadius="xl" px={4} h="32px"
                                                            bgGradient="linear(to-r, blue.400, teal.400)" color="white" boxShadow="md"
                                                            leftIcon={<FaDownload />} onClick={() => handleDownloadTicketImage(t.id)}
                                                            _active={{transform: 'scale(0.95)'}}
                                                        >
                                                            Tải Vé
                                                        </Button>
                                                        <Button 
                                                            size="xs" colorScheme="orange" variant="ghost" borderRadius="xl" h="32px"
                                                            bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                                            onClick={() => handleAction(t.id, 'cancel')}
                                                        >
                                                            Hủy
                                                        </Button>
                                                    </>
                                                )}
                                                <IconButton 
                                                    icon={<FaTrashAlt />} size="sm" variant="ghost" colorScheme="red" isRound
                                                    bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                                    onClick={() => handleAction(t.id, 'delete')} aria-label="Delete" 
                                                />
                                            </Flex>
                                        </Box>
                                    </Flex>
                                );
                            })}
                        </VStack>
                    )}
                </ModalBody>
            </ModalContent>

            {/* 🔥 BẢN VẼ VÉ TÀNG HÌNH NEUMORPHISM (TẢI VỀ MÁY) */}
            {downloadingTicket && (
                <Box position="fixed" top="-10000px" left="0" zIndex="-1">
                    <Box ref={ticketRef} w="400px" bg="#edf2f7" borderRadius="3xl" p={5} fontFamily="'Inter', sans-serif">
                        
                        <Box bg="#edf2f7" borderRadius="2xl" boxShadow="10px 10px 20px #b8bec5, -10px -10px 20px #ffffff" overflow="hidden" position="relative">
                            
                            <Box bgGradient="linear(to-br, blue.600, blue.800)" color="white" p={8} textAlign="center" position="relative">
                                <VStack spacing={4}>
                                    <Box bg="rgba(255,255,255,0.2)" p={4} borderRadius="2xl" shadow="xl" border="1px solid rgba(255,255,255,0.3)">
                                        {config.logo_url ? <Image src={getImgUrl(config.logo_url)} h="50px" objectFit="contain" /> : <Icon as={FaTicketAlt} boxSize={10} />}
                                    </Box>
                                    <Box>
                                        <Text fontSize="2xl" fontWeight="900" letterSpacing="4px">VÉ ĐIỆN TỬ</Text>
                                        <Text fontSize="xs" opacity={0.8} fontWeight="bold">{config.website_name || 'Sport Booking'}</Text>
                                    </Box>
                                </VStack>
                                {/* Lỗ đục vé trên ảnh */}
                                <Box position="absolute" bottom="-12px" left="-12px" w="24px" h="24px" bg="#edf2f7" borderRadius="full" boxShadow="inset -3px 3px 6px #b8bec5" />
                                <Box position="absolute" bottom="-12px" right="-12px" w="24px" h="24px" bg="#edf2f7" borderRadius="full" boxShadow="inset 3px 3px 6px #b8bec5" />
                            </Box>

                            <Box p={8} bg="#edf2f7">
                                <VStack align="stretch" spacing={6}>
                                    <Box p={5} borderRadius="2xl" bg="#edf2f7" boxShadow="inset 5px 5px 10px #b8bec5, inset -5px -5px 10px #ffffff">
                                        <Text fontSize="10px" color="gray.400" fontWeight="bold" letterSpacing="1px" textTransform="uppercase">SÂN THI ĐẤU</Text>
                                        <Text fontSize="2xl" fontWeight="900" color="blue.700" mt={2}>{downloadingTicket.court_name}</Text>
                                        <Text fontWeight="800" color="gray.600" fontSize="sm">{downloadingTicket.facility_name}</Text>
                                        <HStack mt={3} color="gray.500" fontSize="xs"><Icon as={FaMapMarkerAlt} color="red.500"/><Text fontWeight="bold">{downloadingTicket.address}</Text></HStack>
                                    </Box>

                                    <Divider borderStyle="dashed" borderColor="gray.300" borderWidth="2px" />

                                    <Flex justify="space-between" bg="#edf2f7" p={5} borderRadius="2xl" boxShadow="6px 6px 12px #b8bec5, -6px -6px 12px #ffffff">
                                        <Box>
                                            <Text fontSize="10px" color="gray.400" fontWeight="bold" textTransform="uppercase" mb={1}>Ngày</Text>
                                            <Text fontWeight="900" fontSize="lg" color="gray.800">{new Date(downloadingTicket.booking_date).toLocaleDateString('vi-VN')}</Text>
                                        </Box>
                                        <Box textAlign="right">
                                            <Text fontSize="10px" color="gray.400" fontWeight="bold" textTransform="uppercase" mb={1}>Giờ</Text>
                                            <Text fontWeight="900" fontSize="lg" color="gray.800">{downloadingTicket.booking_time}</Text>
                                        </Box>
                                    </Flex>

                                    <Flex justify="space-between" align="center" bg="#edf2f7" p={6} borderRadius="2xl" boxShadow="inset 8px 8px 16px #b8bec5, inset -8px -8px 16px #ffffff">
                                        <Text fontWeight="900" color="gray.500" fontSize="sm">THANH TOÁN</Text>
                                        <Text fontWeight="900" color="green.500" fontSize="3xl">{parseInt(downloadingTicket.price).toLocaleString()}đ</Text>
                                    </Flex>

                                    <Flex justify="space-between" align="center" pt={2}>
                                        <Badge colorScheme="green" bg="green.50" color="green.500" px={4} py={2} borderRadius="full" fontWeight="900">ĐÃ XÁC NHẬN</Badge>
                                        <VStack spacing={0} align="end">
                                            <Text fontSize="10px" color="gray.400" fontWeight="900">TICKET CODE</Text>
                                            <Text fontWeight="900" color="purple.600" fontSize="2xl" fontFamily="monospace">{downloadingTicket.ticket_code || 'N/A'}</Text>
                                        </VStack>
                                    </Flex>
                                </VStack>
                            </Box>
                            
                            <Box h="20px" w="100%" bgImage="radial-gradient(circle at 10px 20px, transparent 15px, #edf2f7 16px)" bgSize="20px 20px" bgPosition="-10px 0" borderTop="2px dashed" borderColor="gray.300" opacity={0.6} />
                        </Box>

                    </Box>
                </Box>
            )}
        </Modal>
    );
};

export default MyTickets;