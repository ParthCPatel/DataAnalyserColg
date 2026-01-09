import React, { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import type { AppDispatch, RootState } from "../store"
import { AlertCircle, CheckCircle2, Database, Loader2, Send, Table, History as HistoryIcon, Trash2, BarChart2, ChevronDown, Plus, Sparkles } from "lucide-react"
import { setQuestion, executeQuery, deleteQuery, appendDatabase, deleteTable, analyzeTable } from "../features/appSlice"
import AnalysisModal from "./AnalysisModal"
import "./Dashboard.css"
import LogoutButton from './LogoutButton';

// Sub-component for individual tables with pagination
const PaginatedTable = ({ 
    tableName, 
    selectedColumns, 
    onToggleColumn,
    onDeleteRequest,
    onAnalyze,
    onToggleTableSelection,
    isTableSelected
}: { 
    tableName: string, 
    selectedColumns: Set<string>,
    onToggleColumn: (table: string, col: string) => void,
    onDeleteRequest: (table: string) => void,
    onAnalyze: (table: string) => void,
    onToggleTableSelection: (table: string) => void,
    isTableSelected: boolean
}) => {
  // const dispatch = useDispatch<AppDispatch>();
  const tableState = useSelector((state: RootState) => state.app.tableStates[tableName]);
  
  // Local fallback if tableState hasn't initialized yet
  if (!tableState || !tableState.rows || tableState.rows.length === 0) return null;

  const { rows, total, loading } = tableState;
  
  return (
    <div className={`glass-panel table-panel ${isTableSelected ? 'selected-table-panel' : ''}`} style={{ borderColor: isTableSelected ? 'var(--accent-primary)' : '' }}>
      <div className="table-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input 
                type="checkbox" 
                checked={isTableSelected} 
                onChange={() => onToggleTableSelection(tableName)}
                className="th-checkbox"
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
            />
            <span className="table-title">
                <Table size={16} /> {tableName}
            </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="table-meta">
                {total ? `Total ${total} rows` : `${rows.length} rows visible`}
            </span>
             <button 
                onClick={() => onAnalyze(tableName)} 
                className="btn-delete" 
                title="AI Deep Dive Analysis"
                style={{ color: 'var(--accent-primary)', borderColor: 'rgba(99, 102, 241, 0.3)', background: 'rgba(99, 102, 241, 0.1)' }}
            >
                <Sparkles size={14} style={{ marginRight: 4 }} /> Analyze
            </button>
            <button 
                onClick={() => onDeleteRequest(tableName)} 
                className="btn-delete" 
                title="Delete this table"
            >
                <Trash2 size={14} />
            </button>
        </div>
      </div>
      <div className={`table-scroll-container ${loading ? 'loading' : ''}`}>
        <table className="result-table">
          <thead>
            <tr>
              {rows.length > 0 && Object.keys(rows[0]).map((key) => {
                const colId = `${tableName}:${key}`;
                const isChecked = selectedColumns.has(colId);
                return (
                  <th key={key} style={{ background: "transparent", minWidth: 150 }}>
                    <div className="th-content" onClick={() => onToggleColumn(tableName, key)}>
                        <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => {}} // handled by div click
                            className="th-checkbox"
                        />
                        {key}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          {/* tbody removed to hide data rows as per user request */}
        </table>
      </div>
    </div>
  );
}

// Client-side pagination for query results
const PaginatedResultTable = ({ data }: { data: any[] }) => {
    // ... (unchanged)
    const [page, setPage] = useState(1);
    const limit = 10;
    const total = data.length;
    const totalPages = Math.ceil(total / limit);

    const paginatedData = data.slice((page - 1) * limit, page * limit);

    if (data.length === 0) return <p>No results found.</p>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="result-table-wrapper">
                <table className="result-table">
                    <thead>
                        <tr>
                            {Object.keys(data[0]).map((key) => (
                                <th key={key}>{key}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map((row: any, i: number) => (
                            <tr key={i}>
                                {Object.values(row).map((val: any, j: number) => (
                                    <td key={j}>{String(val)}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="pagination-container">
                    <button 
                        className="pagination-btn"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        Previous
                    </button>
                    <span className="pagination-info">
                        Page {page} of {totalPages} ({total} rows)
                    </span>
                    <button 
                         className="pagination-btn"
                         onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                         disabled={page === totalPages}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

const Dashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  // Using tableStates primarily
  const { tableStates, queryHistory, loading, error, question, databaseState, currentUploadId, analysisResult, analysisLoading } = useSelector(
    (state: RootState) => state.app,
  )
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);
  
  // New state for dropdown
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [appendCleanMode, setAppendCleanMode] = useState(false);

  // Analysis Modal State
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [analyzingTableName, setAnalyzingTableName] = useState<string | null>(null);
  
  // Multi-table selection state
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());

  const appendFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddOption = (clean: boolean) => {
    setAppendCleanMode(clean);
    setShowAddMenu(false);
    appendFileInputRef.current?.click();
  };

  const handleAppendFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && currentUploadId) {
      // Pass clean mode to the action
      // @ts-ignore
      dispatch(appendDatabase({ file, uploadId: currentUploadId, clean: appendCleanMode }));
    }
    // Reset value so same file can be selected again if needed
    if (event.target) event.target.value = '';
  };

  const handleAnalyzeClick = (tableName: string) => {
      if (currentUploadId) {
          setAnalyzingTableName(tableName);
          setIsAnalysisModalOpen(true);
          dispatch(analyzeTable({ uploadId: currentUploadId, tableName }));
      }
  };

  const handleAnalyzeSelected = () => {
      if (currentUploadId && selectedTables.size > 0) {
          const tableNames = Array.from(selectedTables);
          setAnalyzingTableName(selectedTables.size === 1 ? tableNames[0] : `${selectedTables.size} Selected Tables`);
          setIsAnalysisModalOpen(true);
          dispatch(analyzeTable({ uploadId: currentUploadId, tableNames }));
      }
  };

  const toggleTableSelection = (tableName: string) => {
      const newSelected = new Set(selectedTables);
      if (newSelected.has(tableName)) {
          newSelected.delete(tableName);
      } else {
          newSelected.add(tableName);
      }
      setSelectedTables(newSelected);
  };


  const toggleColumn = (table: string, col: string) => {
    const key = `${table}:${col}`;
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedColumns(newSelected);
  };

  const confirmDelete = () => {
      if (tableToDelete && currentUploadId) {
          dispatch(deleteTable({ uploadId: currentUploadId, tableName: tableToDelete }));
          setTableToDelete(null);
      }
  };

  const cancelDelete = () => {
      setTableToDelete(null);
  };

  const handleExecuteQuery = (overrideColumns?: Set<string>) => {
    if (!question) return;
    
    let finalQuestion = question;
    let targetColumns = overrideColumns instanceof Set ? overrideColumns : new Set(selectedColumns);

    // Auto-detection: If no columns selected, try to infer from question
    if (targetColumns.size === 0 && databaseState) {
        const lowerQuestion = question.toLowerCase();
        Object.keys(databaseState).forEach(table => {
            if (databaseState[table].length > 0) {
                Object.keys(databaseState[table][0]).forEach(col => {
                    // Simple word boundary match
                    const regex = new RegExp(`\\b${col.toLowerCase()}\\b`);
                    if (regex.test(lowerQuestion)) {
                        targetColumns.add(`${table}:${col}`);
                    }
                });
            }
        });
    }

    if (targetColumns.size > 0 && databaseState) {
        const columnsList: string[] = [];
        const contextData: string[] = [];
        
        targetColumns.forEach(id => {
            const [table, col] = id.split(':');
            columnsList.push(col);
            if (databaseState[table]) {
                let rows: any[] = [];
                const tableData = databaseState[table] as any;
                if (Array.isArray(tableData)) {
                    rows = tableData;
                } else if (tableData && Array.isArray(tableData.rows)) {
                    rows = tableData.rows;
                }

                if (rows.length > 0) {
                     const values = rows.map((row: any) => row[col]).slice(0, 50).join(', '); 
                     contextData.push(`Values for column '${col}' in table '${table}': [${values}]`);
                }
            }
        });

        // Add explicit focus instruction if user manually selected columns
        if (selectedColumns.size > 0) {
             finalQuestion += `\n\n(IMPORTANT: The user has explicitly checked the following columns to see in the result: [${columnsList.join(', ')}]. You MUST include these columns in the SELECT clause of your SQL query. If the question asks for a 'max' or 'min' value, do not just return the single number; instead, SELECT the checked columns and use ORDER BY and LIMIT 1 to show the full row context for that maximum/minimum.)`;
        }

        if (contextData.length > 0) {
             finalQuestion += `\n\nContext Data:\n${contextData.join('\n')}`;
        }
    }
    
    dispatch(executeQuery({
        overrideQuestion: finalQuestion,
        restrictedColumns: Array.from(targetColumns)
    }));
  };

  return (
    <div className="dashboard">
      <div className="background-glow glow-blue"></div>
      <div className="background-glow glow-purple"></div>

      {/* Main Content Area - Scrollable */}
      <div className="dashboard-container">
        <div className="dashboard-header">
           <h2 className="dashboard-title">Data Explorer</h2>
           <div className="header-actions">
               <LogoutButton />
               {/* Analyze Selected Button */}
               {selectedTables.size > 0 && (
                   <button 
                       onClick={handleAnalyzeSelected}
                       className="btn-history"
                       style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', background: 'rgba(99, 102, 241, 0.1)', marginRight: '8px' }}
                   >
                       <Sparkles size={16} style={{ marginRight: 6 }} /> Analyze Selected ({selectedTables.size})
                   </button>
               )}

               {currentUploadId && (
                   <>
                       <input 
                           type="file" 
                           ref={appendFileInputRef}
                           style={{ display: 'none' }}
                           multiple
                           accept=".csv"
                           onChange={handleAppendFileChange}
                       />
                       
                       <div style={{ position: 'relative', marginRight: '8px' }}>
                           <button
                               onClick={() => setShowAddMenu(!showAddMenu)}
                               className="btn-history"
                               title="Add Data Options"
                               style={{ display: 'flex', alignItems: 'center' }}
                           >
                               <Database size={16} /> <span style={{ marginLeft: 8 }}>Add Data</span> <ChevronDown size={14} style={{ marginLeft: 4 }} />
                           </button>
                           
                           {showAddMenu && (
                               <div className="glass-panel" style={{
                                   position: 'absolute', 
                                   top: '100%', 
                                   left: 0, 
                                   zIndex: 50, 
                                   marginTop: '6px', 
                                   padding: '6px',
                                   display: 'flex', 
                                   flexDirection: 'column', 
                                   gap: '4px',
                                   minWidth: '180px',
                                   background: 'var(--bg-secondary)',
                                   border: '1px solid var(--border-color)',
                                   boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                               }}>
                                   <button 
                                       onClick={() => handleAddOption(false)}
                                       className="btn-history" 
                                       style={{ justifyContent: 'flex-start', width: '100%', border: 'none', background: 'transparent', padding: '8px' }}
                                   >
                                       <Plus size={14} style={{ marginRight: 8 }}/> Standard Add
                                   </button>
                                    <button 
                                       onClick={() => handleAddOption(true)}
                                       className="btn-history"
                                       style={{ justifyContent: 'flex-start', width: '100%', border: 'none', background: 'transparent', padding: '8px' }}
                                   >
                                       <Database size={14} style={{ marginRight: 8, color: 'var(--accent-primary)' }}/> Clean & Add
                                   </button>
                               </div>
                           )}
                       </div>
                   </>
               )}
               <button
                  onClick={() => navigate('/history')}
                  className="btn-history"
               >
                   <HistoryIcon size={16} /> History
               </button>
               <button 
                  onClick={() => navigate('/')} 
                  className="btn-new-upload"
               >
                  New Upload
               </button>
           </div>
        </div>
        <p className="instruction-text" style={{ color: 'rgba(255,255,255,0.6)', marginTop: '-10px', marginBottom: '20px', fontSize: '0.9rem' }}>
            Check tables to compare, or select fields for query results
        </p>

        {/* Error Banner (Red) */}
        {error && !error.includes("Missing required columns") && (
          <div className="glass-panel error-banner">
            <AlertCircle className="icon-error" />
            <div>
              <h3>Error Occurred</h3>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Database Tables - Moved to Top */}
        {Object.keys(tableStates).length > 0 ? (
             <div className="empty-state-container">
                 {Object.keys(tableStates).map((tableName) => (
                   <PaginatedTable 
                        key={tableName} 
                        tableName={tableName} 
                        selectedColumns={selectedColumns}
                        isTableSelected={selectedTables.has(tableName)}
                        onToggleTableSelection={toggleTableSelection}
                        onToggleColumn={toggleColumn}
                        onDeleteRequest={setTableToDelete}
                        onAnalyze={handleAnalyzeClick}
                   />
                 ))}
             </div>
        ) : (
             <div className="empty-state">
              <Database className="icon-empty" />
              <p>No data loaded.</p>
            </div>
        )}

        {/* ... History Section ... */}
        {queryHistory && queryHistory.length > 0 && (
            <div className="history-list">
                {queryHistory.map((item, index) => (
                    <div key={index} className="glass-panel result-card history-card">
                        {/* Question Header - Chat Style */}
                        <div className="history-question-header">
                             <div className="question-text">{item.question}</div>
                             <div className="history-meta">
                                <div className="history-time">
                                    {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                                {currentUploadId && item.answer && Array.isArray(item.answer) && item.answer.length > 0 && (
                                    <button
                                        onClick={() => navigate(`/graph-builder/${currentUploadId}`, { 
                                            state: { 
                                                resultData: item.answer, 
                                                query: item.question 
                                            } 
                                        })}
                                        title="Visualize this result"
                                        className="btn-delete"
                                        style={{ color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.2)', background: 'rgba(139, 92, 246, 0.1)' }}
                                    >
                                        <BarChart2 size={14} />
                                    </button>
                                )}
                                {item.id && (
                                    <button 
                                        onClick={() => dispatch(deleteQuery(item.id!))}
                                        title="Delete this query"
                                        className="btn-delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                             </div>
                        </div>

                        <div className="card-header">
                            <CheckCircle2 className="icon-success" />
                            <h3>Query Result</h3>
                        </div>
                        <div className="result-content">
                        {typeof item.answer === "string" ? (
                            <p>{item.answer}</p>
                        ) : Array.isArray(item.answer) && item.answer.length > 0 ? (
                            <PaginatedResultTable data={item.answer} />
                        ) : (
                            <pre className="json-display">{JSON.stringify(item.answer, null, 2)}</pre>
                        )}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Bottom Input Area - Fixed */}
      <div className="bottom-input-area">
          <div className="input-container">
              {/* Selected Chips Area */}
              {selectedColumns.size > 0 && (
                  <div className="chips-container">
                      {Array.from(selectedColumns).map(id => {
                          const [table, col] = id.split(':');
                          return (
                              <div key={id} className="chip">
                                  <span>{col}</span>
                                  <button onClick={() => toggleColumn(table, col)} className="chip-remove">×</button>
                              </div>
                          )
                      })}
                  </div>
              )}

              <div className="input-wrapper">
                  <input 
                    type="text" 
                    placeholder="What insights you want from the data…"
                    value={question}
                    onChange={(e) => dispatch(setQuestion(e.target.value))}
                    onKeyDown={(e) => e.key === 'Enter' && handleExecuteQuery()}
                    className="query-input"
                  />
                  <button 
                    onClick={() => handleExecuteQuery()}
                    disabled={loading === 'pending' || !question}
                    className="btn-send"
                  >
                      {loading === 'pending' ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  </button>
              </div>
          </div>
      </div>

      {/* Confirmation Modal */}
      {tableToDelete && (
          <div className="modal-overlay">
              <div className="glass-panel modal-content">
                  <h3>Delete Table?</h3>
                  <p>Are you sure you want to delete <strong>{tableToDelete}</strong>? This action cannot be undone.</p>
                  <div className="modal-actions">
                      <button onClick={cancelDelete} className="btn-cancel">Cancel</button>
                      <button onClick={confirmDelete} className="btn-confirm-delete">Delete</button>
                  </div>
              </div>
          </div>
      )}

      {/* Analysis Modal */}
      <AnalysisModal 
          isOpen={isAnalysisModalOpen}
          onClose={() => setIsAnalysisModalOpen(false)}
          tableName={analyzingTableName || ''}
          loading={analysisLoading}
          analysis={analysisResult}
          error={error} 
      />
    </div>
  )
}

export default Dashboard
