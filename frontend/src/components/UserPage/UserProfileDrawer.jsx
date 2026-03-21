import React, { useState, useEffect, useRef } from 'react';
import {
    Drawer, DrawerBody, DrawerFooter, DrawerHeader, DrawerOverlay, DrawerContent, DrawerCloseButton,
    Button, VStack, Avatar, FormControl, FormLabel, Input, useToast, Text, HStack, Divider, Box, Icon,
    useColorModeValue
} from '@chakra-ui/react';
import { FaCamera, FaSignOutAlt, FaSave, FaEdit } from 'react-icons/fa';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const UserProfileDrawer = ({ isOpen, onClose, onAvatarUpdate }) => {
    const [user, setUser] = useState({});
    const [isEditing, setIsEditing] = useState(false);
    
    // State dữ liệu
    const [fullName, setFullName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [avatarUrl, setAvatarUrl] = useState(''); // Link hiển thị (preview)
    const [selectedFile, setSelectedFile] = useState(null); // File thực tế để upload

    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null); // Ref để kích hoạt input file ẩn
    
    const toast = useToast();
    const navigate = useNavigate();

    // 🎨 MÀU SẮC NEUMORPHISM ĐỒNG BỘ DARK MODE
    const neumorphBg = useColorModeValue('#edf2f7', '#2d3748');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '4px 4px 10px #1a202c, -4px -4px 10px #4a5568');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #1a202c, inset -4px -4px 8px #4a5568');
    
    const textColor = useColorModeValue("gray.700", "gray.200");
    const textMuted = useColorModeValue("gray.500", "gray.400");
    const headerTitleColor = useColorModeValue("blue.600", "blue.300");

    // Style chung cho Input Neumorphism (Chìm xuống)
    const inputStyle = {
        h: "50px",
        bg: neumorphBg,
        color: textColor,
        border: "none",
        boxShadow: isEditing ? neumorphActiveShadow : neumorphShadow,
        rounded: "xl",
        fontSize: "sm",
        fontWeight: "bold",
        _focus: {
            boxShadow: neumorphActiveShadow,
            border: "1px solid",
            borderColor: "blue.400"
        },
        _readOnly: { opacity: 0.7, cursor: "not-allowed", boxShadow: neumorphShadow },
        transition: "all 0.3s"
    };

    // 1. Load dữ liệu khi mở
    useEffect(() => {
        if (isOpen) {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                const currentUser = JSON.parse(storedUser);
                setUser(currentUser);
                setFullName(currentUser.full_name || currentUser.name || '');
                setPhoneNumber(currentUser.phone_number || '');
                setAvatarUrl(currentUser.avatar_url || currentUser.avatar || '');
                setSelectedFile(null); // Reset file chọn
            }
            setIsEditing(false);
        }
    }, [isOpen]);

    // 2. Xử lý khi chọn ảnh từ máy
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            // Tạo link ảo để xem trước ảnh vừa chọn ngay lập tức
            setAvatarUrl(URL.createObjectURL(file));
        }
    };

    // 3. Gửi dữ liệu lên Server 
    const handleSave = async () => {
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('full_name', fullName);
            formData.append('phone_number', phoneNumber);
            
            // Nếu có chọn file mới thì gửi file, không thì thôi
            if (selectedFile) {
                formData.append('avatar', selectedFile); 
            }

            const res = await axios.put(`${import.meta.env.VITE_API_URL}/api/users/${user.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            if (res.data.success) {
                const updatedUser = res.data.user; 
                
                // Cập nhật localStorage
                const oldData = JSON.parse(localStorage.getItem('user')) || {};
                const newData = { 
                 ...oldData, 
                 ...updatedUser,
                // Ép các trường quan trọng theo tên biến Frontend đang dùng
                full_name: updatedUser.name || updatedUser.full_name || oldData.full_name,
                avatar_url: updatedUser.avatar || updatedUser.avatar_url || oldData.avatar_url,
                phone_number: updatedUser.phone_number // Cái này chắc chắn đúng
                };
                localStorage.setItem('user', JSON.stringify(newData));
                
                setUser(newData);
                
                // Cập nhật Avatar bên ngoài
                if (onAvatarUpdate) onAvatarUpdate(newData.avatar_url);

                toast({ title: 'Cập nhật thành công!', status: 'success' });
                setIsEditing(false);
            }
        } catch (error) {
            console.error(error);
            toast({ title: 'Lỗi cập nhật', description: 'Vui lòng thử lại', status: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        if (window.confirm("Bạn có chắc muốn đăng xuất?")) {
            localStorage.clear();
            navigate('/login');
            window.location.reload();
        }
    };

    return (
        <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="sm">
            <DrawerOverlay backdropFilter="blur(2px)" bg="blackAlpha.400" />
            <DrawerContent className="notranslate" translate="no" bg={neumorphBg} border="none" boxShadow="-10px 0 25px rgba(0,0,0,0.1)">
                <DrawerCloseButton mt={2} color={textColor} bg={neumorphBg} boxShadow={neumorphShadow} borderRadius="full" _active={{boxShadow: neumorphActiveShadow}} border="none" />
                <DrawerHeader borderBottomWidth="0" pb={0}>
                    <Text fontSize="2xl" fontWeight="900" color={headerTitleColor}>Hồ Sơ Cá Nhân</Text>
                </DrawerHeader>

                <DrawerBody>
                    <VStack spacing={8} mt={6}>
                        {/* AVATAR + CLICK CHỌN ẢNH VỚI HIỆU ỨNG NEUMORPHISM */}
                        <Box 
                            position="relative" 
                            cursor={isEditing ? "pointer" : "default"} 
                            onClick={() => isEditing && fileInputRef.current.click()}
                            p={2} borderRadius="full" bg={neumorphBg} 
                            boxShadow={isEditing ? neumorphActiveShadow : neumorphShadow}
                            transition="all 0.3s"
                            _hover={isEditing ? { transform: 'scale(1.05)' } : {}}
                        >
                            <Avatar 
                                size="2xl" 
                                name={fullName} 
                                src={avatarUrl} 
                                border="4px solid" borderColor={neumorphBg} 
                                opacity={isEditing ? 0.8 : 1}
                                bg="transparent"
                            />
                            {/* Icon Camera hiện khi sửa */}
                            {isEditing && (
                                <Box position="absolute" bottom="0" right="0" bg={neumorphBg} p={3} borderRadius="full" boxShadow={neumorphShadow}>
                                    <Icon as={FaCamera} color="blue.500" boxSize={5} />
                                </Box>
                            )}
                            
                            {/* Input file ẩn */}
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                style={{ display: 'none' }} 
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </Box>

                        <VStack spacing={1}>
                            <Text fontWeight="900" fontSize="2xl" color={textColor} textAlign="center">{fullName || "Chưa đặt tên"}</Text>
                            {isEditing && <Text fontSize="xs" color="blue.500" fontWeight="bold">(Bấm vào ảnh để thay đổi)</Text>}
                        </VStack>

                        <Divider borderColor={useColorModeValue('gray.300', 'gray.600')} opacity={0.5} w="80%"/>

                        <VStack spacing={5} w="100%" align="stretch" px={2}>
                            <FormControl>
                                <FormLabel fontSize="xs" fontWeight="bold" color={textMuted} textTransform="uppercase" ml={2} mb={2}>Họ và Tên</FormLabel>
                                <Input 
                                    value={fullName} 
                                    onChange={(e) => setFullName(e.target.value)} 
                                    isReadOnly={!isEditing} 
                                    {...inputStyle}
                                />
                            </FormControl>

                            <FormControl>
                                <FormLabel fontSize="xs" fontWeight="bold" color={textMuted} textTransform="uppercase" ml={2} mb={2}>Số điện thoại</FormLabel>
                                <Input 
                                    value={phoneNumber} 
                                    onChange={(e) => setPhoneNumber(e.target.value)} 
                                    isReadOnly={!isEditing} 
                                    {...inputStyle}
                                />
                            </FormControl>
                        </VStack>
                    </VStack>
                </DrawerBody>

                <DrawerFooter borderTopWidth="0" pt={2} pb={6} px={8}>
                    {isEditing ? (
                        <HStack w="100%" spacing={4}>
                            <Button 
                                bg={neumorphBg} color={textColor} boxShadow={neumorphShadow} border="none"
                                _active={{boxShadow: neumorphActiveShadow}} _hover={{transform: 'translateY(-2px)'}}
                                onClick={() => setIsEditing(false)} w="50%" h="55px" borderRadius="xl"
                            >
                                Hủy
                            </Button>
                            <Button 
                                colorScheme="blue" bgGradient="linear(to-r, blue.400, teal.400)" color="white" boxShadow="xl"
                                _active={{transform: 'translateY(2px)'}}
                                onClick={handleSave} isLoading={loading} leftIcon={<FaSave />} w="50%" h="55px" borderRadius="xl"
                            >
                                Lưu
                            </Button>
                        </HStack>
                    ) : (
                        <VStack w="100%" spacing={4}>
                            <Button 
                                w="100%" h="55px" borderRadius="xl" border="none"
                                bg={neumorphBg} color="blue.500" boxShadow={neumorphShadow} 
                                _active={{boxShadow: neumorphActiveShadow}} _hover={{transform: 'translateY(-2px)'}}
                                onClick={() => setIsEditing(true)} leftIcon={<FaEdit />}
                            >
                                Chỉnh sửa thông tin
                            </Button>
                            <Button 
                                w="100%" h="55px" borderRadius="xl" border="none"
                                bg={neumorphBg} color="red.500" boxShadow={neumorphShadow} 
                                _active={{boxShadow: neumorphActiveShadow}} _hover={{transform: 'translateY(-2px)'}}
                                onClick={handleLogout} leftIcon={<FaSignOutAlt />}
                            >
                                Đăng xuất
                            </Button>
                        </VStack>
                    )}
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
};

export default UserProfileDrawer;