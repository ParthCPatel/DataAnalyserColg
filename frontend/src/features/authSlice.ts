import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  pendingVerificationEmail: string | null;
}

// Initial state: Try to load from localStorage
const storedToken = localStorage.getItem("token");
const storedUser = localStorage.getItem("user");

const initialState: AuthState = {
  user: storedUser ? JSON.parse(storedUser) : null,
  token: storedToken || null,
  loading: false,
  error: null,
  pendingVerificationEmail: null,
};

// Async Thunks
export const loginUser = createAsyncThunk(
  "auth/login",
  async ({ email, password }: any, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        "/auth/login",
        { email, password }
      );
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 403) {
        return rejectWithValue({
          message: error.response.data?.detail || "Email not verified",
          status: 403,
          email
        });
      }
      return rejectWithValue({
        message: error.response?.data?.detail || error.response?.data?.message || "Login failed",
        status: error.response?.status
      });
    }
  }
);

export const signupUser = createAsyncThunk(
  "auth/signup",
  async ({ email, password }: any, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        "/auth/signup",
        { email, password }
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Signup failed");
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.error = null;
      state.pendingVerificationEmail = null;
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    },
    clearError: (state) => {
      state.error = null;
    },
    setLoginData: (state, action) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.pendingVerificationEmail = null;
      localStorage.setItem("token", action.payload.token);
      localStorage.setItem("user", JSON.stringify(action.payload.user));
    },
    clearPendingVerification: (state) => {
      state.pendingVerificationEmail = null;
    }
  },
  extraReducers: (builder) => {
    // Login
    builder.addCase(loginUser.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(loginUser.fulfilled, (state, action) => {
      state.loading = false;
      state.token = action.payload.token;
      state.user = action.payload.user;
      localStorage.setItem("token", action.payload.token);
      localStorage.setItem("user", JSON.stringify(action.payload.user));
    });
    builder.addCase(loginUser.rejected, (state, action: any) => {
      state.loading = false;
      if (action.payload?.status === 403) {
        state.pendingVerificationEmail = action.payload.email;
        state.error = null;
      } else {
        state.error = action.payload?.message || "Login failed";
      }
    });

    // Signup
    builder.addCase(signupUser.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(signupUser.fulfilled, (state, action) => {
      state.loading = false;
      if (action.payload.status === "pending_verification") {
        state.pendingVerificationEmail = action.payload.email;
      } else {
        state.token = action.payload.token;
        state.user = action.payload.user;
        localStorage.setItem("token", action.payload.token);
        localStorage.setItem("user", JSON.stringify(action.payload.user));
      }
    });
    builder.addCase(signupUser.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export const { logout, clearError, setLoginData, clearPendingVerification } = authSlice.actions;
export default authSlice.reducer;
