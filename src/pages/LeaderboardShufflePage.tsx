import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Badge,
    Box,
    Button,
    Flex,
    Heading,
    HStack,
    Spinner,
    Switch,
    Text,
    VStack,
} from '@chakra-ui/react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { BASE_URL } from '../constants/ApiConfig';

type ShuffleRow = {
    user_id: string;
    name: string;
    new_pages: number;
    goal_pages: number;
    percent: number | null;
    qadeem_today: boolean;
};

type WeekBucket = {
    start: string;
    end: string;
    rows: ShuffleRow[];
};

type ShuffleResponse = {
    show_previous_week: boolean;
    middle_school: {
        current_week: WeekBucket;
        previous_week?: WeekBucket;
    };
    high_school: {
        current_week: WeekBucket;
        previous_week?: WeekBucket;
    };
};

function fmtDate(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function SectionList({
    title,
    subtitle,
    rows,
    showQadeem,
}: {
    title: string;
    subtitle: string;
    rows: ShuffleRow[];
    showQadeem: boolean;
}) {
    const getTier = (percent: number | null) => {
        if (percent === null || Number.isNaN(percent)) return 'none';
        if (percent >= 160) return 'green4';
        if (percent >= 140) return 'green3';
        if (percent >= 120) return 'green2';
        if (percent >= 100) return 'green1';
        if (percent >= 70) return 'warm1';
        if (percent >= 40) return 'warm2';
        return 'verylow';
    };

    const getColor = (tier: string) => {
        if (tier === 'green4') return { card: 'green.300', text: 'green.900', scheme: 'green4' as const };
        if (tier === 'green3') return { card: 'green.200', text: 'green.800', scheme: 'green3' as const };
        if (tier === 'green2') return { card: 'green.100', text: 'green.700', scheme: 'green2' as const };
        if (tier === 'green1') return { card: 'green.100', text: 'green.700', scheme: 'green1' as const };
        if (tier === 'warm1') return { card: 'yellow.100', text: 'yellow.800', scheme: 'warm1' as const };
        if (tier === 'warm2') return { card: 'orange.100', text: 'orange.800', scheme: 'warm2' as const };
        if (tier === 'verylow') return { card: 'red.100', text: 'red.700', scheme: 'red' as const };
        return { card: 'gray.100', text: 'gray.600', scheme: 'gray' as const };
    };

    return (
        <Box
            borderRadius="xl"
            border="1px solid"
            borderColor="whiteAlpha.500"
            bg="whiteAlpha.900"
            overflow="hidden"
            boxShadow="2xl"
        >
            <Box px={8} py={6} bgGradient="linear(to-r, purple.700, blue.600)" color="white">
                <Heading size="xl" letterSpacing="0.5px">
                    {title}
                </Heading>
                <Text fontSize="lg" opacity={0.95} mt={1}>
                    {subtitle}
                </Text>
            </Box>
            <VStack spacing={3} align="stretch" p={4}>
                {rows.map((row, idx) => (
                    <Box
                        key={row.user_id}
                        px={5}
                        py={4}
                        borderRadius="xl"
                        bg={getColor(getTier(row.percent)).card}
                        border="4px solid"
                        borderColor={showQadeem && row.qadeem_today ? '#FFD700' : 'whiteAlpha.700'}
                        boxShadow={
                            showQadeem && row.qadeem_today
                                ? '0 0 0 2px rgba(255, 223, 0, 0.85), 0 0 0 6px rgba(255, 215, 0, 0.25), 0 0 26px rgba(255, 215, 0, 0.65)'
                                : undefined
                        }
                    >
                        <Flex align="center" justify="space-between" mb={2}>
                            <HStack spacing={4} minW={0}>
                                <Badge
                                    borderRadius="full"
                                    px={3}
                                    py={1}
                                    fontSize="lg"
                                    bg={idx === 0 ? '#FFD700' : idx === 1 ? '#4299E1' : idx === 2 ? '#CD7F32' : 'gray.300'}
                                    color={idx === 0 ? 'black' : 'white'}
                                    boxShadow={idx <= 2 ? '0 0 10px rgba(0,0,0,0.25)' : 'none'}
                                >
                                    #{idx + 1}
                                </Badge>
                                <Text
                                    fontWeight="black"
                                    color={showQadeem && row.qadeem_today ? 'yellow.500' : 'gray.800'}
                                    fontSize="3xl"
                                    noOfLines={1}
                                    textShadow={showQadeem && row.qadeem_today ? '0 0 10px rgba(255, 215, 0, 0.65)' : undefined}
                                >
                                    {row.name}
                                </Text>
                                {showQadeem && row.qadeem_today && (
                                    <Badge
                                        colorScheme="yellow"
                                        borderRadius="full"
                                        px={3}
                                        py={1}
                                        fontSize="md"
                                        boxShadow="0 0 12px rgba(255, 215, 0, 0.6)"
                                    >
                                        ✭ QADEEM
                                    </Badge>
                                )}
                            </HStack>
                            <Text
                                fontWeight="black"
                                color={typeof row.percent === 'number' ? getColor(getTier(row.percent)).text : 'gray.500'}
                                fontSize="4xl"
                                lineHeight="1"
                            >
                                {typeof row.percent === 'number' ? `${Math.round(row.percent)}%` : 'No goal'}
                            </Text>
                        </Flex>
                        <Box>
                            <Box
                                h="42px"
                                borderRadius="full"
                                overflow="hidden"
                                bg="whiteAlpha.600"
                                border="1px solid"
                                borderColor="whiteAlpha.700"
                                position="relative"
                            >
                                <Box
                                    h="100%"
                                    w={`${Math.max(0, Math.min(100, row.percent ?? 0))}%`}
                                    bg={
                                        getColor(getTier(row.percent)).scheme === 'green4'
                                            ? 'green.700'
                                            : getColor(getTier(row.percent)).scheme === 'green3'
                                            ? 'green.600'
                                            : getColor(getTier(row.percent)).scheme === 'green2'
                                            ? 'green.500'
                                            : getColor(getTier(row.percent)).scheme === 'green1'
                                            ? 'green.400'
                                            : getColor(getTier(row.percent)).scheme === 'warm1'
                                            ? 'yellow.400'
                                            : getColor(getTier(row.percent)).scheme === 'warm2'
                                            ? 'orange.400'
                                            : getColor(getTier(row.percent)).scheme === 'red'
                                            ? 'red.400'
                                            : 'gray.400'
                                    }
                                />
                                <Text
                                    position="absolute"
                                    inset={0}
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    fontSize="xl"
                                    fontWeight="black"
                                    color="blackAlpha.700"
                                    letterSpacing="0.3px"
                                    pointerEvents="none"
                                >
                                    {row.new_pages.toFixed(1)} / {row.goal_pages.toFixed(1)} pages
                                </Text>
                                <Text
                                    position="absolute"
                                    inset={0}
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    fontSize="xl"
                                    fontWeight="black"
                                    color="whiteAlpha.950"
                                    letterSpacing="0.3px"
                                    textShadow="0 1px 2px rgba(0,0,0,0.35)"
                                    whiteSpace="nowrap"
                                    pointerEvents="none"
                                    clipPath={`inset(0 ${100 - Math.max(0, Math.min(100, row.percent ?? 0))}% 0 0)`}
                                >
                                    {row.new_pages.toFixed(1)} / {row.goal_pages.toFixed(1)} pages
                                </Text>
                            </Box>
                        </Box>
                    </Box>
                ))}
                {rows.length === 0 && (
                    <Box px={4} py={6}>
                        <Text color="gray.500">No users found in this section.</Text>
                    </Box>
                )}
            </VStack>
        </Box>
    );
}

export default function LeaderboardShufflePage() {
    const [searchParams] = useSearchParams();
    const hs = searchParams.get('hs') || '';
    const ms = searchParams.get('ms') || '';

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ShuffleResponse | null>(null);
    const [error, setError] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const [doubleSpeed, setDoubleSpeed] = useState(false);
    const [pretendMonday, setPretendMonday] = useState(false);
    const [activePane, setActivePane] = useState<'middle' | 'high'>('middle');
    const [activeWeekView, setActiveWeekView] = useState<'current' | 'previous'>('current');
    const [showTestMenu, setShowTestMenu] = useState(false);
    const [paneRenderKey, setPaneRenderKey] = useState(0);
    const [baseSpeed, setBaseSpeed] = useState(3);
    const [isPaneFading, setIsPaneFading] = useState(false);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const isFetchingRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    const switchAtRef = useRef<number>(0);
    const scrollStartAtRef = useRef<number>(0);

    const speed = doubleSpeed ? baseSpeed * 2 : baseSpeed;

    const fetchShuffleData = async (opts?: { showSpinner?: boolean; force?: boolean }) => {
        const showSpinner = opts?.showSpinner ?? false;
        const force = opts?.force ?? false;
        if (!hs || !ms) {
            setError('Missing hs/ms query params.');
            setLoading(false);
            return;
        }

        if (showSpinner) setLoading(true);
        if (isFetchingRef.current && !force) {
            if (showSpinner) setLoading(false);
            return;
        }

        isFetchingRef.current = true;
        try {
            const res = await axios.get<ShuffleResponse>(`${BASE_URL}/leaderboard/shuffle_percentage`, {
                params: { hs, ms, pretend_monday: pretendMonday },
                timeout: 15000,
            });
            setData(res.data);
            setError('');
        } catch (e) {
            if (!data) {
                setError('Failed to load shuffle leaderboard data.');
            }
        } finally {
            isFetchingRef.current = false;
            if (showSpinner) setLoading(false);
        }
    };

    useEffect(() => {
        void fetchShuffleData({ showSpinner: true, force: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hs, ms, pretendMonday]);

    const refreshInBackground = async () => {
        if (!hs || !ms) return;
        await fetchShuffleData();
    };

    useEffect(() => {
        const handleHotkey = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.repeat) return;
            const code = e.code;
            if (code === 'KeyT') {
                e.preventDefault();
                setShowTestMenu((v) => !v);
                return;
            }
            if (code === 'KeyF') {
                e.preventDefault();
                setBaseSpeed((prev) => Math.min(14, prev + 1));
                return;
            }
            if (code === 'KeyS') {
                e.preventDefault();
                setBaseSpeed((prev) => Math.max(1, prev - 1));
            }
        };
        window.addEventListener('keydown', handleHotkey, true);
        return () => {
            window.removeEventListener('keydown', handleHotkey, true);
        };
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        setIsPaneFading(true);
        el.scrollTop = 0;
        // Force a paint cycle so newly switched content reliably renders.
        requestAnimationFrame(() => {
            if (!scrollRef.current) return;
            scrollRef.current.scrollTop = 1;
            scrollRef.current.scrollTop = 0;
        });
        window.setTimeout(() => setIsPaneFading(false), 220);
        setPaneRenderKey((k) => k + 1);
        // Give viewers a brief pause before scrolling starts again.
        switchAtRef.current = Date.now() + 1000;
        scrollStartAtRef.current = switchAtRef.current;
    }, [activePane, activeWeekView]);

    useEffect(() => {
        if (!autoScroll) {
            if (rafRef.current) {
                window.clearInterval(rafRef.current);
            }
            rafRef.current = null;
            return;
        }

        const tick = () => {
            const el = scrollRef.current;
            if (!el) return;
            const now = Date.now();
            const maxScroll = el.scrollHeight - el.clientHeight;
            const showPreviousWeek = !!data?.show_previous_week;

            const advanceView = () => {
                if (showPreviousWeek && activeWeekView === 'current') {
                    setActiveWeekView('previous');
                    return;
                }
                setActiveWeekView('current');
                setActivePane((prev) => (prev === 'middle' ? 'high' : 'middle'));
            };

            if (maxScroll <= 2) {
                if (now >= switchAtRef.current) {
                    advanceView();
                    void refreshInBackground();
                    switchAtRef.current = now + 1800;
                    scrollStartAtRef.current = switchAtRef.current;
                }
                return;
            }

            if (now < switchAtRef.current) {
                return;
            }

            if (el.scrollTop >= maxScroll - 1) {
                if (now >= switchAtRef.current) {
                    el.scrollTop = 0;
                    advanceView();
                    void refreshInBackground();
                    switchAtRef.current = now + 1200;
                    scrollStartAtRef.current = switchAtRef.current;
                }
                return;
            }

            // Ease in after pause so scrolling starts smooth, not abrupt.
            const easeDurationMs = 900;
            const elapsed = Math.max(0, now - scrollStartAtRef.current);
            const t = Math.min(1, elapsed / easeDurationMs);
            const easedFactor = t * t * (3 - 2 * t); // smoothstep
            const easedStep = Math.max(1, Math.round(speed * (0.25 + 0.75 * easedFactor)));
            const prevTop = el.scrollTop;
            el.scrollTop = Math.min(maxScroll, prevTop + easedStep);
            // Some TV browsers occasionally ignore small programmatic deltas.
            if (el.scrollTop === prevTop && prevTop < maxScroll) {
                el.scrollTop = Math.min(maxScroll, prevTop + 1);
            }
        };

        rafRef.current = window.setInterval(tick, 16) as unknown as number;
        return () => {
            if (rafRef.current) {
                window.clearInterval(rafRef.current);
            }
            rafRef.current = null;
        };
    }, [autoScroll, speed, hs, ms, pretendMonday, data?.show_previous_week, activeWeekView]);

    const activeSection = useMemo(() => {
        if (!data) return null;
        const school = activePane === 'middle' ? data.middle_school : data.high_school;
        const isPrev = activeWeekView === 'previous' && data.show_previous_week;
        const bucket = isPrev ? school.previous_week : school.current_week;
        if (!bucket) return null;

        const titleBase = activePane === 'middle' ? 'Middle School Quran Progress' : 'High School Quran Progress';
        const subtitle = isPrev
            ? `${fmtDate(bucket.start)} - ${fmtDate(bucket.end)}`
            : `This Week (${fmtDate(bucket.start)} - ${fmtDate(bucket.end)})`;

        return (
            <SectionList
                key={`${activePane}-${activeWeekView}`}
                title={isPrev ? `${titleBase} - LAST WEEK` : titleBase}
                subtitle={subtitle}
                rows={bucket.rows}
                showQadeem={!isPrev}
            />
        );
    }, [data, activePane, activeWeekView]);

    const isLastWeekTitle = activeWeekView === 'previous' && !!data?.show_previous_week;
    const schoolTitle = activePane === 'middle' ? 'Middle School Quran Progress' : 'High School Quran Progress';
    const activeTitle = isLastWeekTitle ? `${schoolTitle} - LAST WEEK` : `${schoolTitle} - This Week`;

    return (
        <Box h="100vh" overflow="hidden" bgGradient="linear(to-br, purple.800, blue.800)" position="relative">
            <Box
                position="absolute"
                top="14px"
                left="50%"
                transform="translateX(-50%)"
                zIndex={20}
                bg="blackAlpha.500"
                border="1px solid"
                borderColor="whiteAlpha.500"
                borderRadius="2xl"
                px={8}
                py={4}
                backdropFilter="blur(8px)"
                textAlign="center"
                minW="70%"
            >
                <Heading size="2xl" color="white" letterSpacing="0.7px">
                    {activeTitle}
                </Heading>
                {isLastWeekTitle && (
                    <Text mt={1} fontSize="xl" fontWeight="black" color="yellow.300" letterSpacing="0.8px">
                        LAST WEEK
                    </Text>
                )}
            </Box>

            {showTestMenu && (
                <Box
                    position="absolute"
                    top="120px"
                    right="16px"
                    zIndex={30}
                    bg="blackAlpha.700"
                    border="1px solid"
                    borderColor="whiteAlpha.600"
                    borderRadius="xl"
                    p={4}
                >
                    <VStack align="stretch" spacing={3}>
                        <Text color="white" fontWeight="bold">
                            Test Controls (press T to hide)
                        </Text>
                        <Text color="whiteAlpha.900" fontSize="sm">
                            F = faster, S = slower (base speed: {baseSpeed})
                        </Text>
                        <HStack spacing={2}>
                            <Text color="white" fontSize="sm">Stop auto scrolling</Text>
                            <Switch isChecked={!autoScroll} onChange={(e) => setAutoScroll(!e.target.checked)} />
                        </HStack>
                        <HStack spacing={2}>
                            <Text color="white" fontSize="sm">2x auto scroll</Text>
                            <Switch isChecked={doubleSpeed} onChange={(e) => setDoubleSpeed(e.target.checked)} />
                        </HStack>
                        <HStack spacing={2}>
                            <Text color="white" fontSize="sm">Pretend it is Monday</Text>
                            <Switch isChecked={pretendMonday} onChange={(e) => setPretendMonday(e.target.checked)} />
                        </HStack>
                        <Button size="sm" onClick={() => setActivePane((p) => (p === 'middle' ? 'high' : 'middle'))}>
                            Switch Pane
                        </Button>
                    </VStack>
                </Box>
            )}

            {loading ? (
                <Flex py={16} justify="center">
                    <Spinner size="xl" />
                </Flex>
            ) : error ? (
                <Box bg="white" borderRadius="xl" p={6} boxShadow="md">
                    <Text color="red.500" fontWeight="bold">
                        {error}
                    </Text>
                </Box>
            ) : (
                <Box
                    ref={scrollRef}
                    h="100vh"
                    overflowY="scroll"
                    px={4}
                    pt="130px"
                    pb={5}
                >
                    <VStack
                        key={paneRenderKey}
                        spacing={4}
                        align="stretch"
                        opacity={isPaneFading ? 0 : 1}
                        transform={isPaneFading ? 'translateY(8px)' : 'translateY(0)'}
                        transition="opacity 220ms ease, transform 220ms ease"
                    >
                        {activeSection}
                    </VStack>
                </Box>
            )}
        </Box>
    );
}
