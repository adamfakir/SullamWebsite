// src/pages/Login.tsx
import { useState, useEffect, useContext } from "react";
import {
    Box,
    Button,
    Input,
    Text,
    VStack,
    useToast,
    Spinner,
    Flex,
} from "@chakra-ui/react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../utils/UserContext";
import { BASE_URL } from "../constants/ApiConfig";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { user, setUser, isLoading, logout } = useContext(UserContext);
    const toast = useToast();
    const navigate = useNavigate();

    // Redirect if already authenticated
    useEffect(() => {
        if (!isLoading && user) {
            navigate('/leaderboards');
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

    const handleLogin = async () => {
        setLoading(true);
        try {
            const loginRes = await axios.post(
                `${BASE_URL}/user/login`,
                { email, password },
                { withCredentials: true }
            );

            const token = loginRes.data.token;
            localStorage.setItem("sulam_token", token);

            const res = await axios.get(`${BASE_URL}/user/get_self`, {
                headers: { Authorization: token },
            });

            setUser(res.data);
            toast({ title: "Login successful", status: "success", duration: 2000 });
            navigate("/leaderboards");
        } catch (err: any) {
            toast({
                title: err.response?.data?.error || "Login failed",
                status: "error",
                duration: 3000,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box p={8} maxW="400px" mx="auto">
            <VStack spacing={4}>
                <Text fontSize="3xl" fontWeight="bold">
                    Sulam Leaderboard Login
                </Text>
                <Input
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                    colorScheme="accent"
                    onClick={handleLogin}
                    isLoading={loading}
                    width="100%"
                >
                    Login
                </Button>
            </VStack>
        </Box>
    );
}