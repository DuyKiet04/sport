import React, { useState, useRef } from 'react';
import axios from 'axios';
import { 
    Box, Container, Heading, SimpleGrid, GridItem, Stat, StatLabel, StatNumber, 
    VStack, Avatar, IconButton, Divider, FormControl, FormLabel, Input, 
    InputGroup, InputLeftElement, Button, useToast, Badge, HStack, Icon, Text, Flex, useColorModeValue
} from '@chakra-ui/react';
import { FaCamera, FaPhone, FaFacebook, FaCheck, FaWallet, FaTicketAlt, FaClock, FaUserCircle, FaChartLine  } from 'react-icons/fa';
import { SiZalo } from 'react-icons/si';
import { Bar } from 'react-chartjs-2';
import { getImgUrl } from './MapTools';

const StatsProfileTab = ({ stats, user, setUser, isMobile }) => {
    const [profileData, setProfileData] = useState({ 
        phone_number: user?.phone_number || '', 
        facebook_url: user?.facebook_url || '', 
        zalo_url: user?.zalo_url || '', 
        open_time: user?.open_time || '06:00', 
        close_time: user?.close_time || '22:00' 
    });
    const [uploading, setUploading] = useState(false);
    const toast = useToast();
    const fileInputRef = useRef();

    // 🎨 CẤU HÌNH MÀU NEUMORPHISM ĐỒNG BỘ
    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '6px 6px 12px #0d1117, -4px -4px 10px #2d3748');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #0d1117, inset -4px -4px 8px #2d3748');
    
    const textColor = useColorModeValue('gray.700', 'gray.100');
    const textMuted = useColorModeValue('gray.500', 'gray.400');
    const accentColor = useColorModeValue('blue.500', 'blue.300');

    const inputStyle = {
        bg: neumorphBg,
        border: "none",
        color: textColor,
        boxShadow: neumorphActiveShadow,
        borderRadius: "xl",
        fontSize: "sm",
        fontWeight: "bold",
        _focus: { boxShadow: neumorphActiveShadow, border: "1px solid", borderColor: "blue.400" },
        _placeholder: { color: "gray.400" }
    };

    const handleUpdate = async () => { 
        try { 
            await axios.put(`${import.meta.env.VITE_API_URL}/api/users/${user.id}/profile`, profileData); 
            const updatedUser = { ...user, ...profileData };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setUser(updatedUser); 
            toast({ title: 'Đã cập nhật hồ sơ!', status: 'success' }); 
        } catch { toast({ title: 'Lỗi cập nhật', status: 'error' }); } 
    };

    const handleAvatar = async (e) => { 
        const file = e.target.files[0]; if(!file) return; 
        setUploading(true); const fd = new FormData(); fd.append('image', file);
        try { 
            const res = await axios.post(import.meta.env.VITE_API_URL + '/api/upload', fd); 
            await axios.put(`${import.meta.env.VITE_API_URL}/api/users/${user.id}/avatar`, { avatar_url: res.data.url }); 
            const updatedUser = { ...user, avatar: res.data.url, avatar_url: res.data.url };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setUser(updatedUser); 
            toast({title:'Đã đổi ảnh đại diện!', status:'success'}); 
        } catch { toast({title:'Lỗi tải ảnh', status:'error'}); } 
        finally { setUploading(false); }
    };

    const chartConfig = { 
        labels: stats.daily?.map(d => d.day) || [], 
        datasets: [{ 
            label: 'Doanh thu (VNĐ)', 
            data: stats.daily?.map(d => d.revenue) || [], 
            backgroundColor: '#3182ce',
            borderRadius: 10,
            maxBarThickness: 35
        }] 
    };

    const currentAvatar = getImgUrl(user?.avatar || user?.avatar_url);

    return (
        <Box h="100%" overflowY="auto" p={isMobile ? 4 : 8} bg={neumorphBg} css={{scrollbarWidth: "none"}}>
            <Container maxW="container.xl" px={0}>
                
                <VStack align="start" spacing={1} mb={8}>
                    <Heading size="lg" color={textColor} fontWeight="900" textTransform="uppercase" letterSpacing="tight">📊 Thống kê & Hồ sơ</Heading>
                    <HStack bg={neumorphBg} px={4} py={1} borderRadius="full" boxShadow={neumorphActiveShadow}>
                        <Text fontSize="xs" fontWeight="900" color="blue.500">TRUNG TÂM ĐIỀU HÀNH CHỦ SÂN</Text>
                    </HStack>
                </VStack>

                <SimpleGrid columns={{base: 1, lg: 3}} spacing={8}>
                    
                    {/* CỘT TRÁI: THỐNG KÊ */}
                    <GridItem colSpan={{base: 1, lg: 2}}>
                        <SimpleGrid columns={{base: 1, md: 2}} spacing={6} mb={8}>
                            {/* Card Doanh Thu */}
                            <Box bg={neumorphBg} p={6} borderRadius="3xl" boxShadow={neumorphShadow} position="relative" overflow="hidden">
                                <Flex align="center" justify="space-between" mb={4}>
                                    <Text fontSize="xs" fontWeight="900" color={textMuted} letterSpacing="1px">TỔNG DOANH THU</Text>
                                    <Box p={2} borderRadius="xl" bg={neumorphBg} boxShadow={neumorphActiveShadow}>
                                        <Icon as={FaWallet} color="green.500" boxSize={5}/>
                                    </Box>
                                </Flex>
                                <Text color="green.500" fontSize="3xl" fontWeight="900" lineHeight="1">
                                    {parseInt(stats.summary.total_revenue || 0).toLocaleString()} ₫
                                </Text>
                                <Text fontSize="10px" color={textMuted} mt={3} fontWeight="bold">Dựa trên tất cả đơn đặt sân thành công</Text>
                            </Box>

                            {/* Card Đơn Đặt */}
                            <Box bg={neumorphBg} p={6} borderRadius="3xl" boxShadow={neumorphShadow}>
                                <Flex align="center" justify="space-between" mb={4}>
                                    <Text fontSize="xs" fontWeight="900" color={textMuted} letterSpacing="1px">TỔNG ĐƠN ĐẶT</Text>
                                    <Box p={2} borderRadius="xl" bg={neumorphBg} boxShadow={neumorphActiveShadow}>
                                        <Icon as={FaTicketAlt} color="blue.500" boxSize={5}/>
                                    </Box>
                                </Flex>
                                <Text color="blue.500" fontSize="3xl" fontWeight="900" lineHeight="1">
                                    {stats.summary.total_bookings || 0} VÉ
                                </Text>
                                <Text fontSize="10px" color={textMuted} mt={3} fontWeight="bold">Lượt khách đã đặt sân qua hệ thống</Text>
                            </Box>
                        </SimpleGrid>

                        {/* Biểu đồ */}
                        <Box bg={neumorphBg} p={6} borderRadius="3xl" boxShadow={neumorphShadow} border="none">
                            <HStack mb={6} spacing={3}>
                                <Icon as={FaChartLine} color="blue.500" />
                                <Text fontWeight="900" color={textColor} fontSize="sm" textTransform="uppercase">Doanh thu 7 ngày gần nhất</Text>
                            </HStack>
                            <Box h={{ base: "250px", md: "350px" }} p={2} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow}>
                                <Bar data={chartConfig} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } }} />
                            </Box>
                        </Box>
                    </GridItem>
                    
                    {/* CỘT PHẢI: HỒ SƠ */}
                    <GridItem>
                        <Box bg={neumorphBg} p={8} borderRadius="3xl" boxShadow={neumorphShadow} position="sticky" top="20px">
                            <VStack align="center" spacing={6} mb={8}>
                                <Box position="relative" p={2} borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow}>
                                    <Avatar size="2xl" src={currentAvatar} border="4px solid" borderColor={neumorphBg} />
                                    <IconButton 
                                        icon={<FaCamera/>} isRound size="sm" colorScheme="blue" 
                                        position="absolute" bottom={2} right={2} shadow="2xl"
                                        onClick={() => fileInputRef.current.click()} isLoading={uploading}
                                        bgGradient="linear(to-r, blue.400, blue.600)" color="white" border="none"
                                    />
                                    <input type="file" ref={fileInputRef} style={{display:'none'}} onChange={handleAvatar} accept="image/*"/>
                                </Box>
                                <VStack spacing={1}>
                                    <Heading size="md" color={textColor} fontWeight="900">{user?.name || 'Chủ Sân'}</Heading>
                                    <Badge colorScheme="purple" variant="subtle" borderRadius="full" px={4} py={1} fontWeight="900" border="none" fontSize="10px">VẬN HÀNH HỆ THỐNG</Badge>
                                </VStack>
                            </VStack>

                            <Divider borderColor={useColorModeValue('gray.300', 'gray.600')} opacity={0.3} mb={8}/>
                            
                            <VStack spacing={6} align="stretch">
                                {/* <HStack spacing={4}>
                                    <FormControl>
                                        <FormLabel fontSize="10px" fontWeight="900" color={textMuted} ml={2} textTransform="uppercase">Mở cửa</FormLabel>
                                        <Input h="50px" type="time" {...inputStyle} value={profileData.open_time} onChange={e=>setProfileData({...profileData, open_time: e.target.value})} />
                                    </FormControl>
                                    <FormControl>
                                        <FormLabel fontSize="10px" fontWeight="900" color={textMuted} ml={2} textTransform="uppercase">Đóng cửa</FormLabel>
                                        <Input h="50px" type="time" {...inputStyle} value={profileData.close_time} onChange={e=>setProfileData({...profileData, close_time: e.target.value})} />
                                    </FormControl>
                                </HStack> */}

                                <FormControl>
                                    <FormLabel fontSize="10px" fontWeight="900" color={textMuted} ml={2} textTransform="uppercase">Điện thoại liên hệ</FormLabel>
                                    <InputGroup>
                                        <InputLeftElement h="full" children={<Icon as={FaPhone} color="gray.400"/>}/>
                                        <Input h="50px" {...inputStyle} placeholder="Số điện thoại..." value={profileData.phone_number} onChange={e=>setProfileData({...profileData, phone_number: e.target.value})} />
                                    </InputGroup>
                                </FormControl>

                                <FormControl>
                                    <FormLabel fontSize="10px" fontWeight="900" color={textMuted} ml={2} textTransform="uppercase">Trang Facebook</FormLabel>
                                    <InputGroup>
                                        <InputLeftElement h="full" children={<Icon as={FaFacebook} color="blue.500"/>}/>
                                        <Input h="50px" {...inputStyle} placeholder="Link fanpage..." value={profileData.facebook_url} onChange={e=>setProfileData({...profileData, facebook_url: e.target.value})} />
                                    </InputGroup>
                                </FormControl>

                                <FormControl>
                                    <FormLabel fontSize="10px" fontWeight="900" color={textMuted} ml={2} textTransform="uppercase">Số Zalo công việc</FormLabel>
                                    <InputGroup>
                                        <InputLeftElement h="full" children={<Icon as={SiZalo} color="blue.400" boxSize={5}/>}/>
                                        <Input h="50px" {...inputStyle} placeholder="Số Zalo..." value={profileData.zalo_url} onChange={e=>setProfileData({...profileData, zalo_url: e.target.value})} />
                                    </InputGroup>
                                </FormControl>

                                <Button 
                                    mt={4} h="55px" borderRadius="2xl" colorScheme="blue" 
                                    bgGradient="linear(to-r, blue.400, blue.600)" color="white"
                                    onClick={handleUpdate} leftIcon={<FaCheck/>} boxShadow="xl" 
                                    _hover={{ transform: 'translateY(-2px)', shadow: '2xl' }} 
                                    _active={{ transform: 'scale(0.95)' }}
                                    fontWeight="900" border="none"
                                >
                                    LƯU THÔNG TIN HỒ SƠ
                                </Button>
                            </VStack>
                        </Box>
                    </GridItem>

                </SimpleGrid>
                {/* Spacer cho Mobile Bottom Nav */}
                {isMobile && <Box h="100px" />}
            </Container>
        </Box>
    );
};
export default StatsProfileTab;