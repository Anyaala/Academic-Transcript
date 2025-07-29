import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Building, 
  User, 
  Shield, 
  Menu, 
  X, 
  Home,
  LogOut,
  Edit,
  Settings
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface ResponsiveNavbarProps {
  title: string;
  userType?: 'institution' | 'student' | 'public';
  userName?: string;
  onEditName?: () => void;
  onLogout?: () => void;
  showEditButton?: boolean;
  additionalActions?: React.ReactNode;
}

export const ResponsiveNavbar: React.FC<ResponsiveNavbarProps> = ({
  title,
  userType = 'public',
  userName,
  onEditName,
  onLogout,
  showEditButton = false,
  additionalActions
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const getNavItems = (): NavItem[] => {
    const baseItems: NavItem[] = [
      { label: 'Home', href: '/', icon: <Home className="h-4 w-4" /> },
      { label: 'Verify', href: '/verify', icon: <Shield className="h-4 w-4" /> }
    ];

    if (userType === 'public') {
      return [
        ...baseItems,
        { label: 'Institution Login', href: '/institution/login', icon: <Building className="h-4 w-4" /> },
        { label: 'Student Login', href: '/student/login', icon: <User className="h-4 w-4" /> }
      ];
    }

    return baseItems;
  };

  const navItems = getNavItems();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="bg-white border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center flex-shrink-0">
            <img 
              src="https://umatsridinternship.com/images/logo.png" 
              alt="Logo" 
              className="h-6 w-6 sm:h-8 sm:w-8 object-contain mr-2 sm:mr-3"
            />
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">
              {title}
            </h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4 lg:space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActivePath(item.href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {item.icon}
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Desktop User Actions */}
          <div className="hidden md:flex items-center space-x-3 lg:space-x-4">
            {userName && (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-foreground truncate max-w-32 lg:max-w-none">
                  {userName}
                </span>
                {showEditButton && onEditName && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={onEditName}
                    className="p-1"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
            
            {additionalActions}
            
            {onLogout && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline">Logout</span>
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMobileMenu}
              className="p-2"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActivePath(item.href)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
              
              {/* Mobile User Section */}
              {userName && (
                <div className="border-t border-border pt-3 mt-3">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-foreground">
                        {userName}
                      </span>
                      {showEditButton && onEditName && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            onEditName();
                            closeMobileMenu();
                          }}
                          className="p-1"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {additionalActions && (
                    <div className="px-3 py-2">
                      {additionalActions}
                    </div>
                  )}
                  
                  {onLogout && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        onLogout();
                        closeMobileMenu();
                      }}
                      className="flex items-center gap-2 mx-3 mb-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
