import React, { useState, useEffect } from 'react';
import { 
    Box, Button, FormControl, FormLabel, Input, VStack, Heading, Text, useToast, 
    InputGroup, InputRightElement, InputLeftElement,
    Image, Stack, Container, Flex, Icon, HStack,
    useBreakpointValue, Link, Spacer, IconButton, Progress, 
    useColorMode, useColorModeValue, Divider, Center, Tag, Avatar
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon, ArrowBackIcon, SunIcon, MoonIcon } from '@chakra-ui/icons';
import { FaUser, FaLock, FaRunning, FaGoogle, FaFacebook, FaHandshake, FaMapMarkedAlt, FaBolt, FaMobileAlt } from 'react-icons/fa';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// IMPORT FIREBASE
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, facebookProvider } from "./firebase.js"; 

// ==========================================
// 🔥 1. CẤU HÌNH API
// ==========================================
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const apiClient = axios.create({ baseURL: API_URL });
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
}, (error) => Promise.reject(error));

const MotionBox = motion(Box);
const MotionFormControl = motion(FormControl);
const MotionButton = motion(Button);

const cardVariants = {
    hidden: { opacity: 0, scale: 0.96, y: 15 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, scale: 0.96, y: -15, transition: { duration: 0.2 } }
};
const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const staggerItem = { hidden: { y: 10, opacity: 0 }, show: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100, damping: 15 } } };

