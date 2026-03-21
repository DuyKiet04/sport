import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Box, Heading, VStack, HStack, Text, Avatar, Badge, 
    Button, Image, useToast, Textarea, Modal, ModalOverlay, ModalContent, 
    ModalHeader, ModalBody, ModalFooter, useDisclosure, Icon, Flex, Divider, IconButton , 
    useColorModeValue, useColorMode ,ModalCloseButton
} from '@chakra-ui/react';
import { FaStar, FaFlag, FaQuoteLeft, FaCheckCircle, FaExclamationTriangle, FaChevronLeft, FaChevronRight, FaFilter, FaTimes } from 'react-icons/fa';
import axios from 'axios';

const getImgUrl = (url) => {
    if (!url) return '';
    if (url.includes('base64')) return url;
    if (url.startsWith('http')) return url;
    const cleanPath = url.replace(/\\/g, '/').replace(/^\/+/, '');
    return `${import.meta.env.VITE_API_URL}/${cleanPath}`;
};

export default function ReviewTab({ vendorId }) {
    const [reviews, setReviews] = useState([]);
    const [selectedReview, setSelectedReview] = useState(null);
    const [reportReason, setReportReason] = useState('');
    const { isOpen, onOpen, onClose } = useDisclosure();
    const toast = useToast();
    const scrollParentRef = useRef();

    // 🎨 MÀU SẮC NEUMORPHISM ĐỒNG BỘ
    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '6px 6px 12px #0d1117, -4px -4px 10px #2d3748');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #0d1117, inset -4px -4px 8px #2d3748');
    
    const textColor = useColorModeValue('gray.700', 'gray.100');
    const textMuted = useColorModeValue('gray.500', 'gray.400');
    const accentColor = useColorModeValue('blue.500', 'blue.300');

    // ==========================================
    // 🔥 LOGIC BỘ LỌC SAO
    // ==========================================
    const [starFilter, setStarFilter] = useState(null); 

    const filteredReviews = useMemo(() => {
        if (starFilter === null) return reviews;
        return reviews.filter(r => r.rating === starFilter);
    }, [reviews, starFilter]);

    // ==========================================
    // 🔥 LOGIC PHÂN TRANG
    // ==========================================
    const [currentPage, setCurrentPage] = useState(1);
    const REVIEWS_PER_PAGE = 5;

    useEffect(() => { setCurrentPage(1); }, [starFilter]);

    const totalPages = Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE);
    const currentReviews = filteredReviews.slice((currentPage - 1) * REVIEWS_PER_PAGE, currentPage * REVIEWS_PER_PAGE);

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        if (scrollParentRef.current) scrollParentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const fetchReviews = async () => {
        if (!vendorId) return;
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/vendor/reviews?vendor_id=${vendorId}`);
            setReviews(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchReviews(); }, [vendorId]);

    const handleOpenReport = (review) => {
        setSelectedReview(review);
        setReportReason('');
        onOpen();
    };

    const submitReport = async () => {
        if (!reportReason.trim()) return toast({ title: "Lý do là gì bác?", status: "warning" });
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/vendor/reviews/${selectedReview.id}/report`, { reason: reportReason });
            toast({ title: "Đã gửi báo cáo!", status: "success" });
            fetchReviews(); onClose();
        } catch (e) { toast({ title: "Lỗi hệ thống", status: "error" }); }
    };

    return (
        <Box ref={scrollParentRef} h="100%" overflowY="auto" p={{ base: 4, md: 8 }} bg={neumorphBg} css={{ scrollbarWidth: 'none' }}>
            <VStack align="stretch" spacing={8}>
                
                {/* TIÊU ĐỀ */}
                <Flex justify="space-between" align="center">
                    <VStack align="start" spacing={1}>
                        <Heading size="lg" color={textColor} fontWeight="900" textTransform="uppercase" letterSpacing="tight">⭐ Đánh giá & Phản hồi</Heading>
                        <HStack bg={neumorphBg} px={4} py={1} borderRadius="full" boxShadow={neumorphActiveShadow}>
                            <Text fontSize="xs" fontWeight="900" color={accentColor}>KHÁCH HÀNG NÓI GÌ VỀ BẠN</Text>
                        </HStack>
                    </VStack>
                    <Box bg={neumorphBg} p={3} borderRadius="2xl" boxShadow={neumorphShadow} textAlign="center">
                        <Text fontSize="xl" fontWeight="900" color="blue.500" lineHeight="1">{reviews.length}</Text>
                        <Text fontSize="9px" fontWeight="900" color={textMuted}>BÌNH LUẬN</Text>
                    </Box>
                </Flex>

                {/* 🔥 BỘ LỌC SAO: TACTILE BUTTONS */}
                <Box p={5} borderRadius="3xl" bg={neumorphBg} boxShadow={neumorphShadow}>
                    <HStack mb={4} spacing={2} color={accentColor}>
                        <Icon as={FaFilter} boxSize={3} />
                        <Text fontSize="xs" fontWeight="900" textTransform="uppercase" letterSpacing="1px">Lọc theo xếp hạng:</Text>
                    </HStack>
                    
                    <Box overflowX="auto" pb={2} css={{ scrollbarWidth: 'none' }}>
                        <HStack spacing={4} minW="max-content" px={1}>
                            <Button 
                                size="md" flexShrink={0} borderRadius="2xl" border="none"
                                bg={neumorphBg} color={starFilter === null ? "blue.500" : textColor}
                                boxShadow={starFilter === null ? neumorphActiveShadow : neumorphShadow}
                                onClick={() => setStarFilter(null)} fontWeight="900" fontSize="sm"
                            >
                                Tất cả ({reviews.length})
                            </Button>
                            
                            {[5, 4, 3, 2, 1].map(star => {
                                const count = reviews.filter(r => r.rating === star).length;
                                return (
                                    <Button 
                                        key={star} size="md" flexShrink={0} borderRadius="2xl" border="none"
                                        bg={neumorphBg} color={starFilter === star ? "orange.500" : textColor}
                                        boxShadow={starFilter === star ? neumorphActiveShadow : neumorphShadow}
                                        leftIcon={<Icon as={FaStar} color={starFilter === star ? "orange.500" : "orange.300"} />}
                                        onClick={() => setStarFilter(star)} fontWeight="900" fontSize="sm"
                                    >
                                        {star} sao ({count})
                                    </Button>
                                );
                            })}
                        </HStack>
                    </Box>
                </Box>

                {/* DANH SÁCH BÌNH LUẬN */}
                {filteredReviews.length === 0 ? (
                    <VStack py={20} bg={neumorphBg} borderRadius="3xl" boxShadow={neumorphActiveShadow} opacity={0.8}>
                        <Icon as={FaQuoteLeft} boxSize={12} color="gray.300" mb={4} />
                        <Text color={textMuted} fontWeight="900">Chưa có đánh giá nào ở mục này.</Text>
                    </VStack>
                ) : (
                    <VStack spacing={8} align="stretch" pb={24}>
                        {currentReviews.map(r => (
                            <Box 
                                key={r.id} bg={neumorphBg} p={6} borderRadius="3xl" 
                                boxShadow={neumorphShadow} border="none" transition="all 0.2s"
                                _hover={{ transform: 'scale(0.99)' }}
                            >
                                <Flex justify="space-between" align="start" mb={6}>
                                    <HStack spacing={4}>
                                        <Box p={1} borderRadius="full" bg={neumorphBg} boxShadow={neumorphShadow}>
                                            <Avatar size="md" src={getImgUrl(r.user_avatar)} name={r.user_name} border="2px solid" borderColor={neumorphBg} />
                                        </Box>
                                        <VStack align="start" spacing={0}>
                                            <Text fontWeight="900" fontSize="md" color={textColor}>{r.user_name}</Text>
                                            <Text fontSize="xs" color={textMuted} fontWeight="bold">
                                                {new Date(r.created_at).toLocaleDateString('vi-VN')} • <Text as="span" color="blue.500">{r.facility_name}</Text>
                                            </Text>
                                        </VStack>
                                    </HStack>
                                    <HStack bg={neumorphBg} px={3} py={1.5} borderRadius="xl" boxShadow={neumorphActiveShadow} spacing={1}>
                                        <Text fontWeight="900" fontSize="sm" color="orange.500">{r.rating}</Text>
                                        <Icon as={FaStar} color="orange.400" boxSize={3} />
                                    </HStack>
                                </Flex>
                                
                                {/* NỘI DUNG BÌNH LUẬN (DẬP LÕM) */}
                                <Box bg={neumorphBg} p={5} borderRadius="2xl" boxShadow={neumorphActiveShadow} mb={6} position="relative">
                                    <Icon as={FaQuoteLeft} position="absolute" top={-2} left={4} color="blue.500" boxSize={6} opacity={0.2} />
                                    <Text fontSize="sm" color={textColor} fontWeight="600" lineHeight="1.8" pl={2}>
                                        {r.comment || "Khách hàng không để lại bình luận."}
                                    </Text>
                                </Box>
                                
                                {r.image_url && (
                                    <Box mb={6} p={2} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow} w="fit-content">
                                        <Image src={getImgUrl(r.image_url)} maxH="180px" borderRadius="xl" objectFit="cover" border="4px solid" borderColor={neumorphBg} fallbackSrc="https://placehold.co/200x150?text=Review+Image" />
                                    </Box>
                                )}
                                
                                <Divider borderColor={useColorModeValue('gray.300', 'gray.600')} opacity={0.3} mb={5} />

                                <Flex justify="space-between" align="center">
                                    <Badge 
                                        variant="subtle" colorScheme={r.status === 'active' ? 'green' : 'gray'} 
                                        px={4} py={1.5} borderRadius="full" fontSize="9px" fontWeight="900" border="none"
                                    >
                                        {r.status === 'active' ? '● ĐANG HIỂN THỊ' : '● ĐÃ ẨN'}
                                    </Badge>
                                    
                                    {r.status === 'active' && (
                                        <Box>
                                            {r.is_reported ? (
                                                <HStack color="orange.500" fontSize="xs" fontWeight="900" px={4} py={2} bg={neumorphBg} borderRadius="xl" boxShadow={neumorphActiveShadow}>
                                                    <Icon as={FaExclamationTriangle} />
                                                    <Text>ĐANG CHỜ DUYỆT BÁO CÁO</Text>
                                                </HStack>
                                            ) : r.report_resolved ? (
                                                <HStack color="blue.500" fontSize="xs" fontWeight="900" px={4} py={2} bg={neumorphBg} borderRadius="xl" boxShadow={neumorphActiveShadow}>
                                                    <Icon as={FaCheckCircle} />
                                                    <Text>BÁO CÁO HỢP LỆ</Text>
                                                </HStack>
                                            ) : (
                                                <Button 
                                                    size="xs" h="35px" px={5} leftIcon={<FaFlag />} colorScheme="red" variant="ghost" 
                                                    bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                                    onClick={() => handleOpenReport(r)} borderRadius="xl" fontWeight="900"
                                                >
                                                    BÁO CÁO VI PHẠM
                                                </Button>
                                            )}
                                        </Box>
                                    )}
                                </Flex>
                            </Box>
                        ))}

                        {/* PHÂN TRANG */}
                        {totalPages > 1 && (
                            <Flex justify="center" align="center" gap={6} py={8}>
                                <IconButton 
                                    icon={<FaChevronLeft />} isDisabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} 
                                    bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                    isRound size="md" color={accentColor} border="none" aria-label="Prev"
                                />
                                <HStack bg={neumorphBg} px={6} py={2} borderRadius="2xl" boxShadow={neumorphActiveShadow} spacing={2}>
                                    <Text fontWeight="900" color={accentColor}>{currentPage}</Text>
                                    <Text fontWeight="bold" color={textMuted}>/</Text>
                                    <Text fontWeight="bold" color={textMuted}>{totalPages}</Text>
                                </HStack>
                                <IconButton 
                                    icon={<FaChevronRight />} isDisabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)} 
                                    bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}}
                                    isRound size="md" color={accentColor} border="none" aria-label="Next"
                                />
                            </Flex>
                        )}
                    </VStack>
                )}
            </VStack>

            {/* MODAL BÁO CÁO (NEUMORPHISM STYLE) */}
            <Modal isOpen={isOpen} onClose={onClose} isCentered size="md" motionPreset="scale">
                <ModalOverlay backdropFilter="blur(5px)" bg="blackAlpha.600" />
                <ModalContent borderRadius="3xl" bg={neumorphBg} border="none" boxShadow="2xl">
                    <ModalHeader borderBottom="none" pt={8} pb={2} textAlign="center">
                        <HStack justify="center" color="red.500" spacing={3}>
                            <Icon as={FaFlag} boxSize={5} />
                            <Text fontSize="lg" fontWeight="900" textTransform="uppercase">Báo cáo bình luận</Text>
                        </HStack>
                    </ModalHeader>
                    <ModalCloseButton color={textColor} mt={4} mr={4} bg={neumorphBg} boxShadow={neumorphShadow} borderRadius="full" border="none" />
                    
                    <ModalBody py={6} px={8}>
                        <VStack align="stretch" spacing={5}>
                            <Box p={4} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow}>
                                <Text fontSize="sm" color={textColor} fontWeight="bold">
                                    Bác muốn báo cáo bình luận của <Text as="span" color="blue.500">@{selectedReview?.user_name}</Text> vì lý do gì?
                                </Text>
                            </Box>
                            <Textarea 
                                value={reportReason} onChange={e => setReportReason(e.target.value)} 
                                placeholder="Nhập lý do chi tiết để Admin dễ duyệt nhé..." 
                                rows={5} borderRadius="2xl" bg={neumorphBg} border="none" boxShadow={neumorphActiveShadow}
                                focusBorderColor="red.300" fontSize="sm" fontWeight="bold" color={textColor}
                            />
                        </VStack>
                    </ModalBody>
                    
                    <ModalFooter bg={neumorphBg} borderTop="none" p={8} pt={2} borderBottomRadius="3xl">
                        <HStack w="100%" spacing={4}>
                            <Button flex={1} h="50px" borderRadius="xl" variant="ghost" bg={neumorphBg} boxShadow={neumorphShadow} onClick={onClose} fontWeight="900">HỦY</Button>
                            <Button flex={2} h="50px" borderRadius="xl" colorScheme="red" bgGradient="linear(to-r, red.500, orange.500)" color="white" boxShadow="xl" onClick={submitReport} fontWeight="900">GỬI BÁO CÁO</Button>
                        </HStack>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    );
}