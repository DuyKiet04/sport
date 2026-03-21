import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Box, Flex, Heading, HStack, Button, Input, Table, Thead, Tbody, Tr, Th, Td, 
    IconButton, Avatar, useToast, Card, CardBody, Badge, Select, InputGroup, 
    InputLeftElement, Text, VStack, Icon, Container, Checkbox, Image, useColorModeValue , useColorMode , useDisclosure , Divider
} from '@chakra-ui/react';
import { 
    FaSearch, FaTrash, FaEyeSlash, FaEye, FaUserTimes, FaFilter, FaStar, 
    FaChevronLeft, FaChevronRight, FaCheckDouble, FaBan, FaQuoteLeft, FaExclamationTriangle, FaFlag, FaCheckCircle
} from 'react-icons/fa';
import axios from 'axios';

const getImgUrl = (url) => {
    if (!url) return '';
    if (url.includes('base64')) return url;
    if (url.startsWith('http')) return url;
    const cleanPath = url.replace(/\\/g, '/').replace(/^\/+/, '');
    return `http://localhost:5000/${cleanPath}`;
};

const parseArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        let cleanStr = data.replace('{', '').replace('}', '').replace('[', '').replace(']', '').replace(/"/g, '');
        if (cleanStr.trim() === '') return [];
        if (cleanStr.includes(',')) return cleanStr.split(',').map(item => item.trim());
        return [cleanStr.trim()];
    }
    return [];
};

