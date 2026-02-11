import React, { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Flex,
    Heading,
    HStack,
    Progress,
    Spinner,
    Text,
    VStack,
    useToast,
    Input,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    ModalCloseButton,
    useDisclosure,
    IconButton,
} from '@chakra-ui/react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthGuard from '../components/AuthGuard';
import { BASE_URL } from '../constants/ApiConfig';

type LeaderboardState = {
    userIds: string[];
    startTimeIso: string; // ISO string
    endTimeIso: string; // ISO string
};

type Row = {
    user_id: string;
    name: string;
    new_pages: number;
    claimgoal: number;
    goal_pages: number;
    ratio: number | null;
    percent: number | null;
    schoolteacher: string | null;
};

type TeacherGroup = {
    teacherName: string;
    students: Row[];
    averagePercent: number;
};

function fmt(n: number | null | undefined) {
    if (n === null || n === undefined || Number.isNaN(n)) return '';
    return Number(n).toFixed(2);
}

const formatDateLabel = (d: Date | null) => {
    if (!d) return '';
    return d.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    });
};

function PercentageLeaderboardContent() {
    const toast = useToast();
    const navigate = useNavigate();
    const token = localStorage.getItem('sulam_token') || '';
    const location = useLocation();
    const state = (location.state || null) as LeaderboardState | null;

    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<Row[]>([]);
    const [groupView, setGroupView] = useState(false);
    const [newTeacherName, setNewTeacherName] = useState('');
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [updatingTeacher, setUpdatingTeacher] = useState<string | null>(null);
    const [draggedStudent, setDraggedStudent] = useState<Row | null>(null);
    const [dragOverTeacher, setDragOverTeacher] = useState<string | null>(null);
    const [emptyTeachers, setEmptyTeachers] = useState<Set<string>>(new Set());

    const startDate = useMemo(() => (state?.startTimeIso ? new Date(state.startTimeIso) : null), [state]);
    const endDate = useMemo(() => (state?.endTimeIso ? new Date(state.endTimeIso) : null), [state]);

    // Group students by teacher
    const teacherGroups = useMemo(() => {
        const groups: Record<string, Row[]> = {};
        const unassigned: Row[] = [];

        rows.forEach((row) => {
            const teacher = row.schoolteacher?.trim();
            if (teacher) {
                if (!groups[teacher]) {
                    groups[teacher] = [];
                }
                groups[teacher].push(row);
            } else {
                unassigned.push(row);
            }
        });

        // Add empty teachers (created but no students assigned yet)
        Array.from(emptyTeachers).forEach((teacherName) => {
            if (!groups[teacherName]) {
                groups[teacherName] = [];
            }
        });

        // Convert to array and calculate averages
        const result: TeacherGroup[] = Object.entries(groups).map(([teacherName, students]) => {
            const validPercents = students
                .map((s) => s.percent)
                .filter((p): p is number => p !== null && p !== undefined && !Number.isNaN(p));
            const avg = validPercents.length > 0
                ? validPercents.reduce((a, b) => a + b, 0) / validPercents.length
                : 0;

            return {
                teacherName,
                students: students.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1)),
                averagePercent: Math.round(avg * 10) / 10,
            };
        });

        // Sort by average percent descending
        result.sort((a, b) => b.averagePercent - a.averagePercent);

        // Add unassigned group if any
        if (unassigned.length > 0) {
            const validPercents = unassigned
                .map((s) => s.percent)
                .filter((p): p is number => p !== null && p !== undefined && !Number.isNaN(p));
            const avg = validPercents.length > 0
                ? validPercents.reduce((a, b) => a + b, 0) / validPercents.length
                : 0;

            result.push({
                teacherName: 'Unassigned',
                students: unassigned.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1)),
                averagePercent: Math.round(avg * 10) / 10,
            });
        }

        return result;
    }, [rows, emptyTeachers]);

    useEffect(() => {
        if (!state?.userIds?.length || !state.startTimeIso || !state.endTimeIso) {
            setLoading(false);
            setRows([]);
            return;
        }

        setLoading(true);
        axios
            .post(
                `${BASE_URL}/export/percentage_leaderboard`,
                {
                    user_ids: state.userIds,
                    start_date: state.startTimeIso,
                    end_date: state.endTimeIso,
                },
                { headers: { Authorization: token } }
            )
            .then((res) => {
                const out: Row[] = Array.isArray(res.data?.results) ? res.data.results : [];
                // Server already sorts desc, but keep it robust
                out.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
                setRows(out);
            })
            .catch((err) => {
                console.error('Failed to load percentage leaderboard:', err);
                toast({ status: 'error', title: 'Failed to load percentage leaderboard' });
                setRows([]);
            })
            .finally(() => setLoading(false));
    }, [state, token, toast]);

    const updateStudentTeacher = async (studentId: string, teacherName: string | null) => {
        setUpdatingTeacher(studentId);
        try {
            await axios.put(
                `${BASE_URL}/user/update_student_teacher`,
                {
                    student_id: studentId,
                    schoolteacher: teacherName,
                },
                { headers: { Authorization: token } }
            );

            // Update local state
            setRows((prev) =>
                prev.map((r) =>
                    r.user_id === studentId ? { ...r, schoolteacher: teacherName } : r
                )
            );

            toast({ status: 'success', title: 'Student teacher updated' });
        } catch (err) {
            console.error('Failed to update student teacher:', err);
            toast({ status: 'error', title: 'Failed to update student teacher' });
        } finally {
            setUpdatingTeacher(null);
        }
    };

    const handleCreateTeacher = () => {
        const trimmedName = newTeacherName.trim();
        if (!trimmedName) {
            toast({ status: 'warning', title: 'Please enter a teacher name' });
            return;
        }
        // Add to empty teachers set
        setEmptyTeachers((prev) => {
            const newSet = new Set(prev);
            newSet.add(trimmedName);
            return newSet;
        });
        setNewTeacherName('');
        onClose();
        toast({ status: 'success', title: `Teacher "${trimmedName}" created. Drag students to assign them.` });
    };

    const handleDragStart = (student: Row) => {
        setDraggedStudent(student);
    };

    const handleDragEnd = () => {
        setDraggedStudent(null);
    };

    const handleDrop = (teacherName: string | null) => {
        if (!draggedStudent) return;
        const destTeacher = teacherName === 'Unassigned' ? null : teacherName;
        updateStudentTeacher(draggedStudent.user_id, destTeacher);
        setDraggedStudent(null);
    };

    const handleDragOver = (e: React.DragEvent, teacherName: string | null) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverTeacher(teacherName === 'Unassigned' ? null : teacherName);
    };

    const handleDragLeave = () => {
        setDragOverTeacher(null);
    };

    const renderStudentRow = (r: Row, idx: number, isTeacherRow = false) => {
        const hasGoal = (r.goal_pages || 0) > 0;
        const ratio = hasGoal ? (r.new_pages / r.goal_pages) : 0;
        const percent = hasGoal ? ratio * 100 : 0;
        const barValue = Math.max(0, Math.min(100, percent));
        const labelLeft = Math.max(0, Math.min(100, barValue));
        const labelTransform =
            labelLeft <= 2 ? 'translateX(0%)' : labelLeft >= 98 ? 'translateX(-100%)' : 'translateX(-50%)';

        return (
            <Box
                px={4}
                py={3}
                bg={idx % 2 === 0 ? 'whiteAlpha.900' : 'purple.50'}
                borderBottom={idx === (isTeacherRow ? 0 : rows.length - 1) ? 'none' : '1px solid'}
                borderColor="purple.100"
            >
                <HStack spacing={3} align="center">
                    {!isTeacherRow && (
                        <Text
                            minW="26px"
                            textAlign="right"
                            fontSize="xs"
                            color="gray.500"
                            fontWeight="bold"
                        >
                            {idx + 1}.
                        </Text>
                    )}
                    <Box flex="1" minW={0}>
                        <HStack justify="space-between" spacing={3} align="center">
                            <Text fontSize={isTeacherRow ? 'md' : 'sm'} fontWeight={isTeacherRow ? 'bold' : 'semibold'} isTruncated>
                                {r.name}
                            </Text>
                        </HStack>
                        <HStack spacing={3} align="center" mt={1}>
                            <Box flex="1">
                                <Progress
                                    value={barValue}
                                    size="sm"
                                    colorScheme="purple"
                                    borderRadius="full"
                                    boxShadow="inset 0 1px 2px rgba(0,0,0,0.08)"
                                />
                                <Box position="relative" h="18px" mt={1}>
                                    <Text
                                        position="absolute"
                                        left={`${labelLeft}%`}
                                        transform={labelTransform}
                                        fontSize="md"
                                        color={hasGoal ? 'purple.700' : 'gray.500'}
                                        fontWeight="extrabold"
                                        whiteSpace="nowrap"
                                    >
                                        {hasGoal ? `${Math.round(percent)}%` : 'No goal'}
                                    </Text>
                                </Box>
                            </Box>
                            <Text
                                fontSize="sm"
                                color="purple.700"
                                fontWeight="bold"
                                minW="110px"
                                textAlign="center"
                                whiteSpace="nowrap"
                            >
                                {fmt(r.new_pages)} / {fmt(r.goal_pages)}
                            </Text>
                        </HStack>
                    </Box>
                </HStack>
            </Box>
        );
    };

    if (!state?.userIds?.length || !state.startTimeIso || !state.endTimeIso) {
        return (
            <Flex align="center" justify="center" minH="100vh" p={6} bg="gray.50">
                <Box bg="white" borderRadius="xl" boxShadow="lg" p={8} maxW="lg" w="full">
                    <VStack spacing={4} align="stretch">
                        <Heading size="md" color="purple.700">
                            Percentage Leaderboard
                        </Heading>
                        <Text color="gray.600">
                            Missing inputs. Go back to Export Data, select students, and set a date range.
                        </Text>
                        <Button colorScheme="purple" onClick={() => navigate('/export-data')}>
                            ← Back to Export Data
                        </Button>
                    </VStack>
                </Box>
            </Flex>
        );
    }

    return (
        <Box minH="100vh" bg="gray.50">
            <Flex align="center" justify="center" minH="100vh" p={6}>
                <Box
                    w="full"
                    maxW={groupView ? '100%' : '5xl'}
                    bg="white"
                    borderRadius={groupView ? 'lg' : 'xl'}
                    boxShadow="lg"
                    p={groupView ? 4 : 6}
                >
                    <VStack spacing={4} align="stretch">
                        <HStack justify="space-between" align="center">
                            <Box>
                                <Heading size="lg" color="purple.700">
                                    Percentage Leaderboard
                                </Heading>
                                <Text color="gray.600" fontSize="sm">
                                    Range: {formatDateLabel(startDate)} – {formatDateLabel(endDate)}
                                </Text>
                            </Box>
                            <HStack spacing={2}>
                                {groupView && (
                                    <Button size="sm" colorScheme="purple" onClick={onOpen}>
                                        + New Teacher
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    colorScheme={groupView ? 'purple' : 'gray'}
                                    variant={groupView ? 'solid' : 'outline'}
                                    onClick={() => setGroupView(!groupView)}
                                >
                                    {groupView ? 'Switch to List View' : 'Switch to Group View'}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => navigate(-1)}>
                                    ← Back
                                </Button>
                            </HStack>
                        </HStack>

                        {loading ? (
                            <Flex align="center" justify="center" py={12}>
                                <Spinner size="xl" />
                            </Flex>
                        ) : groupView ? (
                            teacherGroups.length === 0 ? (
                                <Box px={4} py={6} textAlign="center">
                                    <Text color="gray.600" fontSize="sm">
                                        No students found.
                                    </Text>
                                </Box>
                            ) : (
                                <Box
                                    sx={{
                                        // Fewer columns => wider cards (so % + header content fits)
                                        columnCount: { base: 1, md: 1, lg: 2, xl: 3 },
                                        columnGap: '18px',
                                    }}
                                >
                                    {teacherGroups.map((group, groupIdx) => {
                                        const isUnassigned = group.teacherName === 'Unassigned';
                                        const hasAnyPercent = group.students.some((s) => typeof s.percent === 'number' && !Number.isNaN(s.percent));
                                        const avgPercent = hasAnyPercent ? group.averagePercent : 0;
                                        const barValue = Math.max(0, Math.min(100, avgPercent));
                                        const labelLeft = Math.max(0, Math.min(100, barValue));
                                        const labelTransform =
                                            labelLeft <= 2 ? 'translateX(0%)' : labelLeft >= 98 ? 'translateX(-100%)' : 'translateX(-50%)';

                                        const teacherKey = group.teacherName === 'Unassigned' ? null : group.teacherName;
                                        const isDragOver = dragOverTeacher === teacherKey;
                                        const accent: 'green' | 'yellow' | 'red' | 'gray' =
                                            isUnassigned || !hasAnyPercent ? 'gray' : avgPercent >= 100 ? 'green' : avgPercent >= 50 ? 'yellow' : 'red';

                                        const borderColorValue = isDragOver
                                            ? accent === 'gray'
                                                ? 'gray.400'
                                                : `${accent}.400`
                                            : accent === 'gray'
                                            ? 'gray.300'
                                            : `${accent}.200`;

                                        const bgValue = isDragOver
                                            ? accent === 'gray'
                                                ? 'gray.200'
                                                : `${accent}.100`
                                            : draggedStudent
                                            ? accent === 'gray'
                                                ? 'gray.50'
                                                : `${accent}.50`
                                            : undefined;

                                        const headerBg = accent === 'gray' ? 'gray.100' : `${accent}.100`;
                                        const headerTextColor = accent === 'gray' ? 'gray.700' : `${accent}.800`;
                                        const headerDividerColor = accent === 'gray' ? 'gray.300' : `${accent}.200`;
                                        const cardGradient =
                                            accent === 'gray' ? 'linear(to-b, gray.50, white)' : `linear(to-b, ${accent}.50, white)`;

                                        const rank = isUnassigned ? null : groupIdx + 1;
                                        const rankBg =
                                            rank === 1 ? 'yellow.400' : rank === 2 ? 'blue.400' : rank === 3 ? 'orange.400' : 'gray.400';
                                        const rankColor = rank === 1 ? 'black' : 'white';

                                        return (
                                            <Box
                                                key={group.teacherName}
                                                position="relative"
                                                w="full"
                                                mb={4}
                                                display="inline-block"
                                                sx={{ breakInside: 'avoid' }}
                                                border="2px solid"
                                                borderRadius="lg"
                                                overflow="hidden"
                                                bgGradient={cardGradient}
                                                boxShadow="md"
                                                onDragOver={(e) => handleDragOver(e, group.teacherName)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={() => {
                                                    handleDrop(group.teacherName === 'Unassigned' ? null : group.teacherName);
                                                    setDragOverTeacher(null);
                                                }}
                                                bg={bgValue}
                                                borderColor={borderColorValue}
                                                transition="all 0.2s"
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
                                                {/* Teacher Header */}
                                                <Box
                                                    px={4}
                                                    py={3}
                                                    bg={headerBg}
                                                    borderBottom="2px solid"
                                                    borderColor={headerDividerColor}
                                                >
                                                    <VStack align="stretch" spacing={2}>
                                                        <HStack justify="space-between" align="start" spacing={3}>
                                                            <Text
                                                                fontSize="lg"
                                                                fontWeight="bold"
                                                                color={headerTextColor}
                                                                minW={0}
                                                                isTruncated
                                                                pr={2}
                                                                pl={rank !== null ? 8 : 0}
                                                            >
                                                                {group.teacherName}
                                                            </Text>
                                                            <Text fontSize="sm" color="gray.600" whiteSpace="nowrap">
                                                                {group.students.length} student{group.students.length !== 1 ? 's' : ''}
                                                            </Text>
                                                        </HStack>

                                                        <Box w="full">
                                                            <Progress
                                                                value={barValue}
                                                                size="md"
                                                                colorScheme={accent === 'gray' ? 'gray' : accent}
                                                                borderRadius="full"
                                                                boxShadow="inset 0 1px 2px rgba(0,0,0,0.08)"
                                                            />
                                                            <Box position="relative" h="26px" mt={1} overflow="visible">
                                                                <Text
                                                                    position="absolute"
                                                                    left={`${labelLeft}%`}
                                                                    transform={labelTransform}
                                                                    fontSize="md"
                                                                    color={hasAnyPercent ? (accent === 'gray' ? 'gray.600' : `${accent}.800`) : 'gray.500'}
                                                                    fontWeight="extrabold"
                                                                    whiteSpace="nowrap"
                                                                    lineHeight="26px"
                                                                    maxW="100%"
                                                                    bg="transparent"
                                                                >
                                                                    {hasAnyPercent ? `${Math.round(avgPercent)}%` : 'No goal'}
                                                                </Text>
                                                            </Box>
                                                        </Box>
                                                    </VStack>
                                                </Box>

                                                {/* Students */}
                                                <VStack spacing={0} align="stretch">
                                                    {group.students.map((student, idx) => (
                                                        <Box
                                                            key={student.user_id}
                                                            draggable
                                                            onDragStart={() => handleDragStart(student)}
                                                            onDragEnd={handleDragEnd}
                                                            bg={idx % 2 === 0 ? 'whiteAlpha.900' : 'gray.50'}
                                                            borderBottom={idx === group.students.length - 1 ? 'none' : '1px solid'}
                                                            borderColor="purple.100"
                                                            cursor="grab"
                                                            _hover={{ bg: 'gray.100' }}
                                                            _active={{ cursor: 'grabbing' }}
                                                            opacity={draggedStudent?.user_id === student.user_id ? 0.5 : 1}
                                                        >
                                                            {renderStudentRow(student, idx)}
                                                        </Box>
                                                    ))}
                                                </VStack>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            )
                        ) : (
                            <Box
                                border="1px solid"
                                borderColor="purple.100"
                                borderRadius="lg"
                                overflow="hidden"
                                bgGradient="linear(to-b, purple.50, white)"
                                boxShadow="md"
                            >
                                <VStack spacing={0} align="stretch">
                                    {rows.map((r, idx) => (
                                        <Box key={r.user_id}>{renderStudentRow(r, idx)}</Box>
                                    ))}

                                    {rows.length === 0 && (
                                        <Box px={4} py={6}>
                                            <Text color="gray.600" fontSize="sm">
                                                No results.
                                            </Text>
                                        </Box>
                                    )}
                                </VStack>
                            </Box>
                        )}
                    </VStack>
                </Box>
            </Flex>

            {/* Create Teacher Modal */}
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
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleCreateTeacher();
                                }
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

export default function PercentageLeaderboard() {
    return (
        <AuthGuard>
            <PercentageLeaderboardContent />
        </AuthGuard>
    );
}
