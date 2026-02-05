import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Box, Container, Heading, SimpleGrid, GridItem, Stat, StatLabel, StatNumber, VStack, Avatar, IconButton, Divider, FormControl, FormLabel, Input, InputGroup, InputRightElement, Button, useToast , Badge , HStack } from '@chakra-ui/react';
import { FaCamera, FaPhone, FaFacebook, FaCheck } from 'react-icons/fa';
import { SiZalo } from 'react-icons/si';
import { Bar } from 'react-chartjs-2';
import { getImgUrl } from './MapTools';

const StatsProfileTab = ({ stats, user, setUser, isMobile }) => {
    const [profileData, setProfileData] = useState({ phone_number: user?.phone_number || '', facebook_url: user?.facebook_url || '', zalo_url: user?.zalo_url || '', open_time: user?.open_time || '06:00', close_time: user?.close_time || '22:00' });
    const [uploading, setUploading] = useState(false);
    const toast = useToast();
    const fileInputRef = useRef();

    const handleUpdate = async () => { try { await axios.put(`http://localhost:5000/api/users/${user.id}/profile`, profileData); setUser({ ...user, ...profileData }); toast({ title: 'Cập nhật thành công', status: 'success' }); } catch { toast({ title: 'Lỗi', status: 'error' }); } };
    const handleAvatar = async (e) => { 
        const file = e.target.files[0]; if(!file) return; setUploading(true); const fd = new FormData(); fd.append('image', file);
        try { const res = await axios.post('http://localhost:5000/api/upload', fd); await axios.put(`http://localhost:5000/api/users/${user.id}/avatar`, {avatar_url: res.data.url}); setUser({...user, avatar: res.data.url}); toast({title:'Xong', status:'success'}); } catch {} finally {setUploading(false);}
    };
    const chartConfig = { labels: stats.daily?.map(d => d.day) || [], datasets: [{ label: 'Doanh thu', data: stats.daily?.map(d => d.revenue) || [], backgroundColor: '#38A169', borderRadius: 6 }] };

    return (
        <Box h="100%" overflowY="auto" p={isMobile ? 2 : 8} px={0}>
            <Container maxW="container.xl">
                <Heading size="lg" mb={6}>📊 Thống kê & Hồ sơ</Heading>
                <SimpleGrid columns={{base: 1, lg: 3}} spacing={6}>
                    <GridItem colSpan={{base: 1, lg: 2}}>
                        <SimpleGrid columns={2} spacing={6} mb={6}><Stat bg="white" p={6} borderRadius="2xl" shadow="md"><StatLabel>Doanh thu</StatLabel><StatNumber color="green.600">{parseInt(stats.summary.total_revenue || 0).toLocaleString()} đ</StatNumber></Stat><Stat bg="white" p={6} borderRadius="2xl" shadow="md"><StatLabel>Đơn đặt</StatLabel><StatNumber color="blue.600">{stats.summary.total_bookings || 0}</StatNumber></Stat></SimpleGrid>
                        <Box bg="white" p={6} borderRadius="2xl" shadow="md" h="400px"><Bar data={chartConfig} options={{ maintainAspectRatio: false }} /></Box>
                    </GridItem>
                    <GridItem>
                        <Box bg="white" p={6} borderRadius="2xl" shadow="md">
                            <VStack align="center" spacing={4} mb={6}><Box position="relative"><Avatar size="2xl" src={getImgUrl(user?.avatar)} /><IconButton icon={<FaCamera/>} isRound size="sm" position="absolute" bottom={0} right={0} onClick={() => fileInputRef.current.click()} isLoading={uploading}/><input type="file" ref={fileInputRef} style={{display:'none'}} onChange={handleAvatar}/></Box><Heading size="md">{user?.full_name}</Heading><Badge colorScheme="purple">CHỦ SÂN</Badge></VStack><Divider mb={6}/>
                            <VStack spacing={4} align="stretch"><HStack><FormControl><FormLabel fontSize="xs">MỞ</FormLabel><Input type="time" value={profileData.open_time} onChange={e=>setProfileData({...profileData, open_time: e.target.value})} /></FormControl><FormControl><FormLabel fontSize="xs">ĐÓNG</FormLabel><Input type="time" value={profileData.close_time} onChange={e=>setProfileData({...profileData, close_time: e.target.value})} /></FormControl></HStack><InputGroup><InputRightElement children={<FaPhone color="gray"/>}/><Input value={profileData.phone_number} onChange={e=>setProfileData({...profileData, phone_number: e.target.value})} /></InputGroup><InputGroup><InputRightElement children={<FaFacebook color="blue"/>}/><Input value={profileData.facebook_url} onChange={e=>setProfileData({...profileData, facebook_url: e.target.value})} /></InputGroup><InputGroup><InputRightElement children={<SiZalo color="blue"/>}/><Input value={profileData.zalo_url} onChange={e=>setProfileData({...profileData, zalo_url: e.target.value})} /></InputGroup><Button colorScheme="purple" w="100%" onClick={handleUpdate} leftIcon={<FaCheck/>}>LƯU THÔNG TIN</Button></VStack>
                        </Box>
                    </GridItem>
                </SimpleGrid>
            </Container>
        </Box>
    );
};
export default StatsProfileTab;