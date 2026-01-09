import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from './store';
import AuthPage from './components/AuthPage';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import ActivityHistory from './components/ActivityHistory';
import GraphBuilder from './components/GraphBuilder';

const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { token } = useSelector((state: RootState) => state.auth);
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
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
        path="/graph-builder/:uploadId"
        element={
          <ProtectedRoute>
            <GraphBuilder />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
