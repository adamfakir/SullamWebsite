// src/utils/UserContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const API_BASE = 'https://sulamserverbackend-cd7ib.ondigitalocean.app';

interface UserContextType {
    user: any;
    setUser: (user: any) => void;
}

export const UserContext = createContext<UserContextType>({
    user: null,
    setUser: () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const token = localStorage.getItem('sulam_token');
        if (!token) return;

        axios
            .get(`${API_BASE}/user/get_self`, {
                headers: { Authorization: token },
            })
            .then((res) => setUser(res.data))
            .catch(() => localStorage.removeItem('sulam_token'));
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);