const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_URL}/${url.startsWith('/') ? url.substring(1) : url}`;
};

export default function LoginPage() {
    const { colorMode, toggleColorMode } = useColorMode();
    const [view, setView] = useState('login'); 
    const [forgotStep, setForgotStep] = useState(1);
    
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [config, setConfig] = useState({});
    
    const [formData, setFormData] = useState({ username: '', email: '', password: '', full_name: '', role: 'user' });
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotCode, setForgotCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [timeLeft, setTimeLeft] = useState(0);

    const toast = useToast();
    const navigate = useNavigate();

    // 🎨 CẤU HÌNH NEUMORPHISM STYLE (ĐÃ FIX THIẾU BIẾN)
    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphShadow = useColorModeValue('9px 9px 16px #c5cad3, -9px -9px 16px #ffffff', '8px 8px 16px #0d1117, -8px -8px 16px #4a5568');
    const neumorphActiveShadow = useColorModeValue('inset 6px 6px 12px #c5cad3, inset -4px -4px 12px #ffffff', 'inset 6px 6px 12px #1a202c, inset -4px -4px 8px #2d3748');
    const textMuted = useColorModeValue("gray.500", "gray.400");
    const textColor = useColorModeValue("gray.700", "gray.100");
    const labelColor = useColorModeValue("gray.500", "gray.400");
    const accentColor = useColorModeValue("blue.500", "blue.300");
    const dividerColor = useColorModeValue('gray.300', 'gray.600'); // 🔥 ĐÃ THÊM BIẾN NÀY

    const inputStyle = {
        bg: neumorphBg,
        border: "none",
        color: textColor,
        boxShadow: neumorphActiveShadow,
        _focus: { boxShadow: neumorphActiveShadow, border: "1px solid", borderColor: "blue.300" },
        _placeholder: { color: "gray.400" },
        borderRadius: "2xl",
        height: "55px",
        fontWeight: "bold"
    };

    const formWidth = useBreakpointValue({ base: "100%", lg: "45%" });
    const bgImageDisplay = useBreakpointValue({ base: "none", lg: "flex" });

    useEffect(() => { apiClient.get('/api/config').then(res => setConfig(res.data || {})).catch(() => {}); }, []);

    useEffect(() => {
        let timer;
        if (view === 'forgot' && forgotStep === 2 && timeLeft > 0) timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [view, forgotStep, timeLeft]);

    const formatTime = (seconds) => { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m}:${s < 10 ? '0' : ''}${s}`; };

    const handleSocialLogin = async (providerType) => {
        setIsLoading(true);
        const provider = providerType === 'google' ? googleProvider : facebookProvider;
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            if (!user.email) { toast({ title: 'Lỗi', description: "Không lấy được Email.", status: 'error' }); return; }
            const res = await apiClient.post('/api/auth/social-login', { email: user.email, name: user.displayName, avatar: user.photoURL, uid: user.uid, provider: providerType });
            if (res.data.success) {
                localStorage.setItem('token', res.data.token); 
                localStorage.setItem('user', JSON.stringify(res.data.user));
                toast({ title: `Chào mừng ${user.displayName}!`, status: 'success' });
                if (res.data.user.role === 'super_admin') navigate('/super-admin'); else if (res.data.user.role === 'vendor') navigate('/admin'); else navigate('/');
            }
        } catch (error) { 
            if (error.code !== 'auth/popup-closed-by-user') toast({ title: 'Lỗi đăng nhập', status: 'error' });
        } finally { setIsLoading(false); }
    };

    const handleLogin = async () => {
        const newErrors = {};
        if (!formData.username) newErrors.username = true; if (!formData.password) newErrors.password = true;
        if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return toast({ title: 'Nhập đủ thông tin nhé!', status: 'warning' }); }
        setIsLoading(true);
        try {
            const res = await apiClient.post('/api/login', { username: formData.username, password: formData.password });
            localStorage.setItem('token', res.data.token); localStorage.setItem('user', JSON.stringify(res.data.user));
            toast({ title: 'Đăng nhập thành công!', status: 'success' });
            if (res.data.user.role === 'super_admin') navigate('/super-admin'); else if (res.data.user.role === 'vendor') navigate('/admin'); else navigate('/');
        } catch (err) { toast({ title: 'Thất bại', description: err.response?.data?.message, status: 'error' }); } 
        finally { setIsLoading(false); }
    };

    const handleRegister = async () => {
        if (formData.password.length < 6) return toast({ title: "Mật khẩu quá ngắn", status: "warning" });
        setIsLoading(true);
        const data = new FormData();
        data.append('username', formData.username); data.append('email', formData.email); data.append('password', formData.password); data.append('full_name', formData.full_name); data.append('role', 'user');
        try { 
            await apiClient.post('/api/register', data); 
            toast({ title: 'Đăng ký thành công!', status: 'success' }); setView('login'); 
        } catch (err) { toast({ title: 'Lỗi', description: err.response?.data?.message, status: 'error' }); } 
        finally { setIsLoading(false); }
    };

    const handleSubmit = (e) => { 
        e.preventDefault(); 
        if(view === 'login') handleLogin(); 
        else if(view === 'register') handleRegister(); 
        else if(view === 'forgot' && forgotStep === 1) handleSendCode(); 
        else if(view === 'forgot' && forgotStep === 2) handleResetPassword(); 
    }

    const handleSendCode = async () => { 
        setIsLoading(true); 
        try { await apiClient.post('/api/forgot-password', { email: forgotEmail }); setForgotStep(2); setTimeLeft(900); toast({ title: "Đã gửi OTP", status: "success" }); } 
        catch (err) { toast({ title: "Lỗi", description: err.response?.data?.message, status: "error" }); } 
        finally { setIsLoading(false); } 
    };

    const handleResetPassword = async () => { 
        setIsLoading(true); 
        try { await apiClient.post('/api/reset-password', { email: forgotEmail, code: forgotCode, newPassword }); toast({ title: "Xong! Đã đổi mật khẩu", status: "success" }); setView('login'); } 
        catch (err) { toast({ title: "Lỗi OTP", status: "error" }); } 
        finally { setIsLoading(false); } 
    };

    return (
        
        <Flex minH="100vh" w="100vw" overflow="hidden" position="relative" bg={neumorphBg}>
            <Button position="absolute" top={6} left={6} zIndex={10} leftIcon={<ArrowBackIcon/>} variant="ghost" color={textMuted} fontWeight="900" onClick={() => navigate('/UserPage')}>
                            TRỞ VỀ TRANG CHỦ
                        </Button>
            {/* Nút đổi Theme */}
            <IconButton 
                position="absolute" top={6} right={6} zIndex={10} isRound 
                icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />} 
                onClick={toggleColorMode} 
                bg={neumorphBg} boxShadow={neumorphShadow} _active={{ boxShadow: neumorphActiveShadow }}
                color={textColor} border="none" aria-label="Toggle Color Mode"
            />

            {/* 🔥 BÊN TRÁI: 3D VISUALIZATION */}
            
            
            <Flex display={bgImageDisplay} flex="1.2" justify="center" align="center" p={10} position="relative">
                
                <VStack spacing={12} align="start" zIndex={2} maxW="xl">
                    <Box>
                        <Heading fontSize="7xl" fontWeight="900" color="blue.500" letterSpacing="tighter" lineHeight="1">
                            Sport <br /> 
                            <Text as="span" bgGradient="linear(to-r, blue.400, purple.500)" bgClip="text">Booking</Text>
                        </Heading>
                        <Text mt={4} fontSize="2xl" color={textMuted} fontWeight="bold">
                            Nền tảng đặt sân <Text as="span" color="orange.400" textDecoration="underline">3D</Text> hiện đại nhất.
                        </Text>
                    </Box>

                    <Box position="relative">
                        <MotionBox 
                            p={6} borderRadius="40px" bg={neumorphBg} boxShadow={neumorphShadow}
                            animate={{ y: ["0px", "-15px", "0px"] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <Image 
                                src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAREAAAC4CAMAAADzLiguAAACdlBMVEX/////m4wAAAD/4WLITf//99X/nI3/42P/mYr/lobCQP//mIj/4GL/5GTITP//5mT/gnf/lIMeDgD/4Fn//f8aDQAzMzP/oJH/mI3OT///+fj/6Wb//fb/4Fv68f//+9j/fXH/vLP/2tX/ycL/6uf/9vXw8PDu0Vv89///+Nz/rKDryP/lt///0szjsP//ppnWiP8lJSXEN///++3Jycn57v/04P/w1v/bwFP/6+jalv//nYcZGRna2tpHR0fpzFm+SfJVVVXgqP//8Le1tbX/i369pEb25v/pwP9oaGg1LxTl5eUgHAz/6pfbhHj/88XNtE6Vgzn3j5+pQdj/5njOZf+kpKRSSB//6IqOjo4UAAD/77PVfv8+Nhjfnv+AcTH/xHOvmkMcCyRvYit4LpnUg/+UOb3MaP/xxaqoZFdlWU9FGUXFdmlzc3NGGUn/qIX/0mvDup7d1La6C/+yJuvCeOXfcMemLtjGVNbdh2nFb4XXf36/ZKPYcbjSZs7XYO/unM5LFGJhJXvHdXYEGwDjmbXfmI1qZEzRYdkvKxt+TEVJLChkPDcAEACRenjjuLOOR0FQIhvFtHJIZGeRY127XVX6d5nebmVqBo+HVZ8RIyXgy3vVYJqzjolWNzKXTEX/vIzLe1pMKToVNSO8pcgmAD10ZH3EoVLtgbWQWYdwTYAYCR/baN/kdc1RRVulirH1zplVAGKknbMcMAhlNGRyF58AAC2uoGzsusi4ccyzfXNJPTMuACiBQ1Y3HABrOSoyAAB9P4zi05uKBr/iro7KiZ6iaIGWjHX6qbBNMQCvVKOYXz1LSzWrervdp1/JloSyjGLMuNNLCAz7AAAgAElEQVR4nO19i0Mb17nnzEgaSaORRmIASQgB4iUknhYCxgiQjEFgYwZhCczLshXbIhiwMThV0sZ24rZOE6d10k3WuTc3iW+7TdybuHXvXm9uYjfZJtk2226T3f9ozzkzo+eIRwJI7N2fE9BzpPnxvc93vsGwQqN5oaOq0N+hWFB6uLW+svtqIhwo9DcpBgCxcJC81uQYpZTKxGihv07h8UxiodtH8vjKDwwGpTLQUejvU3CMJJSJZ5/jf/ijH05RkJGFQn+hgqMqoVQ+f+164MaN6y90UP9fRgCeMSjDyusn+ed8bmzBk+gu9PcpPLoThsQ1nw7HcVMF1tRU6K+zj2hbbJZ/onmxo6LVrcVxnWN/v1GB0e0JJEY2ed4BpMR0eN++TsFRV9tGKRPPrB45MjvUL/uKehOOa9r3+WsVDLU6rfbkdYP1RQLh0GyjzIu00JLU7vt3KwjqTbzluR9dD9xcJk4cP3H6BEH0yXDi1gAhwQvw9QoA0wr+4x8ErI9+cuJlKCLHjx8/ffHiUPar6qCQaOu2f1jvADHgXT0mr4TFi56phaqf8oCQa75bRBrKX1ody3wlNCSAkortHnmIKAf/iGNyGljE6LoaDoN0ZepnGp+pvl9k4+XTx+HPMm/mawVGtiskjYCOI4eIPuLQrn/pPUVzwhoIGwInfRqNG5s9cfrUaWBIkOacIE4Q3tnV6f5Gryj30JDgGt02hWQWcAEO1DdATO/d198DgDxOGaZGfOBU3diR45LOAONadryMePniSxeB4BOC/rRqkZC0bu/IBPEKQdwmiIFDA3v4/fcACwHASHdrjQnXHoZaU/byCeBvToCfxAlEDCRIEJIGpDYa8yZHm5hXSTeHliz80qvE7UN9fXt9DruLroQh7GmqMBph+NU4CwX9UHk5EhSoOD8HIFbF17ZrkJDkj0lmnE52XLzt5ZfIV3geCAqx5yexu+h+NtGCYRajaDQbBddQ6p0eOPHycWKJX1rhfyG+9A5iBKhXHlSyCtpvj1SiO/3aJZ7nzbzl9gGTEYBS8H9dDTSaDekPDxG3l37Om2/hd5bEx/t5EglJg8xBICrtNK3g7BF0p0LHW3gc5y2vlu/hd9871NdosnNbL7GC80vub0neJFHwLrm5bY3QCoWCExVHq9HAl1sOnNYIqDCitKU+7aFGyAiPKOgRH5r9HJ5j/nxPxXIKhdPPdsI75jvuWxpy+O5rxAGL0USYTTl+pPwEbwEPkqRWImrsdcSQKY/aNGK/JE6p1Rw7D++1vvKf3iC1b/LGA1pVqRvOUQgv8fp/1uLkyh2tVBapxRF4+UP08zAP4NROWlCbdl43fJfAh2sAoc3RaI/8u4oWDUbkRzTpjxFvAqeMkzrpQSEgyVcS8PIWcoWYBNbVOSE80upunX3VrDGaogbKEH7rH8Zk31e0MAvBxp20h/7RYjQOm6UApNMlxCN5zEj/m+BZ84p7XsG+nXrUC9Rs2PhPhsClVKR3UNCKBIBcSX/MbXz189feEW6r2DVLHhGBAUiFGz1JavuxzrSnKoDBNt0NhMXs4EDZ2ApBJfj0vMxhNL5LHEM3x1k6dg9SossO0CYiLBtRtddokWvW3cl4ssqC+34UiEv50uzensMuw4ESOTOKHlRC3OmoMZo1t8CNCbWdoTkFbsl1NOtOP8fR7Nk33xPit0/Tn+yx+p77q+FmsupyaX9OZZcg2E0z8c7hBuwoOzPRCSNZYFl1dRN2e9B/hlEo1iyWnPoIrdDr9U7OFiPuCp7I3FoqPTfqefb5QPipp5KMvNiyzyf1/QDXH0CMiWu1lnu0nWXP1hihr8EtawznVCtoWq2mfTlmlVaHQk49zdn+2YiiPFyj1ToEd11FGQB+RaQYuWktzfnYIoZQNkSs3AtyeoV6WDhHC+CCBhmLIsTQ9ET2u8ZpP+d3qmluDRKIOMF1JjcM6j4BfEyd1BHEssRImGorwIl9d7h1EiNnFX4gFmeRc7FcVk8yXExP0zFnLJnsJ+Fiuclzflrhd9YaASfDwhE0pvbaX4et1vs+n3mJkPTmRatBeTCFxLKm1jtjevVlC4APaIuT5piYU+8X4vNMzNhDITWnUHOVWJ0xSQlQHv7mixof9Mi3JSEJKJXUwbIkd3itDsRZFp9awQHDoabvXb53luZo+gytdsZOMWyOzgBURuxcyKlQ+IF/arDUGIc1Iick/65Z+C3qTdyqVBrCB0pIQObiwE1ay1kmGAJ5fUivZhhazymgEQFKc9wl+57KGRbQZ5+Bt0sBJaIxAV5niRR/Ex8CvTkPCFEqA/9lX09oF1Ba3+qmFYACPxPz60PMJK33OxmQ46vt3nzvgUEaLYQwWDugJKl9EjXLwN/cRIQorTf360x2EUdZWuF0Qp/KTAIvow7RMQUdo1lV/rd0pkJ3R8q+CvCdvBEQVAYhfLACVwGuGZZzxvwKNa2nYRyi4PwKRsHKK00Oao3GlObgPst1g8EaDkiEKK2/OWA5sABVhD3lZyaRmDhBWOpX+7kcx5sP0L4CA0vCahN+TWlQZiJw8ErRCOuEU+GEpoQGZtYZY2Js59ZvklBXAzi5y/P83etUNiFxZeL9vfvae4lS6GE4huMUDK0GvOyEEayhHXBSU1NjqV3MYiQcBkHJgfM3AiLApzI0A8QDOGBm0i8XjORHvdvSDvObpgytCYfD0KB48rS8FTkiIVp/Rg+MK8f4OcbJbNuOZKLbk2FE0E+D56BVXRFmnMDpqtUMvXb27L17H3CR73icQUqZg4NJyYwCpP9nUW4DcJs49V1rglPZxhVSQh1AxRm30/cAFWLitpo3Yt0SI55cRpSGA9hOPr4mheEaEGd9n+5vGb2xxit37YvuG6rbhXqJz+c7+SD1J62vc5P4DtfpsoISgzXwIvHdZa5gGHlw/yTA/WvXpwwGkZF6B67VajQa0w56FgEWDdaUdFipj35LEAesGQuhGZVJIZQBEFe19VQ1uE2wfsLDzoqdHMn7L+fj4QByvIFA/Pya7ecHk5FoOBwIQy7Ab3AqCeqHuC6Z5Gu33yLvHRCrrB8+9dSH4NekjTt4C3wQTQYporqJok3DSV9aip9nNTwXQ+VEJl5W2M6BX6tbv7XY0Cs5iMB5kIoEDNfTCdnungFvNh8E4WegiBywLleIpqR/CMfDSETE4qmw/rAtZ9N4LMnD8dgp4UbMRp8AhByoFWABqXQkAM1I2CqICC/UTrfV+jyU5ONUiI4Jt87YGKAzfQeQEOBpkowALxEIfIQYMb+6sl1GGo8k+eC4U9JNxjZJSC3DxY7SzB1Yo2mMwP8fCDJCCHZk687nsRQfodPS7TKaCR0cN1MF0tHKVGjdlmIE/gtcQ4tRS9tlRNp1cJzjknxAq+oEPw9KtNq00Y0dTRWXe9NykTBg5L4P15rIdxpERrbYjNUoUhD0I31ZnRbuMcypogvNupu78j1VBftmkvcuGDIZeeDj6+ph467AyBYBmuBkJp1nwM9jQCbKBasKjUiRBSJtHsojuzxfiaqo86la6gIMV8NCuBqgDImA0CDUgBjJ7ODLxZgoIIAOtJdrFt49rWaCBHFkl85kl1AKi54eufEQE9mF5anAjRswpwG+N9Dc1vvM4ifIY1agVd2c1qssiH7XeVoQiLFUaFZskRkKuwwGmWfmZzLvl/5O6/PhJ689Czh5Jv0JUrMNw+oVGDntF6woSmwmbc5i9LuowEfJzxApbRtMv4t6NX0+y/3MkSOoyzPNjIwuTC3kmCbJsE5Owu1GiJ/jDH28GP0uqmYZFuWfDGykTwVwiP01vsydrpCotG7xtgeRmfqpnALbrEgJBzk4JkTvZ4rOzUBUoWzFIz+NqCNDRuqEpdvsPVftGg1uTkWsUzOdnRFVIOeAYgXgXGwVblATHM8porwIQ5EWKCRio8/EROaiVFVGs0urVjbLNWvaze5kNDJyIdI81RypzZE6KWQNnSgVGSHOqYvP90JYDZLaQDqOpp44mrX0Xy922WW5FbPO7W5P7ucc6Zjp7VlotkVz1hpEvTk36ZXkhTitAN53oLiSvMFFKwq8PEDxK2E7SGWqJ2SGzXytuC8gO+8ncfOdW8l7TQvzPx3Fpkb0Uzmf1ScKySw21ieF9IpQkbmbUY9BiEQNvRjmQgFISm9UR7PWC8ToNDPL/b0FH5hNs5BTrocXsCpr51pv9oeJHnjyHLi9KlFCFxklo1LNw0BVZTOS65HNMjnd7B/MK8RAmoHs7YkA8WiJVl/IGV4iRPLHY9Dj9h8SKYFhazFtGFiQ0jdqMJuRwY7sU7olk9PNEiW/OFKe1vHf3TH+AkgLojIfJgYlIUGgxHLaaVsM2JLdOp9dQK9HVBtDUyeypCmtUWaf1TsCI+l79zA4CaCvbyDNY0w16KfyjBYU9Cb2knBPNLWnYN25mOKSkQUPCkmoqGBUN+m2ewNVyzL2SlQRvybgfIS02LO5I99y5dD0LHHmFHEqJtoNyfvYThSV3mBYV1RJAQNL1aIzyd8m00hY0M7N9Me6E/F/+XXfwMDAodRfOZq3ZXf1CmOznSJC/yreFymZ9BffRpseuHFO8Jf5ZWTodbR4dyv9sSalx/Cn/4rmtvx+qw/xehs/DjEg3+X+7SNR88SUODRZZEIC4HKNTnnQSm5+RlZXzHzOnipYbYyfj4cN1IWtPmN6aLrxl0E/AzKaZDu9WGuki09IYKw6aoCmND8jxzTyRfdeK8BijmeSQWPT21ww6FfbnclMsBEV084BF1xs7fGdwH6UDkY3Y+QX+bfEb/dsXLHJEB1i7DdSKSSQklPniNDxonI3CCpIRdNmjAiTJLY7gEUOLjujCE36FQ8eJZtPxrD1c5yNOx4i/lt0J92g+wGVkNjl9zU7G0mTA9e8nlXQCtvbL1jPByjp0dkjH3Mxv+10iAjmbl4qNARK8suIkPvuZNxXGhpeuP7gpw9Zln4hED5/Pk4lq2z9Qx/7/c5gkGPs//6djryXQJTkyEjSLQq57/aWvKs6FqcyUr1BkFMaqBvf/vYP5+OBQMCTVpxz+f3BSb+efSEnNyw8XKoMGRnrnx3yDhHTUhqHasxbVd0FBB5Gxpun0gxubyAeB146HrACYijqRtpr14OTsRitXqMWi7A3D1CSJiOPiTngGUuIx+J9YdrXdhpFmgcjWLWtJ23gce/VuCEM/gEyoi0to2mZQCWtZxRBJ/s1FV8swlHrLpcr+Yc6QpQgzElrTKjQqiG3cZho9/iFxcO23lQhrWq0d+HGjWcGm7NP2kVDqNXsdUOcegYrPqg6JbUBeX4JlBFi7oT4SC0yrSZwq2KLqXDR7kigiuqMbLm/uXKcBQ6ItrNnP6LC8XhRTtE+KjFyca6k7JUlgNtSziGaVnf9nWGTybSZPWkZtU1h3crqe3JlkjSoXvjo+td2ll27lojDTODG5i8vEGYEtVkFIkLwZgA+OYkJmVaNAw7xIvHNBsN1d4xHe7C26Pj9zTuje0HSTRk+uvElpMNzo7c4W+PF2nM51JgVuEP3dpn0FNwjrtE5+JWlFUDKZgdRVj8NwtKpkc48a2MiPnkE/U88rjRQ0ZEi9DQZGHh9Zek2/xo8dWkgHDCtGo253U2uoFlvm727t8emrMK6t9ohEk0A/2MNU57e3JHigwtbqNx+Y3bprnFJ43jH/el0srBab3KT7e0OjRlfMpObMjKyOPFQZi9E43Tm3NuK5rbohRsdo7mzskqnKANVXLsp+t8bHl4hzbfMS7okIxUms9vdXufQkTgga9O3L/RkK8HQ6vT0xYsXH29vKSJKKZUG5Y6/9Z7isQmt+pNLaWPizJr2XxwiGt0aUmNO/7s29nu9mUWwruwBCUME8RgQ8jJRsp1qWSlcRzJYv/OX3xP8/DZPwv25qZmBWPN93xvHBsr7HbqMirx3aLaxsdE7tOmq9uqTsrmykuXl5bkj0zkjo3PQs1nLQoHQwK8APoABTXOz7//R/Mah8r5pMxCdZIzWOLQqrWANbfLnn34C2Lj01JNLy0/mVresDgnr88VlWmvxV6CMAEebSv9niVc+LS8fAI+nspvG2WOHysv7jnm93qGBzXrKHs89mSM+e/2zSyXLv7q4VZNEL1QaahuFyr1GpWpifn4CpTYOfKUEN5PAYKQi9lU4vZb41JxeExjCjpSXlx+aBbrf33dos96H2c9BGIPfBWHO8paMwNanwm/cq5yYAQE1+A+kGpFxoBjvEkt8e11aCjNwiCDKL6JQXhIcYFBnoYwg0wB+b3Kq9XBtg9R+dtf4+vIWzVZCe9xi72Aht7xOzAA2FAo4aEShUNOXLTiJv5tVIX//Jz8h/hFNOTO/LjpRwMQqEBFh4RZwcyz/J9TyfPunZvLu3eH3tlrnRYYVqA1VsL3infMKRAfgIgQy85BTDU+bNPP/nNFVE02c/4kweAcXS+dj/VBKgHVF90oH+vryZ7u13/KOb9vJ4TeN721lWaPJBfpCMfIxq5DgjDEKdcwmjLUiybPjE/MTySJ5L/UIiQhpeSQsWHnRfyCeE0RmyHskvz60mlbgW4eNw/99q5BE2iJtKNi4tDdptUiImj7DKJigkxb6Ei1n/dCyRCbECLQpinZM+O5TQg+sFxNjC/QL8NKf35DUa3kQ3gBGXttKaapEETEYCuNtGuq0xrOMxIj/nE2REhILEBknYItlZ4RyowMt2viudQhpfv+qWDzxToOwFdCyCSOHtSA/JAEjd7eK0FpEMzKVt2V/D1HR6jbpyOHLEiNMEM5L1HMhRInlHhO0xfTwCTvrHEsO5EyGsY19h4QF22N9fX2we6p/E4XA77yjgYzU1Od/DYLQdmwoxKS0erdJq4FDVI2S1thOhfSIGD+gxHLZNqlgJmmBq8tad22dMNssFcYeKUcbyvqJcsH15hGR6ZeJi1idCQ7uGb5bs8UCB9z/RnkKErC6TeLwNo1RNCQM95lNlJWQjaHVQb+amRTUac2CazRLOJm5ZuMFUVl/f//qIRimTWONEiP9Q8KiRmlFbf1hbHXuxeU5L1anM5lN771mNG3+tToMBk9vIRTmsFkam4jjxjXEiJ7+zClKC+OPBYNBQBQTQxrFIMNCLkHnmz6198gxuBA+1IcC137JrR55MvfkQ6BPrWZeu4L3z5V9uHwJxbOPideNxppNC9cjHs9CQSxqnVaTJIQUGXGe80sGRaFm1Ho9eFRi5DKeQtoZNa4if9tf3jcwhkklgWli7tLy8oeNh008DpLFz4mSsuUyVK59Y0kDGNl0w9ai7O6WPUe9WehgBv4Q1+i0NWtqELurObVkT5JQc370m07xkXmhiUZhEIl3GksSgh2ZK1t+UkLMvgO8LQj0lgRG4OvcJGkyGn3zD+ePquR7AQYL43Id0lw/0/Aw6a6r93KR+U5akcMHpAJFs8CM6HQa4RI+2aOuh6aBh5lOXugHg3nuU4CCst98LkyWXBEYGcImHmpQjGasMcL0KTKfW21uXijEVRwbzNIEu2F3reBIwVfrZGX4UEQw1TgI8fWhpTqH293ebm535DrPMa833e2WlpQsf3iprGz5FWnWZknZpRLi47XLyBZpjUbjc37IPmvPmWZakIXOWsmC6HTpJ6eSYwTNTgRZMRvbQQ9QaQmslpWVzP1RmLXpBloEGIkJUR8Skm/04vEj2xxFuJeokzRG686ogU/IMGKX9qZ1ru/kIx7PlSxfAoz8SiDeMU2ULQNGmMsW0dnf4/RJzscL3VuUMiFZvTHzdhkR+W7f9sjcU5ARQry+TW0pYGSOcIbUl8W5yLZQymQxoa3rrnuIBrdoQnRktjkYz2XkuzZCzRLLZZCRWxoY8ugaqoNzT+ZCcK4cHB5GnmVC/pQz8+d0bjbtY6HIIUWpJkdOlBSRMSM7PX5U2DvsJcqA4SghxirqdHBbo9p2LqRmFHpAiY2mGTqoUKeSbTOfLSODG/t1GeUKKUrV6WRipFxGcj3BFohS4t/7xBySEaHDwnLWznyGDIfeyYX8XIhjFGpJbZh7FlKT1e3XvG91InF6F25yy4TRlTJWZNuzJCtWofPtpZ4Sa2tDRNmlObjdW2BEzRAogVSo9QqnkwFkqJ1CJqVGl/PYtPViDyFcSALXmmWz8cpsM6JWs0flXigHWBrBFqibBCFyvUo8eQzJERhhGOBo9GrxsFBYGL8fmRKUHJDpS4Sdnfvme6Tp73mSiuwATU077RNjWMXh2tY6t0br3rSoMTRU+duAIUzMJSvPYmUaNsFa7jFMyRlbiPPr1Xo1+M/pDMLuRLUoImZ8hU/toR5nWZkP2BOYRRuSpyE1ixHGOUlPVD+thdDh/BKvhd017e1ut8NR1wpS/IxYZvr9PxmU1ktlxMWsilErUFTyOcZ27hxH6/WcP+T0h+jJoI2LOWmnHloROCt9Kb3jb2Jnc1+/O2pNuHBBmTzX8cpgRM0EYxGVCjCSTI/FLE+j0el0iCad2e2oA+QA1P89blAqAwSRszgBfQ3Jq5lYCafWM1yM8wf13BngcrgQcMGMgteYX7mNwz/Wdq94unuoWNLA0zI7TPIlLFcaI2ou5p93qQC0mYRkQiJHawoAQqznibmcmiLaWm+Bo2joUIibDMVsk/pQDDqcIK0fC/mJOt1tEh08syt0X9xvwwrPw2JP7bCsSchgxB+ZQIRUJ5nQylEiwQcro9anZMbvoB5YS0gPAhIGWNNgjONiQY6mnQqgNY2lV8awwyb0GbDEMAK87tFxmA9f2NgXB9zoeBNF7rWytjWNETstCAhUG9FhD2/CB4AVWJG43K6hdvis5RvgcP1qJ2cLhRg9Da9goYauDBFYK3wCrFS2bCxiM2gKffd+lZ3rNyleJe2I3T6uklAtqs2weFWrPCJyH1qRObnOAPQuckUNwTF+YExTRRiBEeGCa6hSWbXRi00IuXAhiiTZkBixz0y4knxcWQdiD2yFu86cIyUandakM5tJLf4AriYsy221E2b6kPxlRhFRO0OpjBcxcgVLxQSovC+oSnc3VjlOb7KpdJ8gMGKPrKfxcWX9ikqDCyWiOi26cguiAnChMbvrapEL/nc4esD6ouxAosPi+fKXWRcIWDNrdIgRcapJel2ud6MKo2dkjrbPgDGrPfKF60p1Gh/r1dXfJj1qfZ0bxSTA6dbWp7nwKGUAfuax3IpvrWiQecvT2EwqKFYnGWmQGeFR5QF/n22Hy3uHSoVdMe4CPABGqqvXr1yBNyE7j7d8a/cURRCyL6sTDTOchXU0abrVgvaw68mhJsnuv1JoQAqxViMHGnrc6ivr69UqIByADxWSlurtVM9GP7woG2BJk35goNzzFcuwDIDdRnM2WHlel+xqaklsxLOIjGrzhanCt4QfhQakGooGYEWUD5Xr+6VdbrEcA7OW3i+vP3/t27e/+h8Pf/vwz199/fVX16KSnTGl6Fxc7FbR49jiRnNvwXfbCBa1+i+AESAe1d+fDiwlI9rKpjZD4lEC4Uv089HVL9tErUrf+wfVZh4YkeYi2P8ruRhgTZF4yNOxMx2XfI1lccNDUYFAIhyIU+BfIhFPxD3NYva5xcC9QqFSlY7qatkX9VbtcFOQEG74HgA+ABNpgE1mUYGwPNcHLjgq0+moXs/pwxyBi48dgzvdcHkYtgP7EogFREk4SYon8DVc4tvuiOh9Rxoj61deyh72MNIxCHe292yMAmqiO4mxTVqS1PzPR0lKJEau/pX3QbvLa7dqsCkYOpOMXPnLSxfnstK2hSnUcLsIUo5F5Q4YcdcYh4eHzX9DlMQTEiNXr//IJ+Q8fDFfSN2V0ppqVVZeUeVJtiB37KCDv2EYXihtmDT/7So0HnGRkQTv84mpo7b4RiumkGlcs3xNm9jV0dXVvYNMHV05DjCC+66LaoNMyg99/PP/pEWlouJVGghXBiVyryjFBmUH3DblUaRaJCMmwMhJT8rRBP7248R1o1CYMxU1I+lCUl2d3dwB1x67B3tlJKS5J3dqoIBakyAiOH7S4/E8+s35MAjOwgnKc80EVAlOVtfKl32LBSlLolp/OlvBO3pamjGrMrMFqBTy1LW4kKcwWqvVDg8LFpQaHJqefel/HT9BEETi2ctGnZkv4vBMQqdUGnHjWk12HN3lobqx0cytYgvdaCDUoqcLiJBMw2WtFieTdVQBpY1j/d5bpMbM8+QKyRdrNCJBiOPbYc9Nrsm7sFEKw/gWLLV237tAQeJaABnNvZ7c49VLFevM5jVMxwNCzCvJaKSruaWlpwhSmVx0AvlwaLNSdAk9QsDadiFtsCaFGEGTjDwyW4SSl5HO3PtZ8drKysrSm/wKroNmpHnKszAYXZTb9ltwVFavk1Kbq+yOXiglG2ntlc0B8UYTJmdzpVQvi1/wsJnU6KC3qcCapgI9rvGZmfmGwWK8qp53VappyE3F7+6B+zs60hNgqYoh35Wbh5H6ZGnfjHV72qr19Lyqep492rNvnSM7glRslxniVKrMnUSLEMUo2XNpkOxI5nJzmnnp3uiZh/1/PdGeysh8j4wtKjAq6usdGrk/q4BArj9pa8HaoFmVtYsNkgrqMuhNMuL7eqN7XgH4MCjbpqIY68qctl1wNLS2m2pqaiQhkXGMzbm60XB9lMJKPfLJTkVS4DKKIFKNHrd4eiYUIHmkoAGhuiYiTRu7cia7gopaB9xbokVBt4DtvE3FsuzTGDbaIz85zywxkuHLJUZ81hYXW9m80QJbjLFoFFN0Lhaw4tzY//eO3uhgc31tbZ3DbdYJThf2rYuM6LYTYMP2NWFy5GKTjJy0i4yY5Bjx/exnLnv1oKerM8ICW9JFYeMTbQUcAjZLBOAormd9sBkkbSPFsCQk27pGHtqPZId/4ja5be3tUnNkBrvCMo3vvtVHHx31lE6wE1gnOEZg5Oh8dx7bvR/w/gFeCtJgwbNAaod1pJncJiOoxRH4TRinyLgbyZebMtZzBEZOek7S810bXQj8ERwAAAPjSURBVBN2WHkYn8A6WqpnSgtoSKbjgBHDNV82IyBu0uBwt1WebqRMoOZx9RpUGLk6gbQ+kbnvCjHi++gHZ9ewqZZqVpgePI61DVbPYIVjZPp0AInIK7J9EDpei29rqKTQ9cnmi6ykdc7MMWri4iZ+9unmQKfYaq4CjESrI5incKH879CVU3+8BEQC9k8lodWatGZHa/02Ey8kJGy+ZuBaH7piNH4vYzZNq7Sy1dpVFRE78SQZKRwjjZeA0lgNf1zRke1uh4S63EbErYAsCZ3nyWBo7ew333xD+zOqLUlGQJQiVS+PzoPMCNAiH+rtB7xvWZXhuPLf6rZ/1VUZHJ0RNr+yeTpgPgg5/RzHKbhMRkStMaV99vwEttA8P19AO/KXsFVpDcTPf6+DqMQJDKmdOFn4OOQHjPjpYEYhu1W83LglzQONqzDryIyqi8o+xL7heEAZOB8IvP+9Biyn+vnybMWZD4VCwWCQ82c8+sU39y6TJHn5m7R1soiriWrSdzYXbLhi4xPUg/qJd/Z7LZiMJxv65PfirHMMwzmZrG0YoSANBCfEOftTH+6q7KJcNNYrW+vfD4z9BkYjN/ox7/cb1T4v6Q0rOwZwjLNxITrbzHCQES4Wck570+xoaTcwIwWaJwFE5PGLVqXBsAsbwlwzLJvfkjS/9eitb20KNnOD4hchJ5CRWCzUmNkUXIl1F86MjIEYntqdYkTlPNoUzMpty1y4epO6usaw/5rxqAvZluCZKzl/kYVCTJQQMPui1WDYtWDIheb+yDzxd9hP9IHtz29l6NQ8q1f4/cEzX2S/vKqQNbTfGXZ3vpYqwkZyHqz8JBFOeD79xpPh5Mce2hVq27eGt3IvVlHIFYqhhGeXy7yu3L7csX+Ih8Px+JeJdP0s/fLPNgXzwUYiES+uS5K07L6fm892wf2JcDgQvxnwpEuDN5EI2WzfJigqUQRj8fYYWR64K0BBEaEoz720qKcyEfjyT/87CPTp6ifFJSR7jd8/Ay8ITJ2/6TE8ZNPcbOlV2Jf31V+pQIIqwlW8vcP/2RCazxLh6zTLpQlDM2ol8YTDCSqx5aWR/l/CqNXjAeeeSNxgnV+ka8eg0FwTPh8OhAPF0gS/H4iwb3997Vnl1Av28UyfWvvAcONnHiocD8MurPgnRXTNxb0Fpw464YYAVp9lPr/gwINrN4BCnQdmhvIkCvP99h8T/hBIelk7q8ra0bjO2RmGXfNQgTC8Nge1UXRXfNorjHnhPowv1nPKDeu/DP3yCutIXPVcBcrz/Ac5wfx/THzMrn39wtcPgQJx/7GCkrxo/OJt7u23vwBStGuH/L+kMyCAQtzVzwAAAABJRU5ErkJggg==" 
                                maxW="450px" 
                                fallbackSrc="https://img.freepik.com/free-vector/stadium-isometric-concept_1284-15024.jpg"
                            />
                        </MotionBox>

                        <MotionBox 
                            position="absolute" top="-20px" right="-30px" p={4} borderRadius="2xl" 
                            bg={neumorphBg} boxShadow={neumorphShadow}
                            animate={{ y: [0, 10, 0] }} transition={{ duration: 3, repeat: Infinity }}
                        >
                            <HStack><Icon as={FaMapMarkedAlt} color="green.400"/><Text fontWeight="900" fontSize="xs" color={textColor}>BẢN ĐỒ SỐNG ĐỘNG</Text></HStack>
                        </MotionBox>

                        <MotionBox 
                            position="absolute" bottom="40px" left="-50px" p={4} borderRadius="2xl" 
                            bg={neumorphBg} boxShadow={neumorphShadow}
                            animate={{ y: [0, -12, 0] }} transition={{ duration: 5, repeat: Infinity }}
                        >
                            <HStack><Icon as={FaBolt} color="yellow.400"/><Text fontWeight="900" fontSize="xs" color={textColor}>ĐẶT SÂN 30 GIÂY</Text></HStack>
                        </MotionBox>
                    </Box>

                    <HStack spacing={4}>
                        <Tag size="lg" borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow} p={3} fontWeight="bold" color="gray.500">#1 UY TÍN</Tag>
                        <Tag size="lg" borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow} p={3} fontWeight="bold" color="gray.500">TẠO TÀI KHOẢN DỄ DÀNG</Tag>
                    </HStack>
                </VStack>

                <Box position="absolute" top="-10%" left="-10%" boxSize="400px" borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow} opacity={0.4} zIndex={1}/>
                <Box position="absolute" bottom="-5%" right="5%" boxSize="200px" borderRadius="full" bg={neumorphBg} boxShadow={neumorphActiveShadow} opacity={0.3} zIndex={1}/>
            </Flex>

            {/* BÊN PHẢI: FORM */}
            <Flex w={formWidth} align="center" justify="center" p={4} overflowY="auto">
                <Container maxW="md">
                    <MotionBox 
                        bg={neumorphBg} p={{ base: 8, md: 10 }} borderRadius="3xl" boxShadow={neumorphShadow}
                        variants={cardVariants} initial="hidden" animate="visible" exit="exit"
                    >
                        <Stack spacing={8}>
                            <Stack spacing={4} align="center">
                                {config.logo_url ? (
                                    <Box p={3} borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow}>
                                        <Image src={getImgUrl(config.logo_url)} h="60px" w="60px" borderRadius="full" objectFit="cover" />
                                    </Box>
                                ) : (
                                    <Box p={4} borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow}>
                                        <Icon as={FaRunning} boxSize={8} color="blue.500"/>
                                    </Box>
                                )}

                                {view !== 'forgot' ? (
                                    <HStack spacing={2} p={1} bg={neumorphBg} borderRadius="2xl" boxShadow={neumorphActiveShadow}>
                                        <Button variant="ghost" borderRadius="xl" px={8} color={view === 'login' ? "blue.500" : labelColor} bg={view === 'login' ? neumorphBg : "transparent"} boxShadow={view === 'login' ? neumorphShadow : "none"} onClick={() => setView('login')}>ĐĂNG NHẬP</Button>
                                        <Button variant="ghost" borderRadius="xl" px={8} color={view === 'register' ? "blue.500" : labelColor} bg={view === 'register' ? neumorphBg : "transparent"} boxShadow={view === 'register' ? neumorphShadow : "none"} onClick={() => setView('register')}>ĐĂNG KÝ</Button>
                                    </HStack>
                                ) : (
                                    <HStack w="full">
                                        <IconButton icon={<ArrowBackIcon/>} isRound bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} onClick={() => setView('login')} border="none"/>
                                        <Spacer/><Text fontWeight="900" color={textColor}>KHÔI PHỤC MẬT KHẨU</Text><Spacer/>
                                    </HStack>
                                )}
                            </Stack>

                            <form onSubmit={handleSubmit}>
                                <AnimatePresence mode='wait'>
                                    <MotionBox key={view + forgotStep} variants={staggerContainer} initial="hidden" animate="show" exit="hidden">
                                        <Stack spacing={5}>
                                            {view === 'login' && (
                                                <>
                                                    <MotionBox variants={staggerItem}>
                                                        <FormControl isRequired isInvalid={errors.username}>
                                                            <FormLabel fontSize="xs" fontWeight="900" color={labelColor} ml={2}>TÀI KHOẢN</FormLabel>
                                                            <InputGroup>
                                                                <InputLeftElement h="full" children={<Icon as={FaUser} color="blue.400"/>} />
                                                                <Input value={formData.username} onChange={e => setFormData({...formData, username:e.target.value})} placeholder="Tên đăng nhập" {...inputStyle}/>
                                                            </InputGroup>
                                                        </FormControl>
                                                    </MotionBox>
                                                    <MotionBox variants={staggerItem}>
                                                        <FormControl isRequired isInvalid={errors.password}>
                                                            <FormLabel fontSize="xs" fontWeight="900" color={labelColor} ml={2}>MẬT KHẨU</FormLabel>
                                                            <InputGroup>
                                                                <InputLeftElement h="full" children={<Icon as={FaLock} color="blue.400"/>} />
                                                                <Input type={showPassword?'text':'password'} value={formData.password} onChange={e => setFormData({...formData, password:e.target.value})} placeholder="••••••••" {...inputStyle} />
                                                                <InputRightElement h="full"><IconButton variant="ghost" size="sm" onClick={()=>setShowPassword(!showPassword)} icon={showPassword?<ViewIcon/>:<ViewOffIcon/>} isRound/></InputRightElement>
                                                            </InputGroup>
                                                        </FormControl>
                                                    </MotionBox>
                                                    <Flex justify="flex-end"><Link color="blue.400" fontSize="xs" fontWeight="900" onClick={()=>setView('forgot')}>QUÊN MẬT KHẨU?</Link></Flex>
                                                    <MotionButton type="submit" h="60px" borderRadius="2xl" colorScheme="blue" bgGradient="linear(to-r, blue.400, blue.600)" color="white" boxShadow="xl" _active={{ transform: 'scale(0.98)' }} fontWeight="900" fontSize="md" isLoading={isLoading} border="none">BẮT ĐẦU NGAY</MotionButton>
                                                </>
                                            )}

                                            {view === 'register' && (
                                                <>
                                                    <MotionBox variants={staggerItem}><Input placeholder="Tên đăng nhập" value={formData.username} onChange={e=>setFormData({...formData, username:e.target.value})} {...inputStyle}/></MotionBox>
                                                    <MotionBox variants={staggerItem}><Input placeholder="Họ và tên" value={formData.full_name} onChange={e=>setFormData({...formData, full_name:e.target.value})} {...inputStyle}/></MotionBox>
                                                    <MotionBox variants={staggerItem}><Input placeholder="Email" type="email" value={formData.email} onChange={e=>setFormData({...formData, email:e.target.value})} {...inputStyle}/></MotionBox>
                                                    <MotionBox variants={staggerItem}>
                                                        <Input type="password" placeholder="Mật khẩu" value={formData.password} onChange={e=>setFormData({...formData, password:e.target.value})} {...inputStyle}/>
                                                        {formData.password.length > 0 && <Progress value={formData.password.length * 10} size="xs" borderRadius="full" mt={3} colorScheme="blue" bg="gray.200"/>}
                                                    </MotionBox>
                                                    <MotionButton type="submit" h="60px" borderRadius="2xl" colorScheme="blue" bgGradient="linear(to-r, blue.400, blue.600)" color="white" boxShadow="xl" _active={{ transform: 'scale(0.98)' }} fontWeight="900" border="none" isLoading={isLoading}>ĐĂNG KÝ THÀNH VIÊN</MotionButton>
                                                </>
                                            )}

                                            {view === 'forgot' && (
                                                <Stack spacing={4}>
                                                    {forgotStep === 1 ? (
                                                        <Input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="Email đã đăng ký" {...inputStyle}/>
                                                    ) : (
                                                        <>
                                                            <Input value={forgotCode} onChange={e => setForgotCode(e.target.value)} placeholder="Mã OTP" textAlign="center" letterSpacing="5px" {...inputStyle}/>
                                                            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mật khẩu mới" {...inputStyle}/>
                                                            <Text color="blue.500" fontSize="xs" textAlign="center" fontWeight="900">Mã hết hạn sau: {formatTime(timeLeft)}</Text>
                                                        </>
                                                    )}
                                                    <Button h="60px" borderRadius="2xl" colorScheme="blue" bgGradient="linear(to-r, blue.400, blue.600)" color="white" boxShadow="xl" _active={{ transform: 'scale(0.98)' }} onClick={forgotStep === 1 ? handleSendCode : handleResetPassword} isLoading={isLoading} border="none" fontWeight="900">
                                                        {forgotStep === 1 ? 'GỬI MÃ OTP' : 'XÁC NHẬN ĐỔI MẬT KHẨU'}
                                                    </Button>
                                                </Stack>
                                            )}
                                        </Stack>
                                    </MotionBox>
                                </AnimatePresence>
                            </form>

                            {view !== 'forgot' && (
                                <VStack spacing={4}>
                                    <HStack w="full"><Divider borderColor={dividerColor} /><Text fontSize="xs" fontWeight="900" color="gray.400" whiteSpace="nowrap">HOẶC TIẾP TỤC VỚI</Text><Divider borderColor={dividerColor} /></HStack>
                                    <HStack spacing={4} w="full">
                                        <IconButton icon={<FaGoogle/>} isRound bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} color="red.500" flex="1" h="55px" border="none" onClick={() => handleSocialLogin('google')}/>
                                        <IconButton icon={<FaFacebook/>} isRound bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} color="blue.600" flex="1" h="55px" border="none" onClick={() => handleSocialLogin('facebook')}/>
                                    </HStack>
                                    
                                    <Divider borderColor={dividerColor} />
                                    
                                    <Button 
                                        variant="ghost" w="full" h="55px" borderRadius="2xl" leftIcon={<FaHandshake/>} 
                                        bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                        color="orange.500" fontWeight="900" onClick={() => navigate('/partner-register')} border="none"
                                    >
                                        TRỞ THÀNH CHỦ SÂN
                                    </Button>
                                </VStack>
                            )}
                        </Stack>
                    </MotionBox>
                    
                </Container>
            </Flex>
        </Flex>
    );
}