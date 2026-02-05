import React, { useState, useEffect } from 'react';
import { 
    Box, Button, FormControl, FormLabel, Input, VStack, Heading, Text, useToast, 
    InputGroup, InputRightElement, InputLeftElement,
    Image, Stack, Container, Flex, Icon, HStack,
    useColorModeValue, useBreakpointValue, Link, Divider,
    Tabs, TabList, Tab, Spacer, IconButton, Progress, Badge, Spinner, 
    Stepper, Step, StepIndicator, StepStatus, StepIcon, StepNumber, StepTitle, StepSeparator
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon, ArrowBackIcon, CloseIcon } from '@chakra-ui/icons';
// IMPORT THÊM FaGoogle, FaFacebook
import { FaUser, FaLock, FaIdCard, FaRunning, FaMapMarkerAlt, FaStore, FaPhone, FaCamera, FaEnvelope, FaKey, FaCheck, FaExclamationCircle, FaGoogle, FaFacebook } from 'react-icons/fa';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

//  IMPORT FIREBASE (
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, facebookProvider } from "./firebase.js"; 


// const glassStyle = {
//     background: "rgba(255, 255, 255, 0.12)", 
//     backdropFilter: "blur(3px) saturate(160%)", 
//     WebkitBackdropFilter: "blur(24px) saturate(160%)",
//     border: "1px solid rgba(255, 255, 255, 0.5)",
//     boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.3) inset"
// };

const glassStyle = {
  background: "rgba(15, 30, 60, 0.12)", 
  backdropFilter: "blur(2px) saturate(160%)",
  WebkitBackdropFilter: "blur(16px) saturate(160%)",
  border: "1px solid rgba(255, 255, 255, 0.5)",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.25)",
  borderRadius: "20px"
};

const inputStyle = {
    bg: "whiteAlpha.600",
    border: "1px solid",
    borderColor: "transparent",
    _hover: { bg: "whiteAlpha.800" },
    _focus: { bg: "white", borderColor: "teal.400", boxShadow: "0 0 0 4px rgba(56, 178, 172, 0.15)" },
    borderRadius: "xl",
    height: "50px",
    fontWeight: "500"
};

const pulseAnimation = `
  @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } 100% { transform: scale(1); opacity: 1; } }
  .leaflet-marker-icon { animation: pulse 1.5s infinite; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
`;

// Fix Leaflet Icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

// --- Motion Components ---
const MotionBox = motion(Box);
const MotionFormControl = motion(FormControl);
const MotionButton = motion(Button);

// --- Animation Variants ---
const cardVariants = {
    hidden: { opacity: 0, scale: 0.96, y: 15 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, scale: 0.96, y: -15, transition: { duration: 0.2 } }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } }
};

const staggerItem = {
    hidden: { y: 10, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100, damping: 15 } }
};

const shakeVariant = {
    shake: { x: [-4, 4, -4, 4, 0], transition: { duration: 0.3 } },
    idle: { x: 0 }
};

