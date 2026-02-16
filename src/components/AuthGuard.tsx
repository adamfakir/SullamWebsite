// src/components/AuthGuard.tsx
import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flex, Spinner } from '@chakra-ui/react';
import { UserContext } from '../utils/UserContext';

interface AuthGuardProps {
    children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
    const { user, isLoading } = useContext(UserContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoading && !user) {
            navigate('/');
        }
    }, [user, isLoading, navigate]);

    // Show loading spinner while checking authentication
    if (isLoading) {
        return (
            <Flex justify="center" align="center" minH="100vh">
                <Spinner size="xl" />
            </Flex>
        );
    }

    // If not authenticated, don't render children (redirect will happen)
    if (!user) {
        return null;
    }

    return <>{children}</>;
}
