import React, { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import type { AppDispatch, RootState } from "../../store"
import { AlertCircle, CheckCircle2, Database, Loader2, Send, Table, Trash2, ChevronDown, Plus, Sparkles, BarChart2, Copy, Check } from "lucide-react"
import { setQuestion, executeQuery, deleteQuery, appendDatabase, deleteTable, analyzeTable, fetchHistory, removeQueryLocally } from "../../features/appSlice"
import AnalysisModal from "../AnalysisModal/AnalysisModal"
import "./Dashboard.css"


// Utility: Format data as a real HTML table for rich clipboard copy (Word/Excel/Docs compatible)
const formatAsHTMLTable = (data: any[]): string => {
    if (!data || data.length === 0) return "";
    const columns = Object.keys(data[0]);

    const thStyle = [
        "border: 1px solid #666",
        "padding: 8px 12px",
        "background-color: #dce6f1",
        "font-weight: bold",
        "text-align: left",
        "font-family: Calibri, Arial, sans-serif",
        "font-size: 11pt",
        "color: #000",
        "white-space: nowrap"
    ].join("; ");

    const tdStyle = [
        "border: 1px solid #aaa",
        "padding: 7px 12px",
        "text-align: left",
        "font-family: Calibri, Arial, sans-serif",
        "font-size: 11pt",
        "color: #000",
        "vertical-align: top"
    ].join("; ");

    const trEvenStyle = "background-color: #f2f7fb;";
    const trOddStyle = "background-color: #ffffff;";

    const headers = columns.map(col => `<th style="${thStyle}">${col}</th>`).join('');
    const rows = data.map((row, rowIdx) =>
        `<tr style="${rowIdx % 2 === 0 ? trEvenStyle : trOddStyle}">${columns.map(col => {
            const val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
            return `<td style="${tdStyle}">${val}</td>`;
        }).join('')
        }</tr>`
    ).join('');

    // Full HTML doc wrapper — required for Word to correctly interpret the table
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
        <table border="1" cellspacing="0" cellpadding="0"
            style="border-collapse: collapse; border: 1px solid #aaa; font-family: Calibri, Arial, sans-serif; font-size: 11pt; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
            <thead><tr>${headers}</tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </body></html>`;
};

// Helper component for copying results
const CopyButton = ({ content, htmlContent, label = "Copy" }: { content: string, htmlContent?: string, label?: string }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
        try {
            if (htmlContent && navigator.clipboard && (window as any).ClipboardItem) {
                // Rich copy: HTML table for Excel/Word/Docs
                const blob = new Blob([htmlContent], { type: 'text/html' });
                const textBlob = new Blob([content], { type: 'text/plain' });
                await navigator.clipboard.write([
                    new (window as any).ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })
                ]);
            } else {
                await navigator.clipboard.writeText(content);
            }
        } catch {
            // Fallback to plain text
            navigator.clipboard.writeText(content);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="btn-copy"
            title={`Copy ${label}`}
        >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? "Copied!" : label}</span>
        </button>
    );
};


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

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const colCount = columns.length;
    const tableWidth = colCount > 7 ? `${(colCount / 7) * 100}%` : '100%';

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
                        style={{ color: 'var(--accent-primary)', borderColor: 'rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.1)' }}
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
                <table className="result-table" style={{ width: tableWidth, tableLayout: 'fixed' }}>
                    <thead>
                        <tr>
                            {columns.map((key: string) => {
                                const colId = `${tableName}:${key}`;
                                const isChecked = selectedColumns.has(colId);
                                return (
                                    <th key={key} style={{ background: "transparent", width: "14.28%" }}>
                                        <div className="th-content" onClick={() => onToggleColumn(tableName, key)}>
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => { }} // handled by div click
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

    const columns = data.length > 0 ? Object.keys(data[0]) : [];
    const colCount = columns.length;
    const tableWidth = colCount > 7 ? `${(colCount / 7) * 100}%` : '100%';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="result-table-wrapper">
                <table className="result-table" style={{ width: tableWidth, tableLayout: 'fixed' }}>
                    <thead>
                        <tr>
                            {columns.map((key, j) => {
                                const isFirst = j === 0;
                                const width = colCount > 1 ? (isFirst ? '25%' : `${75 / 6}%`) : '100%';
                                return (
                                    <th key={key} style={{ width }}>
                                        <div className="cell-content" title={key}>{key}</div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.map((row: any, i: number) => (
                            <tr key={i}>
                                {columns.map((key: string, j: number) => {
                                    const val = row[key];
                                    const strVal = val === null || val === undefined ? '-' : String(val);
                                    const isFirst = j === 0;
                                    const width = colCount > 1 ? (isFirst ? '25%' : `${75 / 6}%`) : '100%';
                                    return (
                                        <td key={j} style={{ width }}>
                                            <div className="cell-content" title={strVal}>
                                                {strVal}
                                            </div>
                                        </td>
                                    );
                                })}
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

    // Clear input on mount & Fetch History
    React.useEffect(() => {
        dispatch(setQuestion(''));
        dispatch(fetchHistory());
    }, [dispatch]);
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
        if (!question || !question.trim()) return;

        let finalQuestion = question;
        let targetColumns = overrideColumns instanceof Set ? overrideColumns : new Set(selectedColumns);
        const autoDetectedTables = new Set<string>();

        // 1. Auto-detection Logic (Tables and Columns)
        if (databaseState) {
            const lowerQuestion = question.toLowerCase();
            Object.keys(databaseState).forEach(tableName => {
                const tableLower = tableName.toLowerCase();
                // Only consider tables with actual data
                const tableDataRows = Array.isArray(databaseState[tableName])
                    ? databaseState[tableName] as any[]
                    : (databaseState[tableName] as any)?.rows || [];

                // Detect table name mentions
                if (new RegExp(`\\b${tableLower}\\b`).test(lowerQuestion)) {
                    autoDetectedTables.add(tableName);
                }

                // If targetColumns is empty (auto-detect mode), look for column names
                if (targetColumns.size === 0 && tableDataRows.length > 0) {
                    Object.keys(tableDataRows[0]).forEach(col => {
                        const regex = new RegExp(`\\b${col.toLowerCase()}\\b`);
                        if (regex.test(lowerQuestion)) {
                            targetColumns.add(`${tableName}:${col}`);
                        }
                    });
                }
            });
        }

        // 2. Build Context for Tables (Selected or Mentioned)
        const combinedTables = new Set([...Array.from(selectedTables), ...Array.from(autoDetectedTables)]);
        const tableContext: string[] = [];

        if (combinedTables.size > 0 && databaseState) {
            combinedTables.forEach(tableName => {
                const tableData = databaseState[tableName] as any;
                const rows = Array.isArray(tableData) ? tableData : (tableData?.rows || []);

                if (rows.length > 0) {
                    const columns = Object.keys(rows[0]).join(', ');
                    // Filter sample rows to only show relevant columns if column-restricting is occurring
                    // but for "table explanation", we want the full schema usually
                    const sampleRows = rows.slice(0, 2).map((r: any) => {
                        // Limit column count in sample if it's too huge
                        const keys = Object.keys(r);
                        if (keys.length > 10) {
                            const limitedObj: any = {};
                            keys.slice(0, 10).forEach(k => limitedObj[k] = r[k]);
                            return JSON.stringify(limitedObj) + "...";
                        }
                        return JSON.stringify(r);
                    }).join('\n');

                    tableContext.push(`Table '${tableName}' has columns: [${columns}]. Sample rows:\n${sampleRows}`);
                } else {
                    tableContext.push(`Table '${tableName}' exists but currently has no loaded data in the sample.`);
                }
            });
        }

        // 3. Build Context for specific Columns
        const columnsList: string[] = [];
        const contextData: string[] = [];

        if (targetColumns.size > 0 && databaseState) {
            targetColumns.forEach(id => {
                const [table, col] = id.split(':');
                columnsList.push(col);
                if (databaseState[table]) {
                    const tableData = databaseState[table] as any;
                    const rows = Array.isArray(tableData) ? tableData : (tableData?.rows || []);

                    if (rows.length > 0) {
                        const values = rows.map((row: any) => row[col]).filter((v: any) => v !== null && v !== undefined).slice(0, 20).join(', ');
                        contextData.push(`Values for column '${col}' in table '${table}': [${values}]`);
                    }
                }
            });
        }

        // 4. Assemble Final Prompt
        if (tableContext.length > 0) {
            finalQuestion += `\n\n- Relevant Tables:\n${tableContext.join('\n')}`;
        }

        if (contextData.length > 0) {
            finalQuestion += `\n\n- Specific Column Context:\n${contextData.join('\n')}`;
        }

        if (selectedColumns.size > 0) {
            finalQuestion += `\n\n(IMPORTANT: The user has explicitly checked columns: [${columnsList.join(', ')}]. You MUST include these in the SELECT clause.)`;
        }

        dispatch(executeQuery({
            overrideQuestion: finalQuestion,
            restrictedColumns: Array.from(targetColumns)
        })).then((res) => {
            if (res.type.endsWith('/fulfilled')) {
                setSelectedColumns(new Set());
                setSelectedTables(new Set());
            }
        });
    };

    return (
        <div className="dashboard">
            <div className="background-glow glow-blue"></div>
            <div className="background-glow glow-blue"></div>

            {/* Main Content Area - Scrollable */}
            {/* Main Content Area - Scrollable */}
            <div className="unified-page-header">
                <h2>Data Explorer</h2>
                <div className="header-actions">
                    {/* Analyze Selected Button */}
                    {selectedTables.size > 0 && (
                        <button
                            onClick={handleAnalyzeSelected}
                            className="btn-history"
                            style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', background: 'rgba(59, 130, 246, 0.1)' }}
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

                            <div style={{ position: 'relative' }}>
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
                                            <Plus size={14} style={{ marginRight: 8 }} /> Standard Add
                                        </button>
                                        <button
                                            onClick={() => handleAddOption(true)}
                                            className="btn-history"
                                            style={{ justifyContent: 'flex-start', width: '100%', border: 'none', background: 'transparent', padding: '8px' }}
                                        >
                                            <Database size={14} style={{ marginRight: 8, color: 'var(--accent-primary)' }} /> Clean & Add
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    <button
                        onClick={() => navigate('/graph-builder')}
                        className="btn-history"
                    >
                        <BarChart2 size={16} /> Add Graph
                    </button>
                </div>
            </div>

            <div className="dashboard-container">

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
                        {currentUploadId && !error && databaseState === null ? (
                            <>
                                <div className="spinner"></div>
                                <p className="loading-text" style={{ marginTop: '10px' }}>Loading session data...</p>
                            </>
                        ) : (
                            <>
                                <Database className="icon-empty" />
                                <p>No data loaded.</p>
                            </>
                        )}
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
                                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                                style={{ color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.2)', background: 'rgba(59, 130, 246, 0.1)' }}
                                            >
                                                <BarChart2 size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                if (item.id) {
                                                    dispatch(deleteQuery(item.id));
                                                } else {
                                                    dispatch(removeQueryLocally(index));
                                                }
                                            }}
                                            title="Delete this query"
                                            className="btn-delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <CheckCircle2 className="icon-success" />
                                        <h3>Query Result</h3>
                                    </div>
                                    {/* Unified Copy button in header */}
                                    {typeof item.answer === 'string' ? (
                                        <CopyButton content={item.answer} label="Copy" />
                                    ) : Array.isArray(item.answer) && item.answer.length > 0 ? (
                                        <CopyButton
                                            label="Copy"
                                            htmlContent={formatAsHTMLTable(item.answer)}
                                            content={[
                                                Object.keys(item.answer[0]).join("\t"),
                                                ...item.answer.map((r: any) => Object.values(r).join("\t"))
                                            ].join("\n")}
                                        />
                                    ) : null}
                                </div>
                                <div className="result-content">
                                    {typeof item.answer === "string" ? (
                                        <p>{item.answer}</p>
                                    ) : Array.isArray(item.answer) && item.answer.length > 0 ? (
                                        <PaginatedResultTable data={item.answer} />
                                    ) : (
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ position: 'absolute', top: '-40px', right: 0 }}>
                                                <CopyButton content={JSON.stringify(item.answer, null, 2)} label="JSON" />
                                            </div>
                                            <pre className="json-display">{JSON.stringify(item.answer, null, 2)}</pre>
                                        </div>
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
                    {(selectedColumns.size > 0 || selectedTables.size > 0) && (
                        <div className="chips-container">
                            {Array.from(selectedTables).map(tableName => (
                                <div key={`tbl:${tableName}`} className="chip table-chip" style={{ background: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.4)' }}>
                                    <Table size={12} style={{ marginRight: 4 }} />
                                    <span>{tableName}</span>
                                    <button onClick={() => toggleTableSelection(tableName)} className="chip-remove">×</button>
                                </div>
                            ))}
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
