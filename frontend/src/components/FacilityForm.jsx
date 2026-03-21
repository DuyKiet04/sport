import React, { useRef, useState, useEffect } from 'react';
import { 
    Box, VStack, FormControl, FormLabel, Input, Button, HStack, 
    Image, IconButton, Text, useToast, Icon, Tooltip, Divider, InputGroup, InputRightElement, Flex, Badge, useColorModeValue
} from '@chakra-ui/react';
import { FaCamera, FaTimes, FaSave, FaBan, FaMapMarkerAlt, FaCrosshairs, FaLock, FaPlus, FaEdit, FaMapPin , FaCheckCircle } from 'react-icons/fa';
import axios from 'axios';

const FacilityForm = ({ formData, setFormData, handleImageUpload, handleSubmit, uploading, onCancel, isEditing, user, wardShape, isPointInWard }) => {
    const fileRef = useRef();
    const toast = useToast();
    
    const [coordInput, setCoordInput] = useState('');
    const [wards, setWards] = useState([]);

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

    useEffect(() => {
        axios.get(import.meta.env.VITE_API_URL + '/api/locations/wards')
            .then(res => setWards(res.data))
            .catch(e => console.error(e));
    }, []);

    const approvedWard = wards.find(w => w.id === user?.approved_ward_id);
    const wardName = approvedWard ? `${approvedWard.name}, ${approvedWard.district_name}` : 'Đang tải dữ liệu...';

    const getImgUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${import.meta.env.VITE_API_URL}/${url.startsWith('/') ? url.substring(1) : url}`;
    };

    const handleRemoveImage = () => {
        setFormData({ ...formData, image_url: '' });
        toast({ title: "Đã xóa ảnh bìa.", status: "info", duration: 1000 });
    };

    const handlePinCoordinates = () => {
        if (!coordInput) return toast({ title: 'Chưa nhập tọa độ!', status: 'warning' });
        const parts = coordInput.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            const lat = parseFloat(parts[0]); 
            const lng = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
                if (!isPointInWard(lat, lng, wardShape)) {
                    toast({ title: "Ngoài khu vực cấp phép!", description: "Vui lòng nhập tọa độ bên trong ranh giới cho phép.", status: "error" });
                    return;
                }
                setFormData(prev => ({ ...prev, lat, lng }));
                toast({ title: '📍 Đã ghim tọa độ!', status: 'success' }); 
                setCoordInput(''); 
            } else { toast({ title: 'Tọa độ không hợp lệ!', status: 'error' }); }
        } else { toast({ title: 'Vui lòng nhập đúng định dạng (Lat, Lng)', status: 'warning' }); }
    };

    const handleGetCurrentLocation = () => {
        if ("geolocation" in navigator) {
            toast({ title: '⏳ Đang định vị...', status: 'info', duration: 2000 });
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    if (!isPointInWard(lat, lng, wardShape)) {
                        toast({ title: "GPS không hợp lệ!", description: "Bạn đang đứng ngoài khu vực cấp phép.", status: "error" });
                        return;
                    }
                    setFormData(prev => ({ ...prev, lat, lng }));
                    toast({ title: '🎯 Đã lấy vị trí GPS!', status: 'success' });
                },
                (error) => { toast({ title: 'Lỗi GPS', description: 'Vui lòng bật định vị!', status: 'error' }); },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }
    };

    return (
        <Box p={6} bg={neumorphBg} h="100%" overflowY="auto" css={{ scrollbarWidth: "none" }}>
            <VStack spacing={6} align="stretch" pb={10}>
                
                {/* HEADER TIÊU ĐỀ */}
                <VStack spacing={2} mb={2}>
                    <Box p={3} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphShadow} color="blue.500">
                        <Icon as={isEditing ? FaEdit : FaPlus} boxSize={6} />
                    </Box>
                    <Text fontWeight="900" fontSize="lg" color={textColor} textTransform="uppercase" letterSpacing="1px">
                        {isEditing ? 'Cập nhật cơ sở' : 'Thêm cơ sở mới'}
                    </Text>
                </VStack>

                <FormControl isRequired>
                    <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2} mb={2}>TÊN ĐỊA ĐIỂM (CLB)</FormLabel>
                    <Input h="55px" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="VD: CLB Bóng Đá ABC" {...inputStyle}/>
                </FormControl>

                {user?.role === 'vendor' && (
                    <FormControl>
                        <FormLabel fontSize="xs" fontWeight="900" color="red.400" ml={2} mb={2}>KHU VỰC CẤP PHÉP (CỐ ĐỊNH)</FormLabel>
                        <InputGroup size="lg">
                            <Input h="55px" value={wardName} isReadOnly bg={neumorphBg} color="red.500" fontWeight="900" boxShadow={neumorphActiveShadow} border="none" borderRadius="xl"/>
                            <InputRightElement h="full" pr={2}><Icon as={FaLock} color="red.400" /></InputRightElement>
                        </InputGroup>
                    </FormControl>
                )}

                <FormControl isRequired>
                    <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2} mb={2}>ĐỊA CHỈ CHI TIẾT</FormLabel>
                    <Input h="55px" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Số nhà, tên đường..." {...inputStyle}/>
                </FormControl>

                {/* 🔥 MODULE TỌA ĐỘ BẢN ĐỒ */}
                <Box p={5} bg={neumorphBg} borderRadius="3xl" boxShadow={neumorphShadow} position="relative">
                    <Text fontSize="xs" fontWeight="900" color="blue.500" mb={4} textAlign="center" letterSpacing="1px">📍 XÁC ĐỊNH VỊ TRÍ TRÊN MAP</Text>
                    
                    <VStack spacing={4} align="stretch">
                        <Button 
                            w="100%" h="50px" borderRadius="2xl" colorScheme="teal" variant="ghost" 
                            bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                            leftIcon={<FaCrosshairs />} onClick={handleGetCurrentLocation} 
                            fontSize="sm" fontWeight="900" color="teal.500"
                        >
                            Sử dụng GPS hiện tại
                        </Button>
                        
                        <Flex align="center" py={1}>
                            <Divider borderColor={useColorModeValue('gray.300', 'gray.600')} />
                            <Text px={4} fontSize="10px" color={textMuted} fontWeight="900">HOẶC NHẬP TỌA ĐỘ</Text>
                            <Divider borderColor={useColorModeValue('gray.300', 'gray.600')} />
                        </Flex>
                        
                        <HStack spacing={3}>
                            <Input 
                                flex={1} h="45px" placeholder="Kinh độ, Vĩ độ..." value={coordInput} 
                                onChange={(e) => setCoordInput(e.target.value)} 
                                onKeyPress={(e) => e.key === 'Enter' && handlePinCoordinates()}
                                {...inputStyle}
                            />
                            <IconButton 
                                aria-label="Pin" icon={<FaMapPin />} colorScheme="orange" 
                                borderRadius="xl" h="45px" w="60px" boxShadow="lg"
                                onClick={handlePinCoordinates}
                            />
                        </HStack>

                        {/* TRẠNG THÁI TỌA ĐỘ DẬP LÕM */}
                        <Box 
                            mt={2} p={3} borderRadius="xl" bg={neumorphBg} 
                            boxShadow={neumorphActiveShadow} textAlign="center"
                        >
                            <HStack justify="center" spacing={2}>
                                <Icon as={formData.lat ? FaCheckCircle : FaBan} color={formData.lat ? "green.500" : "red.500"} />
                                <Text fontSize="xs" color={formData.lat ? "green.500" : "red.500"} fontWeight="900">
                                    {formData.lat ? `${formData.lat.toFixed(5)}, ${formData.lng.toFixed(5)}` : "CHƯA CÓ VỊ TRÍ"}
                                </Text>
                            </HStack>
                        </Box>
                    </VStack>
                </Box>

                <HStack spacing={4}>
                    <FormControl>
                        <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2} mb={2}>MỞ CỬA</FormLabel>
                        <Input h="55px" type="time" value={formData.open_time} onChange={e => setFormData({...formData, open_time: e.target.value})} {...inputStyle}/>
                    </FormControl>
                    <FormControl>
                        <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2} mb={2}>ĐÓNG CỬA</FormLabel>
                        <Input h="55px" type="time" value={formData.close_time} onChange={e => setFormData({...formData, close_time: e.target.value})} {...inputStyle}/>
                    </FormControl>
                </HStack>

                {/* 🔥 KHU VỰC TẢI ẢNH SOFT UI */}
                <FormControl>
                    <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2} mb={2}>ẢNH BÌA ĐẠI DIỆN</FormLabel>
                    <Box 
                        p={2} borderRadius="3xl" bg={neumorphBg} boxShadow={neumorphShadow} 
                        minH="180px" display="flex" alignItems="center" justifyContent="center" 
                        position="relative" overflow="hidden"
                    >
                        {formData.image_url ? (
                            <Box position="relative" w="100%" h="220px" p={2}>
                                <Image 
                                    src={getImgUrl(formData.image_url)} w="100%" h="100%" 
                                    objectFit="cover" borderRadius="2xl" 
                                    boxShadow={neumorphActiveShadow} border="4px solid" borderColor={neumorphBg}
                                />
                                <IconButton 
                                    icon={<FaTimes />} size="sm" colorScheme="red" isRound 
                                    position="absolute" top={5} right={5} shadow="2xl" 
                                    onClick={handleRemoveImage} aria-label="Xóa ảnh" 
                                />
                            </Box>
                        ) : (
                            <VStack 
                                spacing={3} py={8} cursor="pointer" w="100%" 
                                onClick={() => fileRef.current.click()}
                                _hover={{ opacity: 0.8 }}
                            >
                                <Box p={4} borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow} color="gray.400">
                                    <Icon as={FaCamera} boxSize={8} />
                                </Box>
                                <Text fontSize="xs" color="blue.500" fontWeight="900">BẤM ĐỂ CHỌN ẢNH</Text>
                                <Text fontSize="10px" color={textMuted} fontWeight="bold">JPG, PNG tối đa 5MB</Text>
                            </VStack>
                        )}
                        <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={handleImageUpload} accept="image/*" />
                    </Box>
                </FormControl>

                {/* NÚT THAO TÁC DƯỚI CÙNG */}
                <HStack pt={6} spacing={4} pb={4}>
                    <Button 
                        flex={1} h="55px" borderRadius="2xl" variant="ghost" 
                        bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                        color={textColor} fontWeight="900" onClick={onCancel}
                    >
                        HỦY
                    </Button>
                    <Button 
                        flex={2} h="55px" borderRadius="2xl" colorScheme="blue" 
                        bgGradient="linear(to-r, blue.400, blue.600)" color="white"
                        boxShadow="xl" _hover={{ transform: 'translateY(-2px)', shadow: '2xl' }}
                        _active={{ transform: 'scale(0.95)' }}
                        onClick={handleSubmit} isLoading={uploading} leftIcon={<FaSave/>} 
                        isDisabled={!formData.name || !formData.address || !formData.lat}
                        fontWeight="900"
                    >
                        {isEditing ? 'LƯU THAY ĐỔI' : 'TẠO SÂN NGAY'}
                    </Button>
                </HStack>

            </VStack>
        </Box>
    );
};

export default FacilityForm;