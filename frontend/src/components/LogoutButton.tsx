import React from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../features/authSlice';
import { LogOut } from 'lucide-react';

interface LogoutButtonProps {
    className?: string;
    style?: React.CSSProperties;
}

const LogoutButton: React.FC<LogoutButtonProps> = ({ className, style }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleLogout = () => {
        dispatch(logout());
        navigate('/');
    };

    return (
        <button
            onClick={handleLogout}
            className={className}
            title="Sign Out"
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
                gap: '8px',
                transition: 'all 0.2s',
                ...style
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = style?.background?.toString() || 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = style?.border?.toString() || 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.color = style?.color?.toString() || 'var(--text-secondary)';
            }}
        >
            <LogOut size={16} /> Log Out
        </button>
    );
};

export default LogoutButton;
