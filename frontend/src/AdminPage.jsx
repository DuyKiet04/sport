import React, { useState, useEffect } from 'react';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import { Box, Flex, VStack, HStack, Button, Image, Text, IconButton, Spacer, Avatar, useColorModeValue, useColorMode, useBreakpointValue, Tabs, TabPanels, TabPanel ,Icon } from '@chakra-ui/react';
import { FaMapMarkedAlt, FaCalendarCheck, FaChartBar, FaUserCog, FaSignOutAlt, FaMoon, FaSun, FaBars } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

// Import các file vừa tạo từ thư mục components
import FacilityTab from './components/FacilityTab';
import BookingTab from './components/BookingTab';
import StatsProfileTab from './components/StatsProfileTab';
import { getImgUrl } from './components/MapTools';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AdminPage() {
    const [tabIndex, setTabIndex] = useState(0);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    
    // Data States
    const [facilities, setFacilities] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [sportTypes, setSportTypes] = useState([]);
    const [stats, setStats] = useState({ summary: {}, daily: [] });
    const [config, setConfig] = useState({});
    const [user, setUser] = useState(null);

    const navigate = useNavigate();
    const isMobile = useBreakpointValue({ base: true, md: false });
    const { colorMode, toggleColorMode } = useColorMode();
    const bg = useColorModeValue('gray.50', 'gray.900');
    const panelBg = useColorModeValue('white', 'gray.800');

    // Fetch Data (Giữ nguyên logic fetch cũ)
    const fetchData = async () => {
        const userStr = localStorage.getItem('user');
        if(!userStr) { navigate('/login'); return; }
        const currentUser = JSON.parse(userStr);
        setUser(currentUser);

        try {
            const [resFac, resBook, resTypes, resStats, resConfig] = await Promise.all([
                axios.get(`http://localhost:5000/api/vendor/facilities?vendor_id=${currentUser.id}`),
                axios.get(`http://localhost:5000/api/vendor/bookings?vendor_id=${currentUser.id}`),
                axios.get('http://localhost:5000/api/sport-types'),
                axios.get(`http://localhost:5000/api/vendor/stats?vendor_id=${currentUser.id}`),
                axios.get('http://localhost:5000/api/config')
            ]);
            setFacilities(resFac.data || []);
            setBookings(resBook.data || []);
            setSportTypes(resTypes.data || []);
            setStats(resStats.data || { summary: {}, daily: [] });
            setConfig(resConfig.data || {});
        } catch (error) { console.error("Fetch error:", error); }
    };

    useEffect(() => { fetchData(); }, []);

    return (
        <Flex h="100vh" w="100vw" direction="column" bg={bg} overflow="hidden">
            {/* Header */}
            <Flex h="64px" bg={panelBg} shadow="sm" align="center" px={4} justify="space-between" zIndex={2000}>
                <HStack>
                    {!isMobile && <IconButton icon={<FaBars />} variant="ghost" onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} />}
                    <HStack>
                        {config.logo_url && <Image src={getImgUrl(config.logo_url)} h="32px" />}
                        <Text fontWeight="900" fontSize="lg">{config.website_name || 'Admin Panel'}</Text>
                    </HStack>
                </HStack>
                <HStack>
                    {!isMobile && <Button leftIcon={<FaSignOutAlt />} size="sm" colorScheme="red" variant="ghost" onClick={()=>{localStorage.clear(); navigate('/login')}}>Đăng xuất</Button>}
                    <IconButton icon={colorMode === 'light' ? <FaMoon /> : <FaSun />} isRound variant="ghost" onClick={toggleColorMode} />
                    <Avatar size="sm" src={getImgUrl(user?.avatar)} name={user?.full_name}/>
                </HStack>
            </Flex>

            <Flex flex={1} position="relative" overflow="hidden">
                {/* Desktop Sidebar */}
                {!isMobile && (
                    <VStack w={isSidebarCollapsed ? "60px" : "240px"} bg={panelBg} h="100%" borderRight="1px solid" borderColor="gray.200" py={4} spacing={1} px={isSidebarCollapsed ? 0 : 4}>
                        <Button leftIcon={<FaMapMarkedAlt />} w="100%" justifyContent={isSidebarCollapsed?"center":"flex-start"} colorScheme="blue" variant={tabIndex===0?"solid":"ghost"} onClick={()=>setTabIndex(0)}>{!isSidebarCollapsed && "Quản lý Sân"}</Button>
                        <Button leftIcon={<FaCalendarCheck />} w="100%" justifyContent={isSidebarCollapsed?"center":"flex-start"} colorScheme="blue" variant={tabIndex===1?"solid":"ghost"} onClick={()=>setTabIndex(1)}>{!isSidebarCollapsed && "Lịch Đặt"}</Button>
                        <Button leftIcon={<FaChartBar />} w="100%" justifyContent={isSidebarCollapsed?"center":"flex-start"} colorScheme="blue" variant={tabIndex===2?"solid":"ghost"} onClick={()=>setTabIndex(2)}>{!isSidebarCollapsed && "Thống kê"}</Button>
                    </VStack>
                )}

                {/* Content */}
                <Box flex={1} h="100%" overflow="hidden">
                    <Tabs index={tabIndex} onChange={setTabIndex} isLazy h="100%" variant="unstyled">
                        <TabPanels h="100%">
                            <TabPanel p={0} h="100%"><FacilityTab facilities={facilities} sportTypes={sportTypes} user={user} fetchData={fetchData} isMobile={isMobile}/></TabPanel>
                            <TabPanel p={0} h="100%"><BookingTab bookings={bookings} user={user} fetchData={fetchData} isMobile={isMobile}/></TabPanel>
                            <TabPanel p={0} h="100%"><StatsProfileTab stats={stats} user={user} setUser={setUser} isMobile={isMobile}/></TabPanel>
                        </TabPanels>
                    </Tabs>
                </Box>
            </Flex>

            {/* Mobile Nav */}
            {isMobile && (
                <Flex position="fixed" bottom={0} left={0} right={0} bg="white" h="65px" borderTop="1px solid" borderColor="gray.100" justify="space-around" align="center" zIndex={4000}>
                    <VStack onClick={()=>setTabIndex(0)} color={tabIndex===0 ? "blue.600" : "gray.400"}><Icon as={FaMapMarkedAlt} boxSize={5}/><Text fontSize="10px">Sân</Text></VStack>
                    <VStack onClick={()=>setTabIndex(1)} color={tabIndex===1 ? "blue.600" : "gray.400"}><Icon as={FaCalendarCheck} boxSize={5}/><Text fontSize="10px">Lịch</Text></VStack>
                    <VStack onClick={()=>setTabIndex(2)} color={tabIndex===2 ? "blue.600" : "gray.400"}><Icon as={FaUserCog} boxSize={5}/><Text fontSize="10px">Hồ sơ</Text></VStack>
                    <VStack onClick={()=>{localStorage.clear(); navigate('/login')}} color="red.500"><Icon as={FaSignOutAlt} boxSize={5}/><Text fontSize="10px">Thoát</Text></VStack>
                </Flex>
            )}
        </Flex>
    );
}