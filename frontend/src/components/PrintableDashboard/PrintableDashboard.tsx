import React, { useState, useEffect } from 'react';
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
    const [items, setItems] = useState<DashboardItem[]>([]);
    const [layouts, setLayouts] = useState<any>({ lg: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboard();
    }, []);

    // Auto-print effect once loaded
    useEffect(() => {
        if (!loading && items.length > 0) {
            // Small delay to ensure charts rendering triggers
            const timer = setTimeout(() => {
                window.print();
            }, 2500);
            return () => clearTimeout(timer);
        }
    }, [loading, items]);

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
                        static: true // IMPORTANT: Makes it read-only for grid
                    }
                }));
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
        <div className="printable-dashboard-page">
            <ResponsiveGridLayout
                className="layout"
                layouts={layouts}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={30}
                isDraggable={false}
                isResizable={false}
                isDroppable={false}
                margin={[10, 10]}
            >
                {items.map(item => (
                    <div key={item.id} className="dashboard-item" data-grid={item.layout}>
                        <div className="item-header">
                            {item.title}
                        </div>
                        <div className="item-content">
                            {renderItemContent(item)}
                        </div>
                    </div>
                ))}
            </ResponsiveGridLayout>
        </div>
    );
};

export default PrintableDashboard;
