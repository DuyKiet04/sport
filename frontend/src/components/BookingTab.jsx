import React from 'react';
import axios from 'axios';
import { Box, Container, Heading, Card, CardBody, Table, Thead, Tbody, Tr, Th, Td, HStack, Avatar, Text, Badge, IconButton, useColorModeValue, useToast } from '@chakra-ui/react';
import { FaCheck, FaTimes, FaTrash } from 'react-icons/fa';
import { getImgUrl } from './MapTools';

const BookingTab = ({ bookings, user, fetchData, isMobile }) => {
    const toast = useToast();
    const bgHeader = useColorModeValue('gray.50', 'gray.700');
    const handleDelete = async (id) => { if(window.confirm("Xóa vé vĩnh viễn?")) { try { await axios.delete(`http://localhost:5000/api/vendor/bookings/${id}`, { data: { owner_id: user.id } }); fetchData(); } catch { toast({title:"Lỗi", status:"error"}); } } };
    const handleAction = async (id, action) => { try { await axios.put(`http://localhost:5000/api/bookings/${id}/${action}`); fetchData(); } catch {} };

    return (
        <Box h="100%" overflowY="auto" p={isMobile ? 2 : 8} px={0} css={{scrollbarWidth: "none"}}>
            <Container maxW="container.xl">
                <Heading size="lg" mb={6}>📅 Quản lý Lịch Đặt</Heading>
                <Card shadow="lg" borderRadius="2xl" overflow="hidden"><CardBody p={0}><Table variant="simple" size="md">
                    <Thead bg={bgHeader}><Tr><Th>Khách</Th><Th>Sân</Th><Th>Ngày/Giờ</Th><Th>TT</Th><Th>Xử lý</Th></Tr></Thead>
                    <Tbody>{bookings.map(b => (
                        <Tr key={b.id}>
                            <Td><HStack><Avatar size="xs" src={getImgUrl(b.avatar_url)} /><Text fontSize="sm" fontWeight="bold">{b.user_name}</Text></HStack></Td>
                            <Td fontSize="sm">{b.court_name}</Td>
                            <Td><Badge colorScheme="purple">{b.booking_time}</Badge><Text fontSize="xs">{new Date(b.booking_date).toLocaleDateString()}</Text></Td>
                            <Td><Badge colorScheme={b.status==='confirmed'?'green':b.status==='completed'?'blue':'red'}>{b.status}</Badge></Td>
                            <Td><HStack>{b.status === 'confirmed' && <IconButton size="xs" icon={<FaCheck/>} colorScheme="purple" onClick={()=>handleAction(b.id, 'checkin')}/>}{b.status !== 'cancelled' && <IconButton icon={<FaTimes/>} size="xs" colorScheme="orange" onClick={()=>handleAction(b.id, 'cancel')}/>}<IconButton icon={<FaTrash/>} size="xs" colorScheme="red" variant="outline" onClick={()=>handleDelete(b.id)}/></HStack></Td>
                        </Tr>
                    ))}</Tbody>
                </Table></CardBody></Card>
            </Container>
        </Box>
    );
};
export default BookingTab;