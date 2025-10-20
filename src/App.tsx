// App.tsx
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import Login from './pages/Login';
import LeaderboardList from './pages/LeaderboardList';
import LeaderboardPage from './pages/LeaderboardPage';
import ExportData from './pages/ExportData';
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
                        <Route path="/" element={<Login />} />
                        <Route path="/leaderboards" element={<LeaderboardList />} />
                        <Route path="/leaderboard/:id" element={<LeaderboardPage />} />
                        <Route path="/export-data" element={<ExportData />} />
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </Router>
            </UserProvider>
        </ChakraProvider>
    );
}
