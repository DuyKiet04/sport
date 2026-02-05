import React, { useEffect } from 'react';
import { Marker, Popup, useMap, Polyline, GeoJSON } from 'react-leaflet'; // 🔥 Import GeoJSON
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Text, Button } from '@chakra-ui/react';

const getImgUrl = (url) => url ? (url.startsWith('http') ? url : `http://localhost:5000/${url.startsWith('/')?url.substring(1):url}`) : '';

const createFacilityIcon = (imgUrl) => {
    const validUrl = imgUrl && !imgUrl.includes('placeholder') ? imgUrl : null;
    const innerHtml = validUrl ? `<img src="${getImgUrl(validUrl)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.src='https://placehold.co/50?text=San'">` : `<div style="width:100%;height:100%;background:#4299E1;color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;">CLB</div>`;
    return L.divIcon({ className: 'fac-marker', html: `<div style="width:50px;height:50px;background:white;border-radius:50%;border:3px solid #3182CE;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;">${innerHtml}</div>`, iconSize: [50, 50], iconAnchor: [25, 25], popupAnchor: [0, -25] });
};

const createClusterCustomIcon = (cluster) => { return L.divIcon({ html: `<div style="width:40px;height:40px;border-radius:50%;background:#10B981;color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid white;">${cluster.getChildCount()}</div>`, className: 'custom-cluster-icon', iconSize: L.point(40, 40, true) }); };

const userPulseIcon = L.divIcon({ className: 'user-marker', html: `<div style="width:15px;height:15px;background:#3182CE;border-radius:50%;border:2px solid white;box-shadow:0 0 10px #3182CE;"></div>`, iconSize: [15, 15] });

// Controller: Zoom map khi UserLoc hoặc Boundary thay đổi
const MapController = ({ userLoc, flyToPosition, wardBounds }) => {
    const map = useMap();
    
    // Zoom theo User
    useEffect(() => { if (userLoc) map.flyTo(userLoc, 14); }, [userLoc, map]);
    useEffect(() => { if (flyToPosition) map.flyTo(flyToPosition, 16); }, [flyToPosition, map]);

    // 🔥 Zoom theo ranh giới Phường/Xã
    useEffect(() => { 
        if (wardBounds) { 
            const geoJsonLayer = L.geoJSON(wardBounds); 
            const bounds = geoJsonLayer.getBounds(); 
            if (bounds.isValid()) map.flyToBounds(bounds, { padding: [20, 20], maxZoom: 15 }); 
        } 
    }, [wardBounds, map]);

    return null;
};

// 🔥 Component MAP chính (Đã thêm GeoJSON)
const MapComponent = ({ items, showMatches, userLoc, flyToPosition, onMarkerClick, routeCoords, wardShape, wardBounds }) => {
    return (
        <>
            <MapController userLoc={userLoc} flyToPosition={flyToPosition} wardBounds={wardBounds} />
            
            {userLoc && <Marker position={userLoc} icon={userPulseIcon}><Popup>Bạn ở đây</Popup></Marker>}
            {routeCoords && <Polyline positions={routeCoords} color="blue" weight={5} opacity={0.7} />}

            {/* 🔥 VẼ RANH GIỚI PHƯỜNG */}
            {wardShape && (
                <GeoJSON 
                    key={JSON.stringify(wardShape)} // Key change để force re-render khi shape đổi
                    data={wardShape} 
                    style={{ fillColor: 'blue', weight: 2, opacity: 1, color: 'blue', dashArray: '3', fillOpacity: 0.1 }} 
                />
            )}

            {!showMatches ? (
                <MarkerClusterGroup chunkedLoading iconCreateFunction={createClusterCustomIcon}>
                    {items.map((fac) => fac.lat && fac.lng && (
                        <Marker key={fac.id} position={[fac.lat, fac.lng]} icon={createFacilityIcon(fac.image_url)} eventHandlers={{ click: () => onMarkerClick(fac) }}>
                            <Popup><Box w="180px"><Text fontWeight="bold">{fac.name}</Text><Text fontSize="xs">{fac.address}</Text><Button size="xs" colorScheme="blue" w="100%" mt={2} onClick={()=>onMarkerClick(fac)}>Xem chi tiết</Button></Box></Popup>
                        </Marker>
                    ))}
                </MarkerClusterGroup>
            ) : (
                items.map(m => (
                    <Marker key={m.id} position={[m.lat, m.lng]}>
                        <Popup><Text fontWeight="bold">{m.title}</Text><Text fontSize="xs">{m.match_time}</Text></Popup>
                    </Marker>
                ))
            )}
        </>
    );
};

export default MapComponent;