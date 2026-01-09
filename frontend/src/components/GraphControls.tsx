import React from 'react';
import CustomSelect from './CustomSelect';
import { Database, AlignLeft, ArrowUpDown, List, Loader2 } from 'lucide-react';

interface GraphControlsProps {
    tables: string[];
    selectedTable: string;
    onSelectTable: (val: string) => void;
    columns: string[];
    xAxis: string;
    onSelectXAxis: (val: string) => void;
    yAxis: string;
    onSelectYAxis: (val: string) => void;
    chartType: string;
    onSelectChartType: (val: string) => void;
    chartTypeOptions: { value: string; label: string; icon: any }[];
    onGenerate: () => void;
    loading: boolean;
    // Filter props
    showFilters: boolean;
    filterType: 'date' | 'category' | 'number' | 'none';
    sortOrder: 'desc' | 'asc' | 'none';
    onSortChange: (val: 'desc' | 'asc' | 'none') => void;
    dateRange: { start: string, end: string };
    onDateRangeChange: (range: { start: string, end: string }) => void;
    topN: number;
    onTopNChange: (val: number) => void;
}

const GraphControls: React.FC<GraphControlsProps> = ({
    tables, selectedTable, onSelectTable,
    columns, xAxis, onSelectXAxis,
    yAxis, onSelectYAxis,
    chartType, onSelectChartType, chartTypeOptions,
    onGenerate, loading,
    showFilters, filterType,
    sortOrder, onSortChange,
    dateRange, onDateRangeChange,
    topN, onTopNChange
}) => {
    
    // Helper to parse column names for display
    const parseColumnOption = (c: string) => {
         const parts = c.split('.');
         const label = parts.length > 1 ? parts[1] : c;
         const subLabel = parts.length > 1 ? parts[0] : undefined;
         return { value: c, label: label, subLabel: subLabel, icon: AlignLeft };
    };

    const columnOptions = columns.map(parseColumnOption);

    return (
        <div className="graph-sidebar">
            <h3>Configuration</h3>
            
            {/* Table Select */}
            <div className="control-group">
                <label>Select Table</label>
                <CustomSelect 
                    value={selectedTable}
                    onChange={onSelectTable}
                    options={[
                        { value: 'all', label: 'All Tables (Smart Join)', icon: Database },
                        ...tables.map(t => ({ value: t, label: t, icon: Database }))
                    ]}
                    placeholder="Select Table"
                />
            </div>

            {/* X Axis */}
            <div className="control-group">
                <label>X Axis (Category/Label)</label>
                <CustomSelect 
                    value={xAxis}
                    onChange={onSelectXAxis}
                    options={columnOptions}
                    placeholder="Select Field"
                    disabled={columns.length === 0}
                />
            </div>

             {/* Y Axis */}
             <div className="control-group">
                <label>Y Axis (Value/Metric)</label>
                <CustomSelect 
                    value={yAxis}
                    onChange={onSelectYAxis}
                    options={columnOptions}
                    placeholder="Select Field"
                    disabled={columns.length === 0}
                />
            </div>

             {/* Chart Type */}
             <div className="control-group">
                <label>Chart Type</label>
                <CustomSelect 
                    value={chartType}
                    onChange={onSelectChartType}
                    options={chartTypeOptions}
                />
            </div>

            <button 
               className="btn-generate"
               onClick={onGenerate}
               disabled={loading || !xAxis || !yAxis}
            >
                {loading ? (
                    <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'}}>
                        <Loader2 className="spinner" size={16} /> Generating...
                    </div>
                ) : "Generate Graph"}
            </button>

            {/* Smart Filters Area */}
            {showFilters && filterType !== 'none' && (
                <div className="filters-section" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #374151' }}>
                    <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Smart Filters
                    </h4>

                    <div className="filter-group">
                        <label style={{display:'block', marginBottom:'10px', fontSize:'0.85rem'}}>Sort Order</label>
                        <CustomSelect 
                            value={sortOrder}
                            onChange={(val) => onSortChange(val as any)}
                            options={[
                                { value: 'desc', label: 'Descending (High to Low)', icon: ArrowUpDown },
                                { value: 'asc', label: 'Ascending (Low to High)', icon: ArrowUpDown },
                                { value: 'none', label: 'Original Order (No Sort)', icon: List }
                            ]}
                        />
                    </div>
                    
                    {/* Date Filter */}
                    {filterType === 'date' && (
                        <div className="filter-group">
                            <label style={{display:'block',marginTop:'10px', marginBottom:'8px', fontSize:'0.85rem'}}>Date Range</label>
                            <div style={{display:'flex', gap:'8px', flexDirection:'column'}}>
                                <input 
                                    type="date" 
                                    value={dateRange.start}
                                    onChange={(e) => onDateRangeChange({...dateRange, start: e.target.value})}
                                    className="graph-input"
                                    style={{background:'#1f2937', border:'1px solid #374151', color:'white', padding:'6px', borderRadius:'4px'}}
                                />
                                <input 
                                    type="date" 
                                    value={dateRange.end}
                                    onChange={(e) => onDateRangeChange({...dateRange, end: e.target.value})}
                                    className="graph-input"
                                    style={{background:'#1f2937', border:'1px solid #374151', color:'white', padding:'6px', borderRadius:'4px'}}
                                />
                            </div>
                        </div>
                    )}

                    {/* Top N Filter (Category) */}
                    {filterType === 'category' && (
                        <div className="filter-group">
                            <label style={{display:'block',marginTop:'10px', marginBottom:'10px', fontSize:'0.85rem'}}>
                                Show Top {topN}
                            </label>
                            <input 
                                type="range" 
                                min="5" 
                                max="100" 
                                step="5" 
                                value={topN}
                                onChange={(e) => onTopNChange(Number(e.target.value))}
                                style={{width:'100%', accentColor:'#6366f1'}}
                            />
                            <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'#9ca3af', marginTop:'4px'}}>
                                <span>5</span>
                                <span>100</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GraphControls;
