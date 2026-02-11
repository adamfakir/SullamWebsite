// src/utils/UserContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { setupAxiosInterceptors } from './axiosConfig';
import { BASE_URL } from '../constants/ApiConfig';

interface UserContextType {
    user: any;
    setUser: (user: any) => void;
    isLoading: boolean;
    isAuthenticated: boolean;
    logout: () => void;
}

export const UserContext = createContext<UserContextType>({
    user: null,
    setUser: () => {},
    isLoading: true,
    isAuthenticated: false,
    logout: () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const logout = () => {
        localStorage.removeItem('sulam_token');
        setUser(null);
    };

    // Setup axios interceptors
    useEffect(() => {
        setupAxiosInterceptors(logout);
    }, []);

    const validateToken = async (token: string) => {
        try {
            const res = await axios.get(`${BASE_URL}/user/get_self`, {
                headers: { Authorization: token },
            });
            setUser(res.data);
            return true;
        } catch (error: any) {
            // Only remove token if it's an authentication error (401/403), not network issues
            if (error.response?.status === 401 || error.response?.status === 403) {
                logout();
            }
            return false;
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('sulam_token');
        if (!token) {
            setIsLoading(false);
            return;
        }

        validateToken(token).finally(() => {
            setIsLoading(false);
        });
    }, []);

    const isAuthenticated = !!user;

    return (
        <UserContext.Provider value={{ user, setUser, isLoading, isAuthenticated, logout }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);
