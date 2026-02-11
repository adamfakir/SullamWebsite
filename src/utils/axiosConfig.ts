// src/utils/axiosConfig.ts
import axios from 'axios';
import { UserContext } from './UserContext';
import { BASE_URL } from '../constants/ApiConfig';

// Create axios instance with default config
export const apiClient = axios.create({
    baseURL: BASE_URL,
    timeout: 10000, // 10 second timeout
});

// Function to setup axios interceptors
export const setupAxiosInterceptors = (logout: () => void) => {
    // Request interceptor to add auth token
    apiClient.interceptors.request.use(
        (config) => {
            const token = localStorage.getItem('sulam_token');
            if (token) {
                config.headers.Authorization = token;
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    // Response interceptor to handle errors globally
    apiClient.interceptors.response.use(
        (response) => {
            return response;
        },
        (error) => {
            // Only logout on authentication errors (401/403), not network issues
            if (error.response?.status === 401 || error.response?.status === 403) {
                logout();
            }
            
            // For network errors (no response), don't logout - just pass the error through
            if (!error.response) {
                console.warn('Network error:', error.message);
            }
            
            return Promise.reject(error);
        }
    );
};

export default apiClient;
