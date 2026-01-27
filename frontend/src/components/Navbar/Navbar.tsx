import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, LayoutDashboard, BarChart3, History as HistoryIcon, Plus, Database, PieChart } from 'lucide-react';


interface NavbarProps {
  onOpenSidebar: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onOpenSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();


  const navItems = [
    { path: '/dashboard', label: 'Home', icon: BarChart3 },
    { path: '/custom-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/history', label: 'History', icon: HistoryIcon },
    { path: '/all-graphs', label: 'All Graphs', icon: PieChart },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
     <div className="navbar-container" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: 'rgba(15, 23, 42, 0.95)', // Increased opacity
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        zIndex: 1000, // Increased z-index
        justifyContent: 'space-between'
    }}>
        {/* Left: Brand/Logo (Optional) or just Sidebar Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
             <button
                onClick={onOpenSidebar}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(30, 30, 40, 0.6)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                title="Open User Menu"
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-primary)';
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(30, 30, 40, 0.6)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                <User size={20} />
              </button>
              
              <div 
                onClick={() => navigate('/dashboard')} 
                style={{ fontWeight: 700, fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Database size={20} color="var(--accent-primary)" />
                <span>DataAnalyser</span>
              </div>
        </div>

        {/* Right Group: Navigation Links & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* Navigation Links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {navItems.map(item => (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: isActive(item.path) ? 'var(--accent-primary)' : 'transparent',
                            background: isActive(item.path) ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            color: isActive(item.path) ? 'var(--text-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 500,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            if (!isActive(item.path)) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isActive(item.path)) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }
                        }}
                    >
                        <item.icon size={16} />
                        {item.label}
                    </button>
                ))}
            </div>

             <button 
                onClick={() => navigate('/home')} 
                className="btn-new-upload"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'var(--text-secondary)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                }}
             >
                <Plus size={16} /> New Upload
             </button>
        </div>
    </div>
  );
};

export default Navbar;
