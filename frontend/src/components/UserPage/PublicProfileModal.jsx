import React from 'react';
import {
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter,
    VStack, Avatar, Text, HStack, Button, Badge, Divider, IconButton, Box
} from '@chakra-ui/react';
import { FaPhone, FaCommentDots, FaUserShield, FaCalendarAlt } from 'react-icons/fa';

const PublicProfileModal = ({ isOpen, onClose, user }) => {
    if (!user) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm">
            <ModalOverlay />
            <ModalContent className="notranslate" translate="no" borderRadius="xl">
                <ModalHeader textAlign="center">Thông Tin Thành Viên</ModalHeader>
                <ModalCloseButton />
                
                <ModalBody pb={6}>
                    <VStack spacing={4}>
                        {/* Avatar to đùng */}
                        <Box position="relative">
                            <Avatar size="2xl" src={user.avatar_url || user.avatar} name={user.full_name || user.name} border="4px solid white" shadow="lg" />
                            {user.role === 'vendor' && (
                                <Badge position="absolute" bottom={0} right={0} colorScheme="orange" borderRadius="full" px={2}>
                                    Chủ Sân
                                </Badge>
                            )}
                        </Box>

                        <VStack spacing={1}>
                            <Text fontWeight="bold" fontSize="xl">{user.full_name || user.name}</Text>
                            <HStack color="gray.500" fontSize="sm">
                                <FaCalendarAlt />
                                <Text>Tham gia: {user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : 'Thành viên mới'}</Text>
                            </HStack>
                        </VStack>

                        <Divider />

                        {/* Khu vực liên hệ */}
                        <VStack w="100%" spacing={3}>
                            <Text fontWeight="bold" fontSize="sm" color="gray.600">LIÊN HỆ</Text>
                            
                            {user.phone || user.phone_number ? (
                                <HStack w="100%" spacing={2}>
                                    {/* Nút Gọi */}
                                    <Button 
                                        as="a" href={`tel:${user.phone || user.phone_number}`} 
                                        leftIcon={<FaPhone />} colorScheme="green" w="50%"
                                    >
                                        Gọi điện
                                    </Button>
                                    
                                    {/* Nút Zalo */}
                                    <Button 
                                        as="a" href={`https://zalo.me/${user.phone || user.phone_number}`} target="_blank"
                                        leftIcon={<FaCommentDots />} colorScheme="blue" w="50%"
                                    >
                                        Chat Zalo
                                    </Button>
                                </HStack>
                            ) : (
                                <Text fontSize="sm" color="red.400" fontStyle="italic">
                                    Người này chưa cập nhật số điện thoại.
                                </Text>
                            )}
                        </VStack>
                    </VStack>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default PublicProfileModal;