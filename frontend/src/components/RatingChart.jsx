import React, { useMemo } from 'react';
import { 
    Box, Text, useColorModeValue, Tabs, TabList, TabPanels, Tab, TabPanel, 
    VStack, Flex, Icon, Badge, Center 
} from '@chakra-ui/react';
import { Bar } from 'react-chartjs-2';
import { FaChartBar, FaArrowTrendUp, FaTriangleExclamation } from 'react-icons/fa6';

const RatingChart = ({ facilities }) => {
    const textColor = useColorModeValue('gray.700', 'gray.100');
    const neumorphBg = useColorModeValue('#edf2f7', '#1a202c');
    const neumorphActiveShadow = useColorModeValue('inset 4px 4px 8px #b8bec5, inset -4px -4px 8px #ffffff', 'inset 4px 4px 8px #0d1117, inset -4px -4px 8px #2d3748');

    // 1. XỬ LÝ DỮ LIỆU THÔNG MINH
    const { topBest, topWorst, distribution } = useMemo(() => {
        // Chỉ lấy những sân có đánh giá thật
        const realFacs = facilities.filter(f => parseFloat(f.real_review_count) > 0);
        
        // Sắp xếp theo rating giảm dần
        const sorted = [...realFacs].sort((a, b) => b.real_avg_rating - a.real_avg_rating);
        
        // Tính toán phân phối (Histogram) - Biết được hệ thống có bao nhiêu sân theo mức sao
        const dist = { '1-2⭐': 0, '2-3⭐': 0, '3-4⭐': 0, '4-5⭐': 0 };
        realFacs.forEach(f => {
            const r = f.real_avg_rating;
            if (r < 2) dist['1-2⭐']++;
            else if (r < 3) dist['2-3⭐']++;
            else if (r < 4) dist['3-4⭐']++;
            else dist['4-5⭐']++;
        });

        return {
            topBest: sorted.slice(0, 10), // Chỉ lấy 10 ông đầu bảng
            topWorst: sorted.reverse().filter(f => f.real_avg_rating < 3.5).slice(0, 10), // 10 ông tệ nhất dưới 3.5 sao
            distribution: dist
        };
    }, [facilities]);

    // Cấu hình chung cho biểu đồ cột ngang
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
            x: { min: 0, max: 5, grid: { display: false } },
            y: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } }
        }
    };

    // Data cho biểu đồ phân phối (Tổng quan)
    const distChartData = {
        labels: Object.keys(distribution),
        datasets: [{
            label: 'Số lượng sân',
            data: Object.values(distribution),
            backgroundColor: ['#E53E3E', '#DD6B20', '#3182CE', '#38A169'],
            borderRadius: 8
        }]
    };

    return (
        <Box w="100%" h="100%">
            <Tabs variant="soft-rounded" colorScheme="blue" size="sm">
                <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={2}>
                    <Text fontWeight="900" color={textColor} fontSize="sm">📊 PHÂN TÍCH CHẤT LƯỢNG</Text>
                    <TabList bg={neumorphBg} p={1} borderRadius="2xl" boxShadow={neumorphActiveShadow}>
                        <Tab fontSize="10px" fontWeight="900"><Icon as={FaChartBar} mr={1}/>TỔNG QUAN</Tab>
                        <Tab fontSize="10px" fontWeight="900"><Icon as={FaArrowTrendUp} mr={1}/>TOP 10 TỐT</Tab>
                        <Tab fontSize="10px" fontWeight="900" _selected={{bg: 'red.500', color: 'white'}}><Icon as={FaTriangleExclamation} mr={1}/>TOP XẤU</Tab>
                    </TabList>
                </Flex>

                <TabPanels h="300px">
                    {/* TỔNG QUAN: Xem số lượng sân theo từng mốc sao */}
                    <TabPanel h="100%" p={0}>
                        <VStack h="100%" spacing={3}>
                            <Text fontSize="11px" color="gray.500" fontWeight="bold">Phân bổ chất lượng toàn hệ thống</Text>
                            <Box flex={1} w="100%">
                                <Bar data={distChartData} options={{...commonOptions, indexAxis: 'x'}} />
                            </Box>
                        </VStack>
                    </TabPanel>

                    {/* TOP 10 TỐT: Chỉ hiện 10 ông cao điểm nhất */}
                    <TabPanel h="100%" p={0}>
                        <Bar 
                            data={{
                                labels: topBest.map(f => f.name),
                                datasets: [{ data: topBest.map(f => f.real_avg_rating), backgroundColor: 'rgba(56, 161, 105, 0.8)', borderRadius: 5 }]
                            }} 
                            options={commonOptions} 
                        />
                    </TabPanel>

                    {/* TOP XẤU: Hiện những sân dưới 3.5 sao */}
                    <TabPanel h="100%" p={0}>
                        {topWorst.length > 0 ? (
                            <Bar 
                                data={{
                                    labels: topWorst.map(f => f.name),
                                    datasets: [{ data: topWorst.map(f => f.real_avg_rating), backgroundColor: 'rgba(229, 62, 62, 0.8)', borderRadius: 5 }]
                                }} 
                                options={commonOptions} 
                            />
                        ) : (
                            <Center h="100%">
                                <Badge colorScheme="green" p={4} borderRadius="xl">🎉 Tuyệt vời! Không có cơ sở nào dưới 3.5 sao</Badge>
                            </Center>
                        )}
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </Box>
    );
};

export default RatingChart;