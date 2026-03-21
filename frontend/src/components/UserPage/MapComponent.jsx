import React, { useEffect } from 'react';
import { Marker, Popup, Polyline, GeoJSON, useMap } from 'react-leaflet';
import { Text, VStack, HStack, Badge, Button, Icon, Box, Image, Divider, Flex, IconButton, Tooltip, useColorModeValue, useColorMode } from '@chakra-ui/react';
import { FaMapMarkerAlt, FaStar, FaDirections, FaMapMarkedAlt, FaChevronRight } from 'react-icons/fa';
import MarkerClusterGroup from 'react-leaflet-cluster'; 
import L from 'leaflet';

const getImgUrl = (url) => { 
    if (!url) return 'https://placehold.co/300x150?text=Chưa+có+ảnh'; 
    if (url.includes('via.placeholder.com') || url.includes('placehold.co')) return url;
    if (url.startsWith('http')) return url; 
    const cleanPath = url.replace(/\\/g, '/').replace(/^\/+/, ''); 
    return `http://localhost:5000/${cleanPath}`; 
};

// ==========================================
// 🔥 CUSTOM LEAFLET POPUP CSS (Phá bỏ xiềng xích Leaflet cũ)
// ==========================================
const popupStyle = `
  .custom-neumorph-popup .leaflet-popup-content-wrapper {
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
  .custom-neumorph-popup .leaflet-popup-content {
    margin: 0 !important;
    width: 280px !important;
  }
  .custom-neumorph-popup .leaflet-popup-tip {
    display: none !important;
  }
  .custom-neumorph-popup .leaflet-popup-close-button {
    display: none !important;
  }
`;

