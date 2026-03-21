import React from 'react';
import { 
    Card, Flex, Box, Image, Badge, VStack, Text, Wrap, Tag, 
    HStack, Button, useColorModeValue, Icon, Spacer 
} from '@chakra-ui/react';
import { FaLocationArrow, FaStar, FaMapMarkerAlt, FaClock, FaChevronRight } from 'react-icons/fa';

const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url.substring(1) : url;
    return `${import.meta.env.VITE_API_URL}/${cleanPath}`;
};

const FacilityCard = ({ facility, onClick, distance }) => {
    // 🎨 MÀU SẮC NEUMORPHISM ĐỒNG BỘ DARK MODE
    const neumorphBg = useColorModeValue('#edf2f7', '#2d3748');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '4px 4px 10px #1a202c, -4px -4px 10px #4a5568');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #1a202c, inset -4px -4px 8px #4a5568');
    
    const textColor = useColorModeValue('gray.700', 'gray.100');
    const textMuted = useColorModeValue('gray.500', 'gray.400');
    const accentColor = useColorModeValue('blue.500', 'blue.300');

    // Giữ nguyên logic status
    const getStatus = () => {
        if(!facility.open_time || !facility.close_time) return {text:'Unknown', color:'gray', icon: FaClock};
        const now = new Date();
        const cur = now.getHours()*60 + now.getMinutes();
        const [oH,oM] = facility.open_time.split(':').map(Number);
        const [cH,cM] = facility.close_time.split(':').map(Number);
        let start = oH*60+oM; let end = cH*60+cM;
        if(end < start) end += 24*60;
        let check = cur; if(cur < start && end > 24*60) check += 24*60;
        
        if(check < start || check > end) return {text:'Đóng cửa', color:'red', icon: FaClock};
        return {text:'Đang mở', color:'green', icon: FaClock};
    };
    const st = getStatus();

    const rating = facility.avg_rating || "5.0"; 
    const reviewCount = facility.review_count || 0;

    return (
        <Box
            onClick={onClick} 
            cursor="pointer" 
            bg={neumorphBg} 
            w="100%" 
            borderRadius="2xl" 
            p={2}
            boxShadow={neumorphShadow}
            mb={5} 
            overflow="hidden"
            transition="all 0.3s ease"
            _active={{ transform: 'scale(0.98)', boxShadow: neumorphActiveShadow }}
        >
            <Flex direction="row" minH="130px">
                
                {/* 1. CỘT ẢNH (Dập chìm) */}
                <Box 
                    w="120px" minW="120px" h="120px"
                    position="relative" 
                    borderRadius="xl" 
                    overflow="hidden"
                    m={1}
                    boxShadow={neumorphActiveShadow}
                    border="3px solid"
                    borderColor={neumorphBg}
                >
                    <Image 
                        src={getImgUrl(facility.image_url)} 
                        w="100%" h="100%" 
                        objectFit="cover" 
                        fallbackSrc="https://placehold.co/120x120?text=SanBong"
                    />
                    
                    {/* Badge lượt sân nổi lên nhẹ */}
                    <Box 
                        position="absolute" top={1} left={1} 
                        bg={neumorphBg} color="blue.500" 
                        fontSize="9px" fontWeight="900" px={2} py={0.5} 
                        borderRadius="md" shadow="md"
                    >
                        {facility.total_courts} SÂN
                    </Box>
                    
                    {distance && (
                        <Box 
                            position="absolute" bottom={1} right={1} 
                            bg="orange.500" color="white" 
                            fontSize="9px" fontWeight="900"
                            display="flex" alignItems="center" px={2} py={0.5} 
                            borderRadius="full" shadow="md"
                        >
                             {parseFloat(distance).toFixed(1)} km
                        </Box>
                    )}
                </Box>
                
                {/* 2. CỘT THÔNG TIN */}
                <VStack p={3} align="stretch" justify="space-between" flex={1} spacing={0}>
                    
                    <Box>
                        <Flex justify="space-between" align="start">
                            <Text fontWeight="900" fontSize="sm" color={textColor} lineHeight="1.2" noOfLines={1} mb={1} pr={2}>
                                {facility.name}
                            </Text>
                            
                            {/* Rating Star nổi khối */}
                            <HStack 
                                spacing={1} bg={neumorphBg} px={2} py={0.5} 
                                borderRadius="lg" boxShadow={neumorphShadow}
                            >
                                <Icon as={FaStar} color="orange.400" boxSize={2.5} />
                                <Text fontSize="10px" fontWeight="900" color={textColor}>{rating}</Text>
                            </HStack>
                        </Flex>

                        <HStack align="start" spacing={1} mt={1}>
                            <Icon as={FaMapMarkerAlt} w={2.5} h={2.5} color="red.500" mt="2px"/>
                            <Text fontSize="10px" color={textMuted} noOfLines={1} fontWeight="bold">
                                {facility.address}
                            </Text>
                        </HStack>
                    </Box>
                    
                    {/* Tags môn thể thao */}
                    <Wrap spacing={2} mt={2} mb={2} maxH="22px" overflow="hidden">
                        {facility.sports && facility.sports.slice(0, 2).map(s => (
                            <Box 
                                key={s} fontSize="9px" px={2.5} py={0.5} 
                                borderRadius="full" bg={neumorphBg} color={accentColor} 
                                fontWeight="900" boxShadow={neumorphActiveShadow}
                                textTransform="uppercase"
                            >
                                {s}
                            </Box>
                        ))}
                    </Wrap>

                    {/* Footer: Giá + Nút */}
                    <Flex justify="space-between" align="center" pt={1}>
                        <VStack align="start" spacing={0}>
                            <Badge 
                                variant="subtle" 
                                colorScheme={st.color} 
                                fontSize="8px" 
                                borderRadius="full" 
                                px={2} 
                                mb={0.5}
                                border="none"
                            >
                                {st.text}
                            </Badge>
                            <Text fontWeight="900" color="green.500" fontSize="sm" lineHeight="1">
                                {parseInt(facility.min_price||0).toLocaleString()}đ
                            </Text>
                        </VStack>

                        <Button 
                            size="xs" 
                            h="30px" 
                            px={4} 
                            fontSize="10px"
                            fontWeight="900"
                            borderRadius="full" 
                            colorScheme="blue" 
                            bgGradient="linear(to-r, blue.400, blue.600)"
                            color="white"
                            boxShadow="lg"
                            _hover={{ transform: 'translateY(-2px)', shadow: 'xl' }}
                            _active={{ transform: 'scale(0.95)' }}
                            onClick={(e)=>{e.stopPropagation(); onClick();}}
                            rightIcon={<FaChevronRight size="8px"/>}
                        >
                            ĐẶT SÂN
                        </Button>
                    </Flex>
                </VStack>
            </Flex>
        </Box>
    );
};
export default FacilityCard;