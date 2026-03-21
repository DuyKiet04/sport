import React from 'react';
import {
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter,
    VStack, Avatar, Text, HStack, Button, Badge, Divider, IconButton, Box, useColorModeValue , Icon
} from '@chakra-ui/react';
import { FaPhone, FaCommentDots, FaUserShield, FaCalendarAlt, FaUser } from 'react-icons/fa';

const PublicProfileModal = ({ isOpen, onClose, user }) => {
    // 🎨 MÀU SẮC NEUMORPHISM ĐỒNG BỘ
    const neumorphBg = useColorModeValue('#edf2f7', '#2d3748');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '4px 4px 10px #1a202c, -4px -4px 10px #4a5568');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #1a202c, inset -4px -4px 8px #4a5568');
    
    const textColor = useColorModeValue("gray.700", "gray.100");
    const textMuted = useColorModeValue("gray.500", "gray.400");
    const accentColor = useColorModeValue("blue.500", "blue.300");

    if (!user) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm" motionPreset="scale">
            <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.400" />
            <ModalContent 
                className="notranslate" 
                translate="no" 
                borderRadius="3xl" 
                bg={neumorphBg} 
                border="none" 
                boxShadow={neumorphShadow}
                p={4}
            >
                <ModalHeader textAlign="center" color={accentColor} fontWeight="900" fontSize="lg" textTransform="uppercase" letterSpacing="1px">
                    Hồ Sơ Thành Viên
                </ModalHeader>
                <ModalCloseButton color={textColor} borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} mt={2} mr={2} border="none"/>
                
                <ModalBody pb={8} pt={4}>
                    <VStack spacing={6}>
                        {/* Avatar nổi khối Neumorphism */}
                        <Box 
                            position="relative" 
                            p={2} 
                            borderRadius="full" 
                            bg={neumorphBg} 
                            boxShadow={neumorphShadow}
                        >
                            <Avatar 
                                size="2xl" 
                                src={user.avatar_url || user.avatar} 
                                name={user.full_name || user.name} 
                                border="4px solid"
                                borderColor={neumorphBg}
                                bg="transparent"
                            />
                            {user.role === 'vendor' && (
                                <Badge 
                                    position="absolute" 
                                    bottom={2} 
                                    right={2} 
                                    colorScheme="orange" 
                                    borderRadius="full" 
                                    px={3} 
                                    py={1}
                                    boxShadow="md"
                                    border="2px solid white"
                                    fontSize="xs"
                                    fontWeight="900"
                                >
                                    Chủ Sân
                                </Badge>
                            )}
                        </Box>

                        <VStack spacing={1}>
                            <Text fontWeight="900" fontSize="2xl" color={textColor} textAlign="center">
                                {user.full_name || user.name}
                            </Text>
                            <HStack color={textMuted} fontSize="xs" fontWeight="bold" bg={neumorphBg} px={4} py={1.5} borderRadius="full" boxShadow={neumorphActiveShadow}>
                                <Icon as={FaCalendarAlt} color={accentColor} />
                                <Text>Tham gia: {user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : 'Thành viên mới'}</Text>
                            </HStack>
                        </VStack>

                        <Divider borderColor={useColorModeValue('gray.300', 'gray.600')} opacity={0.3} w="80%" />

                        {/* Khu vực liên hệ dập nổi */}
                        <VStack w="100%" spacing={4}>
                            <Text fontWeight="900" fontSize="xs" color={textMuted} letterSpacing="2px" textTransform="uppercase">
                                Liên hệ trực tiếp
                            </Text>
                            
                            {user.phone || user.phone_number ? (
                                <SimpleGrid columns={2} spacing={4} w="100%">
                                    {/* Nút gọi Soft UI */}
                                    <Button 
                                        as="a" 
                                        href={`tel:${user.phone || user.phone_number}`} 
                                        leftIcon={<FaPhone />} 
                                        bg={neumorphBg}
                                        color="green.500"
                                        borderRadius="xl"
                                        h="50px"
                                        boxShadow={neumorphShadow}
                                        _hover={{ transform: 'translateY(-2px)' }}
                                        _active={{ boxShadow: neumorphActiveShadow, transform: 'none' }}
                                        border="none"
                                        fontSize="sm"
                                        fontWeight="bold"
                                    >
                                        Gọi điện
                                    </Button>
                                    
                                    {/* Nút zalo Soft UI */}
                                    <Button 
                                        as="a" 
                                        href={`https://zalo.me/${user.phone || user.phone_number}`} 
                                        target="_blank"
                                        leftIcon={<FaCommentDots />} 
                                        bg={neumorphBg}
                                        color="blue.500"
                                        borderRadius="xl"
                                        h="50px"
                                        boxShadow={neumorphShadow}
                                        _hover={{ transform: 'translateY(-2px)' }}
                                        _active={{ boxShadow: neumorphActiveShadow, transform: 'none' }}
                                        border="none"
                                        fontSize="sm"
                                        fontWeight="bold"
                                    >
                                        Chat Zalo
                                    </Button>
                                </SimpleGrid>
                            ) : (
                                <Box 
                                    w="100%" 
                                    p={4} 
                                    borderRadius="2xl" 
                                    bg={neumorphBg} 
                                    boxShadow={neumorphActiveShadow}
                                    textAlign="center"
                                >
                                    <Text fontSize="xs" color="red.400" fontWeight="bold" fontStyle="italic">
                                        Người này chưa cập nhật số điện thoại.
                                    </Text>
                                </Box>
                            )}
                        </VStack>
                    </VStack>
                </ModalBody>

                <ModalFooter justifyContent="center" pb={4}>
                    <Button 
                        variant="ghost" 
                        color={textMuted} 
                        fontSize="xs" 
                        fontWeight="bold"
                        onClick={onClose}
                        _hover={{ color: accentColor }}
                    >
                        Đóng cửa sổ
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default PublicProfileModal;