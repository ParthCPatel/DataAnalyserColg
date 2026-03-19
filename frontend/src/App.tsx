import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';
import { refreshDatabaseState } from './features/appSlice';
import AuthPage from './components/AuthPage/AuthPage';
import Home from "./components/Home/Home";
import Dashboard from './components/Dashboard/Dashboard';
import ActivityHistory from './components/ActivityHistory/ActivityHistory';
import GraphBuilder from './components/GraphBuilder/GraphBuilder';
import CustomDashboard from './components/CustomDashboard/CustomDashboard';
import AllGraphs from './components/AllGraphs/AllGraphs';
import PrintableDashboard from './components/PrintableDashboard/PrintableDashboard';
import MainLayout from './components/Layout/MainLayout';

const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { token } = useSelector((state: RootState) => state.auth);
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { currentUploadId, uploadedDbPath, databaseState } = useSelector((state: RootState) => state.app);

  useEffect(() => {
    // Attempt to restore session state if ID exists and we haven't loaded data yet
    if (currentUploadId && uploadedDbPath && !databaseState) {
      dispatch(refreshDatabaseState());
    }
  }, [dispatch, currentUploadId, uploadedDbPath, databaseState]);

  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />

      {/* Protected Routes wrapped in MainLayout */}
      <Route element={<MainLayout />}>

        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <ActivityHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/graph-builder/:uploadId?"
          element={
            <ProtectedRoute>
              <GraphBuilder />
            </ProtectedRoute>
          }
        />

        <Route
          path="/custom-dashboard"
          element={
            <ProtectedRoute>
              <CustomDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/all-graphs"
          element={
            <ProtectedRoute>
              <AllGraphs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/custom-dashboard/print"
          element={
            <ProtectedRoute>
              <PrintableDashboard />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