// 🔥 6. Marker User - Thêm Pulse Animation
const userIcon = L.divIcon({
    className: 'custom-user-icon',
    html: `
        <style>
            @keyframes pulse-ring {
                0% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(49, 130, 206, 0.7); }
                70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(49, 130, 206, 0); }
                100% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(49, 130, 206, 0); }
            }
        </style>
        <div style="background-color: #3182CE; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5); animation: pulse-ring 1.5s infinite;"></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
});

const FlyTo = ({ position }) => {
    const map = useMap();
    useEffect(() => {
        if (position) map.flyTo(position, 15, { animate: true, duration: 1.5 });
    }, [position, map]);
    return null;
};

const FitBounds = ({ bounds }) => {
    const map = useMap();
    useEffect(() => {
        if (bounds) {
            try {
                const leafletBounds = L.geoJSON(bounds).getBounds();
                if (leafletBounds.isValid()) {
                    map.fitBounds(leafletBounds, { padding: [30, 30], animate: true, duration: 1.5 });
                }
            } catch(e) { console.error("Lỗi FitBounds:", e); }
        }
    }, [bounds, map]);
    return null;
};

// ==========================================
// COMPONENT CHÍNH
// ==========================================
const MapComponent = ({ items, showMatches, userLoc, flyToPosition, onMarkerClick, routeCoords, wardShape, wardBounds, customIcon, onDrawRoute }) => {
    const { colorMode } = useColorMode();
    
    // 🎨 MÀU SẮC NEUMORPHISM ĐỒNG BỘ
    const neumorphBg = useColorModeValue('#edf2f7', '#2d3748');
    const neumorphShadow = useColorModeValue('6px 6px 12px #b8bec5, -6px -6px 12px #ffffff', '4px 4px 10px #1a202c, -4px -4px 10px #4a5568');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #1a202c, inset -4px -4px 8px #4a5568');
    
    const textColor = useColorModeValue('gray.700', 'white');
    const textMuted = useColorModeValue('gray.500', 'gray.400');

    // 🔥 4. Cluster Icon - Neumorphism Style
    const createClusterIcon = (cluster) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 45 : count < 50 ? 55 : 65;
        const shadow = colorMode === 'light' 
            ? '4px 4px 8px #b8bec5, -4px -4px 8px #ffffff' 
            : '4px 4px 8px #1a202c, -4px -4px 8px #4a5568';
        
        const html = `
            <div style="
                background: ${neumorphBg}; 
                color: #3182CE; 
                width: ${size}px; 
                height: ${size}px; 
                border-radius: 50%; 
                box-shadow: ${shadow}; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-weight: 900; 
                font-size: ${count < 50 ? '14px' : '16px'};
                border: 2px solid ${colorMode === 'light' ? '#ffffff' : '#2d3748'};
            ">
                <div style="background: rgba(49, 130, 206, 0.1); width: 80%; height: 80%; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    ${count}
                </div>
            </div>`;
        
        return L.divIcon({ 
            html: html, 
            className: 'custom-cluster-icon', 
            iconSize: [size, size], 
            iconAnchor: [size / 2, size / 2] 
        });
    };
    
    // 🔥 1. Marker - Dạng Pin (Teardrop) + Neumorphic Shadow
    const getMarkerIcon = (item) => {
        if (customIcon && !showMatches) return customIcon;
        
        const isLocked = item.status === 'locked';
        const isExpired = item.match_time ? new Date(item.match_time) < new Date() : false;
        
        let color = '#38A169'; 
        let iconSymbol = '⚽';

        if (showMatches) {
            color = '#805AD5'; 
            iconSymbol = '🔥';
            if (isLocked || isExpired) {
                color = '#718096'; 
                iconSymbol = '🔒';
            }
        } else {
            if (item.status === 'pending') color = '#D69E2E'; 
            if (item.status === 'rejected' || item.status === 'blocked') color = '#E53E3E'; 
        }

        const shadow = colorMode === 'light' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.6)';

        return L.divIcon({
            className: 'custom-pin',
            html: `
                <div style="
                    background: ${color};
                    width: 32px;
                    height: 32px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 4px 4px 10px ${shadow};
                    border: 2px solid white;
                ">
                    <div style="transform: rotate(45deg); color: white; font-size: 14px; margin-top: 1px; margin-left: 1px;">${iconSymbol}</div>
                </div>`,
            iconSize: [32, 32], 
            iconAnchor: [16, 32], 
            popupAnchor: [0, -35]
        });
    };

    return (
        <>
            <style>{popupStyle}</style>

            {wardShape && (
                <GeoJSON 
                    key={JSON.stringify(wardShape).substring(0, 50)} 
                    data={wardShape} 
                    style={{ color: '#3182CE', weight: 3, opacity: 0.6, fillColor: '#3182CE', fillOpacity: 0.1, dashArray: '8, 12' }} 
                />
            )}

            {wardBounds && <FitBounds bounds={wardBounds} />}
            {!wardBounds && flyToPosition && <FlyTo position={flyToPosition} />}

            {userLoc && (
                <Marker position={userLoc} icon={userIcon}>
                    <Popup className="custom-neumorph-popup">
                        <Box bg={neumorphBg} p={3} borderRadius="xl" boxShadow={neumorphShadow} textAlign="center">
                            <Text fontWeight="900" fontSize="sm" color="blue.500">📍 VỊ TRÍ CỦA BẠN</Text>
                        </Box>
                    </Popup>
                </Marker>
            )}

            {routeCoords && <Polyline positions={routeCoords} color="#3182ce" weight={6} opacity={0.8} dashArray="10, 15" lineJoin="round" />}

            <MarkerClusterGroup chunkedLoading maxClusterRadius={40} iconCreateFunction={createClusterIcon}>
                {items.map(item => {
                    let lat = item.lat;
                    let lng = item.lng;
                    if (!lat || !lng) {
                        if (item.geometry?.coordinates) {
                            lat = item.geometry.coordinates[1];
                            lng = item.geometry.coordinates[0];
                        }
                    }
                    if (!lat || !lng) return null;

                    return (
                        <Marker key={item.id} position={[lat, lng]} icon={getMarkerIcon(item)}>
                            <Popup minWidth={280} maxWidth={280} className="custom-neumorph-popup">
                                {/* 🔥 CARD NỔI NEUMORPHISM */}
                                <Box w="100%" borderRadius="3xl" overflow="hidden" bg={neumorphBg} boxShadow={neumorphShadow} p={2} m={1}>
                                    
                                    {!showMatches && (
                                        <Box position="relative" w="100%" h="130px" borderRadius="2xl" overflow="hidden" mb={3} boxShadow={neumorphActiveShadow} border="4px solid" borderColor={neumorphBg}>
                                            <Image 
                                                src={getImgUrl(item.image_url)} 
                                                w="100%" h="100%" objectFit="cover" 
                                                fallbackSrc="https://placehold.co/300x150?text=San+The+Thao"
                                            />
                                            <Badge 
                                                position="absolute" bottom={3} right={3}
                                                bg="rgba(0,0,0,0.6)" backdropFilter="blur(5px)" color="white" borderRadius="full" px={3} py={1} fontSize="xs" fontWeight="900" border="none"
                                            >
                                                ⭐ {item.rating ? parseFloat(item.rating).toFixed(1) : "5.0"}
                                            </Badge>
                                        </Box>
                                    )}

                                    <VStack align="stretch" spacing={3} p={2}>
                                        <Text fontWeight="900" fontSize="lg" color={textColor} noOfLines={1} px={1}>
                                            {showMatches ? item.title : item.name}
                                        </Text>

                                        <Box bg={neumorphBg} p={3} borderRadius="2xl" boxShadow={neumorphActiveShadow}>
                                            <HStack align="flex-start" spacing={3}>
                                                <Icon as={FaMapMarkerAlt} color="red.500" mt="2px" boxSize={4} />
                                                <VStack align="flex-start" spacing={1}>
                                                    <Text fontSize="12px" fontWeight="bold" color={textColor} noOfLines={2} lineHeight="1.4">
                                                        {showMatches ? item.court_name : item.address}
                                                    </Text>
                                                    {item.calculated_distance && (
                                                        <Badge colorScheme="blue" variant="subtle" fontSize="10px" borderRadius="md" px={2}>
                                                            Cách bạn: {item.calculated_distance} km
                                                        </Badge>
                                                    )}
                                                </VStack>
                                            </HStack>
                                        </Box>

                                        {showMatches && (
                                            <Box bg={neumorphBg} p={2.5} borderRadius="xl" boxShadow={neumorphActiveShadow} textAlign="center" border="1px dashed" borderColor="purple.300">
                                                <Text fontSize="xs" fontWeight="900" color="purple.500">
                                                    ⏰ {item.match_time}
                                                </Text>
                                            </Box>
                                        )}

                                        <HStack spacing={3} w="100%" pt={1}>
                                            <Button 
                                                flex={1} size="md" colorScheme="blue" borderRadius="2xl"
                                                bgGradient="linear(to-r, blue.400, teal.400)" color="white" boxShadow="lg"
                                                _hover={{ transform: 'translateY(-2px)', shadow: 'xl' }}
                                                _active={{ transform: 'scale(0.95)' }}
                                                onClick={() => onMarkerClick && onMarkerClick(item)}
                                            >
                                                Chi tiết
                                            </Button>

                                            <IconButton 
                                                size="md" bg={neumorphBg} color="blue.500" borderRadius="2xl" boxShadow={neumorphShadow}
                                                icon={<FaDirections size={20} />}
                                                _hover={{ transform: 'translateY(-2px)' }}
                                                _active={{ boxShadow: neumorphActiveShadow, transform: 'scale(0.95)' }}
                                                onClick={() => onDrawRoute && onDrawRoute(item)}
                                                aria-label="Chỉ đường"
                                            />

                                            <IconButton 
                                                size="md" bg={neumorphBg} color="orange.500" borderRadius="2xl" boxShadow={neumorphShadow}
                                                icon={<FaMapMarkedAlt size={20} />}
                                                _hover={{ transform: 'translateY(-2px)' }}
                                                _active={{ boxShadow: neumorphActiveShadow, transform: 'scale(0.95)' }}
                                                onClick={() => {
                                                    const url = `http://maps.google.com/maps?q=$${lat},${lng}`;
                                                    window.open(url, '_blank');
                                                }}
                                                aria-label="Google Maps"
                                            />
                                        </HStack>
                                    </VStack>
                                </Box>
                            </Popup>
                        </Marker>
                    );
                })}
            </MarkerClusterGroup>
        </>
    );
};

export default MapComponent;