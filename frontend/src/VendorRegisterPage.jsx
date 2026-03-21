import React, { useState, useEffect, useMemo } from 'react';
import { 
    Box, Button, FormControl, FormLabel, Input, VStack, Heading, Text, useToast, 
    InputGroup, InputLeftElement, Container, Flex, Icon, HStack,
    useBreakpointValue, Select, Checkbox, SimpleGrid,
    Stepper, Step, StepIndicator, StepStatus, StepIcon, StepTitle, StepSeparator,
    List, ListItem, Link , Badge, useColorModeValue, Divider
} from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';
import { 
    FaUser, FaLock, FaIdCard, FaStore, FaPhone, 
    FaEnvelope, FaChartLine, FaShieldAlt, FaHeadset, FaMapMarkerAlt, FaFutbol, FaCheckCircle
} from 'react-icons/fa';
import { SiZalo } from 'react-icons/si';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const MotionBox = motion(Box);
const MotionFormControl = motion(FormControl);

const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const staggerItem = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } } };
const shakeVariant = { shake: { x: [-4, 4, -4, 4, 0], transition: { duration: 0.3 } }, idle: { x: 0 } };

export default function VendorRegisterPage() {
    const [step, setStep] = useState(0); 
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    
    const [wards, setWards] = useState([]);
    const [sportTypes, setSportTypes] = useState([]);
    const [config, setConfig] = useState({});

    const [formData, setFormData] = useState({ 
        username: '', email: '', password: '', full_name: '', role: 'vendor', 
        phone_number: '', facility_name: ''
    });
    
    const [selectedWard, setSelectedWard] = useState('');
    const [streetAddress, setStreetAddress] = useState('');
    const [selectedSports, setSelectedSports] = useState([]);

    // 🎨 MÀU SẮC NEUMORPHISM ĐỒNG BỘ DARK MODE
    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphShadow = useColorModeValue('9px 9px 16px #c5cad3, -9px -9px 16px #ffffff', '8px 8px 16px #0d1117, -4px -4px 10px #2d3748');
    const neumorphActiveShadow = useColorModeValue('inset 6px 6px 12px #c5cad3, inset -4px -4px 8px #ffffff', 'inset 6px 6px 12px #0d1117, inset -4px -4px 8px #2d3748');
    
    const textColor = useColorModeValue("gray.700", "gray.100");
    const textMuted = useColorModeValue("gray.500", "gray.400");
    const accentColor = useColorModeValue("orange.500", "orange.300");

    const inputStyle = {
        bg: neumorphBg,
        border: "none",
        color: textColor,
        boxShadow: neumorphActiveShadow,
        _focus: { boxShadow: neumorphActiveShadow, border: "1px solid", borderColor: "orange.300" },
        _placeholder: { color: "gray.400" },
        borderRadius: "2xl",
        height: "55px",
        fontWeight: "bold"
    };

    const ADMIN_ZALO = config.admin_zalo || "0371914139"; 
    const toast = useToast();
    const navigate = useNavigate();
    const isMobile = useBreakpointValue({ base: true, lg: false });

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const [wardsRes, sportsRes, configRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/locations/wards'),
                    axios.get('http://localhost:5000/api/sport-types'),
                    axios.get('http://localhost:5000/api/config')
                ]);
                setWards(wardsRes.data || []);
                setSportTypes(sportsRes.data || []);
                setConfig(configRes.data || {});
            } catch (error) { console.error(error); }
        };
        fetchCategories();
    }, []);

    const groupedWards = useMemo(() => {
        const groups = {};
        wards.forEach(w => {
            const dist = w.district_name || 'Khác';
            if (!groups[dist]) groups[dist] = [];
            groups[dist].push(w);
        });
        return groups;
    }, [wards]);

    const handleNextStep = () => {
        const newErrors = {};
        if (step === 0) {
            if (!formData.username) newErrors.username = true;
            if (!formData.email) newErrors.email = true;
            if (!formData.password || formData.password.length < 6) newErrors.password = true;
            if (!formData.full_name) newErrors.full_name = true;
        } else if (step === 1) {
            if (!formData.phone_number) newErrors.phone_number = true;
            if (!formData.facility_name) newErrors.facility_name = true;
            if (!selectedWard) newErrors.ward = true;
            if (!streetAddress) newErrors.street = true;
            if (selectedSports.length === 0) newErrors.sports = true;
        }
        
        if (Object.keys(newErrors).length > 0) { 
            setErrors(newErrors); 
            return toast({ title: 'Nhập đủ thông tin nhé!', status: 'warning' }); 
        }
        setErrors({}); 
        setStep(prev => prev + 1);
    };

    const handleRegister = async () => {
        setIsLoading(true);
        const data = new FormData();
        data.append('username', formData.username);
        data.append('email', formData.email);
        data.append('password', formData.password);
        data.append('full_name', formData.full_name);
        data.append('role', 'vendor');
        data.append('phone_number', formData.phone_number);
        data.append('facility_name', formData.facility_name);
        data.append('ward_id', selectedWard); 
        data.append('sport_ids', JSON.stringify(selectedSports)); 
        data.append('facility_address', streetAddress); 

        try { 
            await axios.post('http://localhost:5000/api/register', data); 
            toast({ title: 'Nộp hồ sơ thành công!', status: 'success' }); 
            window.open(`https://zalo.me/${ADMIN_ZALO}`, '_blank');
            navigate('/login');
        } catch (err) { 
            toast({ title: 'Lỗi đăng ký', description: err.response?.data?.message, status: 'error' }); 
        } finally { setIsLoading(false); }
    };

    const stepsInfo = [ { title: 'Tài khoản' }, { title: 'Cơ sở' }, { title: 'Xác minh' } ];

    return (
        <Flex minH="100vh" w="100vw" bg={neumorphBg} overflowY="auto" position="relative">
            
            <Button position="absolute" top={6} left={6} zIndex={10} leftIcon={<ArrowBackIcon/>} variant="ghost" color={textMuted} fontWeight="900" onClick={() => navigate('/login')}>
                QUAY LẠI
            </Button>

            <Container maxW="1200px" py={{ base: 10, lg: 20 }}>
                <Flex direction={{ base: 'column', lg: 'row' }} align="center" justify="center" gap={12}>
                    
                    {/* LEFT CONTENT */}
                    {!isMobile && (
                        <VStack flex={1} align="start" spacing={8}>
                            <Badge bgGradient="linear(to-r, orange.400, yellow.400)" color="white" px={4} py={1.5} borderRadius="full" fontSize="xs" fontWeight="900" boxShadow="lg" border="none">DÀNH CHO ĐỐI TÁC</Badge>
                            <Heading fontSize="6xl" fontWeight="900" lineHeight="1.1" color={textColor}>
                                Tham gia <br/>
                                <Text as="span" color="orange.400">Sport Booking</Text>
                            </Heading>
                            <Text fontSize="xl" color={textMuted} fontWeight="bold">
                                Nâng tầm quản lý sân bãi của bạn với công nghệ Soft UI hiện đại nhất.
                            </Text>

                            <SimpleGrid columns={1} spacing={6} w="100%">
                                {[
                                    { icon: FaChartLine, text: "Tăng trưởng doanh thu 300%", color: "orange" },
                                    { icon: FaStore, text: "Quản lý lịch đặt tự động", color: "teal" },
                                    { icon: FaShieldAlt, text: "Hệ thống bảo mật tuyệt đối", color: "blue" }
                                ].map((item, i) => (
                                    <HStack key={i} p={4} bg={neumorphBg} borderRadius="2xl" boxShadow={neumorphShadow} spacing={4}>
                                        <Flex w={12} h={12} bg={neumorphBg} rounded="xl" align="center" justify="center" boxShadow={neumorphActiveShadow}><Icon as={item.icon} color={`${item.color}.400`} boxSize={6} /></Flex>
                                        <Text fontWeight="900" color={textColor} fontSize="md">{item.text}</Text>
                                    </HStack>
                                ))}
                            </SimpleGrid>
                        </VStack>
                    )}

                    {/* RIGHT FORM CARD */}
                    <Box flex={1.2} w="100%">
                        <MotionBox 
                            bg={neumorphBg} p={{ base: 6, md: 10 }} borderRadius="3xl" boxShadow={neumorphShadow}
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                        >
                            <Box mb={10} textAlign="center">
                                <Heading size="lg" color={textColor} mb={3} fontWeight="900" textTransform="uppercase">Đăng ký Đối tác</Heading>
                                <HStack justify="center" spacing={4}>
                                    <Stepper index={step} size="sm" colorScheme="orange" gap={4}>
                                        {stepsInfo.map((s, index) => (
                                            <Step key={index}>
                                                <StepIndicator bg={neumorphBg} border="none" boxShadow={step >= index ? neumorphActiveShadow : neumorphShadow} boxSize="36px">
                                                    <StepStatus 
                                                        complete={<StepIcon color="orange.400" />} 
                                                        incomplete={<Text fontSize="xs" fontWeight="900" color="gray.400">{index+1}</Text>} 
                                                        active={<Text fontSize="xs" fontWeight="900" color="orange.400">{index+1}</Text>} 
                                                    />
                                                </StepIndicator>
                                                <StepSeparator bg="transparent" />
                                            </Step>
                                        ))}
                                    </Stepper>
                                </HStack>
                            </Box>

                            <AnimatePresence mode='wait'>
                                <MotionBox key={step} variants={staggerContainer} initial="hidden" animate="show" exit="hidden">
                                    <VStack spacing={6} align="stretch">
                                        
                                        {/* STEP 0: ACCOUNT */}
                                        {step === 0 && (
                                            <>
                                                <SimpleGrid columns={{base: 1, md: 2}} spacing={4}>
                                                    <FormControl isRequired isInvalid={errors.username}>
                                                        <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2}>TÊN ĐĂNG NHẬP</FormLabel>
                                                        <InputGroup><InputLeftElement h="full" children={<Icon as={FaUser} color="orange.400"/>}/><Input placeholder="VD: chusan_pro" value={formData.username} onChange={e=>setFormData({...formData, username:e.target.value})} {...inputStyle}/></InputGroup>
                                                    </FormControl>
                                                    <FormControl isRequired isInvalid={errors.full_name}>
                                                        <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2}>HỌ VÀ TÊN</FormLabel>
                                                        <InputGroup><InputLeftElement h="full" children={<Icon as={FaIdCard} color="orange.400"/>}/><Input placeholder="Họ tên thật" value={formData.full_name} onChange={e=>setFormData({...formData, full_name:e.target.value})} {...inputStyle}/></InputGroup>
                                                    </FormControl>
                                                </SimpleGrid>
                                                <FormControl isRequired isInvalid={errors.email}>
                                                    <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2}>EMAIL LIÊN HỆ</FormLabel>
                                                    <InputGroup><InputLeftElement h="full" children={<Icon as={FaEnvelope} color="orange.400"/>}/><Input type="email" placeholder="example@gmail.com" value={formData.email} onChange={e=>setFormData({...formData, email:e.target.value})} {...inputStyle}/></InputGroup>
                                                </FormControl>
                                                <FormControl isRequired isInvalid={errors.password}>
                                                    <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2}>MẬT KHẨU</FormLabel>
                                                    <InputGroup><InputLeftElement h="full" children={<Icon as={FaLock} color="orange.400"/>}/><Input type="password" placeholder="Tối thiểu 6 ký tự" value={formData.password} onChange={e=>setFormData({...formData, password:e.target.value})} {...inputStyle}/></InputGroup>
                                                </FormControl>
                                            </>
                                        )}

                                        {/* STEP 1: FACILITY INFO */}
                                        {step === 1 && (
                                            <>
                                                <FormControl isRequired isInvalid={errors.facility_name}>
                                                    <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2}>TÊN CƠ SỞ / SÂN BÓNG</FormLabel>
                                                    <InputGroup><InputLeftElement h="full" children={<Icon as={FaStore} color="orange.400"/>} /><Input placeholder="VD: Sân Chảo Lửa" value={formData.facility_name} onChange={e => setFormData({...formData, facility_name: e.target.value})} {...inputStyle}/></InputGroup>
                                                </FormControl>
                                                <SimpleGrid columns={{base: 1, md: 2}} spacing={4}>
                                                    <FormControl isRequired isInvalid={errors.phone_number}>
                                                        <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2}>SỐ ĐIỆN THOẠI</FormLabel>
                                                        <InputGroup><InputLeftElement h="full" children={<Icon as={FaPhone} color="orange.400"/>} /><Input placeholder="09xxx..." value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} {...inputStyle}/></InputGroup>
                                                    </FormControl>
                                                    <FormControl isRequired isInvalid={errors.ward}>
                                                        <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2}>PHƯỜNG / XÃ</FormLabel>
                                                        <Select placeholder="Chọn khu vực" value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)} {...inputStyle} sx={{"option": {color: 'black'}}}>
                                                            {Object.keys(groupedWards).map(district => (
                                                                <optgroup key={district} label={district}>
                                                                    {groupedWards[district].map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                                </optgroup>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                </SimpleGrid>
                                                <FormControl isRequired isInvalid={errors.street}>
                                                    <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2}>ĐỊA CHỈ CHI TIẾT</FormLabel>
                                                    <InputGroup><InputLeftElement h="full" children={<Icon as={FaMapMarkerAlt} color="orange.400"/>} /><Input placeholder="Số nhà, tên đường..." value={streetAddress} onChange={e => setStreetAddress(e.target.value)} {...inputStyle}/></InputGroup>
                                                </FormControl>
                                                <FormControl isRequired isInvalid={errors.sports}>
                                                    <FormLabel fontSize="xs" fontWeight="900" color={textMuted} ml={2}>LOẠI HÌNH THỂ THAO</FormLabel>
                                                    <SimpleGrid columns={2} spacing={3} bg={neumorphBg} p={4} borderRadius="2xl" boxShadow={neumorphActiveShadow}>
                                                        {sportTypes.map(s => (
                                                            <Checkbox key={s.id} colorScheme="orange" isChecked={selectedSports.includes(s.id)} onChange={(e) => {
                                                                if(e.target.checked) setSelectedSports([...selectedSports, s.id]);
                                                                else setSelectedSports(selectedSports.filter(id => id !== s.id));
                                                            }}>
                                                                <Text fontSize="xs" fontWeight="900" color={textColor}>{s.name}</Text>
                                                            </Checkbox>
                                                        ))}
                                                    </SimpleGrid>
                                                </FormControl>
                                            </>
                                        )}

                                        {/* STEP 2: VERIFICATION */}
                                        {step === 2 && (
                                            <VStack spacing={6} py={4}>
                                                <Box p={8} borderRadius="3xl" bg={neumorphBg} boxShadow={neumorphActiveShadow} textAlign="center" w="100%">
                                                    <Flex w={20} h={20} bg={neumorphBg} rounded="full" align="center" justify="center" boxShadow={neumorphShadow} mx="auto" mb={6}>
                                                        <Icon as={SiZalo} boxSize={10} color="#0068FF" />
                                                    </Flex>
                                                    <Heading size="md" color={textColor} mb={4} fontWeight="900">Xác minh danh tính</Heading>
                                                    <Text fontSize="sm" color={textMuted} mb={8} fontWeight="bold">
                                                        Vui lòng gửi ảnh CCCD và Sân bãi trực tiếp qua Zalo Admin để được phê duyệt hồ sơ nhanh nhất.
                                                    </Text>
                                                    <Button 
                                                        as={Link} href={`https://zalo.me/${ADMIN_ZALO}`} isExternal 
                                                        size="lg" h="60px" w="full" rounded="2xl" colorScheme="blue" bg="#0068FF"
                                                        leftIcon={<SiZalo/>} boxShadow="xl" _hover={{ transform: 'translateY(-2px)', shadow: '2xl' }}
                                                    >
                                                        Bắt đầu Chat Zalo
                                                    </Button>
                                                </Box>
                                            </VStack>
                                        )}

                                        {/* NAVIGATION BUTTONS */}
                                        <HStack spacing={4} pt={6}>
                                            {step > 0 && (
                                                <Button 
                                                    variant="ghost" h="55px" w="40%" rounded="2xl" color={textColor} fontWeight="900"
                                                    bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                                    onClick={() => setStep(prev => prev - 1)}
                                                >
                                                    QUAY LẠI
                                                </Button>
                                            )}
                                            <Button 
                                                w="full" h="55px" rounded="2xl" fontWeight="900" fontSize="md"
                                                bgGradient="linear(to-r, orange.400, yellow.500)" color="white" border="none"
                                                boxShadow="lg" _hover={{ transform: "translateY(-2px)", boxShadow: "xl" }} 
                                                onClick={step < 2 ? handleNextStep : handleRegister}
                                                isLoading={isLoading}
                                            >
                                                {step < 2 ? "BƯỚC TIẾP THEO" : "XÁC NHẬN & HOÀN TẤT"}
                                            </Button>
                                        </HStack>
                                    </VStack>
                                </MotionBox>
                            </AnimatePresence>
                        </MotionBox>
                        <Flex justify="center" mt={8}><Button variant="link" leftIcon={<ArrowBackIcon />} color={textMuted} fontWeight="900" onClick={() => navigate('/')}>TRỞ VỀ TRANG CHỦ</Button></Flex>
                    </Box>
                </Flex>
            </Container>
        </Flex>
    );
}