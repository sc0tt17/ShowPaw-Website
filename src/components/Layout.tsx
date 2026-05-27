import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/firebase';
import { auth } from '../lib/firebase';
import { Button } from './ui/button';
import { PawPrint, Menu, X, User } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, userRole } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = () => {
    auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <PawPrint className="h-8 w-8 text-indigo-600" />
                <span className="text-xl font-bold tracking-tight text-slate-900">ShowPaw</span>
              </Link>
            </div>
            
            <nav className="hidden md:flex items-center space-x-8">
              <Link to="/" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Home</Link>
              <Link to="/directory" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Services</Link>
              <Link to="/community" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Community</Link>
              {user ? (
                <div className="flex items-center gap-4">
                  {userRole === 'admin' && (
                    <Link to="/admin" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Admin Panel</Link>
                  )}
                  {userRole === 'business_owner' && (
                    <Link to="/dashboard" className="text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors">Manager Panel</Link>
                  )}
                  <Link to="/profile">
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <User className="h-5 w-5 text-slate-600" />
                    </Button>
                  </Link>
                  <Button onClick={handleSignOut} variant="outline" size="sm">Sign out</Button>
                </div>
              ) : (
                <Link to="/login">
                  <Button size="sm">Sign in</Button>
                </Link>
              )}
            </nav>

            <div className="flex items-center md:hidden">
              <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-4 space-y-1">
            <Link to="/" className="block px-3 py-2 text-base font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-md">Home</Link>
            <Link to="/directory" className="block px-3 py-2 text-base font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-md">Services</Link>
            <Link to="/community" className="block px-3 py-2 text-base font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-md">Community</Link>
            {user ? (
              <>
                {userRole === 'admin' && (
                  <Link to="/admin" className="block px-3 py-2 text-base font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-md">Admin Panel</Link>
                )}
                {userRole === 'business_owner' && (
                  <Link to="/dashboard" className="block px-3 py-2 text-base font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md">Manager Panel</Link>
                )}
                <Link to="/profile" className="block px-3 py-2 text-base font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-md">Profile</Link>
                <button onClick={handleSignOut} className="w-full text-left block px-3 py-2 text-base font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-md">Sign out</button>
              </>
            ) : (
              <Link to="/login" className="block px-3 py-2 text-base font-medium text-indigo-600 hover:bg-slate-50 rounded-md">Sign in</Link>
            )}
          </div>
        )}
      </header>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-slate-500">
              <PawPrint className="h-5 w-5" />
              <span className="text-sm font-medium">ShowPaw Laoag City</span>
            </div>
            <p className="text-sm text-slate-400">&copy; {new Date().getFullYear()} ShowPaw. Supporting responsible pet ownership.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
