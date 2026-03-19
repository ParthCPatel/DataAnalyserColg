import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginUser, signupUser, clearError, setLoginData, clearPendingVerification } from '../../features/authSlice';
import type { RootState, AppDispatch } from '../../store';
import { Loader2, ArrowLeft, KeyRound, MailCheck, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import './AuthPage.css';

type AuthMode = 'login' | 'signup' | 'forgot_password' | 'reset_password';

const AuthPage: React.FC = () => {
    const [authMode, setAuthMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);
    const [localSuccess, setLocalSuccess] = useState<string | null>(null);
    const [localLoading, setLocalLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const { loading, error, user, pendingVerificationEmail } = useSelector((state: RootState) => state.auth);

    useEffect(() => {
        if (user) {
            navigate('/home');
        }
    }, [user, navigate]);

    // Clear errors when switching modes
    useEffect(() => {
        dispatch(clearError());
        setLocalError(null);
        setLocalSuccess(null);
        setOtp('');
    }, [authMode, dispatch]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        setLocalSuccess(null);

        if (pendingVerificationEmail) {
            // VERIFY EMAIL OTP
            setLocalLoading(true);
            try {
                const res = await axios.post('/auth/verify-email', {
                    email: pendingVerificationEmail,
                    otp
                });
                dispatch(setLoginData(res.data));
            } catch (err: any) {
                setLocalError(err.response?.data?.detail || "Verification failed");
            } finally {
                setLocalLoading(false);
            }
            return;
        }

        if (authMode === 'login') {
            dispatch(loginUser({ email, password }));
        } else if (authMode === 'signup') {
            dispatch(signupUser({ email, password }));
        } else if (authMode === 'forgot_password') {
            setLocalLoading(true);
            try {
                const res = await axios.post('/auth/forgot-password', { email });
                setLocalSuccess(res.data.message);
                setAuthMode('reset_password');
            } catch (err: any) {
                setLocalError(err.response?.data?.detail || "Failed to send reset email");
            } finally {
                setLocalLoading(false);
            }
        } else if (authMode === 'reset_password') {
            setLocalLoading(true);
            try {
                await axios.post('/auth/reset-password', {
                    email,
                    otp,
                    new_password: password
                });
                setLocalError(null);
                setLocalSuccess('✅ Password updated successfully! Redirecting to login...');
                setPassword('');
                setOtp('');
                // Delay redirect so user sees the success message
                setTimeout(() => {
                    setAuthMode('login');
                    setLocalSuccess(null);
                }, 2500);
            } catch (err: any) {
                setLocalError(err.response?.data?.detail || "Failed to reset password");
            } finally {
                setLocalLoading(false);
            }
        }
    };

    const isProcessing = loading || localLoading;
    const displayError = localError || (typeof error === 'string' ? error : null);

    const renderFormContent = () => {
        if (pendingVerificationEmail) {
            return (
                <>
                    <div className="auth-header">
                        <MailCheck size={48} className="auth-icon accent-glow" />
                        <h1 className="auth-title">Verify Email</h1>
                        <p className="auth-subtitle">
                            We sent a 6-digit code to <strong>{pendingVerificationEmail}</strong>.
                        </p>
                    </div>

                    <div className="form-group otp-group">
                        <label className="form-label">Activation Code</label>
                        <input
                            type="text"
                            maxLength={6}
                            className="form-input otp-input"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                            required
                            placeholder="000000"
                            autoComplete="off"
                        />
                    </div>
                </>
            );
        }

        if (authMode === 'forgot_password') {
            return (
                <>
                    <div className="auth-header">
                        <KeyRound size={48} className="auth-icon accent-glow" />
                        <h1 className="auth-title">Reset Password</h1>
                        <p className="auth-subtitle">
                            Enter your email to receive a recovery code.
                        </p>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="name@company.com"
                        />
                    </div>
                </>
            );
        }

        if (authMode === 'reset_password') {
            return (
                <>
                    <div className="auth-header">
                        <KeyRound size={48} className="auth-icon accent-glow" />
                        <h1 className="auth-title">Set New Password</h1>
                        <p className="auth-subtitle">
                            Enter the code sent to your email and your new password.
                        </p>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Recovery Code</label>
                        <input
                            type="text"
                            maxLength={6}
                            className="form-input otp-input"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                            required
                            placeholder="000000"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">New Password</label>
                        <div className="password-input-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                minLength={8}
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        <p className="password-hint">Min 8 chars, 1 uppercase, 1 number, 1 special char</p>
                    </div>
                </>
            );
        }

        // Login / Signup modes
        return (
            <>
                <div className="auth-header">
                    <h1 className="auth-title">{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
                    <p className="auth-subtitle">
                        {authMode === 'login' ? 'Enter your details to access your workspace' : 'Start your data journey with us'}
                    </p>
                </div>

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
                    <div className="password-label-row">
                        <label className="form-label">Password</label>
                        {authMode === 'login' && (
                            <span
                                className="forgot-password-link"
                                onClick={() => setAuthMode('forgot_password')}
                            >
                                Forgot?
                            </span>
                        )}
                    </div>
                    <div className="password-input-wrapper">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            minLength={authMode === 'signup' ? 8 : 1}
                            autoComplete={authMode === 'login' ? "current-password" : "new-password"}
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                    {authMode === 'signup' && (
                        <p className="password-hint">Min 8 chars, 1 uppercase, 1 number, 1 special char</p>
                    )}
                </div>
            </>
        );
    };

    return (
        <div className="auth-container">
            {/* Success Toast - Floating Popup */}
            {localSuccess && (
                <div style={{
                    position: 'fixed',
                    top: '32px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 9999,
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.5)',
                    color: '#34d399',
                    padding: '16px 28px',
                    borderRadius: '12px',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 8px 32px rgba(16, 185, 129, 0.25)',
                    fontSize: '15px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    animation: 'slideDown 0.3s ease-out',
                    whiteSpace: 'nowrap',
                }}>
                    {localSuccess}
                </div>
            )}
            <div className="auth-sidebar">
                <div className="auth-form-wrapper">

                    {displayError && <div className="error-msg">{displayError}</div>}

                    <form onSubmit={handleSubmit}>
                        {renderFormContent()}

                        <button
                            type="submit"
                            className="auth-button btn-primary"
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Loader2 className="animate-spin" size={18} /> Processing...
                                </span>
                            ) : (
                                pendingVerificationEmail ? 'Verify & Login' :
                                    authMode === 'login' ? 'Sign In' :
                                        authMode === 'signup' ? 'Sign Up' :
                                            authMode === 'forgot_password' ? 'Send Recovery Code' : 'Update Password'
                            )}
                        </button>
                    </form>

                    <div className="toggle-auth">
                        {pendingVerificationEmail ? (
                            <div className="back-action" onClick={() => dispatch(clearPendingVerification())}>
                                <ArrowLeft size={16} /> Cancel Verification
                            </div>
                        ) : authMode === 'login' ? (
                            <>Don't have an account? <span className="toggle-link" onClick={() => setAuthMode('signup')}>Sign up</span></>
                        ) : authMode === 'signup' ? (
                            <>Already have an account? <span className="toggle-link" onClick={() => setAuthMode('login')}>Sign in</span></>
                        ) : (
                            <div className="back-action" onClick={() => setAuthMode('login')}>
                                <ArrowLeft size={16} /> Back to Sign in
                            </div>
                        )}
                    </div>
                </div>
            </div>

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
