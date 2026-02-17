import axios from "axios";

// Create a custom instance or configure the default one
// We'll configure the default one for simplicity with existing code
axios.defaults.baseURL = "http://localhost:3000/api";

axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    console.log(
      "[Axios Interceptor] Token in storage:",
      token ? "Found" : "Missing"
    );
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Optional: Add response interceptor to handle 401s (e.g., auto-logout)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Dispatch logout action or clear storage if token is invalid
      // For now, simpler to just clear storage
      // localStorage.removeItem('token');
      // localStorage.removeItem('user');
      // window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default axios;
