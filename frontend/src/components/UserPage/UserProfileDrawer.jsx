import React, { useState, useEffect, useRef } from 'react';
import {
    Drawer, DrawerBody, DrawerFooter, DrawerHeader, DrawerOverlay, DrawerContent, DrawerCloseButton,
    Button, VStack, Avatar, FormControl, FormLabel, Input, useToast, Text, HStack, Divider, Box, Icon
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

    // 3. Gửi dữ liệu lên Server (Dùng FormData để gửi file)
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

            const res = await axios.put(`http://localhost:5000/api/users/${user.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            if (res.data.success) {
                const updatedUser = res.data.user; 
                
                // Cập nhật localStorage
                const oldData = JSON.parse(localStorage.getItem('user')) || {};
                const newData = { ...oldData, ...updatedUser };
                localStorage.setItem('user', JSON.stringify(newData));
                
                setUser(newData);
                
                // Cập nhật Avatar bên ngoài
                if (onAvatarUpdate) onAvatarUpdate(updatedUser.avatar);

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
            <DrawerOverlay />
            <DrawerContent className="notranslate" translate="no">
                <DrawerCloseButton />
                <DrawerHeader borderBottomWidth="1px">Hồ Sơ Cá Nhân</DrawerHeader>

                <DrawerBody>
                    <VStack spacing={6} mt={4}>
                        {/* AVATAR + CLICK CHỌN ẢNH */}
                        <Box position="relative" cursor={isEditing ? "pointer" : "default"} onClick={() => isEditing && fileInputRef.current.click()}>
                            <Avatar 
                                size="2xl" 
                                name={fullName} 
                                src={avatarUrl} 
                                border="4px solid white" shadow="lg" 
                                opacity={isEditing ? 0.8 : 1}
                            />
                            {/* Icon Camera hiện khi sửa */}
                            {isEditing && (
                                <Box position="absolute" bottom="0" right="0" bg="blue.500" p={2} borderRadius="full" shadow="md">
                                    <Icon as={FaCamera} color="white" />
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

                        <Text fontWeight="bold" fontSize="xl">{fullName || "Chưa đặt tên"}</Text>
                        {isEditing && <Text fontSize="xs" color="gray.500">(Bấm vào ảnh để thay đổi)</Text>}

                        <Divider />

                        <VStack spacing={4} w="100%" align="stretch">
                            <FormControl>
                                <FormLabel>Họ và Tên</FormLabel>
                                <Input 
                                    value={fullName} 
                                    onChange={(e) => setFullName(e.target.value)} 
                                    isReadOnly={!isEditing} 
                                    variant={isEditing ? "outline" : "filled"}
                                />
                            </FormControl>

                            <FormControl>
                                <FormLabel>Số điện thoại</FormLabel>
                                <Input 
                                    value={phoneNumber} 
                                    onChange={(e) => setPhoneNumber(e.target.value)} 
                                    isReadOnly={!isEditing} 
                                    variant={isEditing ? "outline" : "filled"}
                                />
                            </FormControl>
                        </VStack>
                    </VStack>
                </DrawerBody>

                <DrawerFooter borderTopWidth="1px">
                    {isEditing ? (
                        <HStack w="100%">
                            <Button variant="ghost" onClick={() => setIsEditing(false)} w="50%">Hủy</Button>
                            <Button colorScheme="blue" onClick={handleSave} isLoading={loading} leftIcon={<FaSave />} w="50%">
                                Lưu
                            </Button>
                        </HStack>
                    ) : (
                        <VStack w="100%">
                            <Button w="100%" onClick={() => setIsEditing(true)} leftIcon={<FaEdit />}>
                                Chỉnh sửa thông tin
                            </Button>
                            <Button w="100%" colorScheme="red" variant="outline" onClick={handleLogout} leftIcon={<FaSignOutAlt />}>
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