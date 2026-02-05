import React, { useState } from 'react';
import { 
    Box, Button, FormControl, FormLabel, Input, VStack, Heading, Text, useToast, Container,
    InputGroup, InputRightElement, Icon, useColorModeValue 
} from '@chakra-ui/react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ViewIcon, ViewOffIcon, ArrowBackIcon } from '@chakra-ui/icons';
import { FaEnvelope, FaKey } from 'react-icons/fa';

export default function ForgotPasswordPage() {
    const [step, setStep] = useState(1); // Step 1: Nhập Email, Step 2: Nhập Code & Pass
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const toast = useToast();
    const navigate = useNavigate();
    const bg = useColorModeValue('gray.50', 'gray.900');
    const cardBg = useColorModeValue('white', 'gray.800');

    // Gửi mã về Email
    const handleSendCode = async () => {
        if (!email) return toast({ title: "Vui lòng nhập Email", status: "warning" });
        setIsLoading(true);
        try {
            const res = await axios.post('http://localhost:5000/api/forgot-password', { email });
            toast({ title: "Thành công", description: res.data.message, status: "success" });
            setStep(2); // Chuyển sang bước 2
        } catch (err) {
            toast({ title: "Lỗi", description: err.response?.data?.message || "Lỗi server", status: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    // Đổi mật khẩu
    const handleResetPassword = async () => {
        if (!code || !newPassword) return toast({ title: "Vui lòng nhập đủ thông tin", status: "warning" });
        setIsLoading(true);
        try {
            const res = await axios.post('http://localhost:5000/api/reset-password', { email, code, newPassword });
            toast({ title: "Thành công", description: res.data.message, status: "success" });
            navigate('/login'); // Chuyển về trang đăng nhập
        } catch (err) {
            toast({ title: "Thất bại", description: err.response?.data?.message || "Lỗi server", status: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box minH="100vh" bg={bg} display="flex" alignItems="center" justify="center" px={4}>
            <Container maxW="md" bg={cardBg} p={8} borderRadius="xl" shadow="xl">
                <VStack spacing={6}>
                    <Heading size="lg" color="blue.600">Khôi phục mật khẩu</Heading>
                    
                    {step === 1 ? (
                        <>
                            <Text textAlign="center" color="gray.500">Nhập email bạn đã đăng ký để nhận mã xác thực.</Text>
                            <FormControl>
                                <FormLabel>Email đăng ký</FormLabel>
                                <InputGroup>
                                    <Input 
                                        type="email" 
                                        placeholder="example@gmail.com" 
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)} 
                                    />
                                    <InputRightElement children={<Icon as={FaEnvelope} color="gray.400"/>} />
                                </InputGroup>
                            </FormControl>
                            <Button 
                                colorScheme="blue" 
                                w="100%" 
                                onClick={handleSendCode} 
                                isLoading={isLoading}
                            >
                                Gửi mã xác nhận
                            </Button>
                        </>
                    ) : (
                        <>
                            <Text textAlign="center" color="green.500">Mã xác nhận đã được gửi tới <b>{email}</b></Text>
                            
                            <FormControl isRequired>
                                <FormLabel>Mã xác nhận (6 số)</FormLabel>
                                <Input 
                                    placeholder="123456" 
                                    value={code} 
                                    onChange={(e) => setCode(e.target.value)} 
                                    textAlign="center"
                                    letterSpacing="4px"
                                    fontWeight="bold"
                                />
                            </FormControl>

                            <FormControl isRequired>
                                <FormLabel>Mật khẩu mới</FormLabel>
                                <InputGroup>
                                    <Input 
                                        type={showPassword ? "text" : "password"} 
                                        placeholder="Nhập mật khẩu mới" 
                                        value={newPassword} 
                                        onChange={(e) => setNewPassword(e.target.value)} 
                                    />
                                    <InputRightElement width="4.5rem">
                                        <Button h="1.75rem" size="sm" onClick={() => setShowPassword(!showPassword)}>
                                            {showPassword ? <ViewIcon /> : <ViewOffIcon />}
                                        </Button>
                                    </InputRightElement>
                                </InputGroup>
                            </FormControl>

                            <Button 
                                colorScheme="green" 
                                w="100%" 
                                onClick={handleResetPassword} 
                                isLoading={isLoading}
                            >
                                Đổi mật khẩu
                            </Button>
                            
                            <Button variant="link" size="sm" onClick={() => setStep(1)}>Gửi lại mã?</Button>
                        </>
                    )}

                    <Button variant="ghost" leftIcon={<ArrowBackIcon />} onClick={() => navigate('/login')}>
                        Quay lại đăng nhập
                    </Button>
                </VStack>
            </Container>
        </Box>
    );
}