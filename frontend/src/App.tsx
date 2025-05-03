import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CompanyDetailsPage from './pages/CompanyDetailsPage';
import TestPage from './pages/TestPage';
import ToastContainer from './components/ToastContainer';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/company/:id" element={<CompanyDetailsPage />} />
        <Route path="/saved" element={<Navigate to="/?tab=saved" replace />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="*" element={
          <div className="not-found">
            <h1>Page Not Found</h1>
            <p>The page you're looking for doesn't exist or has been moved.</p>
          </div>
        } />
      </Routes>
      
      {/* Global toast container */}
      <ToastContainer position="bottom-right" maxToasts={3} />
    </div>
  );
}

export default App; 