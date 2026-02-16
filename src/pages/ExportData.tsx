import React, { useState, useEffect, useMemo, useContext } from 'react';
import {
    Box,
    Heading,
    Text,
    FormControl,
    FormLabel,
    Input,
    HStack,
    VStack,
    Checkbox,
    Accordion,
    AccordionItem,
    AccordionButton,
    AccordionPanel,
    AccordionIcon,
    Button,
    useToast,
    Spinner,
    Flex,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    TableContainer,
} from '@chakra-ui/react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../utils/UserContext';
import AuthGuard from '../components/AuthGuard';
import * as XLSX from 'xlsx';
import { BASE_URL } from '../constants/ApiConfig';

const NOT_ASSIGNED = 'Not Assigned';

const DATA_TYPES = [
    { id: 'new_pages', label: 'New Pages' },
    { id: 'qadeem_pages', label: 'Qadeem Pages' },
    { id: 'tikrar_pages', label: 'Tikrar Pages' },
    { id: 'qadeem_stars', label: 'Qadeem Stars (days completed qadeem)' },
    { id: 'hasanat', label: 'Hasanat' },
    { id: 'cheques_abrar', label: 'Cheques (# of sullams to 55)' },
    { id: 'alltime_hifz', label: 'Alltime Hifz (total pages excluding preset surahs)', isAdvanced: true },
    { id: 'weekly_goal', label: 'Weekly Goal (claimgoal/550 pages)', isAdvanced: true },
    { id: 'surah_verse_startday', label: 'Surah+Verse on StartDay', category: 'nov23_parent', isAdvanced: true },
    { id: 'surah_verse_today', label: 'Surah+Verse Today', category: 'nov23_parent', isAdvanced: true },
    { id: 'pages_read_through_new', label: 'Pages Read Through New', category: 'nov23_parent', isAdvanced: true },
    { id: 'total_full_cheque_pages', label: 'Total full cheque pages', category: 'nov23_parent', isAdvanced: true },
];

interface UserObj {
    _id: { $oid: string };
    full_name: string;
    organizations?: {
        [org: string]: { groups: string[]; role: string };
    };
}

// helper to format a Date into yyyy-MM-ddThh:mm (local)
function toLocalDateTimeString(date: Date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - tzOffset);
    return local.toISOString().slice(0, 16);
}

// normalize any kind of Mongo ID (string | {$oid:string} | ObjectId) → string
const idStr = (v: any): string => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && '$oid' in v) return v.$oid;
    return String(v);
};

