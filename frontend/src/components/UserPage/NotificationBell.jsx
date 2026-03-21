import React, { useState, useEffect, useRef } from 'react';
import {
    Menu, MenuButton, MenuList, // 🔥 CHUYỂN SANG DÙNG MENU ĐỂ ĐẢM BẢO 100% KHÔNG LỖI TRIGGER
    IconButton, Badge, Box, VStack, HStack, Text, Button, Icon, Flex, useToast, Divider, Image, useColorModeValue,
    Portal
} from '@chakra-ui/react';
import { FaBell, FaTicketAlt, FaTrash, FaCheckDouble, FaDownload, FaCalendarDay, FaClock, FaCheckCircle, FaMapMarkerAlt } from 'react-icons/fa';
import axios from 'axios';
import html2canvas from 'html2canvas';

const getImgUrl = (url) => { 
    if (!url) return '';
    if (url.startsWith('http')) return url; 
    const cleanPath = url.replace(/\\/g, '/').replace(/^\/+/, ''); 
    return `${import.meta.env.VITE_API_URL}/${cleanPath}`; 
};

const NotificationBell = () => {
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [config, setConfig] = useState({});
    
    const ticketRef = useRef(null);
    const [downloadingTicket, setDownloadingTicket] = useState(null);

    const limit = 5;
    const user = JSON.parse(localStorage.getItem('user'));
    const toast = useToast();

    const neumorphBg = useColorModeValue('#edf2f7', '#2d3748');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '4px 4px 10px #1a202c, -4px -4px 10px #4a5568');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #1a202c, inset -4px -4px 8px #4a5568');
    
    const textColor = useColorModeValue('gray.800', 'white');
    const subTextColor = useColorModeValue('gray.600', 'gray.300');
    const textMuted = useColorModeValue("gray.500", "gray.400");
    const headerTitleColor = useColorModeValue("blue.600", "blue.300");

    const fetchData = async (isLoadMore = false) => {
        if (!user) return; 

        const currentOffset = isLoadMore ? (page + 1) * limit : 0;
        setLoading(true);
        try {
            const [notiRes, configRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/api/notifications/${user.id}?limit=${limit}&offset=${currentOffset}`),
                axios.get(import.meta.env.VITE_API_URL + '/api/config')
            ]);

            setConfig(configRes.data || {});
            
            if (isLoadMore) {
                setNotifications(prev => [...prev, ...notiRes.data.notifications]);
                setPage(page + 1);
            } else {
                setNotifications(notiRes.data.notifications);
                setPage(0);
            }
            
            setUnread(notiRes.data.unreadCount);
            if (notiRes.data.notifications.length < limit) setHasMore(false);
        } catch (error) {
            console.error("Lỗi lấy thông báo", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => fetchData(), 10000); 
        
        const handleInstantNotification = () => fetchData();
        window.addEventListener('refresh_notifications', handleInstantNotification);

        return () => {
            clearInterval(interval);
            window.removeEventListener('refresh_notifications', handleInstantNotification);
        };
    }, []);

    const handleOpen = () => {
        if (unread > 0) {
            setUnread(0);
            axios.put(`${import.meta.env.VITE_API_URL}/api/notifications/${user.id}/read`);
        }
    };

    const handleClose = () => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    const handleDeleteOne = async (id, e) => {
        e.stopPropagation();
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/notifications/item/${id}`);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) { toast({ status: "error", title: "Lỗi xóa" }); }
    };

    const handleClearAll = async () => {
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/notifications/all/${user.id}`);
            setNotifications([]);
            setUnread(0);
            toast({ status: "success", title: "Đã dọn dẹp sạch sẽ!" });
        } catch (err) { toast({ status: "error", title: "Lỗi xóa" }); }
    };

    const handleDownloadTicketImage = async (bookingId) => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/bookings/ticket/${bookingId}`);
            setDownloadingTicket(res.data);
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

    if (!user) return null;

    return (
        <>
            <Menu placement="bottom-end" onOpen={handleOpen} onClose={handleClose} isLazy>
                <MenuButton as={Box} position="relative" cursor="pointer" mr={4} 
                     p={2} borderRadius="full" bg={neumorphBg} 
                     boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} 
                     transition="all 0.2s"
                >
                    <Icon as={FaBell} color={unread > 0 ? "red.500" : "blue.500"} boxSize={5} mb="-2px" />
                    {unread > 0 && (
                        <Badge 
                            position="absolute" top="-4px" right="-4px" bg="red.500" color="white" 
                            borderRadius="full" fontSize="0.6em" w="18px" h="18px" display="flex" 
                            alignItems="center" justifyContent="center" animation="pulse 1.5s infinite"
                            border="2px solid" borderColor={neumorphBg}
                        >
                            {unread > 9 ? '9+' : unread}
                        </Badge>
                    )}
                </MenuButton>

                <Portal>
                    <MenuList w="350px" boxShadow={neumorphShadow} borderRadius="2xl" border="none" overflow="hidden" bg={neumorphBg} mt={2} zIndex={9999} p={0}>
                        <Flex bg={neumorphBg} p={5} justify="space-between" align="center" borderBottom="1px solid" borderColor={useColorModeValue('gray.200', 'gray.700')}>
                            <Text fontWeight="900" fontSize="md" color={headerTitleColor} textTransform="uppercase">THÔNG BÁO</Text>
                            {notifications.length > 0 && (
                                <Button size="xs" colorScheme="red" variant="ghost" onClick={handleClearAll} leftIcon={<FaCheckDouble />}>
                                    Dọn dẹp
                                </Button>
                            )}
                        </Flex>
                        
                        <Box p={3} maxH="400px" overflowY="auto" className="hide-scrollbar" bg={neumorphBg}>
                            {notifications.length === 0 ? (
                                <VStack py={10} color={textMuted} bg={neumorphBg} borderRadius="xl" boxShadow={neumorphActiveShadow} mx={2}>
                                    <Icon as={FaBell} boxSize={10} opacity={0.3} color="blue.500"/>
                                    <Text fontWeight="bold" fontSize="sm">Chưa có thông báo nào</Text>
                                </VStack>
                            ) : (
                                <VStack spacing={3} align="stretch" px={1}>
                                    {notifications.map(noti => (
                                        <Box 
                                            key={noti.id} p={4} borderRadius="xl"
                                            bg={neumorphBg} 
                                            boxShadow={noti.is_read ? neumorphShadow : neumorphActiveShadow}
                                            border="none"
                                            position="relative"
                                            opacity={noti.is_read ? 0.7 : 1}
                                            transition="all 0.2s"
                                        >
                                            {!noti.is_read && (
                                                <Box position="absolute" top={3} right={3} w="8px" h="8px" bg="blue.500" borderRadius="full" boxShadow="0 0 5px rgba(49, 130, 206, 0.6)" />
                                            )}

                                            <Flex justify="space-between" align="start">
                                                <HStack align="start" spacing={4} maxW="90%">
                                                    <Flex w="40px" h="40px" borderRadius="xl" bg={neumorphBg} boxShadow={neumorphShadow} color={noti.type === 'booking_success' ? "green.500" : "blue.500"} align="center" justify="center" flexShrink={0}>
                                                        <Icon as={noti.type === 'booking_success' ? FaTicketAlt : FaBell} boxSize={5}/>
                                                    </Flex>
                                                    <Box>
                                                        <Text fontWeight="900" fontSize="sm" color={textColor} mb={1}>
                                                            {noti.title}
                                                        </Text>
                                                        <Text fontSize="xs" color={subTextColor} lineHeight="1.5">
                                                            {noti.message}
                                                        </Text>
                                                        <Text fontSize="9px" color={textMuted} mt={2} fontWeight="bold" letterSpacing="1px">
                                                            {new Date(noti.created_at).toLocaleString('vi-VN')}
                                                        </Text>
                                                        
                                                        {noti.type === 'booking_success' && noti.reference_id && (
                                                            <Button size="xs" mt={3} colorScheme="green" bgGradient="linear(to-r, green.400, teal.400)" color="white" boxShadow="md" borderRadius="md" leftIcon={<FaDownload />} onClick={() => handleDownloadTicketImage(noti.reference_id)} _hover={{ transform: 'translateY(-2px)' }} _active={{ transform: 'none' }}>
                                                                Tải Vé Điện Tử
                                                            </Button>
                                                        )}
                                                    </Box>
                                                </HStack>
                                                <IconButton 
                                                    icon={<FaTrash />} size="xs" variant="ghost" colorScheme="red" 
                                                    onClick={(e) => handleDeleteOne(noti.id, e)} 
                                                    position="absolute" bottom={2} right={2}
                                                    opacity={0.5} _hover={{ opacity: 1, bg: 'transparent', transform: 'scale(1.1)' }}
                                                />
                                            </Flex>
                                        </Box>
                                    ))}
                                </VStack>
                            )}
                            
                            {hasMore && notifications.length > 0 && (
                                <Button w="full" mt={3} bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} borderRadius="xl" color="blue.500" fontSize="sm" fontWeight="bold" onClick={() => fetchData(true)} isLoading={loading}>
                                    Tải thêm thông báo
                                </Button>
                            )}
                        </Box>
                    </MenuList>
                </Portal>
            </Menu>

            {/* KHU VỰC VẼ VÉ GIỮ NGUYÊN KHÔNG ĐỔI */}
            {downloadingTicket && (
                <Box position="fixed" top="-10000px" left="0" zIndex="-1">
                    <Box ref={ticketRef} w="400px" bg="#edf2f7" borderRadius="2xl" p={4} overflow="hidden" fontFamily="'Inter', -apple-system, sans-serif" style={{ textRendering: 'geometricPrecision', WebkitFontSmoothing: 'antialiased' }}>
                        <Box bg="#edf2f7" borderRadius="xl" boxShadow="8px 8px 16px #c5cad3, -8px -8px 16px #ffffff" overflow="hidden" position="relative">
                            <Box bgGradient="linear(to-br, blue.500, blue.700)" color="white" p={6} textAlign="center" position="relative">
                                <VStack spacing={3}>
                                    <Flex bg="rgba(255,255,255,0.2)" backdropFilter="blur(5px)" p={3} borderRadius="xl" shadow="md" border="1px solid rgba(255,255,255,0.3)">
                                        {config.logo_url ? <Image src={getImgUrl(config.logo_url)} h="45px" objectFit="contain" /> : <Icon as={FaTicketAlt} boxSize={8} color="white" />}
                                    </Flex>
                                    <Box>
                                        <Text fontSize="2xl" fontWeight="900" letterSpacing="4px" textTransform="uppercase" lineHeight="1.2">VÉ ĐIỆN TỬ</Text>
                                        <Text fontSize="xs" opacity={0.9} fontWeight="bold" mt={1} letterSpacing="1px">{config.website_name || 'Sport Booking System'}</Text>
                                    </Box>
                                </VStack>
                                <Box position="absolute" bottom="-12px" left="-12px" w="24px" h="24px" bg="#edf2f7" borderRadius="full" boxShadow="inset -3px 3px 6px #c5cad3" />
                                <Box position="absolute" bottom="-12px" right="-12px" w="24px" h="24px" bg="#edf2f7" borderRadius="full" boxShadow="inset 3px 3px 6px #c5cad3" />
                            </Box>

                            <Box p={6} bg="#edf2f7">
                                <VStack align="stretch" spacing={5}>
                                    <Box p={4} borderRadius="lg" bg="#edf2f7" boxShadow="inset 4px 4px 8px #c5cad3, inset -4px -4px 8px #ffffff">
                                        <Text fontSize="10px" color="gray.500" fontWeight="bold" letterSpacing="1px" textTransform="uppercase">Thông tin Sân</Text>
                                        <Text fontSize="xl" fontWeight="900" color="blue.700" mt={1} lineHeight="1.3">{downloadingTicket.court_name}</Text>
                                        <Text fontWeight="800" color="gray.700" fontSize="sm" mt={1}>{downloadingTicket.facility_name}</Text>
                                        <HStack mt={2} color="gray.600" fontSize="xs" align="start"><Icon as={FaMapMarkerAlt} mt={0.5} flexShrink={0} color="red.500"/><Text lineHeight="1.4" fontWeight="600">{downloadingTicket.address}</Text></HStack>
                                    </Box>

                                    <Divider borderStyle="dashed" borderColor="gray.400" borderWidth="2px" opacity={0.5} />
                                    
                                    <Flex justify="space-between" bg="#edf2f7" p={4} borderRadius="xl" boxShadow="4px 4px 8px #c5cad3, -4px -4px 8px #ffffff">
                                        <Box>
                                            <Text fontSize="10px" color="gray.500" fontWeight="bold" letterSpacing="1px" textTransform="uppercase" mb={1}>Ngày đá</Text>
                                            <HStack color="gray.800"><Icon as={FaCalendarDay} color="blue.500" /><Text fontWeight="900" fontSize="md">{new Date(downloadingTicket.booking_date).toLocaleDateString('vi-VN')}</Text></HStack>
                                        </Box>
                                        <Box borderLeft="2px dashed" borderColor="gray.300" pl={6}>
                                            <Text fontSize="10px" color="gray.500" fontWeight="bold" letterSpacing="1px" textTransform="uppercase" mb={1}>Thời gian</Text>
                                            <HStack color="gray.800"><Icon as={FaClock} color="orange.500" /><Text fontWeight="900" fontSize="md">{downloadingTicket.booking_time}</Text></HStack>
                                        </Box>
                                    </Flex>

                                    <Flex justify="space-between" align="center" bg="#edf2f7" p={5} borderRadius="xl" boxShadow="inset 6px 6px 12px #c5cad3, inset -6px -6px 12px #ffffff">
                                        <Text fontWeight="900" color="gray.500" fontSize="sm">TỔNG THANH TOÁN</Text>
                                        <Text fontWeight="900" color="green.500" fontSize="3xl">{parseInt(downloadingTicket.price).toLocaleString()}đ</Text>
                                    </Flex>
                                    
                                    <Flex justify="space-between" align="center" pt={2} px={1}>
                                        <Badge colorScheme="green" bg="green.50" color="green.500" px={3} py={1.5} borderRadius="full" display="flex" alignItems="center" fontSize="xs" fontWeight="bold" border="none">
                                            <Icon as={FaCheckCircle} mr={1.5} /> ĐÃ XÁC NHẬN
                                        </Badge>
                                        <VStack spacing={0} align="end">
                                            <Text fontSize="9px" color="gray.500" letterSpacing="1px" fontWeight="bold">MÃ VÉ (BOOKING ID)</Text>
                                            <Text fontWeight="900" color="blue.700" letterSpacing="3px" fontSize="xl" fontFamily="monospace">#{downloadingTicket.id.toString().padStart(5, '0')}</Text>
                                        </VStack>
                                    </Flex>

                                </VStack>
                            </Box>
                            
                            <Box h="15px" w="100%" bgImage="radial-gradient(circle at 10px 15px, transparent 12px, #edf2f7 13px)" bgSize="20px 20px" bgPosition="-10px 0" borderTop="1px dashed" borderColor="gray.400" opacity={0.8} />
                        </Box>

                    </Box>
                </Box>
            )}
        </>
    );
};

export default NotificationBell;