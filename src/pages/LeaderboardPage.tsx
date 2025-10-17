import React, { useEffect, useState, useRef, useContext } from 'react';
import {
    Box, Text, VStack, Heading, Flex, SimpleGrid, Divider, Spinner,
    Button, IconButton, HStack, Tooltip, useToast, Grid,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Countdown from 'react-countdown';
import { motion, AnimatePresence } from 'framer-motion';
import { UserContext } from '../utils/UserContext';
import { EditIcon, ArrowBackIcon, CopyIcon } from '@chakra-ui/icons';
import LeaderboardModal from '../components/LeaderboardModal';

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
    const [showEdit, setShowEdit] = useState(false);
    const navigate = useNavigate();
    const toast = useToast();

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
    const leaderboardEnded = isValidEndTime && Date.now() > endTime.getTime();
    const sortedByOld = [...data].sort((a, b) => b.OldPoints - a.OldPoints);
    const sortedByNew = [...data].sort((a, b) => b.NewPoints - a.NewPoints);
    //--- total cool stuff
    const userPresence = leaderboard?.user_presence || {};
    const presenceCount = Object.keys(userPresence).length || 1;

    const oldTotalPoints = sortedByOld.reduce((sum, u) => sum + u.OldPoints, 0);
    const oldTotalPages = (oldTotalPoints / 550).toFixed(1);
    const oldAvgPages = (oldTotalPoints / presenceCount / 550).toFixed(1);

    const newTotalPoints = sortedByNew.reduce((sum, u) => sum + u.NewPoints, 0);
    const newTotalPages = (newTotalPoints / 550).toFixed(1);
    const newAvgPages = (newTotalPoints / presenceCount / 550).toFixed(1);

    const totalPointsSum = data.reduce((sum, u) => sum + u.TotalPoints, 0);
    const totalPages = (totalPointsSum / 550).toFixed(1);
    const avgPages = (totalPointsSum / presenceCount / 550).toFixed(1);
    //------
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

    const canEditLeaderboard = () => {
        if (!user || !leaderboard) return false;
        const roles = new Set(['teacher', 'rabtteacher', 'admin']);
        const orgs: string[] = Array.isArray(leaderboard.student_organizations) ? leaderboard.student_organizations : [];
        for (const org of orgs) {
            const r = user.organizations?.[org]?.role;
            if (roles.has(r)) return true;
        }
        return false;
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            toast({ status: 'success', title: 'Link copied' });
        } catch {
            toast({ status: 'error', title: 'Failed to copy' });
        }
    };

    return (
        <Box p={6}>
            <Grid templateColumns={["1fr 1fr 1fr", null, "1fr auto 1fr"]} alignItems="center" mb={4} gap={2}>
                <HStack>
                    <Tooltip label="Home">
                        <IconButton aria-label="Home" icon={<ArrowBackIcon />} onClick={() => navigate('/')} />
                    </Tooltip>
                </HStack>
                <VStack spacing={1}>
                    <Heading textAlign="center">{leaderboard.name}</Heading>
                    <Flex justify="center" align="center">
                        {isValidEndTime ? (
                            <Countdown date={endTime} renderer={countdownRenderer} />
                        ) : (
                            <Text fontSize="xl" color="red.500">Invalid end time</Text>
                        )}
                    </Flex>
                </VStack>
                <HStack justifySelf="end">
                    <Tooltip label="Copy link">
                        <IconButton aria-label="Copy link" icon={<CopyIcon />} onClick={handleCopyLink} />
                    </Tooltip>
                    {canEditLeaderboard() && (
                        <Tooltip label="Edit leaderboard">
                            <IconButton aria-label="Edit" icon={<EditIcon />} onClick={() => setShowEdit(true)} />
                        </Tooltip>
                    )}
                </HStack>
            </Grid>
            {/* disclaimer removed as stars are anchored to LB day window */}
            
            <SimpleGrid columns={[1, null, 3]} spacing={6}>

                <Box bg="purple.100" p={4} borderRadius="xl">

                    <Box
                        bg="purple.300"
                        px={5}
                        py={2}
                        mb={2}
                        borderRadius="md"
                        boxShadow="md"
                        textAlign="center"
                    >
                        <Heading size="md" fontWeight={"bold"} color="white"mb={4} textAlign="center">Qadeem Points</Heading>
                        <Text fontSize="md" color="white">
                            <strong style={{ fontSize: '1.1rem' }}>
                                {oldTotalPages} pages total
                            </strong>{' '}
                            ·{'  '}
                            <strong style={{ fontSize: '1.1rem' }}>
                                {oldAvgPages} avg
                            </strong>
                        </Text>
                    </Box>
                    <VStack align="stretch">
                        {sortedByOld.map((u, i) => {

                            const baseColor = i === 0 ? 'yellow.200' : i === 1 ? 'gray.200' : i === 2 ? 'orange.200' : 'white';
                            const qadeemStatus = u.QadeemStatus; // true | false | null
                            const bgColor = qadeemStatus === true ? 'green.300'
                                : qadeemStatus === false ? baseColor
                                    : 'gray.100';

                            return (
                                <Box
                                    key={u.user_id}
                                    p={3}
                                    borderRadius="md"
                                    bg={bgColor}
                                    boxShadow="md"
                                    display="flex"
                                    justifyContent="space-between"
                                    alignItems="center"
                                >
                                    <Text fontWeight="bold" textAlign="left">
                                        #{i + 1} {u.full_name}
                                        {qadeemStatus === true && <span style={{ color: '#FFD700' }}> ✭</span>}
                                        {qadeemStatus === null && <span style={{ fontSize: '14px', color: '#666' }}> — </span>}
                                    </Text>
                                    <Flex direction="column" align="end">
                                        <Text>{u.OldPoints}</Text>
                                        <Text fontSize="sm" color="gray.700">
                                            ~{(u.OldPoints / 550).toFixed(1)} pages (range: {(u.QadeemRange / 550).toFixed(1)})
                                        </Text>
                                    </Flex>
                                </Box>
                            );
                        })}
                    </VStack>
                </Box>

                <Box
                    bg="green.100"
                    p={6}
                    borderRadius="xl"
                    minH="400px"
                    className="middle-leaderboard"
                    sx={{ transform: "scale(1.01)", zIndex: 1 }}
                >


                    <Box
                        bg="green.300"
                        px={5}
                        py={2}
                        mb={2}
                        borderRadius="md"
                        boxShadow="md"
                        textAlign="center"

                    >
                        <Heading size="md" fontWeight={"bold"} color="white"mb={4} textAlign="center">Total Points Leaderboard</Heading>
                        <Text fontSize="md" color="white">
                            <strong style={{ fontSize: '1.1rem' }}>
                                {totalPages} pages total
                            </strong>{' '}
                            ·{'  '}
                            <strong style={{ fontSize: '1.1rem' }}>
                                {avgPages} avg
                            </strong>
                        </Text>
                    </Box>
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
                                    <Text fontSize="xs" color="gray.700">
                                        ~{(u.TotalPoints / 550).toFixed(1)} pages
                                    </Text>
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
                                            <Flex direction="column" align="end">
                                                <Text>{u.TotalPoints}</Text>
                                                <Text fontSize="xs" color="gray.700">
                                                    ~{(u.TotalPoints / 550).toFixed(1)} pages
                                                </Text>
                                            </Flex>
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
                    <Box
                        bg="blue.300"
                        px={5}
                        py={2}
                        mb={2}
                        borderRadius="md"
                        boxShadow="md"
                        textAlign="center"
                    >
                        <Heading size="md" fontWeight={"bold"} color="white"mb={4} textAlign="center">Jadeed Points</Heading>
                        <Text fontSize="md" color="white">
                            <strong style={{ fontSize: '1.1rem' }}>
                                {newTotalPages} pages total
                            </strong>{' '}
                            ·{'  '}
                            <strong style={{ fontSize: '1.1rem' }}>
                                {newAvgPages} avg
                            </strong>
                        </Text>
                    </Box>
                    <VStack align="stretch">
                        {sortedByNew.map((u, i) => (
                            <Box
                                key={u.user_id}
                                p={3}
                                borderRadius="md"
                                bg={i === 0 ? 'yellow.200' : i === 1 ? 'gray.200' : i === 2 ? 'orange.200' : 'white'}
                                boxShadow="sm"
                            >
                                <Flex justify="space-between" align="center">
                                    <Text fontWeight="bold" textAlign="left">
                                        #{i + 1} {u.full_name}
                                    </Text>
                                    <Flex direction="column" align="end">
                                        <Text>{u.NewPoints}</Text>
                                        <Text fontSize="sm" color="gray.700">
                                            ~{(u.NewPoints / 550).toFixed(1)} pages (range: {(u.JadeedRange / 550).toFixed(1)})
                                        </Text>
                                    </Flex>
                                </Flex>
                            </Box>
                        ))}
                    </VStack>
                </Box>
            </SimpleGrid>
            {showEdit && (
                <LeaderboardModal
                    isOpen
                    mode="edit"
                    existing={leaderboard}
                    onClose={() => setShowEdit(false)}
                    onSuccess={() => {
                        setShowEdit(false);
                        fetchData();
                    }}
                />
            )}
        </Box>
    );
}