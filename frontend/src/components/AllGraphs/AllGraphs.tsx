import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axiosConfig';
import { Trash2, Pin } from 'lucide-react';
import GraphChart from '../GraphChart/GraphChart';
import '../CustomDashboard/CustomDashboard.css'; // Reuse existing styles from sibling folder

interface SavedGraph {
    _id: string;
    title: string;
    content: {
        data: any[];
        chartType: string;
        xAxis: string;
        yAxis: string;
    };
    createdAt: string;
}

const AllGraphs: React.FC = () => {
    const navigate = useNavigate();
    const [graphs, setGraphs] = useState<SavedGraph[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const [graphToDelete, setGraphToDelete] = useState<SavedGraph | null>(null);

    useEffect(() => {
        fetchGraphs();
    }, []);

    const fetchGraphs = async () => {
        try {
            const res = await axios.get('/saved-graphs');
            setGraphs(res.data);
        } catch (err) {
            console.error("Failed to fetch graphs", err);
        } finally {
            setLoading(false);
        }
    };

    const handlePinToDashboard = async (graph: SavedGraph) => {
        try {
            await axios.post('/dashboard/item', {
                type: 'graph',
                title: graph.title,
                content: graph.content,
                layout: {
                    w: 4,
                    h: 11,
                    minW: 4,
                    minH: 11
                }
            });
            setToast({ msg: "Pinned to Dashboard successfully!", type: 'success' });
            setTimeout(() => setToast(null), 3000);
        } catch (err) {
            console.error(err);
            setToast({ msg: "Failed to pin to dashboard", type: 'error' });
            setTimeout(() => setToast(null), 3000);
        }
    };

    const confirmDelete = async () => {
        if (!graphToDelete) return;
        try {
            await axios.delete(`/saved-graphs/${graphToDelete._id}`);
            setGraphs(prev => prev.filter(g => g._id !== graphToDelete._id));
            setToast({ msg: "Graph deleted", type: 'success' });
            setGraphToDelete(null);
            setTimeout(() => setToast(null), 3000);
        } catch (err) {
            console.error(err);
            setToast({ msg: "Failed to delete graph", type: 'error' });
            setTimeout(() => setToast(null), 3000);
        }
    };

    return (
        <div className="custom-dashboard-page">
            {toast && (
                <div className={`toast-notification ${toast.type}`}>
                    {toast.type === 'success' ? <Pin size={16} /> : <Trash2 size={16} />}
                    <span>{toast.msg}</span>
                </div>
            )}

            <div className="unified-page-header">
                <h2>All Saved Graphs</h2>
                {/* Actions could go here */}
            </div>

            <div className="grid-container" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px', overflowY: 'auto' }}>
                {loading ? (
                    <div className="loading-state">Loading library...</div>
                ) : graphs.length === 0 ? (
                    <div className="empty-state">
                        <p>No saved graphs found in library.</p>
                        <button onClick={() => navigate('/home')} className="btn-action" style={{ marginTop: 10 }}>
                            Create New Graph
                        </button>
                    </div>
                ) : (
                    graphs.map(graph => (
                        <div key={graph._id} className="dashboard-item" style={{ position: 'relative', height: '400px', display: 'flex', flexDirection: 'column' }}>
                            <div className="dashboard-card-inner glass-panel">
                                <div className="item-header" style={{ padding: '10px 15px' }}>
                                    <span className="item-title">{graph.title}</span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            className="btn-icon-sm" 
                                            title="Pin to Dashboard"
                                            onClick={() => handlePinToDashboard(graph)}
                                            style={{ color: 'var(--accent-primary)' }}
                                        >
                                            <Pin size={16} />
                                        </button>
                                        <button 
                                            className="btn-icon-sm" 
                                            title="Delete from Library"
                                            onClick={() => setGraphToDelete(graph)}
                                            style={{ color: 'var(--accent-danger)' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="item-content" style={{ flex: 1, minHeight: 0 }}>
                                    <div style={{ width: '100%', height: '100%', flex: 1, minHeight: 0 }}>
                                         <GraphChart 
                                              data={graph.content.data}
                                              chartType={graph.content.chartType}
                                              xAxis={graph.content.xAxis}
                                              yAxis={graph.content.yAxis}
                                         />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {graphToDelete && (
                <div className="modal-overlay">
                    <div className="glass-panel modal-content">
                        <h3>Delete Graph?</h3>
                        <p>Are you sure you want to delete <strong>{graphToDelete.title}</strong>? This action cannot be undone.</p>
                        <div className="modal-actions">
                            <button onClick={() => setGraphToDelete(null)} className="btn-cancel">Cancel</button>
                            <button onClick={confirmDelete} className="btn-confirm-delete">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AllGraphs;
