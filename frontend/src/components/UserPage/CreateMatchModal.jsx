import React, { useState, useEffect } from 'react';
import {
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
    Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, DrawerCloseButton,
    Button, FormControl, FormLabel, Input, Select, VStack, HStack, Box, Text, useToast,
    useColorModeValue, SimpleGrid, Icon , useBreakpointValue
} from '@chakra-ui/react';
import { FaMapMarkerAlt, FaFutbol, FaClock, FaPen, FaUsers, FaStar, FaMoneyBillWave } from 'react-icons/fa';
import axios from 'axios';

const CreateMatchModal = ({ isOpen, onClose, facilities = [], onMatchCreated, editMatch = null }) => {
    const isMobile = useBreakpointValue({ base: true, md: false });
    const toast = useToast();
    
    // 🎨 CÔNG TẮC MÀU SẮC ĐỒNG BỘ DARK MODE NEUMORPHISM
    const neumorphBg = useColorModeValue('#edf2f7', '#2d3748');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '4px 4px 10px #1a202c, -4px -4px 10px #4a5568');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #1a202c, inset -4px -4px 8px #4a5568');
    
    const textColor = useColorModeValue("gray.700", "gray.200");
    const textMuted = useColorModeValue("gray.500", "gray.400");
    const headerTitleColor = useColorModeValue("blue.600", "blue.300");

    // Style chung cho Input/Select Neumorphism (Chìm xuống)
    const inputStyle = {
        h: "50px",
        bg: neumorphBg,
        color: textColor,
        border: "none",
        boxShadow: neumorphActiveShadow,
        rounded: "xl",
        fontSize: "sm",
        fontWeight: "bold",
        _focus: {
            boxShadow: neumorphActiveShadow,
            border: "1px solid",
            borderColor: "blue.400"
        },
        _hover: { opacity: 0.9 }
    };

    const [formData, setFormData] = useState({ sport: '', title: '', match_time: '', court_id: '', level: 'Trung bình', max_players: 10, price_note: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => { 
        if (isOpen) {
            if (editMatch) {
                let sport = 'Bóng đá';
                let rawTitle = editMatch.title;
                const matchSport = editMatch.title.match(/^\[(.*?)\]\s*(.*)/);
                if (matchSport) { sport = matchSport[1]; rawTitle = matchSport[2]; }
                
                const d = new Date(editMatch.match_time);
                const localISOTime = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

                setFormData({
                    sport: sport, title: rawTitle, match_time: localISOTime,
                    court_id: editMatch.court_id?.toString() || '', level: editMatch.level || 'Trung bình',
                    max_players: editMatch.max_players || 10, price_note: editMatch.price_note || ''
                });
            } else {
                setFormData({ sport: '', title: '', match_time: '', court_id: '', level: 'Trung bình', max_players: 10, price_note: '' });
            }
        }
    }, [isOpen, editMatch]);

    const currentFac = facilities.find(f => f.id === parseInt(formData.court_id));
    let displaySports = [];
    if (currentFac && currentFac.sports) {
        if (Array.isArray(currentFac.sports)) displaySports = currentFac.sports;
        else if (typeof currentFac.sports === 'string') displaySports = currentFac.sports.replace(/^{|}$/g, '').split(',').map(s => s.trim().replace(/(^"|"$)/g, '')).filter(s => s);
    }
    if (displaySports.length === 0) displaySports = ["Bóng đá", "Cầu lông", "Tennis", "Bóng chuyền", "Bóng rổ", "Pickleball", "Bơi lội", "Khác"];

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleFacilityChange = (e) => {
        const selectedId = e.target.value;
        const fac = facilities.find(f => f.id === parseInt(selectedId));
        let newSport = formData.sport;
        let parsedSports = [];
        if (fac && fac.sports) {
            if (Array.isArray(fac.sports)) parsedSports = fac.sports;
            else if (typeof fac.sports === 'string') parsedSports = fac.sports.replace(/^{|}$/g, '').split(',').map(s => s.trim().replace(/(^"|"$)/g, '')).filter(s => s);
        }
        if (parsedSports.length > 0 && !parsedSports.includes(formData.sport)) newSport = parsedSports[0];
        setFormData(prev => ({ ...prev, court_id: selectedId, sport: newSport }));
    };

    const handleSubmit = async () => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return toast({ title: 'Vui lòng đăng nhập lại!', status: 'error' });
        if (!formData.court_id) return toast({ title: 'Chọn Địa điểm!', status: 'warning', position: 'top' });
        if (!formData.title || !formData.match_time) return toast({ title: 'Nhập thiếu Tiêu đề / Thời gian!', status: 'warning', position: 'top' });

        const selectedCourt = facilities.find(f => f.id === parseInt(formData.court_id));
        let lat = selectedCourt?.lat || 10.762622;
        let lng = selectedCourt?.lng || 106.660172;

        const finalTitle = `[${formData.sport}] ${formData.title}`;
        const payload = {
            user_id: user.id, court_id: parseInt(formData.court_id), title: finalTitle,
            match_time: formData.match_time, level: formData.level, price_note: formData.price_note || 'Thỏa thuận',
            max_players: parseInt(formData.max_players) || 2, lat, lng
        };

        setLoading(true);
        try {
            if (editMatch) {
                await axios.put(`${import.meta.env.VITE_API_URL}/api/matches/${editMatch.id}`, payload);
                toast({ title: 'Đã cập nhật kèo!', status: 'success', position: 'top' });
            } else {
                await axios.post(import.meta.env.VITE_API_URL + '/api/matches', payload);
                toast({ title: 'Tạo kèo thành công! 🏆', status: 'success', position: 'top' });
            }
            if(onMatchCreated) onMatchCreated();
            onClose();
        } catch (error) {
            toast({ title: 'Lỗi xử lý', description: error.response?.data?.error || "Máy chủ không phản hồi", status: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const HeaderContent = () => (
        <HStack spacing={4}>
            <Box bg={neumorphBg} color={editMatch ? "orange.500" : "blue.500"} p={3} borderRadius="xl" boxShadow={neumorphShadow} display="flex" alignItems="center" justifyContent="center">
                <Text fontSize="2xl">{editMatch ? "✏️" : "🏆"}</Text>
            </Box>
            <Box>
                <Text fontSize="xl" fontWeight="900" color={editMatch ? (useColorModeValue("orange.600", "orange.300")) : headerTitleColor} textTransform="uppercase">
                    {editMatch ? "Cập Nhật Kèo" : "Tạo Kèo Mới"}
                </Text>
                <Text fontSize="xs" color={textMuted} fontWeight="bold">Tìm bạn chơi cùng nhanh chóng</Text>
            </Box>
        </HStack>
    );

    const renderForm = () => (
        <VStack spacing={6} align="stretch" pb={6}>
            <Box bg={neumorphBg} p={5} borderRadius="2xl" boxShadow={neumorphShadow}>
                <FormControl isRequired>
                    <FormLabel fontSize="sm" fontWeight="900" color={textColor} mb={3}><Icon as={FaMapMarkerAlt} mr={2} color="red.500" /> Cơ sở / Địa điểm thi đấu</FormLabel>
                    <Select name="court_id" value={formData.court_id} onChange={handleFacilityChange} placeholder="-- Chọn địa điểm trước --" {...inputStyle}>
                        {facilities.map(fac => <option key={fac.id} value={fac.id}>{fac.name}</option>)}
                    </Select>
                </FormControl>
            </Box>

            <FormControl isRequired px={1}>
                <FormLabel fontSize="xs" fontWeight="900" textTransform="uppercase" color={textMuted} mb={2}><Icon as={FaFutbol} mr={1} color="green.500" /> Môn thể thao</FormLabel>
                <Select name="sport" value={formData.sport} onChange={handleChange} isDisabled={!formData.court_id} placeholder={!formData.court_id ? "Đợi chọn sân..." : "-- Môn thi đấu --"} {...inputStyle}>
                    {displaySports.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
            </FormControl>

            <FormControl isRequired px={1}>
                <FormLabel fontSize="xs" fontWeight="900" textTransform="uppercase" color={textMuted} mb={2}><Icon as={FaClock} mr={1} color="orange.400" /> Thời gian đá</FormLabel>
                <Input type="datetime-local" name="match_time" value={formData.match_time} onChange={handleChange} css={{ "::-webkit-calendar-picker-indicator": { filter: useColorModeValue("none", "invert(1)") } }} {...inputStyle}/>
            </FormControl>

            <FormControl isRequired px={1}>
                <FormLabel fontSize="xs" fontWeight="900" textTransform="uppercase" color={textMuted} mb={2}><Icon as={FaPen} mr={1} color="blue.500" /> Lời mời / Tiêu đề</FormLabel>
                <Input name="title" value={formData.title} placeholder="VD: Giao lưu vui vẻ, thiếu 2 người..." onChange={handleChange} {...inputStyle} />
            </FormControl>

            <SimpleGrid columns={2} spacing={4} px={1}>
                <FormControl isRequired>
                    <FormLabel fontSize="xs" fontWeight="900" textTransform="uppercase" color={textMuted} mb={2}><Icon as={FaUsers} mr={1} /> Số người cần</FormLabel>
                    <Input type="number" name="max_players" value={formData.max_players} onChange={handleChange} min={2} max={100} {...inputStyle} />
                </FormControl>
                <FormControl>
                    <FormLabel fontSize="xs" fontWeight="900" textTransform="uppercase" color={textMuted} mb={2}><Icon as={FaStar} mr={1} color="yellow.400"/> Trình độ</FormLabel>
                    <Select name="level" value={formData.level} onChange={handleChange} {...inputStyle}>
                        <option value="Vui vẻ / Mới tập">Vui vẻ / Mới tập</option>
                        <option value="Trung bình">Trung bình</option>
                        <option value="Khá cứng">Khá căng</option>
                        <option value="Bán chuyên">Bán chuyên</option>
                    </Select>
                </FormControl>
            </SimpleGrid>

            <FormControl px={1}>
                <FormLabel fontSize="xs" fontWeight="900" textTransform="uppercase" color={textMuted} mb={2}><Icon as={FaMoneyBillWave} mr={1} color="green.400"/> Ghi chú Chi phí</FormLabel>
                <Input name="price_note" value={formData.price_note} onChange={handleChange} placeholder="VD: Sân chia đều 50k..." {...inputStyle} />
            </FormControl>
        </VStack>
    );

    if (isMobile) {
        return (
            <Drawer isOpen={isOpen} placement="bottom" onClose={onClose} size="full">
                <DrawerOverlay backdropFilter="blur(2px)" />
                <DrawerContent bg={neumorphBg} h="85vh" borderTopRadius="3xl" boxShadow={neumorphShadow} border="none">
                    <Box w="50px" h="6px" bg="gray.400" borderRadius="full" mx="auto" mt={4} mb={2} opacity={0.6}/>
                    <DrawerCloseButton mt={3} color={textColor} />
                    <DrawerHeader bg={neumorphBg} borderBottom="none" pt={2} pb={6}>
                        <HeaderContent />
                    </DrawerHeader>
                    <DrawerBody px={6} className="hide-scrollbar">
                        {renderForm()}
                    </DrawerBody>
                    <DrawerFooter bg={neumorphBg} borderTop="none" px={6} py={6}>
                        <HStack w="100%" spacing={4}>
                            <Button flex={1} h="55px" borderRadius="xl" bg={neumorphBg} color={textColor} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} onClick={onClose}>Hủy</Button>
                            <Button flex={2} h="55px" borderRadius="xl" colorScheme={editMatch ? "orange" : "blue"} bgGradient={editMatch ? "linear(to-r, orange.400, red.400)" : "linear(to-r, blue.400, teal.400)"} color="white" boxShadow="xl" _active={{transform: "translateY(2px)"}} onClick={handleSubmit} isLoading={loading}>
                                {editMatch ? "Lưu Thay Đổi" : "Xuất Bản Kèo Ngay"}
                            </Button>
                        </HStack>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="xl" motionPreset="scale">
            <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(5px)" />
            <ModalContent borderRadius="3xl" shadow="2xl" bg={neumorphBg} border="none">
                <ModalHeader bg={neumorphBg} borderBottom="none" borderTopRadius="3xl" p={8} pb={4}>
                    <HeaderContent />
                </ModalHeader>
                <ModalCloseButton mt={6} mr={6} color={textColor} bg={neumorphBg} boxShadow={neumorphShadow} borderRadius="full" _hover={{boxShadow: neumorphActiveShadow}}/>
                <ModalBody py={2} px={8}>
                    {renderForm()}
                </ModalBody>
                <ModalFooter bg={neumorphBg} p={8} pt={4} borderTop="none" borderBottomRadius="3xl">
                    <HStack w="100%" justify="flex-end" spacing={4}>
                        <Button w="120px" h="50px" borderRadius="xl" bg={neumorphBg} color={textColor} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} onClick={onClose}>Hủy</Button>
                        <Button w="200px" h="50px" borderRadius="xl" colorScheme={editMatch ? "orange" : "blue"} bgGradient={editMatch ? "linear(to-r, orange.400, red.400)" : "linear(to-r, blue.400, teal.400)"} color="white" boxShadow="lg" _active={{transform: "translateY(2px)"}} onClick={handleSubmit} isLoading={loading}>
                            {editMatch ? "Lưu Thay Đổi" : "Đăng Kèo Ngay"}
                        </Button>
                    </HStack>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default CreateMatchModal;