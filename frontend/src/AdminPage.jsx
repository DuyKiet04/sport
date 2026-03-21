import React, { useState, useEffect } from 'react';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import { 
    Box, Flex, VStack, HStack, Button, Image, Text, IconButton, Avatar, 
    useColorModeValue, useColorMode, useBreakpointValue, Tabs, TabPanels, TabPanel, 
    Icon, Heading, Menu, MenuButton, MenuList, MenuItem, Badge, Spinner, MenuDivider,
    InputGroup, InputLeftElement, Input, InputRightElement, Divider, Spacer,
    Portal // 🔥 Đã import Portal ở đây
} from '@chakra-ui/react';
import { 
    FaMapMarkedAlt, FaCalendarCheck, FaChartBar, FaUserCog, FaSignOutAlt, 
    FaMoon, FaSun, FaBars, FaBell, FaTrash, FaCircle, FaStar, FaSearch, FaEllipsisH
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

import FacilityTab from './components/FacilityTab';
import BookingTab from './components/BookingTab';
import StatsProfileTab from './components/StatsProfileTab';
import { getImgUrl } from './components/MapTools';
import ReviewTab from './components/ReviewTab';
import NotificationBell from './components/UserPage/NotificationBell'; // Sử dụng bản Neumorph đã sửa

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AdminPage() {
    const [tabIndex, setTabIndex] = useState(0);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [globalSearchTerm, setGlobalSearchTerm] = useState('');
    const [mapSearchTrigger, setMapSearchTrigger] = useState(0);

    const [facilities, setFacilities] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [sportTypes, setSportTypes] = useState([]);
    const [stats, setStats] = useState({ summary: {}, daily: [] });
    const [config, setConfig] = useState({});
    const [user, setUser] = useState(null);
    
    const navigate = useNavigate();
    const isMobile = useBreakpointValue({ base: true, md: false });
    const { colorMode, toggleColorMode } = useColorMode();

    // 🎨 CẤU HÌNH MÀU NEUMORPHISM ĐỒNG BỘ
    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '4px 4px 10px #0d1117, -4px -4px 10px #2d3748');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #0d1117, inset -4px -4px 8px #2d3748');
    
    const textColor = useColorModeValue('gray.700', 'gray.100');
    const textMuted = useColorModeValue('gray.500', 'gray.400');
    const accentColor = useColorModeValue('blue.500', 'blue.300');

    useEffect(() => { setGlobalSearchTerm(''); }, [tabIndex]);

    const fetchData = async () => {
        const userStr = localStorage.getItem('user');
        if(!userStr) { navigate('/login'); return; }
        const currentUser = JSON.parse(userStr);
        setUser(currentUser);
        try {
            const [resFac, resBook, resTypes, resStats, resConfig] = await Promise.all([
                apiClient.get(`/api/vendor/facilities?vendor_id=${currentUser.id}`),
                apiClient.get(`/api/vendor/bookings?vendor_id=${currentUser.id}`),
                apiClient.get('/api/sport-types'),
                apiClient.get(`/api/vendor/stats?vendor_id=${currentUser.id}`),
                apiClient.get('/api/config')
            ]);
            setFacilities(resFac.data || []);
            setBookings(resBook.data || []);
            setSportTypes(resTypes.data || []);
            setStats(resStats.data || { summary: {}, daily: [] });
            setConfig(resConfig.data || {});
        } catch (error) {}
    };

    // Tạo axios instance để dùng interceptor (giống bản Login bác đã có)
    const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_URL + '' });
    apiClient.interceptors.request.use((config) => {
        const token = localStorage.getItem('token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    }, (error) => Promise.reject(error));

    useEffect(() => { fetchData(); }, []);

    const handleLogout = () => { if(window.confirm("Đăng xuất tài khoản?")) { localStorage.clear(); navigate('/login'); } };

    return (
        
        <Flex h={{ base: "100dvh", md: "100vh" }} w="100vw" direction="column" bg={neumorphBg} overflow="hidden">
            
            
            {/* 🔥 HEADER SOFT UI (ĐÃ FIX LỖI ĐÈ NỘI DUNG VÀ LIỆT NÚT) */}
<Flex 
    h={{base: "70px", md: "74px"}} 
    bg={neumorphBg} 
    align="center" px={4} justify="space-between" zIndex={2000} gap={3}
    boxShadow={neumorphShadow} 
    w="100%"
    flexShrink={0} /* Đảm bảo Header luôn giữ đúng 70px, không bị bóp méo */
>
                <HStack spacing={3} flex={1} pointerEvents="auto">
                    {!isMobile && (
                        <IconButton 
                            icon={<FaBars />} variant="ghost" bg={neumorphBg} boxShadow={neumorphShadow} 
                            _active={{boxShadow: neumorphActiveShadow}} onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} 
                            borderRadius="xl" border="none" color={textColor}
                        />
                    )}
                    
                    <Box p={1.5} borderRadius="xl" bg={neumorphBg} boxShadow={neumorphShadow} display="flex" alignItems="center">
                        {config.logo_url && <Image src={getImgUrl(config.logo_url)} h="32px" w="32px" objectFit="contain" borderRadius="md"/>}
                    </Box>
                    
                    {!isMobile && <Heading size="md" fontWeight="900" color={accentColor} letterSpacing="tight">{config.website_name}</Heading>}

                    {/* OMNIBAR DẬP CHÌM */}
                    {(tabIndex === 0 || tabIndex === 1) && (
                        <InputGroup size="md" ml={{base: 2, md: 6}} maxW="450px" flex={1}>
                            <InputLeftElement h="full"><Icon as={FaSearch} color="gray.400" /></InputLeftElement>
                            <Input 
                                placeholder={tabIndex === 0 ? "Tìm địa chỉ trên bản đồ..." : "Mã vé, tên khách..."}
                                value={globalSearchTerm}
                                onChange={(e) => setGlobalSearchTerm(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && tabIndex === 0) setMapSearchTrigger(prev => prev + 1); }}
                                bg={neumorphBg} border="none" borderRadius="2xl" color={textColor}
                                boxShadow={neumorphActiveShadow} fontWeight="bold" fontSize="sm"
                                _focus={{ boxShadow: neumorphActiveShadow, border: "1px solid", borderColor: "blue.300" }}
                            />
                            {tabIndex === 0 && (
                                <InputRightElement h="full">
                                    <IconButton size="sm" isRound icon={<FaSearch />} onClick={() => setMapSearchTrigger(prev => prev + 1)} colorScheme="blue" variant="ghost" border="none"/>
                                </InputRightElement>
                            )}
                        </InputGroup>
                    )}
                </HStack>

                <HStack spacing={4} pointerEvents="auto">
                    {/* Cụm nút tiện ích nổi khối */}
                    <HStack bg={neumorphBg} p={1.5} borderRadius="2xl" boxShadow={neumorphShadow} spacing={1}>
                        <NotificationBell user={user} />
                        <IconButton 
                            icon={colorMode === 'light' ? <FaMoon /> : <FaSun />} 
                            isRound variant="ghost" size="md" onClick={toggleColorMode} 
                            color={textColor} border="none"
                        />
                    </HStack>
                    
                    {!isMobile && (
                        <Menu placement="bottom-end">
                            <MenuButton as={Box} cursor="pointer" p={1} borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}>
                                <Avatar size="sm" src={getImgUrl(user?.avatar)} name={user?.full_name} border="2px solid" borderColor={neumorphBg}/>
                            </MenuButton>
                            {/* 🔥 ĐÃ BỌC PORTAL */}
                            <Portal>
                                <MenuList shadow="2xl" borderRadius="2xl" bg={neumorphBg} border="none" p={2} zIndex={9999}>
                                    <Box px={4} py={3}><Text fontWeight="900" fontSize="sm" color={textColor}>{user?.name}</Text><Text fontSize="xs" bg={neumorphBg} borderRadius="2xl"  color={textMuted}>{user?.email}</Text></Box>
                                    <MenuDivider borderColor={useColorModeValue('gray.200', 'gray.700')} />
                                    <MenuItem bg={neumorphBg} borderRadius="lg"  icon={<FaUserCog />} _hover={{ boxShadow: neumorphShadow }} transition="all 0.2s" _active={{ boxShadow: neumorphActiveShadow }} color={textColor} onClick={() => setTabIndex(2)}>Hồ sơ cá nhân</MenuItem>
                                    <MenuItem bg={neumorphBg} borderRadius="lg" icon={<FaSignOutAlt />} _hover={{ boxShadow: neumorphShadow }} transition="all 0.2s" _active={{ boxShadow: neumorphActiveShadow }}  color="red.500" fontWeight="900" onClick={handleLogout}>Đăng xuất</MenuItem>
                                </MenuList>
                            </Portal>
                        </Menu>
                    )}
                </HStack>
            </Flex>
                    
                    
            <Flex flex={1} position="relative" overflow="hidden">
                {/* 📌 SIDEBAR DESKTOP - CÁC NÚT LỒI LÕM */}
                {!isMobile && (
                    <VStack w={isSidebarCollapsed ? "85px" : "260px"} bg={neumorphBg} h="100%" py={6} spacing={6} px={4} transition="all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)">
                        {[
                            { icon: FaMapMarkedAlt, label: "Quản lý Sân", idx: 0 },
                            { icon: FaCalendarCheck, label: "Lịch Đặt", idx: 1 },
                            { icon: FaChartBar, label: "Thống kê", idx: 2 },
                            { icon: FaStar, label: "Đánh giá", idx: 3 }
                        ].map((item) => (
                            <Button 
                                key={item.idx}
                                leftIcon={<Icon as={item.icon} boxSize={5} />} 
                                w="100%" h="55px"
                                justifyContent={isSidebarCollapsed ? "center" : "flex-start"} 
                                bg={neumorphBg}
                                color={tabIndex === item.idx ? accentColor : textColor}
                                borderRadius="2xl"
                                border="none"
                                boxShadow={tabIndex === item.idx ? neumorphActiveShadow : neumorphShadow}
                                onClick={() => setTabIndex(item.idx)}
                                iconSpacing={isSidebarCollapsed ? 0 : 4}
                                fontSize="sm" fontWeight="900"
                                _hover={{ transform: tabIndex === item.idx ? "none" : "translateY(-2px)" }}
                                _active={{ boxShadow: neumorphActiveShadow }}
                            >
                                {!isSidebarCollapsed && item.label}
                            </Button>
                        ))}
                        
                        <Spacer />
                        
                    </VStack>
                )}

                {/* MAIN CONTENT AREA */}
                <Box flex={1} h="100%" overflow="hidden" position="relative" pb={{ base: "85px", md: 0 }}>
                    <Tabs index={tabIndex} onChange={setTabIndex} isLazy h="100%" variant="unstyled">
                        <TabPanels h="100%">
                            <TabPanel p={0} h="100%"><FacilityTab facilities={facilities} sportTypes={sportTypes} user={user} fetchData={fetchData} isMobile={isMobile} searchQuery={globalSearchTerm} searchTrigger={mapSearchTrigger}/></TabPanel>
                            <TabPanel p={4} h="100%"><BookingTab bookings={bookings} user={user} fetchData={fetchData} isMobile={isMobile} searchTerm={globalSearchTerm}/></TabPanel>
                            <TabPanel p={4} h="100%"><StatsProfileTab stats={stats} user={user} setUser={setUser} isMobile={isMobile}/></TabPanel>
                            <TabPanel p={4} h="100%"><ReviewTab vendorId={user?.id} /></TabPanel>
                        </TabPanels>
                    </Tabs>
                </Box>
            </Flex>

            {/* 🔥 NEUMORPHISM MOBILE BOTTOM NAV */}
            {isMobile && (
                <Box position="fixed" bottom={0} left={0} right={0} zIndex={4000} pb="env(safe-area-inset-bottom)" bg={neumorphBg}>
                    <Flex h="75px" bg={neumorphBg} justify="space-around" align="center" px={2} borderTopLeftRadius="3xl" borderTopRightRadius="3xl" boxShadow="0 -10px 20px rgba(0,0,0,0.05)">
                        
                        <VStack spacing={1} flex={1} cursor="pointer" onClick={() => setTabIndex(0)}>
                            <Box p={2.5} borderRadius="xl" bg={neumorphBg} boxShadow={tabIndex === 0 ? neumorphActiveShadow : neumorphShadow} transition="all 0.2s">
                                <Icon as={FaMapMarkedAlt} boxSize={5} color={tabIndex === 0 ? accentColor : textMuted}/>
                            </Box>
                            <Text fontSize="9px" fontWeight="900" color={tabIndex === 0 ? accentColor : textMuted}>Sân</Text>
                        </VStack>

                        <VStack spacing={1} flex={1} cursor="pointer" onClick={() => setTabIndex(2)}>
                            <Box p={2.5} borderRadius="xl" bg={neumorphBg} boxShadow={tabIndex === 2 ? neumorphActiveShadow : neumorphShadow} transition="all 0.2s">
                                <Icon as={FaChartBar} boxSize={5} color={tabIndex === 2 ? accentColor : textMuted}/>
                            </Box>
                            <Text fontSize="9px" fontWeight="900" color={tabIndex === 2 ? accentColor : textMuted}>Thống kê</Text>
                        </VStack>

                        {/* NÚT LỊCH NỔI GIỮA (Tactile Button) */}
                        <Box flex={1} position="relative" display="flex" justifyContent="center">
                            <Box 
                                position="absolute" top="-45px" p={2} borderRadius="full" bg={neumorphBg} 
                                boxShadow={neumorphShadow}
                            >
                                <Flex
                                    w="60px" h="60px"
                                    bg={neumorphBg}
                                    color={tabIndex === 1 ? "white" : accentColor}
                                    bgGradient={tabIndex === 1 ? "linear(to-br, blue.400, blue.600)" : "none"}
                                    borderRadius="full"
                                    justify="center" align="center"
                                    boxShadow={tabIndex === 1 ? neumorphActiveShadow : neumorphShadow}
                                    cursor="pointer"
                                    onClick={() => setTabIndex(1)}
                                    transition="all 0.3s"
                                    _active={{ transform: 'scale(0.9)', boxShadow: neumorphActiveShadow }}
                                >
                                    <Icon as={FaCalendarCheck} boxSize={7} />
                                </Flex>
                            </Box>
                            <Text mt="48px" fontSize="9px" fontWeight="900" color={tabIndex === 1 ? accentColor : textMuted}>Lịch Đặt</Text>
                        </Box>

                        <VStack spacing={1} flex={1} cursor="pointer" onClick={() => setTabIndex(3)}>
                            <Box p={2.5} borderRadius="xl" bg={neumorphBg} boxShadow={tabIndex === 3 ? neumorphActiveShadow : neumorphShadow} transition="all 0.2s">
                                <Icon as={FaStar} boxSize={5} color={tabIndex === 3 ? accentColor : textMuted}/>
                            </Box>
                            <Text fontSize="9px" fontWeight="900" color={tabIndex === 3 ? accentColor : textMuted}>Review</Text>
                        </VStack>

                        <Menu placement="top-end">
                            <MenuButton as={Box} flex={1}>
                                <VStack spacing={1} align="center">
                                    <Box p={1} borderRadius="xl" bg={neumorphBg} boxShadow={neumorphShadow} transition="all 0.2s">
                                        <Avatar boxSize="32px" src={getImgUrl(user?.avatar)} name={user?.full_name} border="none"/>
                                    </Box>
                                    <Text fontSize="9px" fontWeight="900" color={textMuted}>Thêm</Text>
                                </VStack>
                            </MenuButton>
                            {/* 🔥 ĐÃ BỌC PORTAL VÀ NÂNG Z-INDEX LÊN ĐỤNG NÓC */}
                            <Portal>
                                <MenuList shadow="2xl" borderRadius="2xl" zIndex={9999} bg={neumorphBg} border="1px solid" borderColor={useColorModeValue('gray.200', 'gray.700')} p={2} mb={2}>
                                    <Box px={4} py={3}><Text fontWeight="900" fontSize="sm" color={textColor}>{user?.full_name}</Text></Box>
                                    <MenuDivider borderColor={useColorModeValue('gray.200', 'gray.700')} />
                                    <MenuItem bg={neumorphBg} borderRadius="lg" icon={<FaUserCog />} onClick={() => setTabIndex(2)}>Hồ sơ & Cài đặt</MenuItem>
                                    <MenuItem bg={neumorphBg} borderRadius="lg" icon={<FaSignOutAlt />} color="red.500" fontWeight="900" onClick={handleLogout}>Đăng xuất</MenuItem>
                                </MenuList>
                            </Portal>
                        </Menu>
                        
                    </Flex>
                </Box>
            )}
        </Flex>
    );
}