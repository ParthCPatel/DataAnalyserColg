import React from 'react';
import { X, Sparkles, TrendingUp, AlertTriangle, HelpCircle, Loader2, Copy, Check } from 'lucide-react';
import type { AnalysisResult } from '../features/appSlice';

interface AnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    tableName: string;
    loading: boolean;
    analysis: AnalysisResult | null;
    error: string | null;
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, tableName, loading, analysis, error }) => {
    const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

    if (!isOpen) return null;

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}>
            <div className="glass-panel" style={{
                width: '600px',
                maxWidth: '90%',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                animation: 'slideIn 0.3s ease-out',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', 
                            padding: '8px', 
                            borderRadius: '8px',
                            display: 'flex'
                        }}>
                             <Sparkles size={20} color="white" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>AI Deep Dive</h2>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Analyzing <span style={{color: 'white'}}>{tableName}</span></p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="btn-ghost" 
                        style={{ 
                            padding: '8px', 
                            background: 'transparent', 
                            border: 'none', 
                            cursor: 'pointer',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', opacity: 0.7 }}>
                            <Loader2 size={40} className="animate-spin" style={{ marginBottom: '16px', color: 'var(--accent-primary)' }} />
                            <p>Crunching the numbers...</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Looking for patterns and anomalies</p>
                        </div>
                    ) : error ? (
                        <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', borderRadius: '8px' }}>
                            <AlertTriangle size={20} style={{ marginBottom: '8px' }} />
                            <br/>
                            {error}
                        </div>
                    ) : analysis ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Summary */}
                            <div className="glass-card" style={{ padding: '16px', borderLeft: '3px solid var(--accent-primary)' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-primary)' }}>Summary</h3>
                                <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                                    {analysis.summary}
                                </p>
                            </div>

                            {/* Trends */}
                            <div>
                                <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <TrendingUp size={16}/> Key Trends
                                </h3>
                                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {analysis.trends.map((trend, i) => (
                                        <li key={i} style={{ fontSize: '14px' }}>{trend}</li>
                                    ))}
                                </ul>
                            </div>

                            {/* Anomalies */}
                            {analysis.anomalies.length > 0 && (
                                <div>
                                    <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <AlertTriangle size={16}/> Anomalies
                                    </h3>
                                    <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {analysis.anomalies.map((anom, i) => (
                                            <li key={i} style={{ fontSize: '14px' }}>{anom}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                             {/* Suggested Questions */}
                             <div>
                                <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <HelpCircle size={16}/> Ask your data
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {analysis.questions.map((q, i) => (
                                        <div key={i} style={{ 
                                            padding: '12px', 
                                            background: 'rgba(255,255,255,0.05)', 
                                            borderRadius: '8px', 
                                            fontSize: '13px',
                                            cursor: 'default',
                                            border: '1px solid transparent',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            gap: '12px'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--accent-primary)';
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                        }}
                                        onMouseLeave={(e) => {
                                             e.currentTarget.style.borderColor = 'transparent';
                                             e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                        }}
                                        >
                                            <span style={{ flex: 1 }}>{q}</span>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleCopy(q, i); }}
                                                className="btn-ghost"
                                                title="Copy to clipboard"
                                                style={{ 
                                                    padding: '4px', 
                                                    height: 'auto', 
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: copiedIndex === i ? '#4ade80' : 'rgba(255,255,255,0.5)' 
                                                }}
                                            >
                                                {copiedIndex === i ? <Check size={16} /> : <Copy size={16} />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default AnalysisModal;
