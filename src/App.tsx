import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/firebase';
import { Layout } from './components/Layout';
import LandingPage from './pages/LandingPage';
import Directory from './pages/Directory';
import BusinessDetails from './pages/BusinessDetails';
import Community from './pages/Community';
import Profile from './pages/Profile';
import BusinessDashboard from './pages/BusinessDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/directory" element={<Directory />} />
            <Route path="/businesses/:id" element={<BusinessDetails />} />
            <Route path="/community" element={<Community />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/dashboard" element={<BusinessDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </Layout>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  );
}
