import React, { useState, useEffect } from 'react'; 
import { 
    Box, Flex, Text, VStack, HStack, Input, InputGroup, InputLeftElement, Icon, Button, Badge, 
    Select, RangeSlider, RangeSliderTrack, RangeSliderFilledTrack, RangeSliderThumb, Switch, Avatar,
    Divider, Image as ChakraImage, AvatarGroup, Tooltip, Popover, PopoverTrigger, PopoverContent, 
    PopoverArrow, PopoverCloseButton, PopoverHeader, PopoverBody, IconButton, 
    Menu, MenuButton, MenuList, MenuItem, useColorModeValue, Collapse, useDisclosure 
} from '@chakra-ui/react';
import { 
    FaSearch, FaMapMarkerAlt, FaCalendarAlt, FaFire, FaDirections, FaPhone, FaCommentDots, 
    FaTrash, FaLock, FaUnlock, FaUserTimes, FaPlus, FaTrophy, FaLocationArrow, FaChevronDown, FaPen, FaStar, FaHandshake,
    FaChevronLeft, FaChevronRight, FaSlidersH 
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
    top5 = [], handleDrawRoute, handleViewProfile, currentUser, handleDeleteMatch,
    handleKickUser, handleLockMatch, getImgUrl, handleEditMatch 
}) => {
    
    // ========================================================
    // 🔥 LOGIC PHÂN TRANG (PAGINATION)
    // ========================================================
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10; 

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType, selectedWard, searchRadius, priceRange, showMatches, filteredItems.length]);

    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        const listContainer = document.getElementById('sidebar-scroll-container');
        if (listContainer) {
            listContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // ========================================================
    // CÔNG TẮC BỘ LỌC (COLLAPSE)
    // ========================================================
    const { isOpen: isFilterOpen, onToggle: onFilterToggle } = useDisclosure({ defaultIsOpen: false });

    const activeFilterCount = [
        filterType !== '',
        selectedWard !== '',
        searchRadius !== 5,
        priceRange !== 1000000,
        isHeatmap === true
    ].filter(Boolean).length;

    // ========================================================
    // 🎨 NEUMORPHISM STYLES (Đồng bộ với UserPage.jsx)
    // ========================================================
    const neumorphBg = useColorModeValue('#edf2f7', '#2d3748');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '4px 4px 10px #1a202c, -4px -4px 10px #4a5568');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #1a202c, inset -4px -4px 8px #4a5568');
    
    const textColor = useColorModeValue("gray.700", "gray.200");
    const textMuted = useColorModeValue("gray.500", "gray.400");
    
    const highlightBg = useColorModeValue("rgba(128, 90, 213, 0.05)", "rgba(128, 90, 213, 0.15)");
    const highlightText = useColorModeValue("purple.600", "purple.300");
    
    const cardBgLocked = useColorModeValue("gray.200", "gray.800");

    if (!isMobile && !isSidebarOpen) return null;

    const getCurrentSportLabel = () => {
        if (!filterType) return "Tất cả môn";
        return filterType.charAt(0).toUpperCase() + filterType.slice(1);
    };

    return (
        <Box id="sidebar-scroll-container" w={isMobile ? "100%" : "400px"} h="100%" bg={neumorphBg} zIndex={1000} overflowY="auto" transition="width 0.3s ease">
            <VStack p={4} spacing={5} align="stretch" pb={24}>
                
                {/* 1. CHẾ ĐỘ TÌM KÈO */}
                <Box p={4} borderRadius="2xl" bg={showMatches ? highlightBg : neumorphBg} boxShadow={showMatches ? neumorphActiveShadow : neumorphShadow} transition="all 0.3s">
                    <Flex align="center" justify="space-between" mb={showMatches ? 3 : 0}>
                        <HStack>
                            <Icon as={FaTrophy} color={showMatches ? "purple.500" : textMuted} />
                            <Text fontWeight="800" fontSize="sm" color={showMatches ? highlightText : textColor}>TÌM KÈO GIAO LƯU</Text>
                        </HStack>
                        <Switch isChecked={showMatches} onChange={() => setShowMatches(!showMatches)} colorScheme="purple" />
                    </Flex>
                    {showMatches && (
                        <Button 
                            w="100%" size="sm" colorScheme="purple" variant="solid" borderRadius="xl"
                            leftIcon={<FaPlus />} 
                            onClick={() => { if(handleEditMatch) handleEditMatch(null); onCreateMatchOpen(); }}
                        >
                            Đăng kèo mới 
                        </Button>
                    )}
                </Box>

                {/* 2. THANH TÌM KIẾM CHÍNH */}
                <InputGroup>
                    <InputLeftElement pointerEvents="none"><Icon as={FaSearch} color={textMuted} /></InputLeftElement>
                    <Input 
                        placeholder={showMatches ? "Tìm kèo..." : "Tìm sân, môn thể thao..."} 
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
                        borderRadius="full" bg={neumorphBg} border="none" color={textColor}
                        boxShadow={neumorphActiveShadow}
                        _focus={{ boxShadow: neumorphActiveShadow }} 
                    />
                </InputGroup>

                {/* 3. BỘ LỌC (COLLAPSE) */}
                {!showMatches && (
                    <VStack spacing={3} align="stretch">
                        <Button 
                            w="100%" size="sm" bg={neumorphBg} boxShadow={isFilterOpen ? neumorphActiveShadow : neumorphShadow} color={textColor}
                            onClick={onFilterToggle} justifyContent="space-between" border="none" _hover={{}} _active={{ boxShadow: neumorphActiveShadow }}
                            rightIcon={<FaChevronDown style={{ transform: isFilterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />}
                        >
                            <HStack>
                                <Icon as={FaSlidersH} color="blue.500"/>
                                <Text>Bộ lọc nâng cao</Text>
                                {activeFilterCount > 0 && <Badge colorScheme="red" borderRadius="full" ml={1} px={2}>{activeFilterCount}</Badge>}
                            </HStack>
                        </Button>

                        <Collapse in={isFilterOpen} animateOpacity>
                            <Box p={5} borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphActiveShadow}>
                                <VStack spacing={4} align="stretch">
                                    
                                    {/* Môn thể thao */}
                                    <Box>
                                        <Text fontSize="xs" fontWeight="bold" color={textMuted} mb={2}>Môn Thể Thao</Text>
                                        <Menu isLazy matchWidth>
                                            <MenuButton as={Button} rightIcon={<FaChevronDown size="10px" />} textAlign="left" w="100%" bg={neumorphBg} color={textColor} boxShadow={neumorphShadow} border="none" borderRadius="xl" size="sm" _hover={{}} _active={{ boxShadow: neumorphActiveShadow }}>
                                                <HStack>
                                                    {filterType && iconUrlMap[filterType] && <ChakraImage src={getImgUrl(iconUrlMap[filterType])} boxSize="16px" objectFit="contain" />}
                                                    <Text fontWeight="bold">{getCurrentSportLabel()}</Text>
                                                </HStack>
                                            </MenuButton>
                                            <MenuList zIndex={2000} maxH="250px" overflowY="auto" bg={neumorphBg} border="none" boxShadow="xl">
                                                <MenuItem bg={neumorphBg} color={textColor} _hover={{boxShadow: neumorphActiveShadow}} onClick={() => setFilterType('')} fontWeight="bold">Tất cả môn</MenuItem>
                                                {Object.keys(iconUrlMap).map(type => (
                                                    <MenuItem key={type} bg={neumorphBg} color={textColor} _hover={{boxShadow: neumorphActiveShadow}} onClick={() => setFilterType(type)}>
                                                        <HStack>
                                                            <ChakraImage src={getImgUrl(iconUrlMap[type])} boxSize="20px" objectFit="contain" fallbackSrc="https://placehold.co/20?text=?"/>
                                                            <Text>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                                                        </HStack>
                                                    </MenuItem>
                                                ))}
                                            </MenuList>
                                        </Menu>
                                    </Box>

                                    {/* Khu vực */}
                                    <Box>
                                        <Text fontSize="xs" fontWeight="bold" color={textMuted} mb={2}>Khu Vực & Vị Trí</Text>
                                        <HStack>
                                            <Select placeholder="Tất cả phường/xã" color={textColor} bg={neumorphBg} boxShadow={neumorphActiveShadow} border="none" value={selectedWard} onChange={(e) => handleSelectWard(e.target.value)} size="sm" borderRadius="xl">
                                                {wards.map(ward => (<option key={ward.id} value={ward.id}>{ward.name}</option>))}
                                            </Select>
                                            <Tooltip label="Tìm quanh đây" hasArrow>
                                                <IconButton size="sm" colorScheme="blue" bg={neumorphBg} color="blue.500" boxShadow={neumorphShadow} _active={{boxShadow: neumorphActiveShadow}} border="none" icon={<Icon as={BiCurrentLocation} />} onClick={handleFindNearby}/>
                                            </Tooltip>
                                        </HStack>
                                    </Box>

                                    {/* Bán kính */}
                                    <Box px={1}>
                                        <Flex justify="space-between" mb={1}>
                                            <Text fontSize="xs" color={textMuted}>Bán kính tìm kiếm:</Text>
                                            <Text fontSize="xs" fontWeight="bold" color="blue.500">{searchRadius} km</Text>
                                        </Flex>
                                        <RangeSlider aria-label={['min', 'max']} defaultValue={[0, 20]} min={1} max={100} step={1} value={[0, searchRadius]} onChange={(val) => setSearchRadius(val[1])}>
                                            <RangeSliderTrack bg={useColorModeValue('gray.300', 'gray.600')}><RangeSliderFilledTrack bg='blue.400' /></RangeSliderTrack>
                                            <RangeSliderThumb index={1} boxSize={4} shadow="md" borderColor="blue.400" />
                                        </RangeSlider>
                                    </Box>

                                    {/* Giá tiền */}
                                    <Box px={1}>
                                        <Flex justify="space-between" mb={1}>
                                            <Text fontSize="xs" color={textMuted}>Giá tối đa:</Text>
                                            <Text fontSize="xs" fontWeight="bold" color="green.500">{formatCurrency(priceRange)}</Text>
                                        </Flex>
                                        <RangeSlider aria-label={['min', 'max']} defaultValue={[0, 1000000]} min={0} max={2000000} step={50000} value={[0, priceRange]} onChange={(val) => setPriceRange(val[1])}>
                                            <RangeSliderTrack bg={useColorModeValue('gray.300', 'gray.600')}><RangeSliderFilledTrack bg='green.400' /></RangeSliderTrack>
                                            <RangeSliderThumb index={1} boxSize={4} shadow="md" borderColor="green.400" />
                                        </RangeSlider>
                                    </Box>

                                    {/* Bản đồ nhiệt */}
                                    <Flex align="center" justify="space-between" px={1}>
                                        <Text fontSize="xs" fontWeight="bold" color={textMuted}>Bật Bản đồ nhiệt (Heatmap)</Text>
                                        <Switch size="sm" colorScheme="orange" isChecked={isHeatmap} onChange={() => setIsHeatmap(!isHeatmap)} />
                                    </Flex>

                                    {activeFilterCount > 0 && (
                                        <Button size="xs" colorScheme="red" variant="ghost" onClick={() => { setFilterType(''); setSelectedWard(''); setSearchRadius(5); setPriceRange(1000000); setIsHeatmap(false); }}>
                                            Xóa bộ lọc
                                        </Button>
                                    )}
                                </VStack>
                            </Box>
                        </Collapse>
                    </VStack>
                )}

                <Divider borderColor={useColorModeValue('gray.300', 'gray.600')} opacity={0.3} />

                {/* DANH SÁCH HOT NHẤT (Top 5) */}
                {!showMatches && top5 && top5.length > 0 && (
                    <Box>
                        <HStack mb={3} justify="space-between" px={1}>
                            <HStack>
                                <Icon as={FaFire} color="orange.500" />
                                <Text fontWeight="900" fontSize="xs" color="orange.500" textTransform="uppercase">Đang Hot Nhất</Text>
                            </HStack>
                            <Badge colorScheme="orange" variant="subtle" fontSize="9px" borderRadius="full" px={2}>Gợi ý chuẩn</Badge>
                        </HStack>
                        <Flex overflowX="auto" pb={3} px={1} css={{ '&::-webkit-scrollbar': { height: '0px' } }}>
                            {top5.map(item => {
                                const realRating = parseFloat(item.avg_rating);
                                const isNew = isNaN(realRating) || realRating === 0;

                                return (
                                    <Box 
                                        key={`top-${item.id}`} 
                                        minW="160px" maxW="160px" mr={4} p={3} 
                                        borderRadius="2xl" bg={neumorphBg} boxShadow={neumorphShadow}
                                        cursor="pointer" onClick={() => handleFacilityClick(item)} position="relative"
                                        _hover={{ boxShadow: neumorphActiveShadow }} transition="all 0.2s" border="none"
                                    >
                                        <Box position="relative">
                                            <ChakraImage src={getImgUrl(item.image_url)} h="90px" w="100%" objectFit="cover" borderRadius="xl" mb={3} fallbackSrc="https://placehold.co/100?text=No+Image" />
                                            {item.booking_count > 0 && (
                                                <Badge position="absolute" bottom={1} left={1} bg="rgba(0,0,0,0.6)" backdropFilter="blur(4px)" color="white" fontSize="8px" border="none" borderRadius="md" px={2}>
                                                    🛒 {item.booking_count} lượt đặt
                                                </Badge>
                                            )}
                                        </Box>

                                        <Text fontSize="xs" fontWeight="900" color={textColor} noOfLines={1} mb={1}>{item.name}</Text>
                                        
                                        <HStack justify="space-between" align="center" mb={1}>
                                            <HStack spacing={1}>
                                                <Icon as={FaStar} color={isNew ? "gray.400" : "orange.400"} boxSize="10px" />
                                                <Text fontSize="xs" fontWeight="bold" color={isNew ? "gray.500" : "orange.500"}>
                                                    {isNew ? "Mới" : realRating.toFixed(1)}
                                                </Text>
                                            </HStack>
                                            <Text fontSize="9px" color={textMuted} fontWeight="bold">👁️ {item.view_count || 0}</Text>
                                        </HStack>

                                        {item.calculated_distance && (
                                            <HStack spacing={1}>
                                                <Icon as={FaLocationArrow} color="blue.500" boxSize="10px" />
                                                <Text fontSize="xs" fontWeight="bold" color="blue.500">{item.calculated_distance} km</Text>
                                            </HStack>
                                        )}
                                    </Box>
                                );
                            })}
                        </Flex>
                        <Divider mt={3} borderColor={useColorModeValue('gray.300', 'gray.600')} opacity={0.3} />
                    </Box>
                )}

                <HStack justify="space-between" px={1}>
                    <Text fontWeight="800" fontSize="sm" color={textMuted} textTransform="uppercase">DANH SÁCH ({filteredItems.length})</Text>
                    {totalPages > 1 && <Text fontSize="xs" color={textMuted} fontWeight="bold">Trang {currentPage}/{totalPages}</Text>}
                </HStack>

                {/* DANH SÁCH CHÍNH */}
                <VStack spacing={4} align="stretch" pb={4} px={1}>
                    {currentItems.length === 0 && (
                        <Text fontSize="sm" color={textMuted} textAlign="center" py={5}>Không tìm thấy kết quả phù hợp.</Text>
                    )}
                    {currentItems.map(item => {
                        const isHost = currentUser && currentUser.id === item.user_id;
                        const isLocked = item.status === 'locked';
                        const isExpired = item.match_time ? new Date(item.match_time) < new Date() : false;
                        const isPriceZero = !item.min_price || parseInt(item.min_price) === 0;

                        return (
                            <Box 
                                key={item.id} p={4} borderRadius="2xl" 
                                bg={isLocked || isExpired ? cardBgLocked : neumorphBg} 
                                boxShadow={isLocked || isExpired ? neumorphActiveShadow : neumorphShadow}
                                border="none"
                                _hover={{ boxShadow: neumorphActiveShadow, transform: isLocked || isExpired ? 'none' : 'scale(0.99)' }} 
                                transition="all 0.2s ease" cursor="pointer" onClick={() => handleFacilityClick(item)}
                                opacity={isLocked || isExpired ? 0.7 : 1}
                            >
                                {showMatches ? (
                                    <VStack align="start" spacing={3}>
                                        <HStack justify="space-between" w="100%">
                                            <Badge colorScheme={isLocked ? "gray" : isExpired ? "red" : "purple"} fontSize="xs" px={2} borderRadius="md">
                                                {isLocked ? "Đã Khóa" : isExpired ? "Đã Quá Giờ" : `Kèo ${item.level}`}
                                            </Badge>
                                            <HStack>
                                                <Text fontSize="xs" color={textMuted} fontWeight="bold">{new Date(item.created_at).toLocaleDateString()}</Text>
                                                {isHost && (
                                                    <HStack spacing={1}>
                                                        {!isLocked && !isExpired && (
                                                            <IconButton icon={<FaPen />} size="xs" colorScheme="blue" variant="ghost" aria-label="Edit" onClick={(e) => { e.stopPropagation(); if(handleEditMatch) handleEditMatch(item); onCreateMatchOpen(); }}/>
                                                        )}
                                                        <IconButton icon={isLocked ? <FaUnlock /> : <FaLock />} size="xs" colorScheme={isLocked ? "blue" : "orange"} variant="ghost" aria-label="Lock" onClick={(e) => { e.stopPropagation(); handleLockMatch(item.id, item.status); }}/>
                                                        <IconButton icon={<FaTrash />} size="xs" colorScheme="red" variant="ghost" aria-label="Delete" onClick={(e) => { e.stopPropagation(); handleDeleteMatch(item.id); }}/>
                                                    </HStack>
                                                )}
                                            </HStack>
                                        </HStack>
                                        
                                        <Box w="100%">
                                            <Text fontWeight="900" fontSize="md" color={isExpired ? textMuted : highlightText} mb={2}>{item.title}</Text>
                                            <HStack fontSize="sm" color={isExpired ? "red.400" : textMuted} mb={2}>
                                                <Icon as={FaCalendarAlt} color={isExpired ? "red.400" : "purple.500"} />
                                                <Text fontWeight="800">{item.match_time}</Text>
                                            </HStack>
                                            <HStack w="100%" justify="space-between" align="center" bg={useColorModeValue('gray.100', 'gray.700')} p={2} borderRadius="lg">
                                                <HStack fontSize="sm" color={textColor} flex={1}>
                                                    <Icon as={FaMapMarkerAlt} color="red.500" />
                                                    <Text noOfLines={1} fontSize="sm" fontWeight="bold">{item.court_name}</Text>
                                                </HStack>
                                                <Button size="xs" colorScheme="blue" leftIcon={<FaDirections />} onClick={(e) => { e.stopPropagation(); handleDrawRoute(item, 'driving'); }} borderRadius="full">Đường đi</Button>
                                            </HStack>
                                        </Box>

                                        <Divider borderColor={useColorModeValue('gray.300', 'gray.600')} opacity={0.3} />

                                        <HStack w="100%" justify="space-between" align="center">
                                            <Text fontSize="xs" fontWeight="bold" color={textMuted}>
                                                Tham gia ({item.real_current_players}/{item.max_players})
                                            </Text>
                                            <Popover placement='top' isLazy>
                                                <PopoverTrigger>
                                                    <Button size="xs" leftIcon={<FaPhone />} colorScheme="teal" borderRadius="full" onClick={(e) => e.stopPropagation()}>Liên hệ</Button>
                                                </PopoverTrigger>
                                                <PopoverContent bg={neumorphBg} border="none" boxShadow="xl" w="300px" onClick={(e) => e.stopPropagation()}>
                                                    <PopoverArrow bg={neumorphBg} />
                                                    <PopoverCloseButton color={textColor} />
                                                    <PopoverHeader color={textColor} border="none" fontWeight="bold" fontSize="sm">📞 Danh sách liên lạc</PopoverHeader>
                                                    <PopoverBody maxH="250px" overflowY="auto">
                                                        <VStack align="stretch" spacing={3}>
                                                            {item.participants && item.participants.length > 0 ? item.participants.map(p => (
                                                                <HStack key={p.id} justify="space-between" bg={useColorModeValue('gray.100', 'gray.700')} p={2} borderRadius="xl">
                                                                    <HStack cursor="pointer" onClick={() => handleViewProfile && handleViewProfile(p)}>
                                                                        <Avatar size="sm" src={p.avatar} name={p.name} />
                                                                        <Box>
                                                                            <Text fontSize="xs" fontWeight="bold" color={textColor}>{p.name} {p.id === item.user_id && <Badge ml={1} colorScheme="yellow" fontSize="8px">Chủ</Badge>}</Text>
                                                                            <Text fontSize="xs" color={textMuted}>{p.phone || "Không có SĐT"}</Text>
                                                                        </Box>
                                                                    </HStack>
                                                                    <HStack spacing={1}>
                                                                        {isHost && p.id !== currentUser.id && (<IconButton icon={<FaUserTimes />} size="xs" colorScheme="red" variant="ghost" aria-label="Kick" isRound onClick={() => handleKickUser(item.id, p.id)}/>)}
                                                                        {p.phone && (<><IconButton as="a" href={`tel:${p.phone}`} icon={<FaPhone />} size="xs" colorScheme="green" isRound /><IconButton as="a" href={`https://zalo.me/${p.phone}`} target="_blank" icon={<FaCommentDots />} size="xs" colorScheme="blue" isRound /></>)}
                                                                    </HStack>
                                                                </HStack>
                                                            )) : (<Text fontSize="xs" color={textMuted} textAlign="center">Chưa có ai tham gia.</Text>)}
                                                        </VStack>
                                                    </PopoverBody>
                                                </PopoverContent>
                                            </Popover>
                                        </HStack>
                                        
                                        <AvatarGroup size='sm' max={5}>
                                            {item.participants && item.participants.map(p => (
                                                <Tooltip key={p.id} label={p.name}>
                                                    <Avatar name={p.name} src={p.avatar} cursor="pointer" border="2px solid" borderColor={neumorphBg} onClick={(e) => { e.stopPropagation(); handleViewProfile && handleViewProfile(p); }} />
                                                </Tooltip>
                                            ))}
                                        </AvatarGroup>

                                        <Button size="sm" colorScheme={isLocked || isExpired ? "gray" : "green"} w="100%" borderRadius="xl" leftIcon={isLocked ? <FaLock /> : <FaHandshake />} onClick={(e) => { e.stopPropagation(); handleJoinMatch(item.id); }} isDisabled={item.real_current_players >= item.max_players || isLocked || isExpired}>
                                            {isLocked ? "Kèo Đã Khóa" : isExpired ? "Đã Quá Giờ" : item.real_current_players >= item.max_players ? "Đã Đủ Người" : "Tham Gia Ngay"}
                                        </Button>
                                    </VStack>
                                ) : (
                                    <HStack align="start" spacing={4}>
                                        <ChakraImage src={getImgUrl(item.image_url)} boxSize="90px" objectFit="cover" borderRadius="xl" fallbackSrc="https://placehold.co/100?text=No+Image" />
                                        <VStack align="start" spacing={1.5} flex={1}>
                                            <Text fontWeight="900" fontSize="sm" color={textColor} noOfLines={2}>{item.name}</Text>
                                            <HStack fontSize="xs" color={textMuted} align="start">
                                                <Icon as={FaMapMarkerAlt} color="red.500" mt={0.5}/>
                                                <Text noOfLines={2}>{item.address}</Text>
                                            </HStack>
                                            
                                            {item.calculated_distance && (
                                                <HStack fontSize="xs" color="blue.500">
                                                    <Icon as={FaLocationArrow} size="10px"/>
                                                    <Text fontWeight="bold">{item.calculated_distance} km</Text>
                                                </HStack>
                                            )}

                                            <HStack mt={1} wrap="wrap">
                                                {item.sports && item.sports.slice(0,3).map(s => {
                                                    const iconUrl = iconUrlMap[s];
                                                    return (
                                                        <Badge key={s} colorScheme="blue" variant="subtle" fontSize="8px" display="flex" alignItems="center" px={1.5} py={0.5} borderRadius="full" mb={1}>
                                                            {iconUrl && <ChakraImage src={getImgUrl(iconUrl)} w="12px" h="12px" mr={1} ignoreFallback />}
                                                            {s}
                                                        </Badge>
                                                    );
                                                })}
                                            </HStack>
                                            
                                            <Text fontSize="sm" fontWeight="900" color={isPriceZero ? textMuted : "green.500"} mt={1}>
                                                {isPriceZero ? "Đang cập nhật" : formatCurrency(item.min_price)}
                                            </Text>
                                        </VStack>
                                    </HStack>
                                )}
                            </Box>
                        );
                    })}
                </VStack>

                {/* THANH CHUYỂN TRANG */}
                {totalPages > 1 && (
                    <Flex justify="center" align="center" pt={2} pb={10} gap={4}>
                        <IconButton 
                            icon={<FaChevronLeft />} size="md" isRound colorScheme="blue" bg={neumorphBg} boxShadow={neumorphShadow} border="none" color="blue.500"
                            isDisabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} aria-label="Trang trước"
                        />
                        <HStack spacing={1}>
                            <Text fontSize="md" fontWeight="900" color="blue.500">{currentPage}</Text>
                            <Text fontSize="md" fontWeight="bold" color={textMuted}>/ {totalPages}</Text>
                        </HStack>
                        <IconButton 
                            icon={<FaChevronRight />} size="md" isRound colorScheme="blue" bg={neumorphBg} boxShadow={neumorphShadow} border="none" color="blue.500"
                            isDisabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)} aria-label="Trang sau"
                        />
                    </Flex>
                )}

            </VStack>
        </Box>
    );
};

export default SidebarList;