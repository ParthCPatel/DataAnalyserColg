import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from '../Sidebar/Sidebar';
import Navbar from '../Navbar/Navbar';
import type { AppDispatch, RootState } from '../../store';
import { refreshDatabaseState } from '../../features/appSlice';

const MainLayout: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { currentUploadId, tableStates } = useSelector((state: RootState) => state.app);

  // Restore session data if we have an ID but no tables (e.g. on reload or restore)
  useEffect(() => {
      if (currentUploadId && Object.keys(tableStates).length === 0) {
          console.log("Restoring session data for ID:", currentUploadId);
          dispatch(refreshDatabaseState());
      }
  }, [dispatch, currentUploadId, tableStates]); // Check on mount and when ID/tables change

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
