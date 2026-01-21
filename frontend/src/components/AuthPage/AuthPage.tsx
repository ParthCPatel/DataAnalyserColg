import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginUser, signupUser, clearError } from '../../features/authSlice';
import type { RootState, AppDispatch } from '../../store';
import { Loader2 } from 'lucide-react';
import './AuthPage.css';

const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const { loading, error, user } = useSelector((state: RootState) => state.auth);

    useEffect(() => {
        if (user) {
            navigate('/home');
        }
    }, [user, navigate]);

    // Clear errors when switching modes
    useEffect(() => {
        dispatch(clearError());
    }, [isLogin, dispatch]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isLogin) {
            dispatch(loginUser({ email, password }));
        } else {
            dispatch(signupUser({ email, password }));
        }
    };

    return (
        <div className="auth-container">
            {/* Left Side - Form */}
            <div className="auth-sidebar">
                <div className="auth-form-wrapper">
                    <div className="auth-header">
                        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                             {/* Optional Logo or Icon here */}
                        </div>
                        <h1 className="auth-title">{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
                        <p className="auth-subtitle">
                            {isLogin ? 'Enter your details to access your workspace' : 'Start your data journey with us'}
                        </p>
                    </div>

                    {error && <div className="error-msg">{error}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <input
                                type="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="name@company.com"
                                autoComplete="email"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                type="password"
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                minLength={6}
                                autoComplete={isLogin ? "current-password" : "new-password"}
                            />
                        </div>

                        <button 
                            type="submit" 
                            className="auth-button btn-primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Loader2 className="animate-spin" size={18} /> Processing...
                                </span>
                            ) : (
                                isLogin ? 'Sign In' : 'Sign Up'
                            )}
                        </button>
                    </form>

                    <div className="toggle-auth">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <span 
                            className="toggle-link"
                            onClick={() => setIsLogin(!isLogin)}
                        >
                            {isLogin ? 'Sign up' : 'Sign in'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Side - Illustration */}
            <div className="auth-illustration">
                <div className="auth-glow"></div>
                <img 
                    src="/undraw_login.svg" 
                    alt="Data Analysis Illustration" 
                    className="illustration-img"
                />
            </div>
        </div>
    );
};

export default AuthPage;