export default function ReviewManagementTab({ vendorId }) {
    const isSuperAdmin = !vendorId; 

    // 🔥 HOOKS
    const { colorMode } = useColorMode();
    const toast = useToast();
    const scrollParentRef = useRef();

    // STATES
    const [reviews, setReviews] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [starFilter, setStarFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1); // Đã đồng bộ thành currentPage
    const [selectedIds, setSelectedIds] = useState([]);
    
    const ITEMS_PER_PAGE = 10;

    // 🎨 NEUMORPHISM COLORS
    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '6px 6px 12px #0d1117, -4px -4px 10px #2d3748');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #0d1117, inset -4px -4px 8px #2d3748');
    const textColor = useColorModeValue('gray.700', 'gray.100');
    const textMuted = useColorModeValue('gray.500', 'gray.400');
    const accentColor = useColorModeValue('blue.500', 'blue.300');
    const rowSelectedBg = useColorModeValue('orange.50', 'rgba(221, 107, 32, 0.15)');
    const bulkActionBg = useColorModeValue('red.50', 'red.900');
    const dividerColor = useColorModeValue('gray.300', 'gray.600');

    const inputStyle = {
        bg: neumorphBg, border: "none", color: textColor, boxShadow: neumorphActiveShadow,
        borderRadius: "xl", fontSize: "sm", fontWeight: "bold",
        _focus: { boxShadow: neumorphActiveShadow, border: "1px solid", borderColor: "blue.400" },
        _placeholder: { color: "gray.400" }
    };

    const fetchReviews = async () => {
        try {
            const url = isSuperAdmin 
                ? 'http://localhost:5000/api/admin/reviews' 
                : `http://localhost:5000/api/vendor/reviews?vendor_id=${vendorId}`;
            const res = await axios.get(url);
            const data = res.data.reviews || res.data || [];
            setReviews(Array.isArray(data) ? data : []);
        } catch (error) { console.error("Lỗi lấy đánh giá", error); }
    };

    useEffect(() => { fetchReviews(); }, [vendorId]);
    
    // Đồng bộ reset page về 1 khi có lọc
    useEffect(() => { 
        setCurrentPage(1); 
        setSelectedIds([]); 
    }, [searchTerm, starFilter, statusFilter]);

    const filteredReviews = useMemo(() => {
        return reviews.filter(r => {
            if (starFilter !== 'all' && r.rating !== parseInt(starFilter)) return false;
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;
            if (searchTerm) {
                const lower = searchTerm.toLowerCase();
                return (r.user_name?.toLowerCase().includes(lower) || 
                        r.facility_name?.toLowerCase().includes(lower) || 
                        r.comment?.toLowerCase().includes(lower));
            }
            return true;
        });
    }, [reviews, searchTerm, starFilter, statusFilter]);

    // 🔥 LOGIC PHÂN TRANG (Đã đồng bộ biến currentPage)
    const totalPages = Math.ceil(filteredReviews.length / ITEMS_PER_PAGE);
    const currentReviews = filteredReviews.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        if (scrollParentRef.current) scrollParentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleBulkStatus = async (status) => {
        if (selectedIds.length === 0) return;
        try {
            await axios.put('http://localhost:5000/api/admin/reviews/bulk-status', { ids: selectedIds, status });
            toast({ title: `Đã ${status === 'hidden' ? 'ẨN' : 'HIỆN'} ${selectedIds.length} đánh giá!`, status: "success" });
            fetchReviews(); setSelectedIds([]);
        } catch (e) { toast({ title: "Lỗi thao tác", status: "error" }); }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`XÓA VĨNH VIỄN ${selectedIds.length} đánh giá này?`)) return;
        try {
            await axios.post('http://localhost:5000/api/admin/reviews/bulk-delete', { ids: selectedIds });
            toast({ title: `Đã XÓA ${selectedIds.length} đánh giá!`, status: "success" });
            fetchReviews(); setSelectedIds([]);
        } catch (e) { toast({ title: "Lỗi thao tác", status: "error" }); }
    };

    const handleBulkBanUser = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`CẢNH BÁO: Khóa toàn bộ User của ${selectedIds.length} đánh giá này?`)) return;
        try {
            await axios.put('http://localhost:5000/api/admin/users/bulk-ban-from-reviews', { reviewIds: selectedIds });
            await axios.put('http://localhost:5000/api/admin/reviews/bulk-status', { ids: selectedIds, status: 'hidden' });
            toast({ title: `Đã khóa User và ẩn đánh giá!`, status: "success" });
            fetchReviews(); setSelectedIds([]);
        } catch (e) { toast({ title: "Lỗi thao tác", status: "error" }); }
    };

    const handleToggleStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'hidden' : 'active';
        try {
            await axios.put(`http://localhost:5000/api/admin/reviews/${id}/status`, { status: newStatus });
            toast({ title: newStatus === 'hidden' ? "Đã ẩn đánh giá" : "Đã khôi phục đánh giá", status: "success" });
            fetchReviews();
        } catch (e) { toast({ title: "Lỗi cập nhật", status: "error" }); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Xóa vĩnh viễn đánh giá này?")) return;
        try {
            await axios.delete(`http://localhost:5000/api/admin/reviews/${id}`);
            toast({ title: "Đã xóa đánh giá", status: "success" }); fetchReviews();
        } catch (e) { toast({ title: "Lỗi xóa", status: "error" }); }
    };

    const handleBanUser = async (userId, userName) => {
        if (!window.confirm(`Khóa tài khoản của người dùng: ${userName}?`)) return;
        try {
            await axios.put(`http://localhost:5000/api/admin/users/${userId}/status`, { status: 'blocked' });
            toast({ title: `Đã khóa User ${userName}`, status: "success" });
        } catch (e) { toast({ title: "Lỗi khóa User", status: "error" }); }
    };

    const handleDismissReport = async (id) => {
        if (!window.confirm("Bỏ qua báo cáo này (Đánh giá không vi phạm)?")) return;
        try {
            await axios.put(`http://localhost:5000/api/admin/reviews/${id}/dismiss-report`);
            toast({ title: "Đã bỏ qua báo cáo", status: "success" }); fetchReviews();
        } catch (e) { toast({ title: "Lỗi xử lý", status: "error" }); }
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

                {/* LỌC SAO */}
                <Box p={5} borderRadius="3xl" bg={neumorphBg} boxShadow={neumorphShadow}>
                    <HStack mb={4} spacing={2} color={accentColor}>
                        <Icon as={FaFilter} boxSize={3} />
                        <Text fontSize="xs" fontWeight="900" textTransform="uppercase" letterSpacing="1px">Lọc theo xếp hạng:</Text>
                    </HStack>
                    
                    <Box overflowX="auto" pb={2} css={{ scrollbarWidth: 'none' }}>
                        <HStack spacing={4} minW="max-content" px={1}>
                            <Button 
                                size="md" flexShrink={0} borderRadius="2xl" border="none"
                                bg={neumorphBg} color={starFilter === 'all' ? "blue.500" : textColor}
                                boxShadow={starFilter === 'all' ? neumorphActiveShadow : neumorphShadow}
                                onClick={() => setStarFilter('all')} fontWeight="900" fontSize="sm"
                            >
                                Tất cả ({reviews.length})
                            </Button>
                            
                            {[5, 4, 3, 2, 1].map(star => {
                                const count = reviews.filter(r => r.rating === star).length;
                                return (
                                    <Button 
                                        key={star} size="md" flexShrink={0} borderRadius="2xl" border="none"
                                        bg={neumorphBg} color={starFilter === star.toString() ? "orange.500" : textColor}
                                        boxShadow={starFilter === star.toString() ? neumorphActiveShadow : neumorphShadow}
                                        leftIcon={<Icon as={FaStar} color={starFilter === star.toString() ? "orange.500" : "orange.300"} />}
                                        onClick={() => setStarFilter(star.toString())} fontWeight="900" fontSize="sm"
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
                        {/* HIỂN THỊ THANH CÔNG CỤ XÓA HÀNG LOẠT NẾU CÓ CHỌN */}
                        {isSuperAdmin && selectedIds.length > 0 && (
                            <HStack w="100%" bg={bulkActionBg} p={3} borderRadius="2xl" border="1px dashed" borderColor="red.400" justify="space-between">
                                <Text fontSize="sm" fontWeight="900" color="red.500">Đang chọn: {selectedIds.length} đánh giá</Text>
                                <HStack spacing={3}>
                                    <Button size="sm" leftIcon={<FaEyeSlash/>} colorScheme="orange" variant="solid" onClick={() => handleBulkStatus('hidden')} borderRadius="xl">Ẩn Nhanh</Button>
                                    <Button size="sm" leftIcon={<FaEye/>} colorScheme="green" variant="outline" onClick={() => handleBulkStatus('active')} borderRadius="xl">Khôi phục</Button>
                                    <Button size="sm" leftIcon={<FaTrash/>} colorScheme="red" variant="solid" onClick={handleBulkDelete} borderRadius="xl">Xóa Nhanh</Button>
                                    <Button size="sm" leftIcon={<FaUserTimes/>} bg="gray.800" color="white" _hover={{bg: 'gray.900'}} onClick={handleBulkBanUser} borderRadius="xl">Khóa User</Button>
                                    <Button size="sm" onClick={() => setSelectedIds([])} variant="ghost" color={textColor} fontWeight="bold">Hủy chọn</Button>
                                </HStack>
                            </HStack>
                        )}

                        {currentReviews.map(r => (
                            <Box 
                                key={r.id} bg={selectedIds.includes(r.id) ? rowSelectedBg : neumorphBg} p={6} borderRadius="3xl" 
                                boxShadow={neumorphShadow} border="none" transition="all 0.2s"
                                _hover={{ transform: 'scale(0.99)' }}
                            >
                                <Flex justify="space-between" align="start" mb={6}>
                                    <HStack spacing={4}>
                                        {isSuperAdmin && (
                                            <Checkbox isChecked={selectedIds.includes(r.id)} onChange={(e) => e.target.checked ? setSelectedIds([...selectedIds, r.id]) : setSelectedIds(selectedIds.filter(id => id !== r.id))} />
                                        )}
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
                                
                                <Divider borderColor={dividerColor} opacity={0.3} mb={5} />

                                <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
                                    <Badge variant="subtle" colorScheme={r.status === 'active' ? 'green' : 'gray'} px={4} py={1.5} borderRadius="full" fontSize="9px" fontWeight="900" border="none">
                                        {r.status === 'active' ? '● ĐANG HIỂN THỊ' : '● ĐÃ ẨN'}
                                    </Badge>
                                    
                                    <HStack>
                                        {r.is_reported && r.status === 'active' && (
                                            <HStack color="orange.500" fontSize="xs" fontWeight="900" px={4} py={2} bg={neumorphBg} borderRadius="xl" boxShadow={neumorphActiveShadow}>
                                                <Icon as={FaExclamationTriangle} />
                                                <Text>ĐANG CHỜ DUYỆT BÁO CÁO</Text>
                                            </HStack>
                                        )}
                                        {r.is_reported && r.status !== 'active' && (
                                            <HStack color="blue.500" fontSize="xs" fontWeight="900" px={4} py={2} bg={neumorphBg} borderRadius="xl" boxShadow={neumorphActiveShadow}>
                                                <Icon as={FaCheckCircle} />
                                                <Text>BÁO CÁO HỢP LỆ</Text>
                                            </HStack>
                                        )}

                                        {isSuperAdmin ? (
                                            <HStack spacing={2}>
                                                <IconButton size="xs" icon={r.status === 'active' ? <FaEyeSlash/> : <FaEye/>} colorScheme={r.status === 'active' ? 'orange' : 'green'} variant="ghost" bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} onClick={() => handleToggleStatus(r.id, r.status)} isRound title="Ẩn/Hiện"/>
                                                <IconButton size="xs" icon={<FaTrash/>} colorScheme="red" variant="ghost" bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} onClick={() => handleDelete(r.id)} isRound title="Xóa"/>
                                                <IconButton size="xs" icon={<FaUserTimes/>} colorScheme="gray" variant="ghost" bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} onClick={() => handleBanUser(r.user_id, r.user_name)} isRound title="Khóa User"/>
                                                {r.is_reported && r.status === 'active' && (
                                                    <IconButton size="xs" icon={<FaCheckDouble/>} colorScheme="blue" variant="solid" onClick={() => handleDismissReport(r.id)} isRound title="Bỏ qua báo cáo"/>
                                                )}
                                            </HStack>
                                        ) : (
                                            r.status === 'active' && !r.is_reported && (
                                                <Button size="xs" h="35px" px={5} leftIcon={<FaFlag />} colorScheme="red" variant="ghost" bg={neumorphBg} boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} onClick={() => handleOpenReport(r)} borderRadius="xl" fontWeight="900">
                                                    BÁO CÁO VI PHẠM
                                                </Button>
                                            )
                                        )}
                                    </HStack>
                                </Flex>
                            </Box>
                        ))}

                        {/* PHÂN TRANG: Đã đồng bộ là currentPage */}
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
        </Box>
    );
}