// --- Helper Components ---
const LocationPicker = ({ setLocation }) => {
    useMapEvents({ click(e) { setLocation({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
    return null;
};

const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `http://localhost:5000/${url.startsWith('/') ? url.substring(1) : url}`;
};

export default function LoginPage() {
    // --- State ---
    const [view, setView] = useState('login'); 
    const [vendorStep, setVendorStep] = useState(1); 
    const [forgotStep, setForgotStep] = useState(1);
    
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [config, setConfig] = useState({});
    
    const [formData, setFormData] = useState({ username: '', email: '', password: '', full_name: '', role: 'user', phone_number: '', facility_name: '', facility_address: '', lat: null, lng: null });
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotCode, setForgotCode] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const [facilityImages, setFacilityImages] = useState([]);
    const [identityImages, setIdentityImages] = useState([]);
    const [faceImage, setFaceImage] = useState(null);

    const toast = useToast();
    const navigate = useNavigate();

    // UI Styles
    const formWidth = useBreakpointValue({ base: "100%", lg: "45%" });
    const bgImageDisplay = useBreakpointValue({ base: "none", lg: "flex" });
    const accentColor = "teal.500";

    useEffect(() => { axios.get('http://localhost:5000/api/config').then(res => setConfig(res.data || {})).catch(() => {}); }, []);

    // 🔥 3. HÀM XỬ LÝ ĐĂNG NHẬP GOOGLE / FACEBOOK
    const handleSocialLogin = async (providerType) => {
        setIsLoading(true);
        const provider = providerType === 'google' ? googleProvider : facebookProvider;

        try {
            // Mở popup
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            // Gửi thông tin về backend
            const res = await axios.post('http://localhost:5000/api/auth/social-login', {
                email: user.email,
                name: user.displayName,
                avatar: user.photoURL,
                uid: user.uid,
                provider: providerType
            });

            // Xử lý thành công
            if (res.data.success) {
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data.user));
                
                toast({ 
                    title: `Đăng nhập ${providerType} thành công!`, 
                    description: `Xin chào, ${user.displayName}`,
                    status: 'success' 
                });
                
                if (res.data.user.role === 'super_admin') navigate('/super-admin');
                else if (res.data.user.role === 'vendor') navigate('/admin');
                else navigate('/');
                
                setTimeout(() => window.location.reload(), 500);
            }
        } catch (error) {
            console.error("Social Login Error:", error);
            let msg = "Đăng nhập thất bại. Vui lòng thử lại.";
            if (error.code === 'auth/account-exists-with-different-credential') msg = "Email này đã được dùng với phương thức khác.";
            else if (error.code === 'auth/popup-closed-by-user') msg = "Bạn đã đóng cửa sổ đăng nhập.";
            toast({ title: 'Lỗi', description: msg, status: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // --- Handlers Existing ---
    const handleLogin = async () => {
        const newErrors = {};
        if (!formData.username) newErrors.username = true;
        if (!formData.password) newErrors.password = true;
        if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return toast({ title: 'Vui lòng điền đầy đủ thông tin', status: 'warning', duration: 2000, isClosable: true }); }
        setIsLoading(true);
        try {
            const res = await axios.post('http://localhost:5000/api/login', { username: formData.username, password: formData.password });
            localStorage.setItem('token', res.data.token); localStorage.setItem('user', JSON.stringify(res.data.user));
            toast({ title: 'Đăng nhập thành công!', status: 'success' });
            if (res.data.user.role === 'super_admin') navigate('/super-admin'); else if (res.data.user.role === 'vendor') navigate('/admin'); else navigate('/'); setTimeout(() => window.location.reload(), 500); 
        } catch (err) { toast({ title: 'Thất bại', description: err.response?.data?.message, status: 'error' }); } finally { setIsLoading(false); }
    };

    const handleNextStep = () => {
        const newErrors = {};
        if (vendorStep === 1) {
            if (!formData.username) newErrors.username = true; if (!formData.email) newErrors.email = true; if (!formData.password) newErrors.password = true; if (!formData.full_name) newErrors.full_name = true;
        } else if (vendorStep === 2) {
            if (!formData.phone_number) newErrors.phone_number = true; if (!formData.facility_name) newErrors.facility_name = true; if (!formData.facility_address) newErrors.facility_address = true; if (!formData.lat) newErrors.location = true;
        }
        if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return toast({ title: 'Vui lòng hoàn tất thông tin bước này', status: 'warning', duration: 2000 }); }
        setErrors({}); setVendorStep(prev => prev + 1);
    };

    const handleRegister = async () => {
        if (formData.role === 'vendor') { if (facilityImages.length === 0 || identityImages.length === 0 || !faceImage) return toast({ title: "Thiếu hồ sơ KYC", description: "Vui lòng tải đủ ảnh", status: "warning" }); } 
        else { const newErrors = {}; if (!formData.username) newErrors.username = true; if (!formData.email) newErrors.email = true; if (!formData.password) newErrors.password = true; if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; } }

        setIsLoading(true);
        const data = new FormData();
        data.append('username', formData.username); data.append('email', formData.email); data.append('password', formData.password); data.append('full_name', formData.full_name); data.append('role', formData.role);
        if (formData.role === 'vendor') {
            data.append('phone_number', formData.phone_number); data.append('facility_name', formData.facility_name); data.append('facility_address', formData.facility_address); data.append('lat', formData.lat); data.append('lng', formData.lng);
            if (faceImage) data.append('face_image', faceImage);
            for (let i = 0; i < identityImages.length; i++) data.append('identity_images', identityImages[i]);
            for (let i = 0; i < facilityImages.length; i++) data.append('facility_images', facilityImages[i]);
        }
        try { await axios.post('http://localhost:5000/api/register', data); toast({ title: formData.role === 'vendor' ? 'Hồ sơ đã gửi!' : 'Đăng ký thành công!', status: 'success' }); setView('login'); setVendorStep(1); setFormData({ ...formData, username: '', password: '' }); } catch (err) { toast({ title: 'Lỗi', description: err.response?.data?.message, status: 'error' }); } finally { setIsLoading(false); }
    };

    const handleSendCode = async () => { if (!forgotEmail) return toast({ title: "Nhập Email", status: "warning" }); setIsLoading(true); try { await axios.post('http://localhost:5000/api/forgot-password', { email: forgotEmail }); toast({ title: "Đã gửi mã!", description: "Kiểm tra email của bạn.", status: "success" }); setForgotStep(2); } catch (err) { toast({ title: "Lỗi", description: err.response?.data?.message, status: "error" }); } finally { setIsLoading(false); } };
    const handleResetPassword = async () => { if (!forgotCode || !newPassword) return toast({ title: "Nhập đủ thông tin", status: "warning" }); setIsLoading(true); try { await axios.post('http://localhost:5000/api/reset-password', { email: forgotEmail, code: forgotCode, newPassword }); toast({ title: "Thành công!", description: "Mật khẩu đã đổi. Vui lòng đăng nhập.", status: "success" }); setView('login'); setForgotStep(1); setForgotEmail(''); setForgotCode(''); setNewPassword(''); } catch (err) { toast({ title: "Thất bại", description: err.response?.data?.message, status: "error" }); } finally { setIsLoading(false); } };
    const handleSubmit = (e) => { e.preventDefault(); if(view === 'login') handleLogin(); else if(view === 'register') { if (formData.role === 'vendor' && vendorStep < 3) handleNextStep(); else handleRegister(); } else if(view === 'forgot' && forgotStep === 1) handleSendCode(); else if(view === 'forgot' && forgotStep === 2) handleResetPassword(); }

    const renderImagePreview = (files, onDelete) => {
        if (!files || files.length === 0) return null;
        const fileArray = Array.from(files);
        return (
            <HStack spacing={3} overflowX="auto" mt={3} pb={2} css={{ '&::-webkit-scrollbar': { height: '4px' } }}>
                {fileArray.map((file, idx) => (
                    <Box key={idx} position="relative" minW="70px" h="70px" borderRadius="xl" overflow="hidden" border="1px solid white" boxShadow="sm">
                        <Image src={URL.createObjectURL(file)} w="100%" h="100%" objectFit="cover" />
                        {onDelete && <IconButton icon={<CloseIcon />} size="xs" colorScheme="red" position="absolute" top={0} right={0} onClick={() => onDelete(idx)} aria-label="Remove" rounded="full" opacity={0.9} transform="scale(0.8)" />}
                    </Box>
                ))}
            </HStack>
        );
    };

    const vendorSteps = [ { title: 'Tài khoản', }, { title: 'Cơ sở', }, { title: 'Xác minh', } ];

    return (
        <Flex minH="100vh" w="100vw" overflow="hidden" position="relative" fontFamily="'Inter', sans-serif">
            <style>{pulseAnimation}</style>
            
            

            <Box position="absolute" inset="0" zIndex={-1} overflow="hidden">
               <Image src="https://duykiet04.github.io/anh/anh1.png"  alt="background"   position="absolute"  inset="0" w="100%" h="100%" objectFit="cover"/>
                {/* <video autoPlay loop muted playsInline style={{ position: "absolute" , inset: "0" , width: "100%" , height :"100%" , objectFit : "cover",}}><source src= "https://duykiet04.github.io/vdeo/veo2.mp4" type="video/mp4"></source></video> */}
                <Box position="absolute" inset="0" bg="blackAlpha.200" backdropFilter="blur(2px)" />
            </Box>

            <Flex display={bgImageDisplay} flex="1" justify="center" align="center" zIndex={1} p={10}>
                <VStack spacing={6} align="start" maxW="lg">
                    <Heading size="4xl" color="white" fontWeight="900" letterSpacing="tight" lineHeight="0.95" textShadow="0 4px 30px rgba(0,0,0,0.5)">
                        Sport<br/><Text as="span" color={accentColor}>Booking</Text>
                    </Heading>
                    <Text fontSize="2xl" color="whiteAlpha.900" fontWeight="400" textShadow="0 2px 10px rgba(0,0,0,0.5)">
                        WebGis hỗ trợ tìm và đặt sân ở thành phố Hồ Chí Minh<br/>Trải nghiệm ngay hôm nay.
                    </Text>
                </VStack>
            </Flex>

            <Flex w={formWidth} align="center" justify="center" p={4} overflowY="auto" zIndex={1}>
                <Container maxW="md" position="relative">
                    
                    {isLoading && (
                        <Flex position="absolute" inset="-10px" zIndex={20}   justify="center" align="center" rounded="3xl" transition="all 0.3s">
                            <VStack  bg="rgba(255,255,255,0.12)" backdropFilter="blur(1px)" p={6} rounded="2xl" shadow="xl">
                                <Spinner color="white" size="lg" thickness='3px'/>
                                <Text fontWeight="bold" color="white"  mt={3} fontSize="sm">Đang xử lý...</Text>
                            </VStack>
                        </Flex>
                    )}

                    <MotionBox {...glassStyle} rounded="3xl" p={{ base: 6, md: 8 }} variants={cardVariants} initial="hidden" animate="visible" exit="exit">
                        <Stack spacing={6}>
                            <Stack spacing={4} textAlign="center" align="center">
                                {config.logo_url ? <Image src={getImgUrl(config.logo_url)} h="48px"  borderRadius="full" border="1px solid rgba(255,255,255,0.6)" objectFit="contain" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"/> : <Icon as={FaRunning} boxSize={12} color={accentColor}/>}
                                {/* {config.logo_url ? <Image src={getImgUrl(config.logo_url)} h="48px"  borderRadius="50%" border="1px solid rgba(255,255,255,0.6)" boxShadow="0 4px 12px rgba(0,0,0,0.2)" objectFit="cover" /> : <Icon as={FaRunning} boxSize={12} color={accentColor}/>} */}

                                {view !== 'forgot' ? (
                                    <Box p={1} bg="blackAlpha.50" borderRadius="full" w="full" border="1px solid rgba(255,255,255,0.5)">
                                        <Tabs variant="unstyled" align="center" index={view === 'login' ? 0 : 1} onChange={(idx) => { setView(idx===0?'login':'register'); setErrors({}); setVendorStep(1); }} w="full">
                                            <TabList>
                                                <Tab w="50%" color = "#F8FAFC" borderRadius="full" fontWeight="bold" fontSize="sm" _selected={{ bg: 'white', color: 'teal.600', shadow: 'sm' }} transition="all 0.2s">Đăng nhập</Tab>
                                                <Tab w="50%" color = "#F8FAFC" borderRadius="full" fontWeight="bold" fontSize="sm" _selected={{ bg: 'white', color: 'teal.600', shadow: 'sm' }} transition="all 0.2s">Đăng ký</Tab>
                                            </TabList>
                                        </Tabs>
                                    </Box>
                                ) : (
                                    <HStack w="full" justify="flex-start">
                                        <IconButton icon={<ArrowBackIcon/>} variant="ghost" isRound onClick={() => setView('login')} size="sm"/>
                                        <Spacer/><Heading size="md" color="white">Khôi phục mật khẩu</Heading><Spacer/>
                                    </HStack>
                                )}
                            </Stack>

                            <form onSubmit={handleSubmit}>
                                <AnimatePresence mode='wait'>
                                    <MotionBox key={view + forgotStep + vendorStep} variants={staggerContainer} initial="hidden" animate="show" exit="hidden">
                                        <Stack spacing={4}>
                                            
                                            {/* --- LOGIN VIEW --- */}
                                            {view === 'login' && (
                                                <>
                                                    <MotionBox variants={staggerItem}>
                                                        <MotionFormControl isRequired isInvalid={errors.username} animate={errors.username ? "shake" : "idle"} variants={shakeVariant}>
                                                            <FormLabel fontSize="xs" fontWeight="bold" color="white" ml={3} mb={1}>TÊN ĐĂNG NHẬP</FormLabel>
                                                            <InputGroup><InputLeftElement pointerEvents="none" children={<Icon as={FaUser} color="white"/>} /><Input value={formData.username} onChange={e => {setFormData({...formData, username:e.target.value}); setErrors({...errors, username:false})}} placeholder="user123" {...inputStyle}/></InputGroup>
                                                        </MotionFormControl>
                                                    </MotionBox>
                                                    <MotionBox variants={staggerItem}>
                                                        <MotionFormControl isRequired isInvalid={errors.password} animate={errors.password ? "shake" : "idle"} variants={shakeVariant}>
                                                            <FormLabel fontSize="xs" fontWeight="bold" color="white" ml={3} mb={1}>MẬT KHẨU</FormLabel>
                                                            <InputGroup><InputLeftElement pointerEvents="none" children={<Icon as={FaLock} color="white"/>} /><Input type={showPassword?'text':'password'} value={formData.password} onChange={e => {setFormData({...formData, password:e.target.value}); setErrors({...errors, password:false})}} placeholder="••••••••" {...inputStyle} /><InputRightElement><IconButton size="sm" variant="ghost" onClick={()=>setShowPassword(!showPassword)} icon={showPassword?<ViewIcon/>:<ViewOffIcon/>} isRound/></InputRightElement></InputGroup>
                                                        </MotionFormControl>
                                                    </MotionBox>
                                                    <MotionBox variants={staggerItem}><Flex justify="flex-end" mt={-1}><Link color="white" fontSize="sm" fontWeight="semibold" onClick={()=>setView('forgot')}>Quên mật khẩu?</Link></Flex></MotionBox>
                                                    <MotionBox variants={staggerItem}>
                                                        <Button w="full" colorScheme="teal" size="lg" h="50px" rounded="xl" onClick={handleLogin} shadow="lg" _hover={{ transform: 'translateY(-2px)', shadow: 'xl' }} transition="all 0.2s" fontSize="md" fontWeight="bold">Đăng Nhập</Button>
                                                    </MotionBox>

                                                    {/* 🔥 4. UI: NÚT GOOGLE & FACEBOOK */}
                                                    <MotionBox variants={staggerItem}>
                                                        <HStack w="full" my={3}>
                                                            <Divider borderColor="gray.300" />
                                                            <Text fontSize="xs" color="white" whiteSpace="nowrap" fontWeight="bold">Hoặc tiếp tục với</Text>
                                                            <Divider borderColor="gray.300" />
                                                        </HStack>
                                                        <HStack spacing={3}>
                                                            <Button 
                                                                w="full" variant="outline" 
                                                                leftIcon={<Icon as={FaGoogle} color="#DB4437"/>} 
                                                                onClick={() => handleSocialLogin('google')}
                                                                bg="whiteAlpha.800" h="45px" rounded="xl" fontSize="sm"
                                                                _hover={{ bg: "white" }}
                                                            >
                                                                Google
                                                            </Button>
                                                            <Button 
                                                                w="full" colorScheme="facebook" 
                                                                leftIcon={<Icon as={FaFacebook}/>} 
                                                                onClick={() => handleSocialLogin('facebook')}
                                                                h="45px" rounded="xl" fontSize="sm"
                                                            >
                                                                Facebook
                                                            </Button>
                                                        </HStack>
                                                    </MotionBox>
                                                </>
                                            )}

                                            {/* --- REGISTER VIEW --- */}
                                            {view === 'register' && (
                                                <>
                                                    {formData.role === 'vendor' && (
                                                        <Box mb={4} px={2}>
                                                            <Stepper index={vendorStep - 1} size="sm" colorScheme="teal">
                                                                {vendorSteps.map((step, index) => (
                                                                    <Step key={index}>
                                                                        <StepIndicator bg="white" border="2px solid" borderColor={vendorStep > index ? "teal.500" : "gray.200"}>
                                                                            <StepStatus complete={<StepIcon />} incomplete={<Text fontSize="xs" fontWeight="bold" color="gray.400">{index+1}</Text>} active={<Text fontSize="xs" fontWeight="bold" color="teal.600">{index+1}</Text>} />
                                                                        </StepIndicator>
                                                                        <Box flexShrink='0'><StepTitle fontSize="xs" fontWeight="bold">{step.title}</StepTitle></Box>
                                                                        <StepSeparator bg="gray.200"/>
                                                                    </Step>
                                                                ))}
                                                            </Stepper>
                                                        </Box>
                                                    )}

                                                    {/* STEP 1: INFO */}
                                                    {(formData.role !== 'vendor' || vendorStep === 1) && (
                                                        <>
                                                            <MotionBox variants={staggerItem}><InputGroup><InputLeftElement pointerEvents="none" children={<Icon as={FaUser} color="gray.400"/>}/><Input placeholder="Tên đăng nhập" value={formData.username} onChange={e=>{setFormData({...formData, username:e.target.value}); setErrors({...errors, username:false})}} {...inputStyle}/></InputGroup></MotionBox>
                                                            <MotionBox variants={staggerItem}><InputGroup><InputLeftElement pointerEvents="none" children={<Icon as={FaEnvelope} color="gray.400"/>}/><Input placeholder="Email" value={formData.email} onChange={e=>{setFormData({...formData, email:e.target.value}); setErrors({...errors, email:false})}} {...inputStyle}/></InputGroup></MotionBox>
                                                            <MotionBox variants={staggerItem}><InputGroup><InputLeftElement pointerEvents="none" children={<Icon as={FaLock} color="gray.400"/>}/><Input type="password" placeholder="Mật khẩu (6+ ký tự)" value={formData.password} onChange={e=>{setFormData({...formData, password:e.target.value}); setErrors({...errors, password:false})}} {...inputStyle}/></InputGroup></MotionBox>
                                                            <MotionBox variants={staggerItem}><InputGroup><InputLeftElement pointerEvents="none" children={<Icon as={FaIdCard} color="gray.400"/>}/><Input placeholder="Họ và tên" value={formData.full_name} onChange={e=>{setFormData({...formData, full_name:e.target.value}); setErrors({...errors, full_name:false})}} {...inputStyle}/></InputGroup></MotionBox>
                                                            <MotionBox variants={staggerItem}>
                                                                <Box cursor="pointer" p={4} borderRadius="xl" borderWidth="1px" borderColor={formData.role === 'vendor' ? accentColor : 'transparent'} bg={formData.role === 'vendor' ? 'teal.50' : 'whiteAlpha.600'} transition="all 0.2s" onClick={() => { setFormData({ ...formData, role: formData.role === 'vendor' ? 'user' : 'vendor' }); setVendorStep(1); }} _hover={{ bg: "white", shadow: "md" }} shadow="sm">
                                                                    <HStack>
                                                                        <Flex w="24px" h="24px" borderRadius="full" align="center" justify="center" bg={formData.role === 'vendor' ? accentColor : 'gray.300'} color="white"><Icon as={FaCheck} boxSize={3} /></Flex>
                                                                        <Box><Text fontWeight="bold" fontSize="sm" color="gray.700">Đăng ký làm Chủ Sân</Text><Text fontSize="xs" color="gray.500">Dành cho đối tác kinh doanh</Text></Box>
                                                                        <Spacer /><Icon as={FaStore} color={formData.role === 'vendor' ? accentColor : 'gray.300'} boxSize={5} />
                                                                    </HStack>
                                                                </Box>
                                                            </MotionBox>
                                                        </>
                                                    )}

                                                    {/* STEP 2: FACILITY */}
                                                    {formData.role === 'vendor' && vendorStep === 2 && (
                                                        <>
                                                            <MotionBox variants={staggerItem}><InputGroup><InputLeftElement pointerEvents="none" children={<FaPhone color="gray.400"/>} /><Input placeholder="Số điện thoại liên hệ" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} {...inputStyle}/></InputGroup></MotionBox>
                                                            <MotionBox variants={staggerItem}><InputGroup><InputLeftElement pointerEvents="none" children={<FaStore color="gray.400"/>} /><Input placeholder="Tên sân bóng/cơ sở" value={formData.facility_name} onChange={e => setFormData({...formData, facility_name: e.target.value})} {...inputStyle}/></InputGroup></MotionBox>
                                                            <MotionBox variants={staggerItem}>
                                                                <Text fontSize="xs" fontWeight="bold" color="gray.500" mb={2} ml={2}>CHỌN VỊ TRÍ TRÊN BẢN ĐỒ</Text>
                                                                <Box h="180px" borderRadius="xl" overflow="hidden" border="1px solid" borderColor="white" shadow="md"><MapContainer center={[10.7769, 106.7009]} zoom={13} style={{ height: '100%' }} zoomControl={false}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><LocationPicker setLocation={(loc) => setFormData({...formData, lat: loc.lat, lng: loc.lng})} />{formData.lat && <Marker position={[formData.lat, formData.lng]}></Marker>}</MapContainer></Box>
                                                                {formData.lat && <Badge colorScheme="green" mt={2} borderRadius="full">📍 Đã chọn</Badge>}
                                                            </MotionBox>
                                                            <MotionBox variants={staggerItem}><InputGroup><InputLeftElement pointerEvents="none" children={<FaMapMarkerAlt color="gray.400"/>} /><Input placeholder="Địa chỉ chi tiết" value={formData.facility_address} onChange={e => setFormData({...formData, facility_address: e.target.value})} {...inputStyle}/></InputGroup></MotionBox>
                                                        </>
                                                    )}

                                                    {/* STEP 3: KYC */}
                                                    {formData.role === 'vendor' && vendorStep === 3 && (
                                                        <>
                                                            <MotionBox variants={staggerItem}>
                                                                <Box bg="blue.50" p={3} borderRadius="lg" border="1px dashed" borderColor="blue.300">
                                                                    <HStack align="start"><Icon as={FaExclamationCircle} color="blue.500" mt={1}/><Text fontSize="xs" color="blue.700">Chúng tôi cần xác minh danh tính để đảm bảo môi trường kinh doanh an toàn và hợp pháp.</Text></HStack>
                                                                </Box>
                                                            </MotionBox>
                                                            <MotionBox variants={staggerItem}><Button as="label" w="100%" leftIcon={<FaCamera/>} colorScheme={facilityImages.length>0?"green":"gray"} variant="outline" h="50px" rounded="xl" borderStyle="dashed" borderWidth="2px" bg="whiteAlpha.500">
                                                                {facilityImages.length>0 ? `Đã chọn ${facilityImages.length} ảnh sân` : "1. Tải ảnh sân bãi"}
                                                                <Input type="file" multiple accept="image/*" display="none" onChange={e => setFacilityImages(e.target.files)}/>
                                                            </Button></MotionBox>
                                                            <MotionBox variants={staggerItem}><Button as="label" w="100%" leftIcon={<FaIdCard/>} colorScheme={identityImages.length>0?"green":"gray"} variant="outline" h="50px" rounded="xl" borderStyle="dashed" borderWidth="2px" bg="whiteAlpha.500">
                                                                {identityImages.length>0 ? `Đã chọn ${identityImages.length} ảnh CCCD` : "2. Tải ảnh CCCD (2 mặt)"}
                                                                <Input type="file" multiple accept="image/*" display="none" onChange={e => setIdentityImages(e.target.files)}/>
                                                            </Button></MotionBox>
                                                            <MotionBox variants={staggerItem}><Button as="label" w="100%" leftIcon={<FaUser/>} colorScheme={faceImage?"green":"gray"} variant="outline" h="50px" rounded="xl" borderStyle="dashed" borderWidth="2px" bg="whiteAlpha.500">
                                                                {faceImage ? "Đã có ảnh khuôn mặt" : "3. Tải ảnh chân dung"}
                                                                <Input type="file" accept="image/*" display="none" onChange={e => setFaceImage(e.target.files[0])}/>
                                                            </Button></MotionBox>
                                                            {(facilityImages.length > 0 || identityImages.length > 0 || faceImage) && (
                                                                <Box bg="whiteAlpha.400" p={2} borderRadius="xl">
                                                                    {renderImagePreview([...facilityImages, ...identityImages, ...(faceImage ? [faceImage] : [])])}
                                                                </Box>
                                                            )}
                                                        </>
                                                    )}

                                                    {/* NAV BUTTONS */}
                                                    <MotionBox variants={staggerItem}>
                                                        <HStack pt={2} spacing={3}>
                                                            {formData.role === 'vendor' && vendorStep > 1 && (
                                                                <Button variant="ghost" onClick={() => setVendorStep(prev => prev - 1)} h="50px" rounded="xl" w="30%">Quay lại</Button>
                                                            )}
                                                            <MotionButton type="submit" w="full" size="lg" bgGradient="linear(to-r, teal.400, blue.500)" color="white" h="50px" rounded="xl" shadow="lg" _hover={{ transform: 'translateY(-2px)', shadow: 'xl' }} transition="all 0.2s">
                                                                {formData.role === 'vendor' && vendorStep < 3 ? "TIẾP THEO" : "ĐĂNG KÝ NGAY"}
                                                            </MotionButton>
                                                        </HStack>
                                                    </MotionBox>
                                                </>
                                            )}

                                            {/* --- FORGOT PASSWORD --- */}
                                            {view === 'forgot' && (
                                                <>
                                                    <MotionBox variants={staggerItem}>{forgotStep === 1 ? <InputGroup><InputLeftElement pointerEvents="none" children={<Icon as={FaEnvelope} color="gray.400"/>} /><Input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="Email đã đăng ký" {...inputStyle}/></InputGroup> : <><InputGroup mb={3}><InputLeftElement pointerEvents="none" children={<Icon as={FaKey} color="gray.400"/>} /><Input value={forgotCode} onChange={e => setForgotCode(e.target.value)} placeholder="Mã OTP" textAlign="center" letterSpacing="4px" fontWeight="bold" {...inputStyle}/></InputGroup><InputGroup><InputLeftElement pointerEvents="none" children={<Icon as={FaLock} color="gray.400"/>} /><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mật khẩu mới" {...inputStyle}/></InputGroup></>}</MotionBox>
                                                    <MotionBox variants={staggerItem}>
                                                        <Button w="full" size="lg" colorScheme="teal" h="50px" rounded="xl" onClick={forgotStep === 1 ? handleSendCode : handleResetPassword} shadow="lg">{forgotStep === 1 ? 'GỬI MÃ OTP' : 'ĐỔI MẬT KHẨU'}</Button>
                                                        <Button variant="ghost" size="sm" w="full" mt={2} onClick={() => { setView('login'); setForgotStep(1); }}>Quay lại đăng nhập</Button>
                                                    </MotionBox>
                                                </>
                                            )}
                                        </Stack>
                                    </MotionBox>
                                </AnimatePresence>
                            </form>
                        </Stack>
                    </MotionBox>
                    
                    <Flex justify="center" mt={8}>
                        <Button variant="link" leftIcon={<ArrowBackIcon />} color="whiteAlpha.800" _hover={{color: 'white', transform: 'translateX(-4px)'}} transition="all 0.2s" onClick={() => navigate('/')} size="sm">Về trang chủ</Button>
                    </Flex>
                </Container>
            </Flex>
        </Flex>
    );
}