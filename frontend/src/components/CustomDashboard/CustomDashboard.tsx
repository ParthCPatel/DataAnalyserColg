import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import axios from '../../api/axiosConfig';  // One level deeper
import { debounce } from 'lodash';
import { Save, Trash2, BarChart2, FileText, ChevronLeft, Sparkles, Pin, History, Printer } from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import DashboardNote, { type DashboardNoteHandle } from '../DashboardNote/DashboardNote'; // Still in components/
import GraphChart from '../GraphChart/GraphChart'; // Still in components/
import './CustomDashboard.css'; // Same directory

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardItem {
    id: string;
    type: 'graph' | 'text' | 'stat';
    title: string;
    content: any;
    layout: {
        x: number;
        y: number;
        w: number;
        h: number;
        i: string;
        minW?: number;
        minH?: number;
        maxW?: number;
        maxH?: number;
    };
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(_: any) {
        return { hasError: true };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("Dashboard Grid Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <div className="p-4 text-red-500 bg-red-900/20 rounded border border-red-500/50">
                Something went wrong with the dashboard layout. Please refresh.
            </div>;
        }
        return this.props.children;
    }
}

const CustomDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState<DashboardItem[]>([]);
    const [layouts, setLayouts] = useState<any>({ lg: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [analyzingItems, setAnalyzingItems] = useState<Set<string>>(new Set());
    
    // Ref to track current items to avoid stale closures in debounce
    const itemsRef = useRef<DashboardItem[]>([]);
    useEffect(() => { itemsRef.current = items; }, [items]);

    const noteRefs = useRef<{ [key: string]: DashboardNoteHandle | null }>({});

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/dashboard');
            if (res.data && res.data.items) {
                const fetchedItems = res.data.items.map((item: any) => ({
                    ...item,
                    layout: { 
                        ...item.layout, 
                        i: item.id,
                        minW: item.type === 'graph' ? (item.layout?.minW || 4) : (item.layout?.minW || 3),
                        minH: item.type === 'graph' ? (item.layout?.minH || 11) : (item.layout?.minH || 3),
                    } // Ensure 'i' matches 'id'
                }));
                setItems(fetchedItems);
                
                // Construct initial layout
                const initialLayout = fetchedItems.map((item: any) => item.layout);
                setLayouts({ lg: initialLayout, md: initialLayout, sm: initialLayout });
            }
        } catch (err) {
            console.error("Failed to load dashboard", err);
        } finally {
            setLoading(false);
        }
    };

    const saveDashboard = useCallback(async (currentItems: DashboardItem[], showToast = false) => {
        try {
            setSaving(true);
            await axios.post('/dashboard/save', { items: currentItems });
            if (showToast) {
                setToast({ msg: 'Dashboard layout saved!', type: 'success' });
            }
        } catch (err) {
            console.error("Failed to save layout", err);
            if (showToast) {
                setToast({ msg: 'Failed to save layout.', type: 'error' });
            }
        } finally {
            setSaving(false);
        }
    }, []);

    // Debounced save
    const debouncedSave = useCallback(
        debounce((currentItems: DashboardItem[]) => saveDashboard(currentItems), 2000),
        [saveDashboard]
    );

    const onLayoutChange = useCallback((currentLayout: any, allLayouts: any) => {
        // Prevent infinite loops by checking deep equality
        const currentItems = itemsRef.current;
        if (currentItems.length === 0) return;

        // Ensure currentLayout is iterable if it's not an array (though it should be)
        const layoutArray = Array.isArray(currentLayout) ? currentLayout : [];
        if (layoutArray.length === 0) return;

        const needsUpdate = currentItems.some(item => {
            const layoutItem = layoutArray.find((l: any) => l.i === item.id);
            if (!layoutItem) return false;
            return (
                item.layout.x !== layoutItem.x ||
                item.layout.y !== layoutItem.y ||
                item.layout.w !== layoutItem.w ||
                item.layout.h !== layoutItem.h
            );
        });

        if (needsUpdate) {
            // Update local state first
            setItems(prevItems => {
                const newItems = prevItems.map(item => {
                    const layoutItem = layoutArray.find((l: any) => l.i === item.id);
                    if (layoutItem) {
                        return {
                            ...item,
                            layout: {
                                ...item.layout,
                                x: layoutItem.x,
                                y: layoutItem.y,
                                w: layoutItem.w,
                                h: layoutItem.h
                            }
                        };
                    }
                    return item;
                });
                
                // Trigger save
                debouncedSave(newItems);
                return newItems;
            });
            setLayouts(allLayouts);
        }
    }, [debouncedSave]);

    const addItem = async (type: 'text') => {
        try {
            // Create persistent note first
            const noteRes = await axios.post('/notes', { content: '' });
            const content = { noteId: noteRes.data._id, text: '' };

            const newItem = {
                type,
                title: 'New Note',
                content,
                layout: {
                    x: 0,
                    y: Infinity, // puts it at the bottom
                    w: 4,
                    h: 4,
                    minW: 3,
                    minH: 3,
                    i: 'placeholder-id-will-be-replaced' // overwritten by backend ID basically
                }
            };
            const res = await axios.post('/dashboard/item', newItem);
            const savedItem = { ...res.data, layout: { ...res.data.layout, i: res.data.id } };
            
            setItems(prev => [...prev, savedItem]);
            // Refresh dashboard to ensure full sync
            fetchDashboard();
        } catch (err) {
            console.error("Failed to add item", err);
        }
    };

    const removeItem = async (id: string) => {
        try {
            await axios.delete(`/dashboard/item/${id}`);
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (err) {
            console.error("Failed to delete item", err);
        }
    };

    const handleAnalyzeGraph = async (item: DashboardItem) => {
        setAnalyzingItems(prev => new Set(prev).add(item.id));
        try {
            // Optimistic feedback? 
            // For now just basic flow
            
            // Format data for analysis (title + data points)
            const analysisPayload = {
               title: item.title,
               data: typeof item.content === 'object' && item.content.data ? item.content.data : item.content
            };

            const response = await axios.post('/analysis/analyze-graph', analysisPayload);
            const analysisText = response.data.analysis;
            
            // Create persistent note for the analysis
            const noteRes = await axios.post('/notes', { content: analysisText });
            
            // Find a valid position below the current graph
            const newItemY = item.layout.y + item.layout.h;

            // Add new note item to dashboard
            const newNote = {
                type: 'text',
                title: `Analysis: ${item.title}`,
                content: { noteId: noteRes.data._id, text: analysisText },
                layout: {
                    x: item.layout.x,
                    y: newItemY,
                    w: item.layout.w, // Match graph width
                    h: 4, // Default height for note
                    minW: 3, 
                    minH: 3,
                    i: 'temp-id' 
                }
            };
            
            // Save to backend
            await axios.post('/dashboard/item', newNote);
            
            // Refresh dashboard
            await fetchDashboard();
            setToast({ msg: 'Analysis added to dashboard!', type: 'success' });

        } catch (error) {
            console.error('Analysis failed:', error);
            setToast({ msg: 'Failed to analyze graph. Please try again.', type: 'error' });
        } finally {
            setAnalyzingItems(prev => {
                const newSet = new Set(prev);
                newSet.delete(item.id);
                return newSet;
            });
        }
    };

    const handleSaveNote = async (item: DashboardItem) => {
        const noteHandle = noteRefs.current[item.id];
        if (noteHandle) {
             try {
                 await noteHandle.save();
                 setToast({ msg: 'Note saved!', type: 'success' });
             } catch (error) {
                 setToast({ msg: 'Failed to save note.', type: 'error' });
             }
        }
    };

    const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const renderItemContent = (item: DashboardItem) => {
        if (item.type === 'graph') {
            return (
                <div style={{ width: '100%', height: '100%', flex: 1, minHeight: 0 }}>
                    {item.content?.data ? (
                        <GraphChart 
                            data={item.content.data}
                            chartType={item.content.chartType || 'bar'}
                            xAxis={item.content.xAxis || ''}
                            yAxis={item.content.yAxis || ''}
                        />
                    ) : (
                        <div className="empty-graph-state">No Data Configured</div>
                    )}
                </div>
            );
        } else if (item.type === 'text') {
            return (
                <div style={{ height: '100%', overflow: 'hidden' }}>
                    <DashboardNote 
                        noteId={item.content.noteId} 
                        initialText={item.content.text} 
                        ref={(el) => { noteRefs.current[item.id] = el; }}
                    />
                </div>
            );
        }
        return null; 
    };

    return (
        <div className="custom-dashboard-page">
             {toast && (
                 <div className={`toast-notification ${toast.type}`}>
                     {toast.type === 'success' ? <Pin size={16} /> : null}
                     {toast.msg}
                 </div>
             )}
            <div className="dashboard-header-bar">
                <h2>Custom Dashboard</h2>
                <div className="header-actions">
                     <button onClick={() => navigate('/dashboard')} className="btn-back" style={{ marginRight: '12px' }}>
                        <BarChart2 size={16} /> Dashboard
                    </button>
                     <button onClick={() => navigate('/history')} className="btn-back" style={{ marginRight: '12px' }}>
                        <History size={16} /> History
                    </button>
                     <button onClick={() => navigate('/')} className="btn-back">
                        <ChevronLeft size={16} /> Back to Home
                    </button>
                     <button onClick={() => addItem('text')} className="btn-action">
                        <FileText size={16} /> Add Text
                    </button>
                     <button onClick={() => navigate('/all-graphs')} className="btn-action">
                        <BarChart2 size={16} /> Add Graph
                    </button>
                    <button onClick={() => saveDashboard(items, true)} className="btn-action" disabled={saving}>
                        {saving ? (
                            <>
                                <div className="spinner-sm"></div> Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} /> Save Layout
                            </>
                        )}
                    </button>
                    <button onClick={() => navigate('/custom-dashboard/print')} className="btn-action">
                        <Printer size={16} /> Print View
                    </button>
                </div>
            </div>

            <div className="grid-container">
                <ErrorBoundary>
                    {items.length > 0 && (
                        <ResponsiveGridLayout
                            className="layout"
                            layouts={layouts}
                            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                            rowHeight={30}
                            draggableHandle=".drag-handle"
                            onLayoutChange={onLayoutChange}
                            compactType="vertical"
                            preventCollision={false}
                        >
                            {items.map(item => (
                                <div key={item.id} className="dashboard-item glass-panel" data-grid={item.layout}>
                                    <div className="item-header drag-handle">
                                        <span className="item-title">{item.title}</span>
                                        <div className="item-controls">
                                            {item.type === 'graph' && (
                                                <button 
                                                    onClick={() => handleAnalyzeGraph(item)}
                                                    className="btn-icon-sm"
                                                    title="Analyze Graph with AI"
                                                    style={{ color: '#8b5cf6' }} // Purple tint
                                                    disabled={analyzingItems.has(item.id)}
                                                >
                                                    {analyzingItems.has(item.id) ? (
                                                        <div className="spinner-sm"></div>
                                                    ) : (
                                                        <>
                                                            <Sparkles size={14} /> Analyze
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                            {item.type === 'text' && (
                                                 <button 
                                                    onClick={() => handleSaveNote(item)}
                                                    className="btn-save-icon"
                                                    title="Save Note"
                                                 >
                                                    <Save size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="item-content">
                                        {renderItemContent(item)}
                                    </div>
                                    <button 
                                        className="btn-delete-item" 
                                        onMouseDown={(e) => e.stopPropagation()} 
                                        onClick={() => removeItem(item.id)}
                                        title="Delete Item"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </ResponsiveGridLayout>
                    )}
                    {items.length === 0 && !loading && (
                        <div className="empty-dashboard">
                            <p>Dashboard is empty. Add a widget to get started!</p>
                        </div>
                    )}
                </ErrorBoundary>
            </div>
        </div>
    );
};

export default CustomDashboard;
