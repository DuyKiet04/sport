import React from 'react';
import { Card, Flex, Box, Image, Badge, VStack, Text, Wrap, Tag, HStack, Button, useColorModeValue, Icon } from '@chakra-ui/react';
import { FaLocationArrow, FaStar, FaMapMarkerAlt } from 'react-icons/fa';

const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    // Đảm bảo không bị double slash
    const cleanPath = url.startsWith('/') ? url.substring(1) : url;
    return `http://localhost:5000/${cleanPath}`;
};

const FacilityCard = ({ facility, onClick, distance }) => {
    const bg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.100', 'gray.700');
    
    // Status Logic
    const getStatus = () => {
        if(!facility.open_time || !facility.close_time) return {text:'Unknown', color:'gray'};
        const now = new Date();
        const cur = now.getHours()*60 + now.getMinutes();
        const [oH,oM] = facility.open_time.split(':').map(Number);
        const [cH,cM] = facility.close_time.split(':').map(Number);
        let start = oH*60+oM; let end = cH*60+cM;
        if(end < start) end += 24*60;
        let check = cur; if(cur < start && end > 24*60) check += 24*60;
        if(check < start || check > end) return {text:'Đóng cửa', color:'red'};
        return {text:'Mở cửa', color:'green'};
    };
    const st = getStatus();

    return (
        // 🔥 FIX CSS: h="auto" và minH để nó tự giãn nếu tên dài
        <Card onClick={onClick} cursor="pointer" variant="outline" borderColor={borderColor} shadow="sm" _hover={{ shadow: 'md', borderColor: 'blue.300' }} bg={bg} w="100%" borderRadius="xl" mb={3} overflow="hidden">
            <Flex direction="row" minH="120px">
                {/* Cột ảnh bên trái */}
                <Box w="120px" minW="120px" position="relative" bg="gray.100">
                    <Image 
                        src={getImgUrl(facility.image_url)} w="100%" h="100%" objectFit="cover" 
                        onError={(e)=>{e.target.onerror=null; e.target.src='https://placehold.co/120x130?text=San';}}
                    />
                    <Badge position="absolute" top={1} left={1} bg="rgba(0,0,0,0.7)" color="white" fontSize="9px">{facility.total_courts} Sân</Badge>
                    
                    {distance && (
                        <Badge position="absolute" bottom={1} right={1} colorScheme="orange" fontSize="9px" display="flex" alignItems="center">
                            <Icon as={FaMapMarkerAlt} mr={1}/> {distance.toFixed(1)} km
                        </Badge>
                    )}
                </Box>
                
                {/* Cột thông tin bên phải */}
                <VStack p={2} align="stretch" justify="space-between" flex={1} spacing={1}>
                    <Box>
                        {/* Tên sân: Cho phép xuống dòng nếu quá dài */}
                        <Text fontWeight="bold" fontSize="sm" color="blue.600" lineHeight="1.2" noOfLines={2}>
                            {facility.name}
                        </Text>
                        <HStack align="start" mt={1} spacing={1}>
                            <Icon as={FaLocationArrow} w={3} h={3} color="gray.400" mt={0.5}/>
                            <Text fontSize="xs" color="gray.500" noOfLines={2} lineHeight="1.2">
                                {facility.address}
                            </Text>
                        </HStack>
                    </Box>
                    
                    <Wrap spacing={1} mt={1} maxH="22px" overflow="hidden">
                        {facility.sports && facility.sports.map(s => <Tag key={s} size="sm" fontSize="8px" px={1} h="18px" colorScheme="teal">{s}</Tag>)}
                    </Wrap>

                    <Flex justify="space-between" align="end" mt="auto" borderTop="1px solid" borderColor="gray.100" pt={2}>
                        <VStack align="start" spacing={0}>
                            <Text fontSize="9px" color="gray.500">Giá từ</Text>
                            <Text fontWeight="800" color="orange.500" fontSize="sm">{parseInt(facility.min_price||0).toLocaleString()}đ</Text>
                        </VStack>
                        <HStack>
                            <Badge colorScheme={st.color} fontSize="9px" variant="solid" borderRadius="full" px={2}>{st.text}</Badge>
                            <Button size="xs" colorScheme="blue" h="24px" onClick={(e)=>{e.stopPropagation(); onClick();}}>Đặt</Button>
                        </HStack>
                    </Flex>
                </VStack>
            </Flex>
        </Card>
    );
};
export default FacilityCard;