import React, { useEffect, useState, useRef, useContext, useMemo } from 'react';
import {
    Box, Text, VStack, Heading, Flex, SimpleGrid, Divider, Spinner,
    Button, IconButton, HStack, Tooltip, useToast, Grid, Progress,
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
    ModalCloseButton, Input, useDisclosure,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Countdown from 'react-countdown';
import { motion, AnimatePresence } from 'framer-motion';
import { UserContext } from '../utils/UserContext';
import { EditIcon, ArrowBackIcon, CopyIcon, ViewIcon } from '@chakra-ui/icons';
import LeaderboardModal from '../components/LeaderboardModal';
import AuthGuard from '../components/AuthGuard';
import { BASE_URL } from '../constants/ApiConfig';
const REFRESH_INTERVAL = 30 * 1000;
const MotionBox = motion(Box);
const NEW_STEPS = ['11', '22', '33', '44', '55'];
const ARRIVAL_STORAGE_PREFIX = 'teacher-summary-arrivals:';

type OrgUser = {
    _id?: { $oid?: string } | string;
    id?: string;
    full_name?: string;
    schoolteacher?: string | null;
};

type SummaryProgressItem = {
    sulam_label?: string;
    steps_completed?: string[];
    range_points?: number;
};

function LeaderboardPageContent() {
    const { id } = useParams();
    const { user } = useContext(UserContext);
    const [data, setData] = useState<any[]>([]);
    const [leaderboard, setLeaderboard] = useState<any>(null);
    const [lastRanks, setLastRanks] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const [showEdit, setShowEdit] = useState(false);
    const [showTeacherSummary, setShowTeacherSummary] = useState(false);
    const [orgUsers, setOrgUsers] = useState<Record<string, OrgUser[]>>({});
    const [teacherOverrides, setTeacherOverrides] = useState<Record<string, string | null>>({});
    const [arrivalByTeacher, setArrivalByTeacher] = useState<Record<string, string>>({});
    const [draggedStudent, setDraggedStudent] = useState<any | null>(null);
    const [dragOverTeacher, setDragOverTeacher] = useState<string | null>(null);
    const [newTeacherName, setNewTeacherName] = useState('');
    const [emptyTeachers, setEmptyTeachers] = useState<Set<string>>(new Set());
    const [updatingTeacher, setUpdatingTeacher] = useState<string | null>(null);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const navigate = useNavigate();
    const toast = useToast();

    const token = localStorage.getItem('sulam_token') || '';

    useEffect(() => {
        if (!id) return;
        fetchData();
        fetchOrgUsers();
        intervalRef.current = setInterval(fetchData, REFRESH_INTERVAL);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [id]);

    useEffect(() => {
        if (!id) return;
        try {
            const raw = localStorage.getItem(`${ARRIVAL_STORAGE_PREFIX}${id}`);
            const parsed = raw ? JSON.parse(raw) : {};
            setArrivalByTeacher(parsed && typeof parsed === 'object' ? parsed : {});
        } catch {
            setArrivalByTeacher({});
        }
    }, [id]);

    const fetchOrgUsers = async () => {
        try {
            const res = await axios.get<Record<string, OrgUser[]>>(`${BASE_URL}/user/list_my_org_users`, {
                headers: { Authorization: token },
            });
            setOrgUsers(typeof res.data === 'object' ? res.data : {});
        } catch {
            setOrgUsers({});
        }
    };

    const fetchData = async () => {
        try {
            const headers = { headers: { Authorization: token } };
            const [scoresRes, metaRes] = await Promise.all([
                axios.get(`${BASE_URL}/leaderboard/${id}`, headers),
                axios.get(`${BASE_URL}/leaderboard/get/${id}`, headers),
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

    const saveArrivalTimes = (next: Record<string, string>) => {
        setArrivalByTeacher(next);
        if (!id) return;
        localStorage.setItem(`${ARRIVAL_STORAGE_PREFIX}${id}`, JSON.stringify(next));
    };

    const flatOrgUsers = useMemo(() => {
        const all: OrgUser[] = [];
        Object.values(orgUsers).forEach((users) => {
            all.push(...users);
        });
        return all;
    }, [orgUsers]);

    const userTeacherMap = useMemo(() => {
        const out: Record<string, string | null> = {};
        flatOrgUsers.forEach((u) => {
            const idVal = typeof u._id === 'string' ? u._id : u._id?.$oid || u.id;
            if (!idVal) return;
            out[idVal] = u.schoolteacher?.trim() || null;
        });
        Object.entries(teacherOverrides).forEach(([uid, teacher]) => {
            out[uid] = teacher;
        });
        return out;
    }, [flatOrgUsers, teacherOverrides]);

    const teacherGroups = useMemo(() => {
        const grouped: Record<string, any[]> = {};
        data.forEach((row) => {
            const teacher = row.schoolteacher?.trim() || userTeacherMap[row.user_id] || 'Unassigned';
            if (!grouped[teacher]) grouped[teacher] = [];
            grouped[teacher].push(row);
        });
        emptyTeachers.forEach((teacherName) => {
            if (!grouped[teacherName]) grouped[teacherName] = [];
        });
        return Object.entries(grouped)
            .map(([teacherName, students]) => {
                const totalPoints = students.reduce((sum, s) => sum + (s.TotalPoints || 0), 0);
                return {
                    teacherName,
                    students: [...students].sort((a, b) => (b.TotalPoints || 0) - (a.TotalPoints || 0)),
                    totalPoints,
                    totalPages: totalPoints / 550,
                };
            })
            .sort((a, b) => b.totalPoints - a.totalPoints);
    }, [data, userTeacherMap, emptyTeachers]);
    const maxTeacherPages = useMemo(
        () => Math.max(1, ...teacherGroups.map((g) => g.totalPages || 0)),
        [teacherGroups]
    );

    const getArrivalBand = (timeValue: string): 'neutral' | 'green' | 'lightRed' | 'darkRed' => {
        if (!timeValue || !timeValue.includes(':')) return 'neutral';
        const [hh, mm] = timeValue.split(':').map(Number);
        if (Number.isNaN(hh) || Number.isNaN(mm)) return 'neutral';
        const mins = hh * 60 + mm;
        const early = 8 * 60 + 10;
        const mid = 8 * 60 + 30;
        if (mins <= early) return 'green';
        if (mins <= mid) return 'lightRed';
        return 'darkRed';
    };

    const getArrivalAccent = (timeValue: string) => {
        const band = getArrivalBand(timeValue);
        if (band === 'green') {
            return {
                cardBorder: 'green.200',
                cardGradient: 'linear(to-b, green.50, white)',
                headerBg: 'green.100',
                headerBorder: 'green.200',
                headerText: 'green.800',
                inputBg: 'green.100',
            };
        }
        if (band === 'lightRed') {
            return {
                cardBorder: 'red.200',
                cardGradient: 'linear(to-b, red.50, white)',
                headerBg: 'red.100',
                headerBorder: 'red.200',
                headerText: 'red.800',
                inputBg: 'red.100',
            };
        }
        if (band === 'darkRed') {
            return {
                cardBorder: 'red.300',
                cardGradient: 'linear(to-b, red.100, white)',
                headerBg: 'red.300',
                headerBorder: 'red.400',
                headerText: 'red.900',
                inputBg: 'red.300',
            };
        }
        return {
            cardBorder: 'purple.100',
            cardGradient: 'linear(to-b, purple.50, white)',
            headerBg: 'purple.50',
            headerBorder: 'purple.100',
            headerText: 'purple.800',
            inputBg: 'gray.50',
        };
    };

    const getNewSullamProgress = (student: any): SummaryProgressItem[] => {
        const raw =
            student.NewSullamProgress ||
            student.new_sullam_progress ||
            student.newSulamProgress ||
            [];
        if (!Array.isArray(raw)) return [];
        return raw;
    };

    const updateStudentTeacher = async (studentId: string, teacherName: string | null) => {
        setUpdatingTeacher(studentId);
        try {
            await axios.put(
                `${BASE_URL}/user/update_student_teacher`,
                { student_id: studentId, schoolteacher: teacherName },
                { headers: { Authorization: token } }
            );
            setData((prev) => prev.map((u) => (u.user_id === studentId ? { ...u, schoolteacher: teacherName } : u)));
            setTeacherOverrides((prev) => ({ ...prev, [studentId]: teacherName }));
            toast({ status: 'success', title: 'Student teacher updated' });
        } catch {
            toast({ status: 'error', title: 'Failed to update student teacher' });
        } finally {
            setUpdatingTeacher(null);
        }
    };

    const handleCreateTeacher = () => {
        const teacher = newTeacherName.trim();
        if (!teacher) {
            toast({ status: 'warning', title: 'Please enter a teacher name' });
            return;
        }
        setEmptyTeachers((prev) => {
            const next = new Set(prev);
            next.add(teacher);
            return next;
        });
        setNewTeacherName('');
        onClose();
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
                    <Tooltip label="Teacher Summary">
                        <IconButton
                            aria-label="Teacher Summary"
                            icon={<ViewIcon />}
                            colorScheme={showTeacherSummary ? 'purple' : undefined}
                            variant={showTeacherSummary ? 'solid' : 'outline'}
                            onClick={() => setShowTeacherSummary((s) => !s)}
                        />
                    </Tooltip>
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

            {showTeacherSummary && (
                <Box mt={8} p={4} bg="white" borderRadius="xl" border="1px solid" borderColor="purple.100" boxShadow="md">
                    <HStack justify="space-between" mb={4}>
                        <Heading size="md" color="purple.700">Teacher Summary</Heading>
                        <Button size="sm" colorScheme="purple" onClick={onOpen}>+ New Teacher</Button>
                    </HStack>
                    <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4} alignItems="start">
                        {teacherGroups.map((group, idx) => {
                            const rank = group.teacherName === 'Unassigned' ? null : idx + 1;
                            const arrival = arrivalByTeacher[group.teacherName] || '';
                            const isDragOver = dragOverTeacher === group.teacherName;
                            const arrivalAccent = getArrivalAccent(arrival);
                            const teacherBar = Math.max(0, Math.min(100, (group.totalPages / maxTeacherPages) * 100));
                            const rankBg =
                                rank === 1 ? 'yellow.400' : rank === 2 ? 'blue.400' : rank === 3 ? 'orange.400' : 'gray.500';
                            const rankColor = rank === 1 ? 'black' : 'white';
                            return (
                                <Box
                                    key={group.teacherName}
                                    position="relative"
                                    w="full"
                                    border="2px solid"
                                    borderColor={isDragOver ? 'purple.300' : arrivalAccent.cardBorder}
                                    borderRadius="lg"
                                    overflow="hidden"
                                    boxShadow="sm"
                                    bgGradient={arrivalAccent.cardGradient}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOverTeacher(group.teacherName);
                                    }}
                                    onDragLeave={() => setDragOverTeacher(null)}
                                    onDrop={() => {
                                        if (!draggedStudent) return;
                                        const nextTeacher = group.teacherName === 'Unassigned' ? null : group.teacherName;
                                        updateStudentTeacher(draggedStudent.user_id, nextTeacher);
                                        setDraggedStudent(null);
                                        setDragOverTeacher(null);
                                    }}
                                >
                                    {rank !== null && (
                                        <Box
                                            position="absolute"
                                            top="10px"
                                            left="10px"
                                            w="26px"
                                            h="26px"
                                            borderRadius="full"
                                            bg={rankBg}
                                            color={rankColor}
                                            display="flex"
                                            alignItems="center"
                                            justifyContent="center"
                                            fontSize="sm"
                                            fontWeight="extrabold"
                                            boxShadow="md"
                                            zIndex={2}
                                        >
                                            {rank}
                                        </Box>
                                    )}
                                    <Box bg={arrivalAccent.headerBg} p={3} borderBottom="2px solid" borderColor={arrivalAccent.headerBorder}>
                                        <HStack justify="space-between" align="start" mb={2}>
                                            <VStack align="start" spacing={0}>
                                                <Text fontWeight="bold" color={arrivalAccent.headerText} pl={rank ? 8 : 0}>
                                                    {group.teacherName}
                                                </Text>
                                                <Text fontSize="sm" color="gray.600">
                                                    {group.students.length} student{group.students.length !== 1 ? 's' : ''} · {group.totalPages.toFixed(1)} pages
                                                </Text>
                                            </VStack>
                                            <Box minW="110px">
                                                <Text fontSize="xs" color="gray.600" mb={1}>Arrival</Text>
                                                <Input
                                                    size="sm"
                                                    type="time"
                                                    value={arrival}
                                                    bg={arrivalAccent.inputBg}
                                                    onChange={(e) => {
                                                        const next = { ...arrivalByTeacher, [group.teacherName]: e.target.value };
                                                        saveArrivalTimes(next);
                                                    }}
                                                />
                                            </Box>
                                        </HStack>
                                        <Box>
                                            <Progress
                                                value={teacherBar}
                                                size="sm"
                                                colorScheme={arrivalAccent.headerText.includes('green') ? 'green' : arrivalAccent.headerText.includes('red') ? 'red' : 'purple'}
                                                borderRadius="full"
                                            />
                                        </Box>
                                    </Box>
                                    <VStack spacing={0} align="stretch">
                                        {group.students.map((student: any, studentIdx: number) => {
                                            const progressItems = getNewSullamProgress(student);
                                            const hasSingleProgressCard = progressItems.length === 1;
                                            const qadeemPoints = ((student.QadeemPoints ?? student.OldPoints) || 0);
                                            const tikrarPoints = ((student.TikrarPoints ?? 0) || 0);
                                            const newPoints = (student.NewPoints || 0);
                                            const isAllZeroStudent = qadeemPoints === 0 && tikrarPoints === 0 && newPoints === 0;
                                            return (
                                                <Box
                                                    key={student.user_id}
                                                    p={3}
                                                    bg={
                                                        isAllZeroStudent
                                                            ? 'red.100'
                                                            : (studentIdx % 2 === 0 ? 'white' : 'gray.50')
                                                    }
                                                    borderBottom={studentIdx === group.students.length - 1 ? 'none' : '2px solid'}
                                                    borderColor={arrivalAccent.headerBorder}
                                                    draggable
                                                    cursor={updatingTeacher === student.user_id ? 'not-allowed' : 'grab'}
                                                    opacity={updatingTeacher === student.user_id ? 0.6 : 1}
                                                    onDragStart={() => setDraggedStudent(student)}
                                                    onDragEnd={() => setDraggedStudent(null)}
                                                >
                                                    <HStack justify="space-between" align="start" mb={2}>
                                                        <Text fontWeight="bold">{student.full_name}</Text>
                                                        <Text fontSize="sm" color="purple.700" fontWeight="bold">
                                                            {(student.TotalPoints / 550).toFixed(1)}p
                                                        </Text>
                                                    </HStack>
                                                    <Flex
                                                        gap={2}
                                                        mb={2}
                                                        align={hasSingleProgressCard ? 'center' : 'start'}
                                                        justify="space-between"
                                                        wrap={hasSingleProgressCard ? 'nowrap' : 'wrap'}
                                                    >
                                                        {hasSingleProgressCard ? (
                                                            <VStack align="start" spacing={1} flex="1" minW={0}>
                                                                <Box
                                                                    px={2}
                                                                    py={1}
                                                                    borderRadius="md"
                                                                    border="1px solid"
                                                                    borderColor={student.QadeemStatus === true ? 'green.400' : 'transparent'}
                                                                    bg={student.QadeemStatus === true ? 'green.50' : 'transparent'}
                                                                >
                                                                    <Text fontSize="sm" color="gray.700">
                                                                        Qadeem:{' '}
                                                                        <strong>{(qadeemPoints / 550).toFixed(1)}p</strong>
                                                                        {student.QadeemStatus === true && <span style={{ color: '#FFD700' }}> ✭</span>}
                                                                    </Text>
                                                                </Box>
                                                                <Box px={2} py={1}>
                                                                    <Text fontSize="sm" color="gray.700">
                                                                        Tikrar: <strong>{(tikrarPoints / 550).toFixed(1)}p</strong>
                                                                    </Text>
                                                                </Box>
                                                            </VStack>
                                                        ) : (
                                                            <HStack spacing={3} flex="1" minW={0}>
                                                                <Box
                                                                    px={2}
                                                                    py={1}
                                                                    borderRadius="md"
                                                                    border="1px solid"
                                                                    borderColor={student.QadeemStatus === true ? 'green.400' : 'transparent'}
                                                                    bg={student.QadeemStatus === true ? 'green.50' : 'transparent'}
                                                                >
                                                                    <Text fontSize="sm" color="gray.700">
                                                                        Qadeem:{' '}
                                                                        <strong>{(qadeemPoints / 550).toFixed(1)}p</strong>
                                                                        {student.QadeemStatus === true && <span style={{ color: '#FFD700' }}> ✭</span>}
                                                                    </Text>
                                                                </Box>
                                                                <Box px={2} py={1}>
                                                                    <Text fontSize="sm" color="gray.700">
                                                                        Tikrar: <strong>{(tikrarPoints / 550).toFixed(1)}p</strong>
                                                                    </Text>
                                                                </Box>
                                                            </HStack>
                                                        )}
                                                        {hasSingleProgressCard && (() => {
                                                            const item = progressItems[0];
                                                            const completed = new Set(item.steps_completed || []);
                                                            const rangeLines = (((item.range_points || 0) / 550) * 15).toFixed(1);
                                                            return (
                                                                <Box p={2} bg="purple.50" borderRadius="md" border="1px solid" borderColor="purple.100" flexShrink={0}>
                                                                    <HStack justify="space-between" mb={1}>
                                                                        <Text fontSize="xs" color="purple.800" fontWeight="bold" noOfLines={1}>
                                                                            {rangeLines} Lines
                                                                        </Text>
                                                                    </HStack>
                                                                    <HStack spacing={1} align="center">
                                                                        {NEW_STEPS.map((step, sIdx) => (
                                                                            <React.Fragment key={`${student.user_id}-inline-${step}`}>
                                                                                <Box
                                                                                    w="18px"
                                                                                    h="18px"
                                                                                    borderRadius="full"
                                                                                    bg={completed.has(step) ? 'purple.500' : 'gray.300'}
                                                                                    color="white"
                                                                                    fontSize="10px"
                                                                                    display="flex"
                                                                                    alignItems="center"
                                                                                    justifyContent="center"
                                                                                    fontWeight="bold"
                                                                                >
                                                                                    {step}
                                                                                </Box>
                                                                                {sIdx !== NEW_STEPS.length - 1 && (
                                                                                    <Progress
                                                                                        value={completed.has(step) && completed.has(NEW_STEPS[sIdx + 1]) ? 100 : 0}
                                                                                        size="xs"
                                                                                        colorScheme="purple"
                                                                                        w="20px"
                                                                                        borderRadius="full"
                                                                                    />
                                                                                )}
                                                                            </React.Fragment>
                                                                        ))}
                                                                    </HStack>
                                                                </Box>
                                                            );
                                                        })()}
                                                    </Flex>
                                                    {!hasSingleProgressCard && progressItems.length > 0 ? (
                                                        <SimpleGrid columns={2} spacing={2}>
                                                            {progressItems.map((item, pIdx) => {
                                                                const completed = new Set(item.steps_completed || []);
                                                                const rangeLines = (((item.range_points || 0) / 550) * 15).toFixed(1);
                                                                return (
                                                                    <Box
                                                                        key={`${student.user_id}-progress-${pIdx}`}
                                                                        p={2}
                                                                        bg="purple.50"
                                                                        borderRadius="md"
                                                                        border="1px solid"
                                                                        borderColor="purple.100"
                                                                    >
                                                                        <HStack justify="space-between" mb={1}>
                                                                            <Text fontSize="xs" color="purple.800" fontWeight="bold" noOfLines={1}>
                                                                                {rangeLines} Lines
                                                                            </Text>
                                                                        </HStack>
                                                                        <HStack spacing={1} align="center">
                                                                            {NEW_STEPS.map((step, sIdx) => (
                                                                                <React.Fragment key={`${student.user_id}-${pIdx}-${step}`}>
                                                                                    <Box
                                                                                        w="18px"
                                                                                        h="18px"
                                                                                        borderRadius="full"
                                                                                        bg={completed.has(step) ? 'purple.500' : 'gray.300'}
                                                                                        color="white"
                                                                                        fontSize="10px"
                                                                                        display="flex"
                                                                                        alignItems="center"
                                                                                        justifyContent="center"
                                                                                        fontWeight="bold"
                                                                                    >
                                                                                        {step}
                                                                                    </Box>
                                                                                    {sIdx !== NEW_STEPS.length - 1 && (
                                                                                        <Progress
                                                                                            value={completed.has(step) && completed.has(NEW_STEPS[sIdx + 1]) ? 100 : 0}
                                                                                            size="xs"
                                                                                            colorScheme="purple"
                                                                                            w="20px"
                                                                                            borderRadius="full"
                                                                                        />
                                                                                    )}
                                                                                </React.Fragment>
                                                                            ))}
                                                                        </HStack>
                                                                    </Box>
                                                                );
                                                            })}
                                                        </SimpleGrid>
                                                    ) : (
                                                        !hasSingleProgressCard && (
                                                            <Text fontSize="xs" color="gray.500">No New completed today.</Text>
                                                        )
                                                    )}
                                                </Box>
                                            );
                                        })}
                                        {group.students.length === 0 && (
                                            <Box p={3}>
                                                <Text fontSize="sm" color="gray.500">Drag students here to assign.</Text>
                                            </Box>
                                        )}
                                    </VStack>
                                </Box>
                            );
                        })}
                    </SimpleGrid>
                </Box>
            )}
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

            <Modal isOpen={isOpen} onClose={onClose}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Create New Teacher</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <Input
                            placeholder="Enter teacher name"
                            value={newTeacherName}
                            onChange={(e) => setNewTeacherName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateTeacher();
                            }}
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button colorScheme="purple" mr={3} onClick={handleCreateTeacher}>
                            Create
                        </Button>
                        <Button variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    );
}

export default function LeaderboardPage() {
    return (
        <AuthGuard>
            <LeaderboardPageContent />
        </AuthGuard>
    );
}