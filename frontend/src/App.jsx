import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';

// Import các trang
import UserPage from './UserPage';   // Trang dành cho khách
import LoginPage from './LoginPage'; // Trang Đăng nhập & Đăng ký user
import VendorRegisterPage from './VendorRegisterPage'; // TRANG ĐĂNG KÝ CHỦ SÂN MỚI
import AdminPage from './AdminPage'; // Trang Quản lý Sân 
import MyTickets from './MyTickets'; // Trang Vé của tôi
import SuperAdminPage from './SuperAdminPage'; // Trang Super Admin

// --- GUARD 1: CHỈ CHO SUPER ADMIN ---
const SuperAdminRoute = ({ children }) => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!user || user.role !== 'super_admin') {
        return <Navigate to="/" replace />;
    }
    return children;
};

// --- GUARD 2: CHỈ CHO CHỦ SÂN (VENDOR) ---
const VendorRoute = ({ children }) => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (user.role !== 'vendor') {
        return <Navigate to="/" replace />;
    }

    return children;
};

function App() {
  return (
    <ChakraProvider>
        <BrowserRouter>

            <Routes>
                {/* --- CÁC ROUTE CÔNG KHAI --- */}
                <Route path="/" element={<UserPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/partner-register" element={<VendorRegisterPage />} /> {/* 🔥 ĐÃ THÊM ROUTE NÀY */}
                
                <Route path="/my-tickets" element={
                    // Kiểm tra sơ bộ: có user mới cho vào, không thì về login
                    localStorage.getItem('user') ? <MyTickets /> : <Navigate to="/login" replace />
                } />
            
                <Route 
                    path="/admin" 
                    element={
                        <VendorRoute>
                            <AdminPage />
                        </VendorRoute>
                    } 
                />
                {/* Khu vực admin */}
                <Route 
                    path="/super-admin" 
                    element={
                        <SuperAdminRoute>
                            <SuperAdminPage />
                        </SuperAdminRoute>
                    }
                />
                {/* Route bắt lỗi 404 -> Về trang chủ */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    </ChakraProvider>
  );
}

export default App;