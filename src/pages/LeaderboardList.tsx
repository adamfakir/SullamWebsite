// src/pages/LeaderboardListPage.tsx
import React, { useEffect, useState, useContext, useCallback } from 'react';
import {
    Box,
    Button,
    Tabs,
    TabList,
    Tab,
    SimpleGrid,
    Text,
    Stack,
    useToast,
    Heading,
    IconButton,
    Tooltip,
    Badge,
    HStack,
    Tag,
    Flex,
    Spinner,
    useDisclosure,
    Collapse,
} from '@chakra-ui/react';
import { AddIcon, EditIcon, DeleteIcon, ChevronDownIcon, ChevronRightIcon } from '@chakra-ui/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../utils/UserContext';
import LeaderboardModal from '../components/LeaderboardModal';
import AuthGuard from '../components/AuthGuard';
import { BASE_URL } from '../constants/ApiConfig';

interface Leaderboard {
    target_groups: any[];
    _id: string | { $oid: string };
    name: string;
    description: string;
    student_organizations: string[];
    linkable: boolean;
    end_time: string;
    // injected locally:
    count?: number;
}

function LeaderboardListPageContent() {
    const { user, logout } = useContext(UserContext);
    const [boards, setBoards] = useState<Leaderboard[]>([]);
    const [orgs, setOrgs] = useState<string[]>([]);
    const [activeOrg, setActiveOrg] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editBoard, setEditBoard] = useState<Leaderboard | null>(null);
    const { isOpen: showCompleted, onToggle: toggleCompleted } = useDisclosure({
        defaultIsOpen: false,
    });
    const toast = useToast();
    const navigate = useNavigate();
    const token = localStorage.getItem('sulam_token') || '';

    // load leaderboards + counts
    const loadBoards = useCallback(async () => {
        setLoading(true);
        try {
            // 1) fetch visible
            const { data: visible } = await axios.get<Leaderboard[]>(
                `${BASE_URL}/leaderboard/visible`,
                { headers: { Authorization: token } }
            );
            // extract org list - only include orgs the user is a member of
            const allOrgs = new Set<string>();
            visible.forEach((lb) => {
                (lb.student_organizations || []).forEach((o) => {
                    // Only add org if user is a member of it
                    if (user?.organizations?.[o]) {
                        allOrgs.add(o);
                    }
                });
            });
            setOrgs(Array.from(allOrgs));
            const orgArray = Array.from(allOrgs);
            if (!activeOrg && orgArray.length > 0) {
                setActiveOrg(orgArray[0]);
            }
            if (allOrgs.size === 1) setActiveOrg(Array.from(allOrgs)[0]);

            // 2) fetch counts in parallel
            const withCounts = await Promise.all(
                visible.map(async (lb) => {
                    const id = typeof lb._id === 'string' ? lb._id : lb._id.$oid;
                    try {
                        //const res = await axios.get<any[]>(
                        //    `${API_BASE}/leaderboard/${id}`,
                       //     { headers: { Authorization: token } }
                        //);
                       // return { ...lb, count: res.data.length };
                        return { ...lb, count: 0 };
                    } catch {
                        return { ...lb, count: 0 };
                    }
                })
            );

            setBoards(withCounts);
        } catch {
            toast({ status: 'error', title: 'Failed to load leaderboards' });
        } finally {
            setLoading(false);
        }
    }, [token, toast]);

    useEffect(() => {
        loadBoards();
    }, [loadBoards]);

    const getRole = (org: string) => user?.organizations?.[org]?.role || 'member';
    const canEdit = (org: string) =>
        ['teacher', 'rabtteacher', 'admin','helper'].includes(getRole(org));
    
    // Check if user has any teacher role across all organizations
    const hasAnyTeacherRole = () => {
        if (!user?.organizations) return false;
        return Object.values(user.organizations).some((org: any) => 
            ['teacher', 'rabtteacher', 'admin','helper'].includes(org.role)
        );
    };

    const handleDelete = async (id: string) => {
        try {
            await axios.delete(`${BASE_URL}/leaderboard/${id}/delete`, {
                headers: { Authorization: token },
            });
            setBoards((prev) =>
                prev.filter((lb) => (typeof lb._id === 'string' ? lb._id : lb._id.$oid) !== id)
            );
        } catch {
            toast({ status: 'error', title: 'Delete failed' });
        }
    };

    if (loading) {
        return (
            <Flex align="center" justify="center" minH="100vh">
                <Spinner size="xl" />
            </Flex>
        );
    }

    // split current vs archived
    // compare real Dates instead of strings
    // helper to turn whatever shape `end_time` is into a real JS Date
    function parseDate(input: any): Date {
        if (!input) return new Date(NaN);
        if (input instanceof Date) return input;
        if (typeof input === 'string' || typeof input === 'number') {
            return new Date(input);
        }
        // handle Mongo/MongoEngine Extended JSON
        if (typeof input === 'object') {
            // v2 JSON: { $date: "2025-04-19T04:33:00.000Z" }
            if (typeof input.$date === 'string' || typeof input.$date === 'number') {
                return new Date(input.$date);
            }
            // legacy: { $date: { $numberLong: "1721424000000" } }
            if (input.$date?.$numberLong) {
                return new Date(parseInt(input.$date.$numberLong, 10));
            }
        }
        return new Date(NaN);
    }
    const now = new Date();

    const filtered = boards.filter((lb) =>
        activeOrg ? lb.student_organizations.includes(activeOrg) : true
    );

    const current = filtered.filter((lb) => {
        const end = parseDate(lb.end_time);
        return !isNaN(end.valueOf()) && end > now;
    });

    const archived = filtered.filter((lb) => {
        const end = parseDate(lb.end_time);
        return !isNaN(end.valueOf()) && end <= now;
    });

    return (
        <Box p={6}>
            <Stack direction="row" justify="space-between" align="center" mb={4}>
                <Heading size="lg">Leaderboards</Heading>
                <Stack direction="row" spacing={3}>
                    <Button
                        colorScheme="blue"
                        variant="outline"
                        onClick={() => navigate('/export-data')}
                    >
                        Export Data
                    </Button>
                    {hasAnyTeacherRole() && (
                        <Button
                            leftIcon={<AddIcon />}
                            colorScheme="accent"
                            onClick={() => setShowCreate(true)}
                        >
                            Create New
                        </Button>
                    )}
                    <Button
                        colorScheme="red"
                        variant="outline"
                        onClick={() => {
                            logout();
                            navigate('/');
                        }}
                    >
                        Logout
                    </Button>
                </Stack>
            </Stack>

            {orgs.length > 1 && (
                <Tabs
                    onChange={(idx) => setActiveOrg(orgs[idx])}
                    colorScheme="accent"
                    mb={4}
                >
                    <TabList>
                        {orgs.map((o) => (
                            <Tab key={o}>{o}</Tab>
                        ))}
                    </TabList>
                </Tabs>
            )}

            <Heading size="md" mb={2}>
                Current
            </Heading>
            <SimpleGrid columns={[1, 2]} spacing={6} mb={8}>
                {current.map(renderCard)}
            </SimpleGrid>

            {/* Completed header is now clickable */}
            <HStack
                mb={2}
                cursor="pointer"
                onClick={toggleCompleted}
                align="center"
            >
                {showCompleted ? (
                    <ChevronDownIcon />
                ) : (
                    <ChevronRightIcon />
                )}
                <Heading size="md">Completed</Heading>
            </HStack>

            {/* instead of Collapse, just mount conditionally */}
            {showCompleted && (
                <SimpleGrid columns={[1, 2]} spacing={6}>
                    {archived.map(renderCard)}
                </SimpleGrid>
            )}

            {/* Create */}
            {showCreate && (
                <LeaderboardModal
                    isOpen
                    mode="create"
                    onClose={() => setShowCreate(false)}
                    onSuccess={() => {
                        setShowCreate(false);
                        loadBoards();
                    }}
                />
            )}

            {/* Edit */}
            {editBoard && (
                <LeaderboardModal
                    isOpen
                    mode="edit"
                    existing={editBoard}
                    onClose={() => setEditBoard(null)}
                    onSuccess={() => {
                        setEditBoard(null);
                        loadBoards();
                    }}
                />
            )}
        </Box>
    );

    function renderCard(lb: Leaderboard) {
        const id = typeof lb._id === 'string' ? lb._id : lb._id.$oid;
        return (
            <Box
                key={id}
                p={4}
                borderWidth="1px"
                borderRadius="lg"
                boxShadow="sm"
                _hover={{ boxShadow: 'md', cursor: 'pointer' }}
                onClick={() => navigate(`/leaderboard/${id}`)}
            >
                <Stack direction="row" justify="space-between" align="center">
                    <Text fontSize="xl" fontWeight="bold">
                        {lb.name}
                    </Text>
                    {canEdit(activeOrg) && (
                        <HStack spacing={2}>
                            <Tooltip label="Edit">
                                <IconButton
                                    icon={<EditIcon />}
                                    size="sm"
                                    aria-label="Edit"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditBoard(lb);
                                    }}
                                />
                            </Tooltip>
                            <Tooltip label="Delete">
                                <IconButton
                                    icon={<DeleteIcon />}
                                    size="sm"
                                    aria-label="Delete"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(id);
                                    }}
                                />
                            </Tooltip>
                        </HStack>
                    )}
                </Stack>

                <Text fontSize="sm" color="gray.600" mt={1}>
                    {lb.description || 'No description'}
                </Text>

                <HStack mt={2} spacing={2} wrap="wrap">
                    {/*<Tag colorScheme="accent">{lb.count ?? 0} participants</Tag>*/}
                    {lb.linkable && <Badge colorScheme="green">Linkable</Badge>}

                    {/* ← new: show target_groups */}
                    {(lb.target_groups || []).map((g) => (
                        <Badge key={g} colorScheme="purple">
                            {g}
                        </Badge>
                    ))}
                </HStack>

                <Badge mt={2} colorScheme="blue">
                    {lb.student_organizations.join(', ')}
                </Badge>
            </Box>
        );
    }
}

export default function LeaderboardListPage() {
    return (
        <AuthGuard>
            <LeaderboardListPageContent />
        </AuthGuard>
    );
}