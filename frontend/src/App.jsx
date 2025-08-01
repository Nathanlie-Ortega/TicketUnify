// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { TicketProvider } from './contexts/TicketContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import Scanner from './pages/Scanner';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';

function AppContent() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors">
      <Navbar />
      
      <main className="flex-1">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected Routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <div className="container mx-auto px-4 py-8">
                  <Dashboard />
                </div>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/scanner" 
            element={
              <ProtectedRoute>
                <div className="container mx-auto px-4 py-8">
                  <Scanner />
                </div>
              </ProtectedRoute>
            } 
          />
          
          {/* Admin Only Routes */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute adminOnly>
                <div className="container mx-auto px-4 py-8">
                  <AdminDashboard />
                </div>
              </ProtectedRoute>
            } 
          />
          
          {/* Catch all route - 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer />
      
      {/* Toast Notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            style: {
              background: '#10b981',
            },
          },
          error: {
            style: {
              background: '#ef4444',
            },
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TicketProvider>
          <Router>
            <AppContent />
          </Router>
        </TicketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;