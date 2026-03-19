import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";
import axios from "axios";
import type { RootState } from "../store";

export interface AnalysisResult {
  summary: string;
  trends: string[];
  anomalies: string[];
  questions: string[];
  raw?: string;
}

interface TableState {
  rows: any[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
}

export interface QueryHistoryItem {
  id?: string;
  question: string;
  answer: any[];
  sql: string;
  timestamp: number;
}

interface AppState {
  schema: string;
  question: string;
  queryHistory: QueryHistoryItem[];
  generatedSQL: string;
  queryResult: any[] | null;
  databaseState: Record<string, any[]> | null;
  tableStates: Record<string, TableState>;
  loading: "idle" | "pending" | "succeeded" | "failed";
  error: string | null;
  feedback: string | null;
  validation: boolean | null;
  uploadedDbPath: string | null;
  uploadSchema: string | null;
  currentUploadId: string | null;
  historyData: any[];
  analysisResult: AnalysisResult | null;
  analysisLoading: boolean;
}

const getInitialState = (): AppState => {
  const baseState: AppState = {
    schema: "",
    question: "",
    queryHistory: [],
    generatedSQL: "",
    queryResult: null,
    databaseState: null,
    tableStates: {},
    loading: "idle",
    error: null,
    feedback: null,
    validation: null,
    uploadedDbPath: null,
    uploadSchema: null,
    currentUploadId: null,
    historyData: [],
    analysisResult: null,
    analysisLoading: false,
  };

  try {
    const savedSession = localStorage.getItem("active_session");
    if (savedSession) {
      const parsed = JSON.parse(savedSession);
      if (parsed.currentUploadId) {
        baseState.currentUploadId = parsed.currentUploadId;
        baseState.uploadedDbPath = parsed.uploadedDbPath;
        baseState.schema = parsed.schema;
        baseState.uploadSchema = parsed.schema;
        baseState.queryHistory = parsed.queryHistory || [];
      }
    }
  } catch (e) {
    console.warn("Failed to load initial state from storage", e);
  }
  return baseState;
};

const initialState: AppState = getInitialState();

export const uploadDatabase = createAsyncThunk(
  "app/uploadDatabase",
  async (
    {
      files,
      clean,
    }: { files: File | FileList | File[]; clean?: boolean },
    { getState, rejectWithValue }
  ) => {
    try {
      const rootState = getState() as RootState;
      const token = rootState.auth.token;

      const formData = new FormData();
      if (files instanceof FileList) {
        Array.from(files).forEach((f) => formData.append("database", f));
      } else if (Array.isArray(files)) {
        files.forEach((f) => formData.append("database", f));
      } else {
        formData.append("database", files as File);
      }

      const response = await axios.post(
        `/upload-db?clean=${clean || false}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Failed to upload database"
      );
    }
  }
);

export const appendDatabase = createAsyncThunk(
  "app/appendDatabase",
  async (
    {
      file,
      uploadId,
      clean,
    }: { file: File; uploadId: string; clean?: boolean },
    { getState, rejectWithValue }
  ) => {
    try {
      const rootState = getState() as RootState;
      const token = rootState.auth.token;

      const formData = new FormData();
      formData.append("database", file);
      formData.append("uploadId", uploadId);
      const response = await axios.post(
        `/append?clean=${clean || false}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
        }
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Failed to append database"
      );
    }
  }
);

