import React, { useState, useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import { Box, InputGroup, Input, InputRightElement, IconButton, useToast, useColorModeValue } from '@chakra-ui/react';
import { FaSearch } from 'react-icons/fa';

// --- HELPER: XỬ LÝ LINK ẢNH ---
export const getImgUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url.substring(1) : url;
    return `${import.meta.env.VITE_API_URL}/${cleanPath}`;
};

// --- HELPER: TẠO MARKER TRÒN (AVATAR) TRÊN BẢN ĐỒ ---
export const createCircleMarker = (iconUrl, type, isHovered) => {
    const realUrl = getImgUrl(iconUrl);
    const fallbackIcon = 'https://cdn-icons-png.flaticon.com/512/857/857681.png'; 
    const initialSrc = (realUrl && !realUrl.includes('placeholder')) ? realUrl : fallbackIcon;
    const size = isHovered ? 60 : 50;
    const borderColor = type === 'new' ? '#F6E05E' : '#38A169'; 

    return L.divIcon({ 
        className: `admin-marker ${isHovered ? 'z-index-high' : ''}`, 
        html: `
            <div style="width: ${size}px; height: ${size}px; background: white; border-radius: 50%; border: 3px solid ${borderColor}; box-shadow: 0 4px 15px rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center; overflow: hidden; transition: all 0.3s ease;">
               <img src="${initialSrc}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null;this.src='${fallbackIcon}';"/>
            </div>
        `, 
        iconSize: [size, size], iconAnchor: [size/2, size], popupAnchor: [0, -size] 
    });
};

// --- COMPONENT: CHỌN VỊ TRÍ KHI CLICK VÀO BẢN ĐỒ ---
export const LocationPicker = ({ setFormData }) => {
    const toast = useToast();
    useMapEvents({
        click: async (e) => {
            const { lat, lng } = e.latlng;
            setFormData(prev => ({ ...prev, lat, lng }));
            
            // Gọi API Reverse Geocoding
            try {
                const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                if (res.data && res.data.display_name) {
                    
                    toast({ 
                        title: 'Đã ghim vị trí!', 
                        description: `Gần: ${res.data.display_name.split(',')[0]}`, // Chỉ hiện tên ngắn gọn
                        status: 'info', duration: 2000, position: 'top', variant: 'subtle'
                    });
                }
            } catch (err) {}
        },
    });
    return null;
};

// --- COMPONENT: THANH TÌM KIẾM ĐỊA CHỈ THÔNG MINH ---
// --- COMPONENT: THANH TÌM KIẾM ĐỊA CHỈ (HEADLESS - CHẠY NGẦM) ---
export const MapSearchControl = ({ setFormData, query, triggerSearch }) => {
    const map = useMap();
    const toast = useToast();

    useEffect(() => {
        if (!triggerSearch || !query) return;

        const handleSearch = async () => {
            const searchApi = async (q) => axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=vn`);
            try {
                let res = await searchApi(query);
                let foundQuery = query;

                if (res.data.length === 0) {
                    const streetMatch = query.match(/(Đường|Phố|Quốc lộ|Tỉnh lộ|Xa lộ|Đại lộ|Khu phố|Phường|Xã|Thị trấn).*$/i);
                    if (streetMatch) { res = await searchApi(streetMatch[0]); foundQuery = streetMatch[0]; }
                }
                if (res.data.length === 0) {
                    const wardMatch = query.match(/(Phường|Xã|Thị trấn).*$/i);
                    if (wardMatch) { res = await searchApi(wardMatch[0]); foundQuery = wardMatch[0]; }
                }

                if (res.data && res.data.length > 0) {
                    const { lat, lon } = res.data[0];
                    map.flyTo([parseFloat(lat), parseFloat(lon)], 16); 
                    setFormData(prev => ({ ...prev, lat: parseFloat(lat), lng: parseFloat(lon) }));
                    toast({ title: foundQuery === query ? 'Đã tìm thấy!' : 'Tìm thấy lân cận', description: "Kéo thả bản đồ để ghim chính xác.", status: 'success', position: 'top', duration: 3000 });
                } else {
                    toast({ title: 'Không tìm thấy', description: "Bản đồ chưa cập nhật, thử từ khóa khác.", status: 'warning', position: 'top', duration: 3000 });
                }
            } catch (e) { toast({ title: 'Lỗi bản đồ', status: 'error' }); }
        };
        handleSearch();
    }, [triggerSearch]); // Chỉ chạy khi AdminPage bấm nút Enter/Search

    return null; // 👈 Quan trọng: Trả về null vì Header đã lo giao diện
};