function ExportDataContent() {
    const { user } = useContext(UserContext);
    const toast = useToast();
    const token = localStorage.getItem('sulam_token') || '';
    const navigate = useNavigate();

    // Date fields
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    
    // Users grouped by org
    const [orgUsers, setOrgUsers] = useState<Record<string, UserObj[]>>({});
    
    // Selections
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // Search
    const [search, setSearch] = useState('');
    
    // Loading state
    const [loading, setLoading] = useState(true);
    
    // Data type selection
    const [selectedDataTypes, setSelectedDataTypes] = useState<Set<string>>(new Set());
    const [showAdvancedDataTypes, setShowAdvancedDataTypes] = useState(false);
    
    // Loaded data
    const [loadedData, setLoadedData] = useState<any>(null);
    const [loadingData, setLoadingData] = useState(false);
    
    // Advanced filtering
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [schoolPeriods, setSchoolPeriods] = useState<Array<{day: string, startTime: string, endTime: string}>>([]);

    // Helper function to get default dates based on timezone
    const getDefaultDates = () => {
        const now = new Date();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        if (timezone === 'America/Toronto') {
            // Toronto: Start from Monday, end now
            const monday = new Date(now);
            const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days to go back to Monday
            monday.setDate(now.getDate() - daysToMonday);
            monday.setHours(0, 0, 0, 0); // Start of Monday
            
            return {
                start: toLocalDateTimeString(monday),
                end: toLocalDateTimeString(now)
            };
        } else {
            // Other timezones: Start from most recent Sunday, end Thursday or today
            const sunday = new Date(now);
            const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const daysToSunday = dayOfWeek === 0 ? 0 : dayOfWeek; // Days to go back to Sunday
            sunday.setDate(now.getDate() - daysToSunday);
            sunday.setHours(0, 0, 0, 0); // Start of Sunday
            
            // End date: Thursday or today if Thursday hasn't passed
            const thursday = new Date(sunday);
            thursday.setDate(sunday.getDate() + 4); // Thursday is 4 days after Sunday
            thursday.setHours(23, 59, 59, 999); // End of Thursday
            
            const endDate = now > thursday ? now : thursday;
            
            return {
                start: toLocalDateTimeString(sunday),
                end: toLocalDateTimeString(endDate)
            };
        }
    };

    // Load org users
    useEffect(() => {
        setLoading(true);
        axios
            .get<Record<string, UserObj[]>>(`${BASE_URL}/user/list_my_org_users`, {
                headers: { Authorization: token },
            })
            .then((res) => {
                setOrgUsers(typeof res.data === 'object' ? res.data : {});
                
                // Set default dates based on timezone
                const defaultDates = getDefaultDates();
                setStartTime(defaultDates.start);
                setEndTime(defaultDates.end);
            })
            .catch(() => {
                toast({ status: 'error', title: 'Failed to load users' });
                setOrgUsers({});
            })
            .finally(() => {
                setLoading(false);
            });
    }, [token, toast]);

    // Helper to sort group names (Grade 1 before Grade 2, fallback to alpha)
    const compareGroups = (a: string, b: string) => {
        const numA = a.match(/\d+/);
        const numB = b.match(/\d+/);
        if (numA && numB && numA[0] !== numB[0]) return parseInt(numA[0], 10) - parseInt(numB[0], 10);
        return a.localeCompare(b);
    };

    // Organize users into tree structure
    const tree = useMemo(() => {
        const out: Record<string, Record<string, UserObj[]>> = {};
        Object.entries(orgUsers).forEach(([org, users]) => {
            users.forEach(u => {
                const grpList = u.organizations?.[org]?.groups || [];
                if (!grpList.length) {
                    out[org] = out[org] || {};
                    out[org][NOT_ASSIGNED] = out[org][NOT_ASSIGNED] || [];
                    out[org][NOT_ASSIGNED].push(u);
                }
                grpList.forEach(grp => {
                    out[org] = out[org] || {};
                    out[org][grp] = out[org][grp] || [];
                    out[org][grp].push(u);
                });
            });
        });
        
        if (!search.trim()) return out;

        const s = search.toLowerCase();
        const filt: typeof out = {};
        Object.entries(out).forEach(([org, groups]) => {
            const orgMatch = org.toLowerCase().includes(s);
            const gp: Record<string, UserObj[]> = {};
            Object.entries(groups).forEach(([grp, users]) => {
                const grpMatch = grp.toLowerCase().includes(s);
                const ufil = users.filter((u) => u.full_name.toLowerCase().includes(s));
                if (grpMatch || ufil.length) gp[grp] = grpMatch ? users : ufil;
            });
            if (orgMatch || Object.keys(gp).length) filt[org] = gp;
        });
        return filt;
    }, [orgUsers, search]);

    // Flatten helpers
    const flattenOrg = (org: string) =>
        (orgUsers[org] || []).map((u) => idStr(u._id));

    const flattenGroup = (org: string, grp: string) => {
        const all = orgUsers[org] || [];
        if (grp === NOT_ASSIGNED) {
            return all
                .filter(u => (u.organizations?.[org]?.groups || []).length === 0)
                .map(u => idStr(u._id));
        }
        return all
            .filter(u => (u.organizations?.[org]?.groups || []).includes(grp))
            .map(u => idStr(u._id));
    };

    // Toggle functions
    const toggleUser = (id: string) => {
        const s = new Set(selectedIds);
        if (s.has(id)) s.delete(id);
        else s.add(id);
        setSelectedIds(s);
    };

    const toggleGroup = (org: string, grp: string) => {
        const ids = flattenGroup(org, grp);
        const s = new Set(selectedIds);
        const all = ids.every((i) => s.has(i));
        ids.forEach((i) => {
            if (all) s.delete(i);
            else s.add(i);
        });
        setSelectedIds(s);
    };

    const toggleOrg = (org: string) => {
        const ids = flattenOrg(org);
        const s = new Set(selectedIds);
        const all = ids.every((i) => s.has(i));
        ids.forEach((i) => {
            if (all) s.delete(i);
            else s.add(i);
        });
        setSelectedIds(s);
    };

    const toggleDataType = (dataType: string) => {
        const s = new Set(selectedDataTypes);
        if (s.has(dataType)) s.delete(dataType);
        else s.add(dataType);
        setSelectedDataTypes(s);
    };

    const handleGeneratePercentageLeaderboard = () => {
        if (selectedIds.size === 0) {
            toast({ status: 'warning', title: 'Please select at least one student' });
            return;
        }
        if (!startTime || !endTime) {
            toast({ status: 'warning', title: 'Please select start and end dates' });
            return;
        }

        navigate('/percentage-leaderboard', {
            state: {
                userIds: Array.from(selectedIds),
                startTimeIso: new Date(startTime).toISOString(),
                endTimeIso: new Date(endTime).toISOString(),
            },
        });
    };

    const addSchoolPeriod = () => {
        setSchoolPeriods([...schoolPeriods, { day: 'Monday', startTime: '09:00', endTime: '10:00' }]);
    };

    const removeSchoolPeriod = (index: number) => {
        setSchoolPeriods(schoolPeriods.filter((_, i) => i !== index));
    };

    const updateSchoolPeriod = (index: number, field: string, value: string) => {
        const updated = [...schoolPeriods];
        updated[index] = { ...updated[index], [field]: value };
        setSchoolPeriods(updated);
    };

    const handleLoadData = async () => {
        if (selectedIds.size === 0) {
            toast({ status: 'warning', title: 'Please select at least one student' });
            return;
        }
        
        if (selectedDataTypes.size === 0) {
            toast({ status: 'warning', title: 'Please select at least one data type' });
            return;
        }
        
        if (!startTime || !endTime) {
            toast({ status: 'warning', title: 'Please select start and end dates' });
            return;
        }

        setLoadingData(true);
        try {
            const response = await axios.post(`${BASE_URL}/export/data`, {
                user_ids: Array.from(selectedIds),
                data_types: Array.from(selectedDataTypes),
                start_date: new Date(startTime).toISOString(),
                end_date: new Date(endTime).toISOString(),
                school_periods: schoolPeriods,
                user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }, {
                headers: { Authorization: token }
            });
            
            const apiData = response.data.results;
            
            const processedData = {
                students: apiData.map((student: any) => ({
                    id: student.user_id,
                    name: student.name,
                    surah_jump_warnings: student.surah_jump_warnings || [],
                    ...student.data
                })),
                dateRange: { start: startTime, end: endTime },
                dataTypes: Array.from(selectedDataTypes)
            };
            
            setLoadedData(processedData);
            toast({ status: 'success', title: 'Data loaded successfully' });
        } catch (error) {
            console.error('Error loading data:', error);
            toast({ status: 'error', title: 'Failed to load data' });
        } finally {
            setLoadingData(false);
        }
    };

    const handleExportToExcel = () => {
        if (!loadedData) {
            toast({ status: 'warning', title: 'Please load data first' });
            return;
        }

        try {
            // Prepare data for Excel
            const excelData = loadedData.students.map((student: any) => {
                const row: any = {
                    'Student Name': student.name,
                };
                
                // Add each data type as a column
                loadedData.dataTypes.forEach((dataType: string) => {
                    const label = DATA_TYPES.find(dt => dt.id === dataType)?.label || dataType;
                    
                    // Check if we have split data
                    const hasSplitData = loadedData.students.some((s: any) => 
                        s[`${dataType}_school`] !== undefined || s[`${dataType}_home`] !== undefined
                    );
                    
                    if (hasSplitData && dataType !== 'qadeem_stars') {
                        // Add school and home columns
                        row[`${label} (School)`] = student[`${dataType}_school`] || 0;
                        row[`${label} (Home)`] = student[`${dataType}_home`] || 0;
                    } else {
                        // Add single column
                        row[label] = student[dataType] || 0;
                    }
                });
                
                // Add warnings column
                if (student.surah_jump_warnings && student.surah_jump_warnings.length > 0) {
                    row['⚠️ Warnings'] = '⚠️ ' + student.surah_jump_warnings.join('; ');
                } else {
                    row['⚠️ Warnings'] = '';
                }
                
                return row;
            });

            // Create workbook and worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            // Set column widths
            const colWidths = [
                { wch: 20 }, // Student Name column
                ...loadedData.dataTypes.map(() => ({ wch: 15 })), // Data type columns
                { wch: 50 } // Warnings column
            ];
            ws['!cols'] = colWidths;
            
            // Add cell styling for warnings
            const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
            const warningsColIndex = range.e.c; // Last column (warnings)
            
            // Style warning cells with yellow background
            for (let row = 1; row <= range.e.r; row++) {
                const cellAddress = XLSX.utils.encode_cell({ r: row, c: warningsColIndex });
                const cell = ws[cellAddress];
                
                if (cell && cell.v && cell.v !== '') {
                    // Add cell style for yellow background (note: basic xlsx may not support all styling)
                    if (!cell.s) cell.s = {};
                    cell.s = {
                        fill: { fgColor: { rgb: 'FFFF00' } }, // Yellow background
                        font: { bold: true }
                    };
                }
            }

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Student Data');

            // Generate filename with date range
            const startDate = new Date(loadedData.dateRange.start).toLocaleDateString().replace(/\//g, '-');
            const endDate = new Date(loadedData.dateRange.end).toLocaleDateString().replace(/\//g, '-');
            const filename = `Student_Data_${startDate}_to_${endDate}.xlsx`;

            // Save file
            XLSX.writeFile(wb, filename);
            
            toast({ status: 'success', title: 'Excel file downloaded successfully!' });
        } catch (error) {
            toast({ status: 'error', title: 'Failed to export to Excel' });
        }
    };


    if (loading) {
        return (
            <Flex align="center" justify="center" minH="100vh">
                <Spinner size="xl" />
            </Flex>
        );
    }

    return (
        <Box minH="100vh" bg="gray.50">
            <Flex align="center" justify="center" minH="100vh" p={6}>
                <Box 
                    w="full" 
                    maxW="4xl" 
                    bg="white" 
                    borderRadius="xl" 
                    boxShadow="lg" 
                    p={8}
                >
                    <VStack spacing={8} align="stretch">
                        {/* Header */}
                        <Box textAlign="center">
                            <Heading size="xl" color="blue.600" mb={2}>
                                Export Data
                            </Heading>
                            <Text color="gray.600" fontSize="lg">
                                Select a date range and students to export their data
                            </Text>
                        </Box>
                        
                        {/* Date Selection */}
                        <Box 
                            bg="blue.50" 
                            borderRadius="lg" 
                            p={6}
                            border="1px solid"
                            borderColor="blue.200"
                        >
                            <Heading size="md" mb={4} color="blue.700">
                                📅 Date Range
                            </Heading>
                            <HStack spacing={6} justify="center">
                                <FormControl maxW="300px">
                                    <FormLabel fontWeight="semibold">Start Date</FormLabel>
                                    <Input 
                                        type="datetime-local" 
                                        value={startTime} 
                                        onChange={(e) => setStartTime(e.target.value)}
                                        bg="white"
                                        borderColor="blue.300"
                                        _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px blue.500" }}
                                    />
                                </FormControl>
                                <FormControl maxW="300px">
                                    <FormLabel fontWeight="semibold">End Date</FormLabel>
                                    <Input 
                                        type="datetime-local" 
                                        value={endTime} 
                                        onChange={(e) => setEndTime(e.target.value)}
                                        bg="white"
                                        borderColor="blue.300"
                                        _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px blue.500" }}
                                    />
                                </FormControl>
                            </HStack>
                        </Box>

                        {/* Student Selection */}
                        <Box 
                            bg="green.50" 
                            borderRadius="lg" 
                            p={6}
                            border="1px solid"
                            borderColor="green.200"
                        >
                            <Heading size="md" mb={4} color="green.700">
                                👥 Select Students
                            </Heading>
                            
                            {/* Search */}
                            <FormControl mb={6} maxW="400px" mx="auto">
                                <FormLabel fontWeight="semibold">Search</FormLabel>
                                <Input 
                                    placeholder="Search by organization, group, or name..." 
                                    value={search} 
                                    onChange={(e) => setSearch(e.target.value)}
                                    bg="white"
                                    borderColor="green.300"
                                    _focus={{ borderColor: "green.500", boxShadow: "0 0 0 1px green.500" }}
                                />
                            </FormControl>

                            {/* Selection Tree */}
                            <Box maxH="400px" overflowY="auto" bg="white" borderRadius="md" p={4}>
                                <Accordion allowMultiple>
                                    {Object.entries(tree).map(([org, groups]) => (
                                        <AccordionItem key={org} border="none">
                                            <AccordionButton 
                                                _hover={{ bg: "green.100" }}
                                                borderRadius="md"
                                                mb={2}
                                            >
                                                <Checkbox 
                                                    isChecked={flattenOrg(org).every((i) => selectedIds.has(i))} 
                                                    onChange={() => toggleOrg(org)} 
                                                    mr={3}
                                                    colorScheme="green"
                                                />
                                                <Box flex="1" textAlign="left" fontWeight="semibold">
                                                    {org}
                                                </Box>
                                                <AccordionIcon />
                                            </AccordionButton>
                                            <AccordionPanel pb={4}>
                                                <Accordion allowMultiple>
                                                    {Object.entries(groups).sort(([a], [b]) => compareGroups(a, b)).map(([grp, users]) => (
                                                        <AccordionItem key={grp} border="none">
                                                            <AccordionButton 
                                                                _hover={{ bg: "green.50" }}
                                                                borderRadius="md"
                                                                ml={4}
                                                                mb={1}
                                                            >
                                                                <Checkbox
                                                                    isChecked={flattenGroup(org, grp).every((i) => selectedIds.has(i))}
                                                                    onChange={() => toggleGroup(org, grp)}
                                                                    mr={3}
                                                                    colorScheme="green"
                                                                />
                                                                <Box flex="1" textAlign="left">
                                                                    {grp}
                                                                </Box>
                                                                <AccordionIcon />
                                                            </AccordionButton>
                                                            <AccordionPanel pb={2}>
                                                                <VStack align="stretch" ml={8}>
                                                                    {users.map((u) => {
                                                                        const uid = u._id.$oid;
                                                                        return (
                                                                            <HStack key={uid} py={1}>
                                                                                <Checkbox 
                                                                                    isChecked={selectedIds.has(uid)} 
                                                                                    onChange={() => toggleUser(uid)}
                                                                                    colorScheme="green"
                                                                                />
                                                                                <Box>{u.full_name}</Box>
                                                                            </HStack>
                                                                        );
                                                                    })}
                                                                </VStack>
                                                            </AccordionPanel>
                                                        </AccordionItem>
                                                    ))}
                                                </Accordion>
                                            </AccordionPanel>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </Box>
                        </Box>

                        {/* Data Type Selection */}
                        <Box 
                            bg="purple.50" 
                            borderRadius="lg" 
                            p={6}
                            border="1px solid"
                            borderColor="purple.200"
                        >
                            <HStack justify="space-between" align="center" mb={4}>
                                <Heading size="md" color="purple.700">
                                    📋 Select Data Types
                                </Heading>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    colorScheme="purple"
                                    onClick={() => setShowAdvancedDataTypes(!showAdvancedDataTypes)}
                                >
                                    {showAdvancedDataTypes ? 'Hide' : 'Show'} Advanced
                                </Button>
                            </HStack>

                            <VStack align="stretch" spacing={3}>
                                {DATA_TYPES.filter((dt: any) => !dt.isAdvanced).map((dataType: any) => (
                                    <HStack key={dataType.id}>
                                        <Checkbox 
                                            isChecked={selectedDataTypes.has(dataType.id)} 
                                            onChange={() => toggleDataType(dataType.id)}
                                            colorScheme="purple"
                                            size="lg"
                                        />
                                        <Text fontSize="md" fontWeight="medium">
                                            {dataType.label}
                                        </Text>
                                    </HStack>
                                ))}
                            </VStack>

                            {showAdvancedDataTypes && (
                                <Box mt={6} bg="white" borderRadius="md" p={4} border="1px solid" borderColor="purple.200">
                                    <Heading size="sm" color="purple.700" mb={3}>
                                        Advanced Data Types
                                    </Heading>
                                    <VStack align="stretch" spacing={3}>
                                        {DATA_TYPES.filter((dt: any) => dt.isAdvanced).map((dataType: any) => (
                                            <HStack key={dataType.id}>
                                                <Checkbox 
                                                    isChecked={selectedDataTypes.has(dataType.id)} 
                                                    onChange={() => toggleDataType(dataType.id)}
                                                    colorScheme="purple"
                                                    size="md"
                                                />
                                                <Text fontSize="sm" fontWeight="medium">
                                                    {dataType.label}
                                                </Text>
                                            </HStack>
                                        ))}
                                    </VStack>

                                    <Box mt={5} pt={4} borderTop="1px solid" borderColor="purple.100">
                                        <Button
                                            colorScheme="teal"
                                            variant="solid"
                                            size="sm"
                                            w="full"
                                            onClick={handleGeneratePercentageLeaderboard}
                                            isDisabled={selectedIds.size === 0 || !startTime || !endTime}
                                        >
                                            Generate Percentage Leaderboard →
                                        </Button>
                                        <Text mt={2} fontSize="xs" color="gray.600">
                                            Uses New Pages in range ÷ (claimgoal/550) and sorts highest to lowest.
                                        </Text>
                                    </Box>
                                </Box>
                            )}
                        </Box>

                        {/* Advanced Section */}
                        <Box 
                            bg="orange.50" 
                            borderRadius="lg" 
                            p={6}
                            border="1px solid"
                            borderColor="orange.200"
                        >
                            <HStack justify="space-between" align="center" mb={4}>
                                <Heading size="md" color="orange.700">
                                    ⚙️ Advanced Filtering
                                </Heading>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    colorScheme="orange"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                >
                                    {showAdvanced ? 'Hide' : 'Show'} Advanced
                                </Button>
                            </HStack>
                            
                            {showAdvanced && (
                                <VStack align="stretch" spacing={6}>
                                    {/* School Periods */}
                                    <Box>
                                        <Text color="orange.600" fontSize="sm" mb={3} fontWeight="semibold">
                                            Define school periods to separate school vs home time data
                                        </Text>
                                        
                                        <VStack align="stretch" spacing={3}>
                                            {schoolPeriods.map((period, index) => (
                                                <HStack key={index} spacing={3}>
                                                    <FormControl maxW="150px">
                                                        <FormLabel fontSize="sm">Day</FormLabel>
                                                        <select 
                                                            value={period.day}
                                                            onChange={(e) => updateSchoolPeriod(index, 'day', e.target.value)}
                                                            style={{
                                                                padding: '8px',
                                                                borderRadius: '6px',
                                                                border: '1px solid #e2e8f0',
                                                                backgroundColor: 'white'
                                                            }}
                                                        >
                                                            <option value="Monday">Monday</option>
                                                            <option value="Tuesday">Tuesday</option>
                                                            <option value="Wednesday">Wednesday</option>
                                                            <option value="Thursday">Thursday</option>
                                                            <option value="Friday">Friday</option>
                                                            <option value="Saturday">Saturday</option>
                                                            <option value="Sunday">Sunday</option>
                                                        </select>
                                                    </FormControl>
                                                    
                                                    <FormControl maxW="120px">
                                                        <FormLabel fontSize="sm">Start</FormLabel>
                                                        <Input 
                                                            type="time" 
                                                            value={period.startTime}
                                                            onChange={(e) => updateSchoolPeriod(index, 'startTime', e.target.value)}
                                                            size="sm"
                                                        />
                                                    </FormControl>
                                                    
                                                    <FormControl maxW="120px">
                                                        <FormLabel fontSize="sm">End</FormLabel>
                                                        <Input 
                                                            type="time" 
                                                            value={period.endTime}
                                                            onChange={(e) => updateSchoolPeriod(index, 'endTime', e.target.value)}
                                                            size="sm"
                                                        />
                                                    </FormControl>
                                                    
                                                    <Button 
                                                        size="sm" 
                                                        colorScheme="red" 
                                                        variant="outline"
                                                        onClick={() => removeSchoolPeriod(index)}
                                                    >
                                                        Remove
                                                    </Button>
                                                </HStack>
                                            ))}
                                            
                                            <Button 
                                                size="sm" 
                                                colorScheme="orange" 
                                                variant="outline"
                                                onClick={addSchoolPeriod}
                                            >
                                                + Add School Period
                                            </Button>
                                        </VStack>
                                    </Box>

                                    {/* Nov23-Parent Quran Papers Section */}
                                    {/* (Advanced data types moved into the purple "Select Data Types" section) */}
                                </VStack>
                            )}
                        </Box>

                        {/* Load Data Button */}
                        <Box textAlign="center">
                            <Button 
                                colorScheme="purple" 
                                size="lg" 
                                onClick={handleLoadData}
                                isDisabled={selectedIds.size === 0 || selectedDataTypes.size === 0 || !startTime || !endTime}
                                isLoading={loadingData}
                                loadingText="Loading Data..."
                                px={12}
                                py={6}
                                fontSize="lg"
                                fontWeight="bold"
                                borderRadius="xl"
                                boxShadow="md"
                                _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
                                transition="all 0.2s"
                            >
                                🔄 Load Data
                            </Button>
                        </Box>


                        {/* Dotted Line Separator */}
                        {loadedData && (
                            <Box>
                                <Box 
                                    borderTop="2px dashed" 
                                    borderColor="gray.300" 
                                    my={6}
                                />
                            </Box>
                        )}

                        {/* Data Display Section */}
                        {loadedData && (
                            <Box 
                                bg="white" 
                                borderRadius="lg" 
                                p={6}
                                border="1px solid"
                                borderColor="gray.200"
                                boxShadow="sm"
                            >
                                <VStack align="stretch" spacing={4}>
                                    {/* Header Info */}
                                    <Box>
                                        <HStack justify="space-between" align="center" mb={2}>
                                            <Heading size="md" color="gray.700">
                                                📊 Data Export Preview
                                            </Heading>
                                            <Button 
                                                colorScheme="green" 
                                                size="sm" 
                                                onClick={handleExportToExcel}
                                                px={4}
                                                py={2}
                                                fontSize="sm"
                                                fontWeight="bold"
                                                borderRadius="lg"
                                                boxShadow="sm"
                                                _hover={{ transform: "translateY(-1px)", boxShadow: "md" }}
                                                transition="all 0.2s"
                                            >
                                                📈 Export to Excel
                                            </Button>
                                        </HStack>
                                        <Text color="gray.600" fontSize="sm">
                                            Date Range: {new Date(loadedData.dateRange.start).toLocaleDateString()} - {new Date(loadedData.dateRange.end).toLocaleDateString()}
                                        </Text>
                                    </Box>
                                    
                                    {/* Excel-like Table */}
                                    <TableContainer 
                                        border="1px solid" 
                                        borderColor="gray.300" 
                                        borderRadius="md"
                                        overflowX="auto"
                                        bg="white"
                                    >
                                        <Table size="sm" variant="simple">
                                            <Thead bg="gray.100">
                                                <Tr>
                                                    <Th 
                                                        border="1px solid" 
                                                        borderColor="gray.300" 
                                                        bg="blue.50" 
                                                        color="blue.700"
                                                        fontWeight="bold"
                                                        textAlign="center"
                                                        minW="200px"
                                                    >
                                                        Student Name
                                                    </Th>
                                                    {loadedData.dataTypes.map((dataType: string) => {
                                                        const dataTypeInfo = DATA_TYPES.find(dt => dt.id === dataType);
                                                        if (!dataTypeInfo) return null;
                                                        
                                                        // Check if we have split data (school/home columns)
                                                        const hasSplitData = loadedData.students.some((student: any) => 
                                                            student[`${dataType}_school`] !== undefined || student[`${dataType}_home`] !== undefined
                                                        );
                                                        
                                                        if (hasSplitData && dataType !== 'qadeem_stars') {
                                                            // Show school and home columns
                                                            return (
                                                                <React.Fragment key={dataType}>
                                                                    <Th 
                                                                        border="1px solid" 
                                                                        borderColor="gray.300" 
                                                                        bg="blue.50" 
                                                                        color="blue.700"
                                                                        fontWeight="bold"
                                                                        textAlign="center"
                                                                        minW="120px"
                                                                    >
                                                                        {dataTypeInfo.label} (School)
                                                                    </Th>
                                                                    <Th 
                                                                        border="1px solid" 
                                                                        borderColor="gray.300" 
                                                                        bg="green.50" 
                                                                        color="green.700"
                                                                        fontWeight="bold"
                                                                        textAlign="center"
                                                                        minW="120px"
                                                                    >
                                                                        {dataTypeInfo.label} (Home)
                                                                    </Th>
                                                                </React.Fragment>
                                                            );
                                                        } else {
                                                            // Show single column
                                                            return (
                                                                <Th 
                                                                    key={dataType}
                                                                    border="1px solid" 
                                                                    borderColor="gray.300" 
                                                                    bg="purple.50" 
                                                                    color="purple.700"
                                                                    fontWeight="bold"
                                                                    textAlign="center"
                                                                    minW="150px"
                                                                >
                                                                    {dataTypeInfo.label}
                                                                </Th>
                                                            );
                                                        }
                                                    })}
                                                </Tr>
                                            </Thead>
                                            <Tbody>
                                                {loadedData.students.map((student: any, index: number) => (
                                                    <Tr key={student.id}>
                                                        <Td 
                                                            border="1px solid" 
                                                            borderColor="gray.300" 
                                                            bg={index % 2 === 0 ? "white" : "gray.50"}
                                                            fontWeight="medium"
                                                            textAlign="left"
                                                        >
                                                            {student.name}
                                                        </Td>
                                                        {loadedData.dataTypes.map((dataType: string) => {
                                                            const dataTypeInfo = DATA_TYPES.find(dt => dt.id === dataType);
                                                            if (!dataTypeInfo) return null;
                                                            
                                                            // Check if we have split data (school/home columns)
                                                            const hasSplitData = loadedData.students.some((s: any) => 
                                                                s[`${dataType}_school`] !== undefined || s[`${dataType}_home`] !== undefined
                                                            );
                                                            
                                                            if (hasSplitData && dataType !== 'qadeem_stars') {
                                                                // Show school and home cells
                                                                return (
                                                                    <React.Fragment key={dataType}>
                                                                        <Td 
                                                                            border="1px solid" 
                                                                            borderColor="gray.300" 
                                                                            bg={index % 2 === 0 ? "white" : "gray.50"}
                                                                            textAlign="center"
                                                                            fontWeight="semibold"
                                                                            color="blue.600"
                                                                        >
                                                                            {student[`${dataType}_school`] || 0}
                                                                        </Td>
                                                                        <Td 
                                                                            border="1px solid" 
                                                                            borderColor="gray.300" 
                                                                            bg={index % 2 === 0 ? "white" : "gray.50"}
                                                                            textAlign="center"
                                                                            fontWeight="semibold"
                                                                            color="green.600"
                                                                        >
                                                                            {student[`${dataType}_home`] || 0}
                                                                        </Td>
                                                                    </React.Fragment>
                                                                );
                                                            } else {
                                                                // Show single cell
                                                                return (
                                                                    <Td 
                                                                        key={dataType}
                                                                        border="1px solid" 
                                                                        borderColor="gray.300" 
                                                                        bg={index % 2 === 0 ? "white" : "gray.50"}
                                                                        textAlign="center"
                                                                        fontWeight="semibold"
                                                                        color="blue.600"
                                                                    >
                                                                        {student[dataType] || 0}
                                                                    </Td>
                                                                );
                                                            }
                                                        })}
                                                    </Tr>
                                                ))}
                                            </Tbody>
                                        </Table>
                                    </TableContainer>
                                    
                                    {/* Summary */}
                                    <Box 
                                        bg="blue.50" 
                                        p={3} 
                                        borderRadius="md" 
                                        border="1px solid" 
                                        borderColor="blue.200"
                                    >
                                        <Text fontSize="sm" color="blue.700" fontWeight="medium">
                                            📈 Total: {loadedData.students.length} students | {loadedData.dataTypes.length} data types selected
                                        </Text>
                                    </Box>
                                </VStack>
                            </Box>
                        )}

                    </VStack>
                </Box>
            </Flex>
        </Box>
    );
}

export default function ExportData() {
    return (
        <AuthGuard>
            <ExportDataContent />
        </AuthGuard>
    );
}
