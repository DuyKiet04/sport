import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Checkbox,
    Container,
    Flex,
    FormControl,
    FormLabel,
    Heading,
    HStack,
    Input,
    InputGroup,
    InputLeftElement,
    InputRightElement,
    Stack,
    Text,
    useColorModeValue,
    useToast,
    Icon,
    Image,
    VStack,
    useBreakpointValue,
    Link
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon, ArrowBackIcon } from '@chakra-ui/icons';
import { FaUser, FaLock, FaIdCard, FaRunning } from 'react-icons/fa'; // Cần cài: npm install react-icons
import { motion, AnimatePresence } from 'framer-motion';

// Tạo component Motion để có hiệu ứng animation
const MotionBox = motion(Box);

// --- HELPERS ---
const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `http://localhost:5000/${url.startsWith('/') ? url.substring(1) : url}`;
};

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const toast = useToast();
    const navigate = useNavigate();
    const [config, setConfig] = useState({});

    useEffect(() => {
    axios.get('http://localhost:5000/api/config')
    .then(res => setConfig(res.data || {}))
    .catch(() => {});
    }, []);

    // Responsive layout values
    const formWidth = useBreakpointValue({ base: "100%", md: "50%", lg: "40%" });
    const bgImageDisplay = useBreakpointValue({ base: "none", md: "block" });

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_name: '',
        role: 'user'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const url = isLogin
            ? 'http://localhost:5000/api/login'
            : 'http://localhost:5000/api/register';

        try {
            const res = await axios.post(url, formData);

            if (isLogin) {
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data.user));

                toast({
                    title: 'Đăng nhập thành công!',
                    description: `Chào mừng ${res.data.user.name || 'bạn'} quay trở lại!`,
                    status: 'success',
                    duration: 3000,
                    isClosable: true,
                    position: 'top-right',
                });

                if (res.data.user.role === 'super_admin') navigate('/super-admin');
                else if (res.data.user.role === 'vendor') navigate('/admin');
                else navigate('/');
                
                window.location.reload();
            } else {
                toast({
                    title: 'Đăng ký thành công!',
                    description: "Tài khoản đã được tạo. Vui lòng đăng nhập.",
                    status: 'success',
                    duration: 3000,
                    isClosable: true,
                    position: 'top-right',
                });
                setIsLogin(true);
                setFormData({ username: '', password: '', full_name: '', role: 'user' });
            }
        } catch (err) {
            const errorMsg = err.response?.data?.error || "Lỗi kết nối Server";
            toast({
                title: 'Thất bại',
                description: errorMsg,
                status: 'error',
                duration: 3000,
                isClosable: true,
                position: 'top',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Flex minH="100vh" bg={useColorModeValue('gray.50', 'gray.900')}>
            {/* --- PHẦN HÌNH ẢNH (Bên trái - Chỉ hiện trên Desktop) --- */}
            <Box
                display={bgImageDisplay}
                flex="1"
                position="relative"
                bgGradient="linear(to-br, green.400, teal.600)"
            >
                <Image
                    src="https://tntenglish.vn/wp-content/uploads/2022/11/sports-tools-scaled.jpg" // Hình sân cỏ đẹp
                    objectFit="cover"
                    w="full"
                    h="full"
                    opacity={0.4}
                />
                <Box position="absolute" top="0" left="0" w="full" h="full" bgGradient="linear(to-b, transparent 0%, blackAlpha.600 100%)" />
                
                <VStack 
                    position="absolute" 
                    bottom="10%" 
                    left="10%" 
                    align="start" 
                    spacing={4} 
                    color="white"
                    maxW="lg"
                >
                    <Heading size="2xl" fontWeight="bold">Sport Booking</Heading>
                    <Text fontSize="xl" fontWeight="medium">
                        Nền tảng đặt sân thể thao hiện đại & nhanh chóng nhất.
                        Kết nối đam mê, rèn luyện sức khỏe ngay hôm nay.
                    </Text>
                </VStack>
            </Box>

            {/* --- PHẦN FORM (Bên phải - Full màn hình trên Mobile) --- */}
            <Flex
                w={formWidth}
                align="center"
                justify="center"
                p={{ base: 4, md: 8 }}
                bg={useColorModeValue('white', 'gray.800')}
            >
                <Container maxW="md">
                    <Stack spacing={8}>
                        
                        {/* Header của Form */}
                        <Stack spacing={2} textAlign="center">
                            <MotionBox
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.5 }}
                            >
                                {config.logo_url ? (
                                    <Image
                                        src={getImgUrl(config.logo_url)}
                                        h="64px"
                                        mx="auto"
                                        objectFit="cover"
                                    />    
                                ) :(
                                    <Text fontSize="5xl">🏟️</Text>
                                )

                                }
                            </MotionBox>
                            <Heading fontSize={'2xl'} color="green.600">
                                {isLogin ? 'Chào mừng trở lại!' : 'Tạo tài khoản mới'}
                            </Heading>
                            <Text fontSize={'md'} color={'gray.500'}>
                                {isLogin ? 'Đăng nhập để đặt sân ngay 👇' : 'Tham gia cộng đồng thể thao 👇'}
                            </Text>
                        </Stack>

                        {/* Form Area với Animation chuyển đổi */}
                        <Box
                            rounded={'2xl'}
                            bg={useColorModeValue('white', 'gray.700')}
                            boxShadow={'xl'}
                            p={8}
                            as="form"
                            onSubmit={handleSubmit}
                            border="1px solid"
                            borderColor="gray.100"
                        >
                            <AnimatePresence mode='wait'>
                                <MotionBox
                                    key={isLogin ? "login" : "register"}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Stack spacing={4}>
                                        <FormControl isRequired>
                                            <FormLabel>Tên đăng nhập</FormLabel>
                                            <InputGroup>
                                                <InputLeftElement pointerEvents="none" children={<Icon as={FaUser} color="gray.400" />} />
                                                <Input 
                                                    type="text" 
                                                    value={formData.username}
                                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                                    focusBorderColor="green.500"
                                                    placeholder="Ví dụ: abc_123@"
                                                />
                                            </InputGroup>
                                        </FormControl>

                                        {!isLogin && (
                                            <FormControl isRequired>
                                                <FormLabel>Họ và tên</FormLabel>
                                                <InputGroup>
                                                    <InputLeftElement pointerEvents="none" children={<Icon as={FaIdCard} color="gray.400" />} />
                                                    <Input 
                                                        type="text" 
                                                        value={formData.full_name}
                                                        onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                                        focusBorderColor="green.500"
                                                        placeholder="Ví dụ: Nguyễn Duy Abc"
                                                    />
                                                </InputGroup>
                                            </FormControl>
                                        )}

                                        <FormControl isRequired>
                                            <FormLabel>Mật khẩu</FormLabel>
                                            <InputGroup>
                                                <InputLeftElement pointerEvents="none" children={<Icon as={FaLock} color="gray.400" />} />
                                                <Input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={formData.password}
                                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                    focusBorderColor="green.500"
                                                    placeholder="••••••••"
                                                />
                                                <InputRightElement width="4.5rem">
                                                    <Button h="1.75rem" size="sm" onClick={() => setShowPassword(!showPassword)} variant="ghost">
                                                        {showPassword ? <ViewIcon /> : <ViewOffIcon />}
                                                    </Button>
                                                </InputRightElement>
                                            </InputGroup>
                                        </FormControl>

                                        {/* Checkbox Vendor được style lại đẹp hơn */}
                                        {!isLogin && (
                                            <Box
                                                as="label"
                                                cursor="pointer"
                                                borderWidth="1px"
                                                borderRadius="lg"
                                                p={3}
                                                bg={formData.role === 'vendor' ? 'green.50' : 'transparent'}
                                                borderColor={formData.role === 'vendor' ? 'green.500' : 'gray.200'}
                                                _hover={{ borderColor: 'green.400' }}
                                                transition="all 0.2s"
                                            >
                                                <HStack>
                                                    <Checkbox
                                                        colorScheme="green"
                                                        isChecked={formData.role === 'vendor'}
                                                        onChange={e => setFormData({ ...formData, role: e.target.checked ? 'vendor' : 'user' })}
                                                    />
                                                    <Box>
                                                        <Text fontWeight="bold" fontSize="sm" color="gray.700">Đăng ký làm Chủ Sân (Vendor)</Text>
                                                        <Text fontSize="xs" color="gray.500">Tôi muốn đăng bài cho thuê sân bãi</Text>
                                                    </Box>
                                                    <Icon as={FaRunning} boxSize={5} color="green.500" ml="auto" />
                                                </HStack>
                                            </Box>
                                        )}

                                        <Stack spacing={5} pt={2}>
                                            <Button
                                                type="submit"
                                                loadingText="Đang xử lý"
                                                size="lg"
                                                bgGradient="linear(to-r, green.400, teal.500)"
                                                color={'white'}
                                                _hover={{
                                                    bgGradient: 'linear(to-r, green.500, teal.600)',
                                                    boxShadow: 'lg',
                                                }}
                                                isLoading={isLoading}
                                                rounded={'xl'}
                                            >
                                                {isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
                                            </Button>
                                        </Stack>

                                        <Stack pt={4} direction={{ base: 'column', sm: 'row' }} align={'start'} justify={'space-between'}>
                                            <Text color={'gray.500'}>
                                                {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
                                                <Link 
                                                    as="span" 
                                                    color={'green.500'} 
                                                    fontWeight="bold" 
                                                    ml={1} 
                                                    cursor="pointer"
                                                    onClick={() => {
                                                        setIsLogin(!isLogin);
                                                        setFormData({ username: '', password: '', full_name: '', role: 'user' });
                                                    }}
                                                >
                                                    {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
                                                </Link>
                                            </Text>
                                        </Stack>
                                    </Stack>
                                </MotionBox>
                            </AnimatePresence>
                        </Box>
                        
                        <Button
                            variant="link"
                            leftIcon={<ArrowBackIcon />}
                            color="gray.500"
                            onClick={() => navigate('/')}
                            size="sm"
                        >
                            Quay lại trang chủ
                        </Button>
                    </Stack>
                </Container>
            </Flex>
        </Flex>
    );
}