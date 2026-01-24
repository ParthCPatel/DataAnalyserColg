import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { ChevronLeft, BarChart2, TrendingUp, Pin, LayoutDashboard, Save, BarChart3 } from 'lucide-react';
import axios from '../../api/axiosConfig';
import './GraphBuilder.css';
import GraphControls from '../GraphControls/GraphControls';
import GraphChart from '../GraphChart/GraphChart';
import LogoutButton from '../LogoutButton/LogoutButton';

const CHART_TYPES = [
    { id: 'bar', label: 'Bar Chart', icon: BarChart2 },
    { id: 'line', label: 'Line Chart', icon: TrendingUp },
    { id: 'area', label: 'Area Chart', icon: TrendingUp },
];

const GraphBuilder: React.FC = () => {
    const { uploadId } = useParams<{ uploadId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUploadId } = useSelector((state: RootState) => state.app);
    const effectiveUploadId = uploadId || currentUploadId;

    const { resultData, query } = location.state || {};

    const [loading, setLoading] = useState(false);
    const [fetchingData, setFetchingData] = useState(false);
    const [tables, setTables] = useState<string[]>([]);

    // Graph Configuration State
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [columns, setColumns] = useState<string[]>([]);
    
    const [xAxis, setXAxis] = useState<string>('');
    const [yAxis, setYAxis] = useState<string>('');
    const [chartType, setChartType] = useState<string>('bar');
    
    // Graph Data
    const [graphData, setGraphData] = useState<any[]>([]);
    
    const [dbPath, setDbPath] = useState<string>('');
    const [dbState, setDbState] = useState<any>(null);

    // Filter State
    const [filterType, setFilterType] = useState<'date' | 'category' | 'number' | 'none'>('none');
    const [dateRange, setDateRange] = useState<{start: string, end: string}>({start: '', end: ''});
    const [topN, setTopN] = useState<number>(10);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'none'>('desc');

    useEffect(() => {
         const init = async () => {
            if (resultData && Array.isArray(resultData) && resultData.length > 0) {
                setGraphData(resultData);
                const cols = Object.keys(resultData[0]);
                setColumns(cols);
                const numericCols = cols.filter(c => typeof resultData[0][c] === 'number');
                const catCols = cols.filter(c => typeof resultData[0][c] === 'string');
               
                if (catCols.length > 0) setXAxis(catCols[0]);
                else if (cols.length > 0) setXAxis(cols[0]);

                if (numericCols.length > 0) setYAxis(numericCols[0]);
                else if (cols.length > 1) setYAxis(cols[1]);
            }

            if (!effectiveUploadId) return;
            setLoading(true);
            try {
                const historyRes = await axios.get('http://localhost:3000/api/history/sessions');
                const session = historyRes.data.find((s: any) => s.upload._id === effectiveUploadId);
                if (session) {
                    setDbPath(session.upload.path);
                    const stateRes = await axios.post('http://localhost:3000/api/sandbox', {
                         dbFilePath: session.upload.path,
                         question: "", 
                         uploadId: effectiveUploadId
                    });
                     if (stateRes.data.databaseState) {
                        setDbState(stateRes.data.databaseState);
                        const tbls = Object.keys(stateRes.data.databaseState);
                        setTables(tbls);
                        if (tbls.length > 0 && !resultData) {
                            setSelectedTable(tbls[0]);
                        }
                    }
                }
            } catch (err) { console.error(err); } 
            finally { setLoading(false); }
         };
         init();
    }, [effectiveUploadId, resultData]);

    // Update columns when table selected
    useEffect(() => {
        if (!dbState) return;

        if (selectedTable === 'all') {
            const allCols: string[] = [];
            Object.keys(dbState).forEach(tbl => {
                const rows = dbState[tbl].rows || [];
                if (rows.length > 0) {
                    Object.keys(rows[0]).forEach(col => {
                        allCols.push(`${tbl}.${col}`);
                    });
                }
            });
            setColumns(allCols);
             setXAxis('');
             setYAxis('');
        } else if (selectedTable && dbState[selectedTable]) {
            const rows = dbState[selectedTable].rows || [];
            if (rows.length > 0) {
                setColumns(Object.keys(rows[0]));
                setXAxis('');
                setYAxis('');
            }
        }
    }, [selectedTable, dbState]);

    // Helper: Detect Column Type
    const detectType = (data: any[], col: string): 'date' | 'category' | 'number' | 'none' => {
        if (!data || data.length === 0 || !col) return 'none';
        const val = data[0][col];
        
        if (typeof val === 'string' && !isNaN(Date.parse(val)) && val.length > 5 && (val.includes('-') || val.includes('/'))) {
            return 'date';
        }
        if (typeof val === 'number') return 'number';
        if (typeof val === 'string') return 'category';
        
        return 'none';
    };

    // Effect: Auto-Detect Filters when X-Axis changes
    useEffect(() => {
        if (!xAxis || graphData.length === 0) {
            setFilterType('none');
            return;
        }

        const type = detectType(graphData, xAxis);
        setFilterType(type);

        if (type === 'date') {
            const dates = graphData.map(d => new Date(d[xAxis]).getTime()).filter(d => !isNaN(d));
            if (dates.length > 0) {
                const min = new Date(Math.min(...dates)).toISOString().split('T')[0];
                const max = new Date(Math.max(...dates)).toISOString().split('T')[0];
                setDateRange({ start: min, end: max });
            }
        } else if (type === 'category') {
            setTopN(10);
            setSortOrder('desc');
        }
    }, [xAxis, graphData]);

    // Computed: Processed Data with Filters
    const processedData = useMemo(() => {
        if (!graphData || graphData.length === 0) return [];
        let data = [...graphData];

        if (filterType === 'date' && dateRange.start && dateRange.end) {
            const start = new Date(dateRange.start).getTime();
            const end = new Date(dateRange.end).getTime();
            data = data.filter(d => {
                const t = new Date(d[xAxis]).getTime();
                return t >= start && t <= end;
            });
        }

        if (yAxis && (filterType === 'category' || filterType === 'date') && sortOrder !== 'none') {
             data.sort((a, b) => {
                 const valA = a[yAxis] || 0;
                 const valB = b[yAxis] || 0;
                 return sortOrder === 'desc' ? valB - valA : valA - valB;
             });
        }

        if (filterType === 'category') {
            data = data.slice(0, topN);
        }

        return data.map((d, i) => ({
            ...d,
            _uniqueKey: `${d[xAxis]}__${i}` // Unique Key for Recharts
        }));
    }, [graphData, filterType, dateRange, xAxis, yAxis, sortOrder, topN]);


    const handleGenerate = async () => {
        if (!selectedTable || !xAxis || !yAxis || !dbPath) return;
        setFetchingData(true);
        try {
            let prompt = '';
            
            if (selectedTable === 'all') {
                 prompt = `Select columns "${xAxis}" and "${yAxis}" by joining the relevant tables automatically. Return the data as a JSON array. Limit to 1000 rows.`;
            } else {
                 prompt = `Give me ${xAxis} and ${yAxis} from table "${selectedTable}". Return as many rows as possible (up to 1000).`;
            }
            
            const res = await axios.post('http://localhost:3000/api/sandbox', {
                dbFilePath: dbPath,
                question: prompt,
                uploadId: effectiveUploadId,
                restrictedColumns: selectedTable === 'all' ? [] : [xAxis, yAxis]
            });

            if (res.data.answer) {
                let formattedData = res.data.answer;
                
                if (selectedTable === 'all' && Array.isArray(formattedData) && formattedData.length > 0) {
                    const sample = formattedData[0];
                    const findMatch = (fullPath: string) => {
                        if (sample[fullPath] !== undefined) return fullPath; 
                        const colName = fullPath.split('.').pop();
                        return Object.keys(sample).find(k => k === colName || k.endsWith('.'+colName));
                    };

                    const xKey = findMatch(xAxis);
                    const yKey = findMatch(yAxis);

                    if (xKey || yKey) {
                         formattedData = formattedData.map((row: any) => ({
                             ...row,
                             [xAxis]: xKey ? row[xKey] : undefined,
                             [yAxis]: yKey ? row[yKey] : undefined
                         }));
                    }
                }
                setGraphData(formattedData);
            }

        } catch (err) {
            console.error("Graph gen error:", err);
            alert("Failed to generate graph data");
        } finally {
            setFetchingData(false);
        }
    };

    const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const handleSaveGraph = async () => {
        if (!graphData.length) return;
        try {
            await axios.post('/saved-graphs', {
                title: `Graph: ${xAxis} vs ${yAxis}`,
                content: {
                    data: processedData,
                    chartType,
                    xAxis,
                    yAxis
                }
            });
            setToast({ msg: "Graph saved to library!", type: 'success' });
        } catch (err) {
            console.error(err);
            setToast({ msg: "Failed to save graph", type: 'error' });
        }
    };

    const handlePinToDashboard = async () => {
        if (!graphData || graphData.length === 0) {
            setToast({ msg: "No data to pin!", type: 'error' });
            return;
        }
        try {
            await axios.post('/dashboard/item', {
                type: 'graph',
                title: `Graph: ${xAxis} vs ${yAxis}`,
                content: {
                    data: processedData,
                    chartType,
                    xAxis,
                    yAxis
                },
                layout: {
                    w: 4,
                    h: 11,
                    minW: 4,
                    minH: 11
                }
            });
            setToast({ msg: "Pinned to Dashboard successfully!", type: 'success' });
        } catch (err) {
            console.error(err);
            setToast({ msg: "Failed to pin to dashboard", type: 'error' });
        }
    };

    return (
        <div className="graph-page">
             {toast && (
                 <div className={`toast-notification ${toast.type}`}>
                     {toast.type === 'success' ? <Pin size={16} /> : null}
                     {toast.msg}
                 </div>
             )}
             <div className="graph-header">
                <button onClick={() => navigate('/history')} className="btn-back">
                    <ChevronLeft size={16} /> Back to History
                </button>
                <div style={{ marginLeft: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <span>{query ? `Result: ${query.length > 40 ? query.substring(0,40)+'...' : query}` : 'Graph Builder'}</span>
                </div>
                
                <div style={{ flex: 1 }}></div>
                 <div className="header-actions">
                     {graphData.length > 0 && (
                        <>
                            <button onClick={handleSaveGraph} className="btn-back">
                                <Save size={16} /> Save to Library
                            </button>
                            <button onClick={handlePinToDashboard} className="btn-back">
                                <Pin size={16} /> Pin to Dashboard
                            </button>
                        </>
                     )}
                      <button onClick={() => navigate('/dashboard')} className="btn-back">
                         <BarChart3 size={16} /> Home
                      </button>
                     <button onClick={() => navigate('/custom-dashboard')} className="btn-back">
                         <LayoutDashboard size={16} /> Dashboard
                     </button>
                    
                     <button onClick={() => navigate('/all-graphs')} className="btn-back">
                        <BarChart2 size={16} /> All Graphs
                     </button>
                     <button 
                       onClick={() => navigate('/')} 
                       className="btn-new-upload"
                    >
                       New Upload
                    </button>
                    <LogoutButton />
                 </div>
             </div>

             <div className="graph-container">
                 {/* Filters & Controls */}
                 <GraphControls 
                     tables={tables}
                     selectedTable={selectedTable}
                     onSelectTable={setSelectedTable}
                     columns={columns}
                     xAxis={xAxis}
                     onSelectXAxis={setXAxis}
                     yAxis={yAxis}
                     onSelectYAxis={setYAxis}
                     chartType={chartType}
                     onSelectChartType={setChartType}
                     chartTypeOptions={CHART_TYPES.map(t => ({ value: t.id, label: t.label, icon: t.icon }))}
                     onGenerate={handleGenerate}
                     loading={fetchingData}
                     showFilters={graphData.length > 0}
                     filterType={filterType}
                     sortOrder={sortOrder}
                     onSortChange={setSortOrder}
                     dateRange={dateRange}
                     onDateRangeChange={setDateRange}
                     topN={topN}
                     onTopNChange={setTopN}
                 />

                 {/* Main Chart Area */}
                 <div className="graph-main">
                      {loading ? (
                          <div className="loading-container"><div className="spinner"></div></div>
                      ) : (
                           <div className="chart-wrapper">
                               <GraphChart 
                                   data={processedData}
                                   chartType={chartType}
                                   xAxis={xAxis}
                                   yAxis={yAxis}
                               />
                           </div>
                      )}
                 </div>
             </div>
        </div>
    );
};

export default GraphBuilder;
