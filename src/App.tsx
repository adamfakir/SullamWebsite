// App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import Login from './pages/Login';
import LeaderboardList from './pages/LeaderboardList';
import LeaderboardPage from './pages/LeaderboardPage';
import { UserProvider } from './utils/UserContext';

const theme = extendTheme({
    fonts: {
        heading: 'Lexend, sans-serif',
        body: 'Lexend, sans-serif',
    },
    colors: {
        accent: {
            500: '#4CAF50',
        },
        oldPoints: {
            500: '#8E24AA',
        },
        newPoints: {
            500: '#2196F3',
        },
    },
});

export default function App() {
    return (
        <ChakraProvider theme={theme}>
            <UserProvider>
                <Router>
                    <Routes>
                        <Route path="/SullamWebsite" element={<Login />} />
                        <Route path="/SullamWebsite/leaderboards" element={<LeaderboardList />} />
                        <Route path="/SullamWebsite/leaderboard/:id" element={<LeaderboardPage />} />
                        <Route path="*" element={<Navigate to="/SullamWebsite" />} />
                    </Routes>
                </Router>
            </UserProvider>
        </ChakraProvider>
    );
}
