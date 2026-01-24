import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { AppDispatch, RootState } from '../../store';
import { fetchHistory, restoreSession, refreshDatabaseState } from '../../features/appSlice';
import { FileText, Clock, ChevronRight, LayoutDashboard, Trash2, MessageSquare, Database, PieChart } from 'lucide-react';
import { BarChart3 } from 'lucide-react';

import "./ActivityHistory.css";
import LogoutButton from '../LogoutButton/LogoutButton'; // Updated path // Not moved yet or remains in root for now

import axios from 'axios';

const ActivityHistory: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  // historyData is now Session[] from appSlice
  const historyData = useSelector((state: RootState) => state.app.historyData);
  const loading = useSelector((state: RootState) => state.app.loading);

  const [sessionToDelete, setSessionToDelete] = React.useState<string | null>(null);

  const handleDeleteSession = (e: React.MouseEvent, uploadId: string) => {
    e.stopPropagation(); // Prevent card click
    setSessionToDelete(uploadId);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;

    try {
        await axios.delete(`http://localhost:3000/api/history/session/${sessionToDelete}`);
        dispatch(fetchHistory()); // Refresh list
        setSessionToDelete(null);
    } catch (error) {
        console.error("Failed to delete session:", error);
        alert("Failed to delete session");
    }
  };

  useEffect(() => {
    dispatch(fetchHistory());
  }, [dispatch]);

  const handleRestore = (session: any) => {
      console.log("Restoring session:", session);
      if (session?.upload?.path) {
        console.log("Upload path found:", session.upload.path);
      } else {
        console.error("No upload path in session!");
      }

      dispatch(restoreSession(session));
      // Trigger a refresh of the DB state so the dashboard isn't empty
      setTimeout(() => {
          console.log("Dispatching refreshDatabaseState...");
          dispatch(refreshDatabaseState());
          navigate('/dashboard');
      }, 100); 
  };

  return (
    <div className="dashboard">
       {/* Reuse background effects */}
      <div className="background-glow glow-blue"></div>
      <div className="background-glow glow-purple"></div>

      <div className="dashboard-container">
        
        <div className="dashboard-header">
            <div className="header-title-group">
                 <h2>Activity History</h2>
                 <p>Resume your past data analysis sessions</p>
            </div>
            <div className="header-actions">
                <LogoutButton />
                <button 
                  onClick={() => navigate('/custom-dashboard')}
                  className="btn-home"
                >
                   <LayoutDashboard size={16} /> Dashboard
                </button>
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="btn-home"
                >
                   <BarChart3 size={16} /> Home
                </button>
                <button 
                   onClick={() => navigate('/')} 
                   className="btn-new-upload"
                >
                   New Upload
                </button>
            </div>
        </div>

        {loading === 'pending' && (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        )}

        {loading !== 'pending' && (
            <div className="history-list">
                {(!historyData || historyData.length === 0) ? (
                    <div className="empty-state">
                        <MessageSquare className="icon-empty" />
                        <h3>No history found</h3>
                        <p className="small-text">Upload a file to start a new session</p>
                    </div>
                ) : (
                    historyData.map((session: any, index: number) => {
                        const upload = session.upload;
                        const queries = session.queries;
                        const lastQuery = queries[queries.length - 1];
                        const lastActive = session.lastActive;
                        
                        // Determine file type icon
                        const isSQL = upload.originalName.toLowerCase().endsWith('.db') || upload.originalName.toLowerCase().endsWith('.sqlite');

                        return (
                            <div 
                                key={upload._id} 
                                className="history-card"
                                onClick={() => handleRestore(session)}
                                style={{ 
                                    animation: 'fadeSlideUp 0.5s ease-out backwards',
                                    animationDelay: `${index * 0.1}s` 
                                }}
                            >
                                <div className="history-card-header">
                                    <div className="history-title-row">
                                        <div className="history-icon-wrapper">
                                            {isSQL ? <Database size={20} /> : <FileText size={20} />}
                                        </div>
                                        <div>
                                            <h3 className="history-title">{upload.originalName}</h3>
                                        </div>
                                        <span className="history-badge">
                                            {queries.length} {queries.length === 1 ? 'query' : 'queries'}
                                        </span>
                                    </div>
                                    <button 
                                        className="delete-session-btn"
                                        onClick={(e) => handleDeleteSession(e, upload._id)}
                                        title="Delete Session"
                                        style={{ 
                                            background: 'transparent', border: 'none', color: '#6b7280', 
                                            cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                        onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                {/* Last Query Section */}
                                {lastQuery ? (
                                    <div className="history-preview">
                                        "{lastQuery.question.split('\n\nContext Data:')[0].split('\n\n(IMPORTANT:')[0].substring(0, 120)}..."
                                    </div>
                                ) : (
                                    <div className="history-preview" style={{ fontStyle: 'italic', opacity: 0.5 }}>
                                        No queries asked yet
                                    </div>
                                )}

                                <div className="history-meta">
                                    <div className="history-date">
                                        <Clock size={14} />
                                        <span>
                                            {new Date(lastActive).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            <span style={{ margin: '0 6px', opacity: 0.3 }}>|</span>
                                            {new Date(lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="history-arrow">
                                        <ChevronRight size={18} />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        )}

        {/* Delete Confirmation Modal */}
        {sessionToDelete && (
          <div className="modal-overlay">
              <div className="glass-panel modal-content">
                  <h3>Delete Session?</h3>
                  <p>Are you sure you want to delete this session? This will delete the uploaded file and all query history. This action cannot be undone.</p>
                  
                  <div className="modal-actions">
                      <button 
                          onClick={() => setSessionToDelete(null)}
                          className="btn-cancel"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={confirmDeleteSession}
                          className="btn-confirm-delete"
                      >
                          Delete
                      </button>
                  </div>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};


export default ActivityHistory;
