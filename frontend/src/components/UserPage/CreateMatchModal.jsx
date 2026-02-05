import React, { useState, useEffect } from 'react';
import {
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
    Button, FormControl, FormLabel, Input, Select, VStack, HStack, useToast, Box
} from '@chakra-ui/react';
import axios from 'axios';

const CreateMatchModal = ({ isOpen, onClose, facilities = [], onMatchCreated }) => {
    const [formData, setFormData] = useState({
        title: '', match_time: '', court_id: '', level: 'Trung bình', max_players: 10, price_note: '5-5'
    });
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    // Reset form khi mở
    useEffect(() => { if (isOpen) setFormData(prev => ({ ...prev, court_id: '' })); }, [isOpen]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async () => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return toast({ title: 'Vui lòng đăng nhập lại!', status: 'error' });
        
        if (!formData.court_id) return toast({ title: 'Chưa chọn sân!', status: 'warning' });
        if (!formData.title || !formData.match_time) return toast({ title: 'Nhập thiếu thông tin!', status: 'warning' });

        // 1. Tìm sân đã chọn để lấy tọa độ
        const selectedCourt = facilities.find(f => f.id === parseInt(formData.court_id));
        
        // 2. Lấy tọa độ (Ưu tiên cột lat/lng, fallback sang geometry)
        let lat = selectedCourt?.lat;
        let lng = selectedCourt?.lng;
        
        if (!lat || !lng) {
             if (selectedCourt?.geometry?.coordinates) {
                 lat = selectedCourt.geometry.coordinates[1];
                 lng = selectedCourt.geometry.coordinates[0];
             }
        }
        // Fallback cuối cùng nếu sân không có tọa độ (tránh lỗi 500 DB)
        if (!lat || !lng) { lat = 10.762622; lng = 106.660172; }

        setLoading(true);
        try {
            // 3. Gửi API với đầy đủ Lat/Lng
            await axios.post('http://localhost:5000/api/matches', {
                ...formData,
                user_id: user.id,
                court_id: parseInt(formData.court_id),
                max_players: parseInt(formData.max_players),
                lat: lat, // <--- Quan trọng
                lng: lng  // <--- Quan trọng
            });
            
            toast({ title: 'Tạo kèo thành công!', status: 'success' });
            if(onMatchCreated) onMatchCreated();
            onClose();
        } catch (error) {
            console.error("Lỗi:", error);
            toast({ 
                title: 'Lỗi tạo kèo', 
                description: error.response?.data?.error || 'Kiểm tra lại User ID hoặc Server', 
                status: 'error' 
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
            <ModalOverlay />
            {/* Thêm notranslate để tránh Google Dịch làm crash nút bấm */}
            <ModalContent className="notranslate" translate="no">
                <ModalHeader>🏆 Tạo Kèo Tìm Đối</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <VStack spacing={4}>
                        <FormControl isRequired>
                            <FormLabel>1. Chọn Sân</FormLabel>
                            <Select placeholder="-- Chọn địa điểm --" name="court_id" value={formData.court_id} onChange={handleChange}>
                                {facilities.map(fac => (
                                    <option key={fac.id} value={fac.id}>{fac.name}</option>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl isRequired><FormLabel>2. Tiêu đề</FormLabel><Input name="title" onChange={handleChange} /></FormControl>
                        <FormControl isRequired><FormLabel>3. Thời gian</FormLabel><Input name="match_time" onChange={handleChange} /></FormControl>
                        <HStack w="100%">
                            <FormControl><FormLabel>Số người</FormLabel><Select name="max_players" onChange={handleChange} defaultValue={10}><option value="10">5 vs 5</option><option value="14">7 vs 7</option></Select></FormControl>
                            <FormControl><FormLabel>Trình độ</FormLabel><Select name="level" onChange={handleChange} defaultValue="TB"><option value="Yếu">Yếu</option><option value="Trung bình">Trung bình</option><option value="Khá">Khá</option></Select></FormControl>
                        </HStack>
                        <FormControl><FormLabel>Kèo tiền</FormLabel><Select name="price_note" onChange={handleChange} defaultValue="5-5"><option value="5-5">5-5</option><option value="Thua trả sân">Thua trả sân</option></Select></FormControl>
                    </VStack>
                </ModalBody>
                <ModalFooter>
                    <Button variant="ghost" mr={3} onClick={onClose}>Hủy</Button>
                    <Button colorScheme="blue" onClick={handleSubmit} isLoading={loading}>Đăng Kèo</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default CreateMatchModal;