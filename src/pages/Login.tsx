import { useState } from "react";
import { Box, Button, Input, Text, VStack } from "@chakra-ui/react";
import axios from "axios";

const API_BASE = "https://sulamserverbackend-cd7ib.ondigitalocean.app";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [user, setUser] = useState<any>(null);
    const [error, setError] = useState("");

    const handleLogin = async () => {
        try {
            await axios.post(
                `${API_BASE}/user/login`,
                { email, password },
                { withCredentials: true }
            );

            const res = await axios.get(`${API_BASE}/user/get_self`, {
                withCredentials: true,
            });

            setUser(res.data);
            setError("");
        } catch (err: any) {
            setError(err.response?.data?.error || "Login failed");
        }
    };

    return (
        <Box p={8}>
            <VStack spacing={4}>
                <Text fontSize="2xl">Login</Text>
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
                <Button onClick={handleLogin}>Login</Button>

                {user && (
                    <Box>
                        <Text>Welcome, {user.full_name}</Text>
                    </Box>
                )}
                {error && <Text color="red.500">{error}</Text>}
            </VStack>
        </Box>
    );
}