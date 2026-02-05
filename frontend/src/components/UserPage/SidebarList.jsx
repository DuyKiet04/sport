import React from 'react';
import { 
    Box, Flex, Text, VStack, HStack, Input, InputGroup, InputLeftElement, Icon, Button, Badge, 
    Select, RangeSlider, RangeSliderTrack, RangeSliderFilledTrack, RangeSliderThumb, Switch, Spacer, Avatar,
    Divider, Image as ChakraImage, AvatarGroup, Tooltip, Popover, PopoverTrigger, PopoverContent, 
    PopoverArrow, PopoverCloseButton, PopoverHeader, PopoverBody, IconButton, Link
} from '@chakra-ui/react';

// 🔥 IMPORT FULL ICONS ĐỂ KHÔNG BỊ LỖI
import { 
    FaSearch, FaFilter, FaMapMarkerAlt, FaCalendarAlt, FaRunning, FaUsers, FaHandshake, 
    FaStar, FaFire, FaDirections, FaPhone, FaCommentDots, FaTrash, FaLock, FaUnlock, 
    FaUserTimes, FaPlus, FaTrophy 
} from 'react-icons/fa';
import { BiCurrentLocation } from 'react-icons/bi';

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const SidebarList = ({ 
    isMobile, isSidebarOpen, headerBg, searchTerm, setSearchTerm, showMatches, setShowMatches, 
    iconUrlMap, filterType, setFilterType, filteredItems, handleFacilityClick, setFlyToPosition, 
    onCreateMatchOpen, wards, selectedWard, handleSelectWard, searchRadius, setSearchRadius, 
    handleFindNearby, priceRange, setPriceRange, isHeatmap, setIsHeatmap, handleJoinMatch,
    top5 = [],
    handleDrawRoute,
    handleViewProfile,
    // 🔥 NHẬN QUYỀN LỰC
    currentUser,
    handleDeleteMatch,
    handleKickUser,
    handleLockMatch
}) => {
    
    if (!isMobile && !isSidebarOpen) return null;

    return (
        <Box w={isMobile ? "100%" : "400px"} h="100%" bg="white" shadow="lg" zIndex={1000} overflowY="auto" borderRight="1px solid" borderColor="gray.200" transition="width 0.3s ease">
            <VStack p={4} spacing={4} align="stretch">
                
                {/* 1. CHẾ ĐỘ TÌM KÈO */}
                <Box p={4} borderRadius="xl" bg={showMatches ? "purple.50" : "gray.50"} border="1px dashed" borderColor={showMatches ? "purple.300" : "gray.300"}>
                    <Flex align="center" justify="space-between" mb={2}>
                        <HStack>
                            <Icon as={FaTrophy} color={showMatches ? "purple.500" : "gray.400"} />
                            <Text fontWeight="bold" fontSize="sm" color={showMatches ? "purple.700" : "gray.600"}>Chế độ Tìm Kèo</Text>
                        </HStack>
                        <Switch isChecked={showMatches} onChange={() => setShowMatches(!showMatches)} colorScheme="purple" />
                    </Flex>
                    {showMatches && (
                        <Button w="100%" colorScheme="purple" leftIcon={<FaPlus />} size="sm" onClick={onCreateMatchOpen}>
                            + Đăng kèo mới
                        </Button>
                    )}
                </Box>

                {/* 2. THANH TÌM KIẾM */}
                <InputGroup>
                    <InputLeftElement pointerEvents="none"><Icon as={FaSearch} color="gray.400" /></InputLeftElement>
                    <Input placeholder={showMatches ? "Tìm kèo..." : "Tìm sân, môn thể thao..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} borderRadius="full" bg="gray.100" border="none" _focus={{ bg: 'white', shadow: 'md' }} />
                </InputGroup>

                {/* 3. BỘ LỌC */}
                {!showMatches && (
                    <VStack spacing={3} align="stretch">
                        <Select placeholder="Tất cả môn" value={filterType} onChange={(e) => setFilterType(e.target.value)} size="sm" borderRadius="lg">
                            {Object.keys(iconUrlMap).map(type => (<option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>))}
                        </Select>
                        <HStack>
                            <Select placeholder="Chọn Phường" value={selectedWard} onChange={(e) => handleSelectWard(e.target.value)} size="sm" borderRadius="lg">
                                {wards.map(ward => (<option key={ward.id} value={ward.id}>{ward.name}</option>))}
                            </Select>
                            <Button size="sm" colorScheme="blue" variant="outline" onClick={handleFindNearby}><Icon as={BiCurrentLocation} /></Button>
                        </HStack>
                        <Box px={2}>
                            <Flex justify="space-between" mb={1}>
                                <Text fontSize="xs" color="gray.500">Bán kính tìm:</Text>
                                <Text fontSize="xs" fontWeight="bold" color="blue.500">{searchRadius} km</Text>
                            </Flex>
                            <RangeSlider aria-label={['min', 'max']} defaultValue={[0, 20]} min={1} max={1000} step={1} value={[0, searchRadius]} onChange={(val) => setSearchRadius(val[1])}>
                                <RangeSliderTrack bg='gray.200'><RangeSliderFilledTrack bg='teal.400' /></RangeSliderTrack>
                                <RangeSliderThumb index={1} boxSize={4} shadow="md" borderColor="teal.400" />
                            </RangeSlider>
                        </Box>
                        <Box px={2}>
                            <Text fontSize="xs" mb={1} color="gray.500">Giá tối đa: {formatCurrency(priceRange)}</Text>
                            <RangeSlider aria-label={['min', 'max']} defaultValue={[0, 1000000]} min={0} max={2000000} step={50000} value={[0, priceRange]} onChange={(val) => setPriceRange(val[1])}>
                                <RangeSliderTrack bg='gray.200'><RangeSliderFilledTrack bg='blue.400' /></RangeSliderTrack>
                                <RangeSliderThumb index={1} boxSize={4} shadow="md" />
                            </RangeSlider>
                        </Box>
                        <Flex align="center" justify="space-between" px={2}>
                            <Text fontSize="xs" color="gray.500">Bản đồ nhiệt</Text>
                            <Switch size="sm" isChecked={isHeatmap} onChange={() => setIsHeatmap(!isHeatmap)} />
                        </Flex>
                    </VStack>
                )}

                <Divider />

                {!showMatches && top5 && top5.length > 0 && (
                    <Box>
                        <HStack mb={2}>
                            <Icon as={FaFire} color="orange.500" />
                            <Text fontWeight="bold" fontSize="xs" color="orange.500" textTransform="uppercase">Gợi ý hàng đầu</Text>
                        </HStack>
                        <Flex overflowX="auto" pb={2} css={{ '&::-webkit-scrollbar': { height: '4px' }, '&::-webkit-scrollbar-thumb': { background: '#CBD5E0', borderRadius: '4px' } }}>
                            {top5.map(item => (
                                <Box key={`top-${item.id}`} minW="140px" maxW="140px" mr={2} p={2} borderRadius="lg" bg="orange.50" border="1px solid" borderColor="orange.200" cursor="pointer" onClick={() => handleFacilityClick(item)}>
                                    <ChakraImage src={item.image_url ? `http://localhost:5000/${item.image_url}` : 'https://placehold.co/100'} h="80px" w="100%" objectFit="cover" borderRadius="md" mb={1} fallbackSrc="https://placehold.co/100?text=No+Image" />
                                    <Text fontSize="xs" fontWeight="bold" noOfLines={1}>{item.name}</Text>
                                    <HStack spacing={1}><Icon as={FaStar} color="orange.400" size="10px" /><Text fontSize="xs">{item.avg_rating || 5.0}</Text></HStack>
                                </Box>
                            ))}
                        </Flex>
                        <Divider mt={2} />
                    </Box>
                )}

                <Text fontWeight="bold" fontSize="sm" color="gray.500" textTransform="uppercase">DANH SÁCH ({filteredItems.length})</Text>

                <VStack spacing={3} align="stretch" pb={20}>
                    {filteredItems.map(item => {
                        // 🔥 CHECK XEM MÌNH CÓ PHẢI CHỦ KÈO KHÔNG
                        const isHost = currentUser && currentUser.id === item.user_id;
                        const isLocked = item.status === 'locked';

                        return (
                            <Box 
                                key={item.id} 
                                p={3} borderRadius="xl" bg={isLocked ? "gray.50" : "white"} border="1px solid" borderColor={isLocked ? "gray.300" : "gray.100"} shadow="sm" 
                                _hover={{ shadow: 'md', borderColor: 'blue.300', transform: 'translateY(-2px)' }} 
                                transition="all 0.2s" cursor="pointer"
                                onClick={() => handleFacilityClick(item)}
                                opacity={isLocked ? 0.8 : 1}
                            >
                                {showMatches ? (
                                    <VStack align="start" spacing={3}>
                                        <HStack justify="space-between" w="100%">
                                            <Badge colorScheme={isLocked ? "gray" : "purple"} fontSize="xs">{isLocked ? "Đã Khóa" : `Kèo ${item.level}`}</Badge>
                                            <HStack>
                                                <Text fontSize="xs" color="gray.500">{new Date(item.created_at).toLocaleDateString()}</Text>
                                                
                                                {/* 🔥 NÚT QUYỀN LỰC CHO CHỦ KÈO: XÓA & KHÓA */}
                                                {isHost && (
                                                    <HStack spacing={1}>
                                                        <IconButton 
                                                            icon={isLocked ? <FaUnlock /> : <FaLock />} 
                                                            size="xs" colorScheme={isLocked ? "blue" : "orange"} variant="ghost" aria-label="Lock"
                                                            onClick={(e) => { e.stopPropagation(); handleLockMatch(item.id, item.status); }}
                                                        />
                                                        <IconButton 
                                                            icon={<FaTrash />} 
                                                            size="xs" colorScheme="red" variant="ghost" aria-label="Delete"
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteMatch(item.id); }}
                                                        />
                                                    </HStack>
                                                )}
                                            </HStack>
                                        </HStack>
                                        
                                        <Box>
                                            <Text fontWeight="bold" fontSize="md" color="purple.700" mb={1}>{item.title}</Text>
                                            <HStack fontSize="sm" color="gray.600" mb={1}>
                                                <Icon as={FaCalendarAlt} color="purple.400" />
                                                <Text fontWeight="medium">{item.match_time}</Text>
                                            </HStack>
                                            <HStack w="100%" justify="space-between" align="center">
                                                <HStack fontSize="sm" color="gray.600" flex={1}>
                                                    <Icon as={FaMapMarkerAlt} color="red.400" />
                                                    <Text noOfLines={1} fontSize="sm">{item.court_name}</Text>
                                                </HStack>
                                                <Button size="xs" colorScheme="blue" variant="outline" leftIcon={<FaDirections />} onClick={(e) => { e.stopPropagation(); handleDrawRoute(item, 'driving'); }}>
                                                    Chỉ đường
                                                </Button>
                                            </HStack>
                                        </Box>

                                        <Divider />

                                        {/* DANH SÁCH NGƯỜI CHƠI */}
                                        <HStack w="100%" justify="space-between">
                                            <Text fontSize="xs" fontWeight="bold" color="gray.500">
                                                Đã tham gia ({item.real_current_players}/{item.max_players})
                                            </Text>
                                            
                                            <Popover placement='top' isLazy>
                                                <PopoverTrigger>
                                                    <Button size="xs" leftIcon={<FaPhone />} colorScheme="teal" variant="solid" onClick={(e) => e.stopPropagation()}>
                                                        Liên hệ
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="notranslate" w="300px" onClick={(e) => e.stopPropagation()}>
                                                    <PopoverArrow />
                                                    <PopoverCloseButton />
                                                    <PopoverHeader fontWeight="bold" fontSize="sm">📞 Danh sách liên lạc</PopoverHeader>
                                                    <PopoverBody maxH="250px" overflowY="auto">
                                                        <VStack align="stretch" spacing={3}>
                                                            {item.participants && item.participants.length > 0 ? item.participants.map(p => (
                                                                <HStack key={p.id} justify="space-between" bg="gray.50" p={2} borderRadius="md">
                                                                    <HStack cursor="pointer" onClick={() => handleViewProfile && handleViewProfile(p)}>
                                                                        <Avatar size="sm" src={p.avatar} name={p.name} />
                                                                        <Box>
                                                                            <Text fontSize="xs" fontWeight="bold">
                                                                                {p.name}
                                                                                {p.id === item.user_id && <Badge ml={1} colorScheme="yellow" fontSize="8px">Chủ kèo</Badge>}
                                                                            </Text>
                                                                            <Text fontSize="xs" color="gray.500">{p.phone || "Không có SĐT"}</Text>
                                                                        </Box>
                                                                    </HStack>
                                                                    
                                                                    <HStack spacing={1}>
                                                                        {/* 🔥 CHỦ KÈO CÓ QUYỀN ĐUỔI NGƯỜI (Trừ chính mình) */}
                                                                        {isHost && p.id !== currentUser.id && (
                                                                            <IconButton 
                                                                                icon={<FaUserTimes />} size="xs" colorScheme="red" variant="outline" aria-label="Kick" isRound
                                                                                onClick={() => handleKickUser(item.id, p.id)}
                                                                            />
                                                                        )}
                                                                        {p.phone && (
                                                                            <>
                                                                                <IconButton as="a" href={`tel:${p.phone}`} icon={<FaPhone />} size="xs" colorScheme="green" aria-label="Call" isRound />
                                                                                <IconButton as="a" href={`https://zalo.me/${p.phone}`} target="_blank" icon={<FaCommentDots />} size="xs" colorScheme="blue" aria-label="Zalo" isRound />
                                                                            </>
                                                                        )}
                                                                    </HStack>
                                                                </HStack>
                                                            )) : (
                                                                <Text fontSize="xs" color="gray.500" textAlign="center">Chưa có ai tham gia.</Text>
                                                            )}
                                                        </VStack>
                                                    </PopoverBody>
                                                </PopoverContent>
                                            </Popover>
                                        </HStack>

                                        <AvatarGroup size='sm' max={5}>
                                            {item.participants && item.participants.map(p => (
                                                <Tooltip key={p.id} label={p.name}>
                                                    <Avatar name={p.name} src={p.avatar} cursor="pointer" onClick={(e) => { e.stopPropagation(); handleViewProfile && handleViewProfile(p); }} />
                                                </Tooltip>
                                            ))}
                                        </AvatarGroup>

                                        <Button 
                                            size="sm" colorScheme={isLocked ? "gray" : "green"} w="100%" leftIcon={isLocked ? <FaLock /> : <FaHandshake />}
                                            onClick={(e) => { e.stopPropagation(); handleJoinMatch(item.id); }}
                                            isDisabled={item.real_current_players >= item.max_players || isLocked}
                                        >
                                            {isLocked ? "Kèo Đã Khóa" : item.real_current_players >= item.max_players ? "Đã Đủ Người" : "Tham Gia Ngay"}
                                        </Button>
                                    </VStack>
                                ) : (
                                    <HStack align="start" spacing={3}>
                                        <ChakraImage src={item.image_url ? `http://localhost:5000/${item.image_url}` : 'https://placehold.co/100'} boxSize="80px" objectFit="cover" borderRadius="lg" fallbackSrc="https://placehold.co/100?text=No+Image" />
                                        <VStack align="start" spacing={1} flex={1}>
                                            <Text fontWeight="bold" fontSize="sm" noOfLines={1}>{item.name}</Text>
                                            <HStack fontSize="xs" color="gray.500"><Icon as={FaMapMarkerAlt} color="red.400"/><Text noOfLines={1}>{item.address}</Text></HStack>
                                            <HStack mt={1}>{item.sports && item.sports.slice(0,3).map(s => (<Badge key={s} colorScheme="blue" fontSize="8px">{s}</Badge>))}</HStack>
                                            <Text fontSize="xs" fontWeight="bold" color="green.600">{item.min_price ? formatCurrency(item.min_price) : 'Liên hệ'}</Text>
                                        </VStack>
                                    </HStack>
                                )}
                            </Box>
                        );
                    })}
                </VStack>
            </VStack>
        </Box>
    );
};

export default SidebarList;