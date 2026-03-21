import React, { useState, useEffect } from 'react';
import {
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
    VStack, HStack, Text, Box, Image, Button, useColorModeValue, Icon, IconButton, Flex, Spinner, Divider , Badge
} from '@chakra-ui/react';
import { FaHeart, FaMapMarkerAlt, FaTrashAlt, FaChevronRight } from 'react-icons/fa';
import axios from 'axios';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
const getImgUrl = (url) => url ? (url.startsWith('http') ? url : `http://localhost:5000/${url.replace(/^\/+/, '')}`) : 'https://placehold.co/100';

const FavoriteFacilitiesModal = ({ isOpen, onClose, onSelectFacility }) => {
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(false);
    const user = JSON.parse(localStorage.getItem('user'));

    // 🎨 MÀU SẮC NEUMORPHISM ĐỒNG BỘ
    const neumorphBg = useColorModeValue('#edf2f7', '#2d3748');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '4px 4px 10px #1a202c, -4px -4px 10px #4a5568');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #1a202c, inset -4px -4px 8px #4a5568');

    const textColor = useColorModeValue("gray.700", "gray.100");
    const textMuted = useColorModeValue("gray.500", "gray.400");

    const fetchFavorites = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/user/favorite-facilities/${user.id}`);
            setFavorites(res.data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    useEffect(() => { if (isOpen) fetchFavorites(); }, [isOpen]);

    const handleRemove = async (facId) => {
        try {
            await axios.post('http://localhost:5000/api/favorites', { user_id: user.id, facility_id: facId });
            setFavorites(prev => prev.filter(f => f.id !== facId));
        } catch (e) { console.error(e); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered scrollBehavior="inside" motionPreset="slideInBottom">
            <ModalOverlay backdropFilter="blur(5px)" bg="blackAlpha.600" />
            <ModalContent bg={neumorphBg} borderRadius="3xl" border="none" shadow="2xl">
                <ModalHeader borderBottom="none" pt={6}>
                    <HStack spacing={3}>
                        <Box bg={neumorphBg} p={2.5} borderRadius="xl" boxShadow={neumorphShadow} display="flex" alignItems="center" justifyContent="center">
                            <Icon as={FaHeart} color="red.500" boxSize={5} />
                        </Box>
                        <VStack align="start" spacing={0}>
                            <Text color={textColor} fontWeight="900" fontSize="lg" textTransform="uppercase">Sân Yêu Thích</Text>
                            <Text color={textMuted} fontSize="xs" fontWeight="bold">Nơi lưu giữ các cơ sở tin cậy</Text>
                        </VStack>
                    </HStack>
                </ModalHeader>
                <ModalCloseButton color={textColor} bg={neumorphBg} boxShadow={neumorphShadow} borderRadius="full" mt={4} mr={4} _active={{boxShadow: neumorphActiveShadow}} border="none" />
                
                <ModalBody py={6} px={5} bg={neumorphBg}>
                    {loading ? (
                        <Flex justify="center" py={10}><Spinner color="red.500" thickness="3px" /></Flex>
                    ) : favorites.length === 0 ? (
                        <VStack py={12} bg={neumorphBg} borderRadius="2xl" boxShadow={neumorphActiveShadow} mx={1}>
                            <Icon as={FaHeart} boxSize={10} color="gray.300" opacity={0.5} />
                            <Text textAlign="center" color={textMuted} fontWeight="bold" fontSize="sm">Danh sách đang trống...</Text>
                        </VStack>
                    ) : (
                        <VStack spacing={5} align="stretch" pb={4}>
                            {favorites.map(fac => (
                                <Flex 
                                    key={fac.id} bg={neumorphBg} p={4} borderRadius="2xl" border="none" boxShadow={neumorphShadow} 
                                    transition="all 0.2s" _hover={{ transform: 'scale(0.98)', boxShadow: neumorphActiveShadow }}
                                >
                                    <Box 
                                        borderRadius="xl" overflow="hidden" mr={4} flexShrink={0} 
                                        boxShadow={neumorphActiveShadow} border="3px solid" borderColor={neumorphBg}
                                    >
                                        <Image src={getImgUrl(fac.image_url)} boxSize="75px" objectFit="cover" fallbackSrc="https://placehold.co/75x75?text=Sport" />
                                    </Box>
                                    
                                    <Box flex={1} minW={0}>
                                        <Text fontWeight="900" fontSize="md" color={textColor} noOfLines={1} mb={0.5}>{fac.name}</Text>
                                        <HStack spacing={1} mb={2}>
                                            <Icon as={FaMapMarkerAlt} color="red.500" boxSize={3}/> 
                                            <Text fontSize="xs" color={textMuted} noOfLines={1} fontWeight="bold">{fac.address}</Text>
                                        </HStack>
                                        <Badge colorScheme="green" variant="subtle" px={2} py={0.5} borderRadius="md" fontSize="10px" border="none">
                                            Giá từ {formatCurrency(fac.min_price)}
                                        </Badge>
                                    </Box>

                                    <VStack justify="space-between" ml={2}>
                                        <IconButton 
                                            icon={<FaTrashAlt/>} size="sm" colorScheme="red" variant="ghost" isRound
                                            bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                            onClick={() => handleRemove(fac.id)} aria-label="Remove"
                                        />
                                        <Button 
                                            size="xs" colorScheme="blue" bgGradient="linear(to-r, blue.400, teal.400)" 
                                            color="white" borderRadius="lg" px={4} shadow="md"
                                            onClick={() => { onClose(); onSelectFacility(fac); }}
                                            rightIcon={<FaChevronRight size="10px"/>}
                                        >
                                            Xem
                                        </Button>
                                    </VStack>
                                </Flex>
                            ))}
                        </VStack>
                    )}
                </ModalBody>
                
                <Box p={4} textAlign="center" bg={neumorphBg} borderBottomRadius="3xl">
                     <Divider borderColor={useColorModeValue('gray.300', 'gray.600')} opacity={0.3} mb={4} />
                     <Text fontSize="10px" color={textMuted} fontWeight="bold" letterSpacing="1px" textTransform="uppercase">
                        Tổng cộng: {favorites.length} cơ sở
                     </Text>
                </Box>
            </ModalContent>
        </Modal>
    );
};

export default FavoriteFacilitiesModal;