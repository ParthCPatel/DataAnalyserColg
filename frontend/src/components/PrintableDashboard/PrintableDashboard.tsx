import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, ChevronLeft } from 'lucide-react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import axios from '../../api/axiosConfig';
import DashboardNote from '../DashboardNote/DashboardNote';
import GraphChart from '../GraphChart/GraphChart';
import './PrintableDashboard.css';

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
    };
}

const PrintableDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState<DashboardItem[]>([]);
    const [layouts, setLayouts] = useState<any>({ lg: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboard();
    }, []);

    // Auto-print effect removed as per user request

    const fetchDashboard = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/dashboard');
            if (res.data && res.data.items) {
                const fetchedItems = res.data.items.map((item: any) => {
                     const isLegacy = (item.layout?.h || 0) < 50; 
                     const scale = isLegacy ? 20 : 1;

                    return {
                        ...item,
                        layout: { 
                            ...item.layout, 
                            i: item.id,
                            y: isLegacy ? (item.layout.y * scale) : item.layout.y,
                            h: isLegacy ? (item.layout.h * scale) : item.layout.h,
                            static: true 
                        }
                    };
                });
                setItems(fetchedItems);
                
                const initialLayout = fetchedItems.map((item: any) => item.layout);
                setLayouts({ lg: initialLayout, md: initialLayout, sm: initialLayout });
            }
        } catch (err) {
            console.error("Failed to load dashboard for printing", err);
        } finally {
            setLoading(false);
        }
    };

    const renderItemContent = (item: DashboardItem) => {
        if (item.type === 'graph') {
            return (
                <div style={{ width: '100%', height: '100%' }}>
                    {item.content?.data ? (
                        <GraphChart 
                            data={item.content.data}
                            chartType={item.content.chartType || 'bar'}
                            xAxis={item.content.xAxis || ''}
                            yAxis={item.content.yAxis || ''}
                            enableAnimation={false}
                        />
                    ) : (
                        <div style={{ padding: 20, color: '#999' }}>No Data</div>
                    )}
                </div>
            );
        } else if (item.type === 'text') {
            return (
                <div style={{ height: '100%', overflow: 'hidden' }}>
                    <DashboardNote 
                        noteId={item.content.noteId} 
                        initialText={item.content.text} 
                        readOnly={true}
                    />
                </div>
            );
        }
        return null; 
    };

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Preparing document...</div>;

    return (
        <div className="printable-dashboard-wrapper">
             <div className="printable-dashboard-page">
                {/* Header Actions Row (Back Button) */}
                <div className="back-button-container no-print">
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            backgroundColor: 'rgba(30, 41, 59, 0.8)',
                            color: '#f8fafc',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            backdropFilter: 'blur(4px)'
                        }}
                    >
                        <ChevronLeft size={16} /> Back
                    </button>
                </div>

                <ResponsiveGridLayout
                    className="layout"
                    layouts={layouts}
                    breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                    cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                    rowHeight={2}
                    isDraggable={false}
                    isResizable={false}
                    isDroppable={false}
                    margin={[10, 0]}
                >
                    {items.map(item => (
                        <div key={item.id} className="dashboard-item" data-grid={item.layout}>
                            <div className="dashboard-card-inner">
                                <div className="item-header">
                                    {item.title}
                                </div>
                                <div className="item-content">
                                    {renderItemContent(item)}
                                </div>
                            </div>
                        </div>
                    ))}
                </ResponsiveGridLayout>

                {/* Manual Print Button - Floating Bottom Right */}
                {!loading && (
                    <button
                        onClick={() => window.print()}
                        style={{
                            position: 'fixed',
                            bottom: '30px',
                            right: '30px',
                            padding: '12px 24px',
                            backgroundColor: '#5465FF',
                            color: 'white',
                            border: 'none',
                            borderRadius: '24px',
                            fontSize: '16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            zIndex: 9999
                        }}
                        className="no-print"
                    >
                        <Printer size={20} /> Print
                    </button>
                )}
                <style>{`
                    @media print {
                        .no-print {
                            display: none !important;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
};

export default PrintableDashboard;
