import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
    { name: 'Public Clubs', href: '/public-clubs', icon: '🌐' },
    { name: 'Join Club', href: '/join-club', icon: '➕' },
    { name: 'Create Club', href: '/create-club', icon: '🎬' },
  ];

  const isActiveRoute = (href) => {
    return location.pathname === href;
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Link to="/dashboard" className="text-xl font-bold gradient-text">
                  🎬 Ocularr
                </Link>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden md:ml-6 md:flex md:space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors duration-200 ${
                      isActiveRoute(item.href)
                        ? 'text-primary-400 border-b-2 border-primary-400'
                        : 'text-gray-300 hover:text-gray-100 hover:border-gray-300 border-b-2 border-transparent'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* User menu */}
            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <Link
                to="/profile"
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  isActiveRoute('/profile')
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700'
                }`}
              >
                👤 {user?.displayName || user?.username}
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-300 hover:text-gray-100 hover:bg-gray-700 rounded-lg transition-colors duration-200"
              >
                🚪 Logout
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-700">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 text-base font-medium rounded-md transition-colors duration-200 ${
                    isActiveRoute(item.href)
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.name}
                </Link>
              ))}
              <div className="border-t border-gray-700 pt-4">
                <Link
                  to="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 text-base font-medium rounded-md transition-colors duration-200 ${
                    isActiveRoute('/profile')
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700'
                  }`}
                >
                  👤 {user?.displayName || user?.username}
                </Link>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="block w-full text-left px-3 py-2 text-base font-medium text-gray-300 hover:text-gray-100 hover:bg-gray-700 rounded-md transition-colors duration-200"
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">
              © 2024 Ocularr. Made with ❤️ for movie lovers.
            </p>
            <div className="flex space-x-4 text-sm text-gray-400">
              <span>v1.0.0</span>
              <span>•</span>
              <span>🎬 Self-hosted movie clubs</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;