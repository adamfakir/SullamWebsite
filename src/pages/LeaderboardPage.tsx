import React, { useEffect, useState, useRef, useContext } from 'react';
import {
    Box, Text, VStack, Heading, Flex, SimpleGrid, Divider, Spinner,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Countdown from 'react-countdown';
import { motion, AnimatePresence } from 'framer-motion';
import { UserContext } from '../utils/UserContext';

const API_BASE = 'https://sulamserverbackend-cd7ib.ondigitalocean.app';
const REFRESH_INTERVAL = 30 * 1000;
const MotionBox = motion(Box);

export default function LeaderboardPage() {
    const { id } = useParams();
    const { user, setUser } = useContext(UserContext);
    const [data, setData] = useState<any[]>([]);
    const [leaderboard, setLeaderboard] = useState<any>(null);
    const [lastRanks, setLastRanks] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const token = localStorage.getItem('sulam_token') || '';

    useEffect(() => {
        if (token && !user) {
            axios.get(`${API_BASE}/user/get_self`, {
                headers: { Authorization: token },
            })
                .then((res) => setUser(res.data))
                .catch(() => localStorage.removeItem('sulam_token'));
        }
    }, [user, setUser, token]);

    useEffect(() => {
        if (!id) return;
        fetchData();
        intervalRef.current = setInterval(fetchData, REFRESH_INTERVAL);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [user, id]);

    const fetchData = async () => {
        try {
            const headers = { headers: { Authorization: token } };
            const [scoresRes, metaRes] = await Promise.all([
                axios.get(`${API_BASE}/leaderboard/${id}`, headers),
                axios.get(`${API_BASE}/leaderboard/get/${id}`, headers),
            ]);

            const leaderboardMeta = metaRes.data//.find((lb: any) =>
             //   lb._id === id || lb._id?.$oid === id
          //  );
            if (!leaderboardMeta) {
                console.error("Leaderboard not found");
                setLoading(false);
                return;
            }

            setLeaderboard({
                ...leaderboardMeta,
                end_time: new Date(
                    typeof leaderboardMeta.end_time === 'string'
                        ? leaderboardMeta.end_time
                        : leaderboardMeta.end_time?.$date
                ),
            });

            const sorted = scoresRes.data.sort((a: any, b: any) => b.TotalPoints - a.TotalPoints);
            const newRanks: Record<string, number> = {};
            sorted.forEach((u: any, i: number) => {
                newRanks[u.user_id] = i;
            });

            setLastRanks((prev) => {
                const animated = sorted.map((u: any) => ({
                    ...u,
                    direction: prev[u.user_id] == null ? 0 : prev[u.user_id] - newRanks[u.user_id],
                }));
                setData(animated);
                setLoading(false);
                return newRanks;
            });
        } catch (err) {
            console.error("Failed to load leaderboard data:", err);
            setLoading(false);
        }
    };

    if (loading) {
        return <Flex justify="center" align="center" minH="100vh"><Spinner size="xl" /></Flex>;
    }

    if (!leaderboard) {
        return <Flex justify="center" align="center" minH="100vh"><Text>Leaderboard not found or access denied.</Text></Flex>;
    }

    const endTime = leaderboard.end_time ? new Date(Date.parse(leaderboard.end_time)) : null;
    const isValidEndTime = endTime instanceof Date && !isNaN(endTime?.getTime?.());

    const sortedByOld = [...data].sort((a, b) => b.OldPoints - a.OldPoints);
    const sortedByNew = [...data].sort((a, b) => b.NewPoints - a.NewPoints);
    const top3 = data.slice(0, 3);
    const others = data.slice(3);
    const podiumOrder = [1, 0, 2];
    const podiumColors = ["#C0C0C0", "#FFD700", "#CD7F32"];
    const podiumHeights = [140, 160, 140];

    const countdownRenderer = ({ days, hours, minutes, seconds }: any) => {
        const display = `${days > 0 ? `${days}d, ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        return (
            <Text
                fontSize="5xl"
                fontWeight="bold"
                textAlign="center"
                mb={4}
                fontFamily="'Lexend', monospace"
                transition="all 0.3s ease"
            >
                {display}
            </Text>
        );
    };

    return (
        <Box p={6}>
            <Heading textAlign="center" mb={2}>{leaderboard.name}</Heading>
            <Flex justify="center" align="center" mb={4}>
                {isValidEndTime ? (
                    <Countdown date={endTime} renderer={countdownRenderer} />
                ) : (
                    <Text fontSize="xl" color="red.500">Invalid end time</Text>
                )}
            </Flex>
            <SimpleGrid columns={[1, null, 3]} spacing={6}>
                <Box bg="purple.100" p={4} borderRadius="xl">
                    <Heading size="md" mb={4} textAlign="center">Old Points</Heading>
                    <VStack align="stretch">
                        {sortedByOld.map((u, i) => (
                            <Box
                                key={u.user_id}
                                p={3}
                                borderRadius="md"
                                bg={i === 0 ? 'yellow.200' : i === 1 ? 'gray.200' : i === 2 ? 'orange.200' : 'white'}
                                boxShadow="sm"
                            >
                                <Text fontWeight="bold">#{i + 1} {u.full_name}</Text>
                                <Text>{u.OldPoints}</Text>
                            </Box>
                        ))}
                    </VStack>
                </Box>

                <Box bg="green.100" p={6} borderRadius="xl" minH="450px">
                    <Heading size="md" mb={4} textAlign="center">Total Points Leaderboard</Heading>
                    <Flex justify="center" align="end" mb={4} gap={4} wrap="wrap">
                        {podiumOrder.map((realIndex, i) => {
                            const u = top3[realIndex];
                            if (!u) return null;

                            return (
                                <MotionBox
                                    key={u.user_id}
                                    layout
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ duration: 0.4 }}
                                    p={3}
                                    borderRadius="lg"
                                    bg={podiumColors[i]}
                                    boxShadow="md"
                                    h={`${podiumHeights[i]}px`}
                                    w="110px"
                                    textAlign="center"
                                    display="flex"
                                    flexDirection="column"
                                    justifyContent="center"
                                    overflow="hidden"
                                >
                                    <Text fontWeight="bold" fontSize="lg" noOfLines={1}>#{realIndex + 1}</Text>
                                    <Text fontSize="sm" noOfLines={2}>{u.full_name}</Text>
                                    <Text fontWeight="bold">{u.TotalPoints}</Text>
                                </MotionBox>
                            );
                        })}
                    </Flex>
                    <Divider mb={4} />
                    <VStack align="stretch" spacing={2}>
                        <AnimatePresence>
                            {others.map((u, i) => (
                                <MotionBox
                                    key={u.user_id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    bg="white"
                                    p={3}
                                    borderRadius="md"
                                    boxShadow="sm"
                                >
                                    <Flex justify="space-between">
                                        <Text fontWeight="bold">#{i + 4} {u.full_name}</Text>
                                        <Flex align="center" gap={2}>
                                            <Text>{u.TotalPoints}</Text>
                                            {u.direction > 0 && <Text color="green.600">↑</Text>}
                                            {u.direction < 0 && <Text color="red.600">↓</Text>}
                                        </Flex>
                                    </Flex>
                                </MotionBox>
                            ))}
                        </AnimatePresence>
                    </VStack>
                </Box>

                <Box bg="blue.100" p={4} borderRadius="xl">
                    <Heading size="md" mb={4} textAlign="center">New Points</Heading>
                    <VStack align="stretch">
                        {sortedByNew.map((u, i) => (
                            <Box
                                key={u.user_id}
                                p={3}
                                borderRadius="md"
                                bg={i === 0 ? 'yellow.200' : i === 1 ? 'gray.200' : i === 2 ? 'orange.200' : 'white'}
                                boxShadow="sm"
                            >
                                <Text fontWeight="bold">#{i + 1} {u.full_name}</Text>
                                <Text>{u.NewPoints}</Text>
                            </Box>
                        ))}
                    </VStack>
                </Box>
            </SimpleGrid>
        </Box>
    );
}