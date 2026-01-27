import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar';
import Navbar from '../Navbar/Navbar';

const MainLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Navbar includes the sidebar toggle */}
      <Navbar onOpenSidebar={() => setIsSidebarOpen(true)} />

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content - Add top padding for fixed navbar */}
      <div className="main-layout-content" style={{ width: '100%', height: '100%', paddingTop: '64px', overflow: 'hidden' }}>
        <Outlet />
      </div>
    </div>
  );
};

export default MainLayout;
