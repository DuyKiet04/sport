import { useState, useEffect } from 'react';
import { Box, Flex, Button, Heading, Image, HStack, Spacer, Text, Avatar, Menu, MenuButton, MenuList, MenuItem, IconButton } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaBars } from 'react-icons/fa'; // Import icon 3 gạch

// Nhận prop onToggleSidebar để điều khiển sidebar từ bên ngoài
export default function Navbar({ onToggleSidebar }) {
    const [config, setConfig] = useState({ website_name: 'Sport Booking', logo_url: '' });
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // Nhớ đổi localhost thành biến môi trường khi deploy nhé
                const res = await axios.get('http://localhost:5000/api/config');
                if (res.data) {
                    setConfig({
                        website_name: res.data.website_name || 'Sport Booking',
                        logo_url: res.data.logo_url || ''
                    });
                    document.title = res.data.website_name || 'Sport Booking';
                }
            } catch (err) {
                console.error("Lỗi tải cấu hình:", err);
            }
        };

        fetchConfig();

        const userStr = localStorage.getItem('user');
        if (userStr) setUser(JSON.parse(userStr));
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user'); // Xóa user
        setUser(null);
        navigate('/login');
    };

    return (
        <Box bg="white" px={4} py={3} shadow="sm" borderBottom="1px solid #eee" position="sticky" top={0} zIndex={10000}>
            <Flex alignItems="center">
                
                

                {/* 2. LOGO & TÊN WEB (KHÔNG BẤM ĐƯỢC) */}
                {/* Đã bỏ 'as={Link}' và 'to' để không chuyển trang */}
                <HStack spacing={3} userSelect="none"> 
                    {config.logo_url ? (
                        <Image src={config.logo_url} h="40px" w="40px" objectFit="cover" borderRadius="full" />
                    ) : (
                        <Box h="40px" w="40px" bg="blue.500" borderRadius="full" display="flex" alignItems="center" justifyContent="center" color="white" fontWeight="bold">S</Box>
                    )}
                    <Heading size="md" color="green.600" cursor="default">{config.website_name}</Heading>
                </HStack>

                <Spacer />

                {/* 3. KHU VỰC TÀI KHOẢN */}
                <HStack spacing={4}>
                    {user ? (
                        <Menu>
                            <MenuButton>
                                <HStack>
                                    <Avatar size="sm" name={user.name} src={user.avatar} border="2px solid #E2E8F0" />
                                    <Text fontWeight="bold" fontSize="sm" display={{ base: 'none', md: 'block' }} color="gray.700">{user.name}</Text>
                                </HStack>
                            </MenuButton>
                            <MenuList zIndex={2000}>
                                
                                
                                {/* Nút đăng xuất làm đẹp lại xíu */}
                                <MenuItem color="red.500" borderRadius = "5px"  display="flex" alignItems="center" justifyContent="center" fontWeight="bold"  onClick={handleLogout} _hover={{ bg: 'red.50' }}>
                                    Đăng xuất
                                </MenuItem>
                            </MenuList>
                        </Menu>
                    ) : (
                        <Button 
                            colorScheme="green" 
                            variant="solid" 
                            size="sm"
                            onClick={() => navigate('/login')}
                        >
                            Đăng Nhập
                        </Button>
                    )}
                </HStack>
            </Flex>
        </Box>
    );
}