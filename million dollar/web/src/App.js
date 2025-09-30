import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inspection from './pages/Inspection';
import Checklist from './pages/Checklist';
import Comparison from './pages/Comparison';
import Drive from './pages/Drive';
import DriveAdvanced from './pages/DriveAdvanced';
import GoogleAuthCallback from './pages/GoogleAuthCallback';

function App() {
  // TODO: Add authentication context/provider
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
  <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/inspection/:id" element={<Inspection />} />
      <Route path="/checklist/:inspectionId" element={<Checklist />} />
  <Route path="/compare/:propertyId" element={<Comparison />} />
  <Route path="/drive" element={<Drive />} />
  <Route path="/drive-advanced" element={<DriveAdvanced />} />
  <Route path="/google-auth-callback" element={<GoogleAuthCallback />} />
  <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default App;