export const executeQuery = createAsyncThunk(
  "app/executeQuery",
  async (
    args:
      | { overrideQuestion?: string; restrictedColumns?: string[] }
      | string
      | undefined,
    { getState, rejectWithValue }
  ) => {
    try {
      const rootState = getState() as RootState;
      const state = rootState.app;
      const token = rootState.auth.token;
      const { schema, question, uploadedDbPath, uploadSchema } = state;
      const activeSchema = uploadedDbPath ? uploadSchema : schema;
      const activeDbPath = uploadedDbPath || undefined;
      const activeUploadId = state.currentUploadId;

      // Handle flexible arguments
      let finalQuestion = question;
      let finalRestrictedColumns: string[] | undefined = undefined;

      if (typeof args === "string") {
        finalQuestion = args;
      } else if (typeof args === "object") {
        if (args.overrideQuestion) finalQuestion = args.overrideQuestion;
        if (args.restrictedColumns)
          finalRestrictedColumns = args.restrictedColumns;
      }

      console.log(
        `[AppSlice] Executing Query. RestrictedCols:`,
        finalRestrictedColumns
      );

      const response = await axios.post("/sandbox", {
        schema: activeSchema,
        question: finalQuestion,
        dbFilePath: activeDbPath,
        uploadId: activeUploadId,
        restrictedColumns: finalRestrictedColumns,
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to execute query"
      );
    }
  }
);

export const deleteQuery = createAsyncThunk(
  "app/deleteQuery",
  async (queryId: string, { getState, rejectWithValue }) => {
    try {
      const rootState = getState() as RootState;
      const token = rootState.auth.token;
      await axios.delete(`/history/query/${queryId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return queryId;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to delete query"
      );
    }
  }
);

export const fetchHistory = createAsyncThunk(
  "app/fetchHistory",
  async (_, { getState, rejectWithValue }) => {
    try {
      const rootState = getState() as RootState;
      const token = rootState.auth.token;
      const response = await axios.get(
        "/history/sessions", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteTable = createAsyncThunk(
  "app/deleteTable",
  async (
    { uploadId, tableName }: { uploadId: string; tableName: string },
    { getState, rejectWithValue }
  ) => {
    try {
      const rootState = getState() as RootState;
      const token = rootState.auth.token;
      await axios.delete("/table", {
        data: { uploadId, tableName },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return tableName;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to delete table"
      );
    }
  }
);

export const refreshDatabaseState = createAsyncThunk(
  "app/refreshDatabaseState",
  async (_, { getState, rejectWithValue }) => {
    try {
      const rootState = getState() as RootState;
      const state = rootState.app;
      const token = rootState.auth.token;
      const { uploadedDbPath, uploadSchema, currentUploadId } = state;

      console.log(
        `[AppSlice] Refreshing DB State. Path: ${uploadedDbPath}, SchemaLength: ${uploadSchema?.length}, ID: ${currentUploadId}`
      );

      if (!uploadedDbPath) {
        console.warn(
          "[AppSlice] No database path available in state during refresh"
        );
        return rejectWithValue("No database path");
      }

      const response = await axios.post("/sandbox", {
        schema: uploadSchema,
        dbFilePath: uploadedDbPath,
        uploadId: currentUploadId,
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      console.log(
        "[AppSlice] DB Refresh Response Status:",
        response.status,
        "HasState:",
        !!response.data.databaseState
      );

      // Critical: If no tables are returned, we must still return an empty object,
      // NOT null/undefined, effectively mocking an empty state.
      // This prevents the UI from thinking "we haven't loaded yet".
      if (!response.data.databaseState) {
        return {
          ...response.data,
          databaseState: {}
        };
      }
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // If file not found/deleted, we should clear the session locally effectively
        return rejectWithValue("Session invalid");
      }
      return rejectWithValue(
        error.response?.data?.error || "Failed to refresh state"
      );
    }
  }
);

export const analyzeTable = createAsyncThunk(
  "app/analyzeTable",
  async (
    {
      uploadId,
      tableName,
      tableNames,
    }: { uploadId: string; tableName?: string; tableNames?: string[] },
    { getState, rejectWithValue }
  ) => {
    try {
      const rootState = getState() as RootState;
      const token = rootState.auth.token;
      const response = await axios.post(
        "/analyze-table",
        { uploadId, tableName, tableNames },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (response.data.status === "success") {
        return response.data.analysis;
      }
      return rejectWithValue(response.data.message || "Analysis failed");
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to analyze table"
      );
    }
  }
);

// Helper to persist session
const saveSessionToStorage = (data: any) => {
  try {
    localStorage.setItem("active_session", JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save session to storage", e);
  }
};

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    setSchema: (state, action: PayloadAction<string>) => {
      state.schema = action.payload;
    },
    setQuestion: (state, action: PayloadAction<string>) => {
      state.question = action.payload;
    },
    setDatabaseState: (
      state,
      action: PayloadAction<Record<string, any> | null>
    ) => {
      // Handle the complex parsing logic used in uploadDatabase.fulfilled if needed,
      // or just trust the payload if it's already formatted.
      // For consistency with manual axios calls in Home.tsx:
      if (action.payload) {
        state.databaseState = action.payload;
        // Re-creating tableStates logic from the payload
        const newTableStates: Record<string, any> = {};
        Object.keys(action.payload).forEach((tableName) => {
          const data = action.payload![tableName];
          let rows: any[] = [];
          let total = 0;
          if (Array.isArray(data)) {
            rows = data;
            total = data.length;
          } else if (data && typeof data === "object") {
            rows = data.rows || [];
            total = data.total || 0;
          }
          newTableStates[tableName] = {
            rows: rows,
            total: total,
            page: 1,
            limit: 5,
            loading: false,
          };
        });
        state.tableStates = newTableStates;
      } else {
        state.databaseState = null;
        state.tableStates = {};
      }
    },
    setUploadId: (state, action: PayloadAction<string | null>) => {
      state.currentUploadId = action.payload;
    },

    rehydrateSession: (state, action: PayloadAction<any>) => {
      const { currentUploadId, uploadedDbPath, schema, queryHistory } = action.payload;
      if (currentUploadId) {
        state.currentUploadId = currentUploadId;
        state.uploadedDbPath = uploadedDbPath;
        state.schema = schema;
        state.uploadSchema = schema;
        state.queryHistory = queryHistory || [];
      }
    },

    restoreSession: (state, action: PayloadAction<any>) => {
      const session = action.payload;
      const upload = session.upload;
      const queries = session.queries;

      // Restore upload state
      if (upload) {
        state.uploadedDbPath = upload.path;
        state.currentUploadId = upload._id;
      }

      // Restore full conversation history
      if (queries && queries.length > 0) {
        state.queryHistory = queries.map((q: any) => {
          let parsedAnswer: any = [];
          try {
            if (q.result !== undefined && q.result !== null) {
              parsedAnswer = q.result;
            } else if (q.resultSummary) {
              if (typeof q.resultSummary === "string") {
                parsedAnswer = JSON.parse(q.resultSummary);
              } else {
                parsedAnswer = q.resultSummary;
              }
            }
          } catch (e) {
            console.warn("Failed to parse history answer:", q.resultSummary);
            // Fallback for messy strings
            parsedAnswer = q.resultSummary || q.result || [{ error: "Failed to load result" }];
          }

          return {
            id: q._id, // Map MongoDB ID for deletion
            question: q.question
              ? q.question
                .split("\n\n- Relevant Tables:")[0]
                .split("\n\n- Specific Column Context:")[0]
                .split("\n\nContext Data:")[0]
                .split("\n\n(IMPORTANT:")[0]
              : "", // Clean up prompt artifacts
            answer: parsedAnswer,
            sql: q.generatedSQL,
            timestamp: new Date(q.timestamp).getTime(),
          };
        });
        // Set the last question as current (optional)
        const lastQuery = queries[queries.length - 1];
        state.question = lastQuery.question
          ? lastQuery.question
            .split("\n\nContext Data:")[0]
            .split("\n\n(IMPORTANT:")[0]
          : "";
      } else {
        state.queryHistory = [];
        state.question = "";
      }

      state.tableStates = {}; // Will be refreshed by refreshDatabaseState

      // Persist to local storage
      saveSessionToStorage({
        currentUploadId: state.currentUploadId,
        uploadedDbPath: state.uploadedDbPath,
        schema: state.schema || (upload ? upload.schema : ""), // Ensure schema is saved
        queryHistory: state.queryHistory
      });
    },

    resetSession: (state) => {
      state.queryHistory = [];
      state.generatedSQL = "";
      state.queryResult = null;
      state.error = null;
      state.feedback = null;
      state.currentUploadId = null;
      state.uploadedDbPath = null;
      state.databaseState = null;
      state.schema = "";

      localStorage.removeItem("active_session");
    },
    setUploadedDbPath: (state, action: PayloadAction<string | null>) => {
      state.uploadedDbPath = action.payload;
    },
    removeQueryLocally: (state, action: PayloadAction<number>) => {
      state.queryHistory.splice(action.payload, 1);
      saveSessionToStorage({
        currentUploadId: state.currentUploadId,
        uploadedDbPath: state.uploadedDbPath,
        schema: state.schema,
        queryHistory: state.queryHistory,
      });
    },
  },
  extraReducers: (builder) => {
    // Handle auth logout
    builder.addCase("auth/logout", (state) => {
      state.queryHistory = [];
      state.generatedSQL = "";
      state.queryResult = null;
      state.error = null;
      state.feedback = null;
      state.currentUploadId = null;
      state.uploadedDbPath = null;
      state.databaseState = null;
      state.schema = "";
      state.uploadSchema = null;
      state.historyData = [];
      state.analysisResult = null;
      state.tableStates = {};
      localStorage.removeItem("active_session");
    });

    // Execute Query
    builder.addCase(executeQuery.pending, (state) => {
      state.loading = "pending";
      state.error = null;
    });
    builder.addCase(executeQuery.fulfilled, (state, action) => {
      state.loading = "idle";
      state.generatedSQL = action.payload.generatedSQL;
      state.queryResult = action.payload.answer;
      state.feedback = action.payload.feedback;
      state.validation = action.payload.validation;
      state.queryHistory.push({
        id: action.payload.queryId, // Capture ID
        question: state.question,
        answer: action.payload.answer,
        sql: action.payload.generatedSQL,
        timestamp: Date.now(),
      });
      state.question = ""; // Clear input after success
      if (action.payload.databaseState) {
        state.databaseState = action.payload.databaseState;
      }
    });
    builder.addCase(deleteQuery.fulfilled, (state, action) => {
      // Remove from history
      state.queryHistory = state.queryHistory.filter(
        (item) => item.id !== action.payload
      );
      saveSessionToStorage({
        currentUploadId: state.currentUploadId,
        uploadedDbPath: state.uploadedDbPath,
        schema: state.schema,
        queryHistory: state.queryHistory,
      });
    });
    builder.addCase(executeQuery.rejected, (state, action) => {
      state.loading = "idle";
      state.error = action.payload as string;
    });

    // Upload
    builder.addCase(uploadDatabase.pending, (state) => {
      state.loading = "pending";
      state.error = null;
    });
    builder.addCase(uploadDatabase.fulfilled, (state, action) => {
      state.loading = "idle";
      state.uploadedDbPath = action.payload.path;
      state.uploadSchema = action.payload.schema;
      state.schema = action.payload.schema;
      if (action.payload.uploadId)
        state.currentUploadId = action.payload.uploadId;
      state.tableStates = {};
      if (action.payload.databaseState) {
        state.databaseState = action.payload.databaseState;
        Object.keys(action.payload.databaseState).forEach((tableName) => {
          const tableData = action.payload.databaseState[tableName];
          let rows: any[] = [];
          let total = 0;

          if (Array.isArray(tableData)) {
            rows = tableData;
            total = tableData.length;
          } else if (tableData && typeof tableData === "object") {
            rows = tableData.rows || [];
            total = tableData.total || 0;
          }

          state.tableStates[tableName] = {
            rows: rows, // Backend sends limit 1
            total: total,
            page: 1,
            limit: 1,
            loading: false,
          };
        });
      } else {
        state.databaseState = null;
        state.tableStates = {};
      }
      state.queryResult = null;
      state.queryHistory = []; // Reset history on new upload

      // Persist to local storage
      saveSessionToStorage({
        currentUploadId: state.currentUploadId,
        uploadedDbPath: state.uploadedDbPath,
        schema: state.schema,
        queryHistory: []
      });
    });
    builder.addCase(uploadDatabase.rejected, (state, action) => {
      state.loading = "failed";
      state.error = action.payload as string;
    });

    // Append Database
    builder.addCase(appendDatabase.pending, (state) => {
      state.loading = "pending";
      state.error = null;
    });
    builder.addCase(appendDatabase.fulfilled, (state, action) => {
      state.loading = "idle";
      state.schema = action.payload.schema;
      state.uploadSchema = action.payload.schema; // Update the schema to include new table

      // Merge new table state into existing
      if (action.payload.databaseState) {
        // Ensure databaseState is initialized
        if (!state.databaseState) state.databaseState = {};

        Object.keys(action.payload.databaseState).forEach((tableName) => {
          const allRows = action.payload.databaseState[tableName].rows || [];
          const total = action.payload.databaseState[tableName].total || 0;

          // Add/Overwrite entry in databaseState
          state.databaseState![tableName] = {
            rows: allRows,
            total: total,
          } as any;

          // Initialize table state for the new table
          state.tableStates[tableName] = {
            rows: allRows.slice(0, 5),
            total: total,
            page: 1,
            limit: 5,
            loading: false,
          };
        });
      }
    });
    builder.addCase(appendDatabase.rejected, (state, action) => {
      state.loading = "failed";
      state.error = action.payload as string;
    });

    // History
    builder.addCase(fetchHistory.pending, (state) => {
      state.loading = "pending";
      state.error = null;
    });
    builder.addCase(fetchHistory.fulfilled, (state, action) => {
      state.loading = "idle";
      if (Array.isArray(action.payload)) {
        state.historyData = action.payload;

        // If we have an active session, update its query history from the fresh data
        if (state.currentUploadId) {
          const currentSession = action.payload.find(
            (s: any) => s.upload._id === state.currentUploadId
          );
          if (currentSession && currentSession.queries) {
            state.queryHistory = currentSession.queries.map((q: any) => {
              let parsedAnswer: any = [];
              if (q.result && Array.isArray(q.result)) {
                parsedAnswer = q.result;
              } else if (q.resultSummary) {
                if (typeof q.resultSummary === "string") {
                  try {
                    parsedAnswer = JSON.parse(q.resultSummary);
                  } catch {
                    parsedAnswer = q.resultSummary;
                  }
                } else {
                  parsedAnswer = q.resultSummary;
                }
              }

              return {
                id: q._id,
                question: q.question
                  ? q.question
                    .split("\n\n- Relevant Tables:")[0]
                    .split("\n\n- Specific Column Context:")[0]
                    .split("\n\nContext Data:")[0]
                    .split("\n\n(IMPORTANT:")[0]
                  : "",
                answer: parsedAnswer,
                sql: q.generatedSQL,
                timestamp: new Date(q.createdAt || q.timestamp || Date.now()).getTime(),
              };
            });
          }
        }
      }
    });
    builder.addCase(fetchHistory.rejected, (state, action) => {
      state.loading = "failed";
      state.error = action.payload as string;
    });

    // Refresh DB
    builder.addCase(refreshDatabaseState.fulfilled, (state, action) => {
      // Update schema if returned
      if (action.payload.schema) {
        state.schema = action.payload.schema;
        state.uploadSchema = action.payload.schema;
      }

      if (action.payload.databaseState) {
        state.databaseState = action.payload.databaseState;
        const newTableStates: Record<string, any> = {};
        Object.keys(action.payload.databaseState).forEach((tableName) => {
          const data = action.payload.databaseState[tableName];
          let rows: any[] = [];
          let total = 0;

          if (Array.isArray(data)) {
            rows = data;
            total = data.length;
          } else if (data && typeof data === "object") {
            rows = data.rows || [];
            total = data.total || 0;
          }

          newTableStates[tableName] = {
            rows: rows,
            total: total,
            page: 1,
            limit: 5, // Match backend limit
            loading: false,
          };
        });
        state.tableStates = newTableStates;
      }
    });

    builder.addCase(refreshDatabaseState.rejected, (state, action) => {
      console.warn("Refresh DB blocked/failed:", action.payload);
      // Stop the infinite loop by ensuring databaseState is not null
      if (!state.databaseState) {
        state.databaseState = {};
      }

      // If session is invalid, clear it completely
      if (action.payload === "Session invalid") {
        state.currentUploadId = null;
        state.uploadedDbPath = null;
        state.schema = "";
        state.queryHistory = [];
        try {
          localStorage.removeItem("active_session");
        } catch { }
      }
    });

    // Delete Table
    builder.addCase(deleteTable.fulfilled, (state, action) => {
      const tableName = action.payload;
      // Remove from databaseState
      if (state.databaseState) {
        delete state.databaseState[tableName];
      }
      // Remove from tableStates
      delete state.tableStates[tableName];
    });
    builder.addCase(deleteTable.rejected, (state, action) => {
      state.error = action.payload as string;
    });

    // Analyze Table
    builder.addCase(analyzeTable.pending, (state) => {
      state.analysisLoading = true;
      state.error = null;
    });
    builder.addCase(analyzeTable.fulfilled, (state, action) => {
      state.analysisLoading = false;
      state.analysisResult = action.payload;
    });
    builder.addCase(analyzeTable.rejected, (state, action) => {
      state.analysisLoading = false;
      state.error = action.payload as string;
    });
  },
});

export const {
  setSchema,
  setQuestion,
  setDatabaseState,
  setUploadId,
  restoreSession,
  rehydrateSession,
  resetSession,
  setUploadedDbPath,
  removeQueryLocally,
} = appSlice.actions;
export default appSlice.reducer;
