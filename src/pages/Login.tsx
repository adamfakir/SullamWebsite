// src/pages/Login.tsx
import { useState, useEffect, useContext } from "react";
import {
    Box,
    Button,
    Input,
    Text,
    VStack,
    useToast,
} from "@chakra-ui/react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../utils/UserContext";

const API_BASE = "https://sulamserverbackend-cd7ib.ondigitalocean.app";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { user, setUser } = useContext(UserContext);
    const toast = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/leaderboards'); // or whatever page is your homepage
        }
        const token = localStorage.getItem("sulam_token");
        if (!token) return;

        axios
            .get(`${API_BASE}/user/get_self`, {
                headers: { Authorization: token },
            })
            .then((res) => setUser(res.data))
            .catch(() => localStorage.removeItem("sulam_token"));
    }, [setUser,user]);

    const handleLogin = async () => {
        setLoading(true);
        try {
            const loginRes = await axios.post(
                `${API_BASE}/user/login`,
                { email, password },
                { withCredentials: true }
            );

            const token = loginRes.data.token;
            localStorage.setItem("sulam_token", token);

            const res = await axios.get(`${API_BASE}/user/get_self`, {
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