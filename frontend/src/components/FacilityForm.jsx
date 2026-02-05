import React, { useRef } from 'react';
import { 
    Box, VStack, FormControl, FormLabel, Input, Button, HStack, 
    Image, IconButton, Text, useToast, Icon 
} from '@chakra-ui/react';
import { FaCamera, FaTimes, FaSave, FaBan, FaMapMarkerAlt } from 'react-icons/fa';

const FacilityForm = ({ formData, setFormData, handleImageUpload, handleSubmit, uploading, onCancel, isEditing }) => {
    const fileRef = useRef();
    const toast = useToast();

    const getImgUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `http://localhost:5000/${url.startsWith('/') ? url.substring(1) : url}`;
    };

    const handleRemoveImage = () => {
        setFormData({ ...formData, image_url: '' });
        toast({ title: "Đã xóa ảnh bìa.", status: "info", duration: 1000 });
    };

    return (
        <Box p={4} bg="white" h="100%" overflowY="auto" className="hide-scrollbar">
            <VStack spacing={4} align="stretch">
                <Text fontWeight="bold" fontSize="lg" color="blue.600" textAlign="center">
                    {isEditing ? 'SỬA THÔNG TIN ĐỊA ĐIỂM' : 'TẠO ĐỊA ĐIỂM MỚI'}
                </Text>

                {/* 1. TÊN ĐỊA ĐIỂM */}
                <FormControl isRequired>
                    <FormLabel fontSize="sm" fontWeight="bold">Tên địa điểm (CLB)</FormLabel>
                    <Input 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        placeholder="VD: CLB Bóng Đá K34"
                        bg="white"
                    />
                </FormControl>

                {/* 2. ĐỊA CHỈ (ĐÃ SỬA: CHO PHÉP NHẬP TAY) */}
                <FormControl isRequired>
                    <FormLabel fontSize="sm" fontWeight="bold">Địa chỉ chi tiết</FormLabel>
                    <Input 
                        value={formData.address} 
                        onChange={e => setFormData({...formData, address: e.target.value})} 
                        placeholder="Nhập số nhà, tên đường..."
                        bg="white" // Đổi màu nền cho thấy là nhập được
                        // ❌ Đã bỏ readOnly
                    />
                    
                    {/* Hiển thị tọa độ để biết đã ghim map chưa */}
                    <HStack mt={2} bg={formData.lat ? "green.50" : "red.50"} p={2} borderRadius="md">
                        <Icon as={FaMapMarkerAlt} color={formData.lat ? "green.500" : "red.500"}/>
                        <Text fontSize="xs" color={formData.lat ? "green.700" : "red.600"} fontWeight="bold">
                            {formData.lat 
                                ? `Đã ghim: ${formData.lat.toFixed(5)}, ${formData.lng.toFixed(5)}` 
                                : "⚠️ Chưa ghim vị trí trên bản đồ (Bắt buộc!)"}
                        </Text>
                    </HStack>
                </FormControl>

                {/* 3. GIỜ HOẠT ĐỘNG */}
                <HStack>
                    <FormControl>
                        <FormLabel fontSize="sm">Mở cửa</FormLabel>
                        <Input type="time" value={formData.open_time} onChange={e => setFormData({...formData, open_time: e.target.value})}/>
                    </FormControl>
                    <FormControl>
                        <FormLabel fontSize="sm">Đóng cửa</FormLabel>
                        <Input type="time" value={formData.close_time} onChange={e => setFormData({...formData, close_time: e.target.value})}/>
                    </FormControl>
                </HStack>

                {/* 4. ẢNH BÌA */}
                <FormControl>
                    <FormLabel fontSize="sm" fontWeight="bold">Ảnh bìa / Đại diện</FormLabel>
                    <Box 
                        p={2} border="2px dashed" borderColor="gray.300" borderRadius="md" 
                        bg="gray.50" textAlign="center" minH="120px" display="flex" 
                        alignItems="center" justifyContent="center"
                        position="relative"
                    >
                        {formData.image_url ? (
                            <Box position="relative" w="100%" h="180px">
                                <Image
                                    src={getImgUrl(formData.image_url)}
                                    w="100%" h="100%" objectFit="cover" borderRadius="md"
                                    fallbackSrc="https://placehold.co/300x200?text=No+Image"
                                />
                                <IconButton
                                    icon={<FaTimes />} size="sm" colorScheme="red"
                                    position="absolute" top={2} right={2} shadow="lg"
                                    onClick={handleRemoveImage} aria-label="Xóa ảnh"
                                />
                            </Box>
                        ) : (
                            <VStack>
                                <Button
                                    size="sm" leftIcon={<FaCamera />}
                                    onClick={() => fileRef.current.click()}
                                    isLoading={uploading} colorScheme="blue" variant="outline"
                                >
                                    Tải ảnh lên
                                </Button>
                                <Text fontSize="xs" color="gray.400">Chưa có ảnh</Text>
                            </VStack>
                        )}
                        <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={handleImageUpload} accept="image/*" />
                    </Box>
                </FormControl>

                <HStack pt={4}>
                    <Button flex={1} variant="ghost" onClick={onCancel} leftIcon={<FaBan/>}>Hủy</Button>
                    <Button 
                        flex={1} colorScheme="blue" onClick={handleSubmit} 
                        isLoading={uploading} leftIcon={<FaSave/>}
                        // Validate: Phải có tên, địa chỉ và tọa độ mới cho lưu
                        isDisabled={!formData.name || !formData.address || !formData.lat} 
                    >
                        {isEditing ? 'Lưu Thay Đổi' : 'Tạo Mới'}
                    </Button>
                </HStack>
            </VStack>
        </Box>
    );
};

export default FacilityForm;