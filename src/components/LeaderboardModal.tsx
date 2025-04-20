// src/components/LeaderboardModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalCloseButton,
    ModalBody,
    ModalFooter,
    Button,
    FormControl,
    FormLabel,
    Input,
    Textarea,
    Switch,
    VStack,
    HStack,
    Box,
    Checkbox,
    Accordion,
    AccordionItem,
    AccordionButton,
    AccordionPanel,
    AccordionIcon,
    useToast,
} from '@chakra-ui/react';
import axios from 'axios';

interface UserObj {
    _id: { $oid: string };
    full_name: string;
    organizations?: {
        [org: string]: { groups: string[]; role: string };
    };
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    mode: 'create' | 'edit';
    existing?: any;
    onSuccess: () => void;
}

const API_BASE = 'https://sulamserverbackend-cd7ib.ondigitalocean.app';
const NOT_ASSIGNED = 'Not Assigned';

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

export default function LeaderboardModal({
                                             isOpen,
                                             onClose,
                                             mode,
                                             existing,
                                             onSuccess,
                                         }: Props) {
    const toast = useToast();
    const token = localStorage.getItem('sulam_token') || '';

    // basic fields
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    // users grouped by org
    const [orgUsers, setOrgUsers] = useState<Record<string, UserObj[]>>({});
    // selections
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [presence, setPresence] = useState<Record<string, boolean>>({});
    // advanced
    const [viewableIds, setViewableIds] = useState<Set<string>>(new Set());
    const [linkable, setLinkable] = useState(false);
    // search
    const [search, setSearch] = useState('');

    // load org‑users + init
    useEffect(() => {
        if (!isOpen) return;

        // fetch all org users
        axios
            .get<Record<string, UserObj[]>>(`${API_BASE}/user/list_my_org_users`, {
                headers: { Authorization: token },
            })
            .then((res) => {
                setOrgUsers(typeof res.data === 'object' ? res.data : {});
            })
            .catch(() => {
                toast({ status: 'error', title: 'Failed to load users' });
                setOrgUsers({});
            });

        const now = new Date();
        const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

        if (mode === 'create') {
            setName(now.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }));
            setDescription('');
            setStartTime(toLocalDateTimeString(now));
            setEndTime(toLocalDateTimeString(inOneHour));
            setSelectedIds(new Set());
            setPresence({});
            setViewableIds(new Set());
            setLinkable(false);
        } else if (mode === 'edit' && existing) {
            // 1️⃣ Basic text fields
            setName(existing.name || '');
            setDescription(existing.description || '');

            // 2️⃣ Times (handle both ISO & BSON date wrapper)
            const rawStart = existing.start_time?.$date ?? existing.start_time;
            const rawEnd = existing.end_time?.$date ?? existing.end_time;
            const parsedStart = rawStart ? new Date(rawStart) : null;
            const parsedEnd = rawEnd ? new Date(rawEnd) : null;
            setStartTime(
                parsedStart instanceof Date && !isNaN(parsedStart.getTime())
                    ? toLocalDateTimeString(parsedStart)
                    : ''
            );
            setEndTime(
                parsedEnd instanceof Date && !isNaN(parsedEnd.getTime())
                    ? toLocalDateTimeString(parsedEnd)
                    : ''
            );

            // 3️⃣ Presence map (normalize keys)
            const p: Record<string, boolean> = {};
            if (existing.user_presence && typeof existing.user_presence === 'object') {
                Object.entries(existing.user_presence).forEach(([k, v]: [any, any]) => {
                    p[idStr(k)] = !!v;
                });
            }
            setPresence(p);

            // 4️⃣ Viewable IDs
            const v = new Set<string>();
            Array.isArray(existing.viewable_user_ids) &&
            existing.viewable_user_ids.forEach((uid: any) => v.add(idStr(uid)));
            setViewableIds(v);

            setLinkable(!!existing.linkable);

            // 5️⃣ Selected IDs – use stored list if present, otherwise derive
            const sel = new Set<string>();
            if (Array.isArray(existing.target_user_ids) && existing.target_user_ids.length) {
                existing.target_user_ids.forEach((i: any) => sel.add(idStr(i)));
            } else {
                // fallback → combine explicit target_user_ids + presence keys
                Array.isArray(existing.target_user_ids) &&
                existing.target_user_ids.forEach((i: any) => sel.add(idStr(i)));
                Object.keys(p).forEach((k) => sel.add(k));
            }
            setSelectedIds(sel);
        }
    }, [isOpen, mode, existing, token, toast]);

    // ---------------------------------------------
    // Helpers to organise the org → group → users tree
    // ---------------------------------------------
    const tree = useMemo(() => {
        const out: Record<string, Record<string, UserObj[]>> = {};
        Object.entries(orgUsers).forEach(([org, users]) => {
            // REPLACE your current inner loop that distributes users into groups
            users.forEach(u => {
                const grpList = u.organizations?.[org]?.groups || [];
                if (!grpList.length) {           // ⬅️ NEW  (no groups → Not Assigned)
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

    // flatten helpers
    const flattenOrg = (org: string) =>
        Object.values(tree[org] || {})
            .flat()
            .map((u) => u._id.$oid);
    const flattenGroup = (org: string, grp: string) => (tree[org]?.[grp] || []).map((u) => u._id.$oid);

    // ---------------------------------------------
    //  T O G G L E S
    // ---------------------------------------------
    const toggleUser = (id: string) => {
        const s = new Set(selectedIds);
        if (s.has(id)) s.delete(id);
        else {
            s.add(id);
            presence[id] = true;
        }
        setSelectedIds(s);
        setPresence({ ...presence });
    };
    const toggleGroup = (org: string, grp: string) => {
        const ids = flattenGroup(org, grp);
        const s = new Set(selectedIds);
        const all = ids.every((i) => s.has(i));
        ids.forEach((i) => {
            if (all) s.delete(i);
            else {
                s.add(i);
                presence[i] = true;
            }
        });
        setSelectedIds(s);
        setPresence({ ...presence });
    };
    const toggleOrg = (org: string) => {
        const ids = flattenOrg(org);
        const s = new Set(selectedIds);
        const all = ids.every((i) => s.has(i));
        ids.forEach((i) => {
            if (all) s.delete(i);
            else {
                s.add(i);
                presence[i] = true;
            }
        });
        setSelectedIds(s);
        setPresence({ ...presence });
    };
    const setAllPresence = (val: boolean) => {
        const p = { ...presence };
        Array.from(selectedIds).forEach((i) => (p[i] = val));
        setPresence(p);
    };
    const toggleViewable = (id: string) => {
        const v = new Set(viewableIds);
        if (v.has(id)) v.delete(id);
        else v.add(id);
        setViewableIds(v);
    };

    // ---------------------------------------------
    //  S U B M I T
    // ---------------------------------------------
    const handleSubmit = async () => {
        const body = {
            name,
            description,
            start_time: new Date(startTime).toISOString(),
            end_time: new Date(endTime).toISOString(),
            target_organizations: Object.keys(tree).filter((org) => flattenOrg(org).every((i) => selectedIds.has(i))),
            target_groups: Object.entries(tree)
                .flatMap(([org, groups]) =>
                    Object.entries(groups)
                        .filter(([grp]) =>
                            grp !== NOT_ASSIGNED &&         // ⬅️ NEW
                            !flattenOrg(org).every(i => selectedIds.has(i)) &&
                            flattenGroup(org, grp).every(i => selectedIds.has(i))
                        )
                        .map(([grp]) => `${org}:${grp}`)
                ),er_ids: Array.from(selectedIds),
            viewable_user_ids: Array.from(viewableIds),
            linkable,
            user_presence: presence,
            target_user_ids: Array.from(selectedIds),
        };

        try {
            if (mode === 'create') {
                await axios.post(`${API_BASE}/leaderboard/create`, body, {
                    headers: { Authorization: token },
                });
            } else if (mode === 'edit' && existing) {
                const id = idStr(existing._id);
                await axios.put(`${API_BASE}/leaderboard/${id}/edit`, body, {
                    headers: { Authorization: token },
                });
            }
            toast({ status: 'success', title: mode === 'create' ? 'Created' : 'Updated' });
            onSuccess();
            onClose();
        } catch {
            toast({ status: 'error', title: 'Save failed' });
        }
    };

    // =========================================================================================
    //  UI
    // =========================================================================================
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>{mode === 'create' ? 'Create' : 'Edit'} Leaderboard</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <VStack spacing={4} align="stretch">
                        {/* name/desc */}
                        <FormControl>
                            <FormLabel>Name</FormLabel>
                            <Input value={name} onChange={(e) => setName(e.target.value)} />
                        </FormControl>
                        <FormControl>
                            <FormLabel>Description</FormLabel>
                            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                        </FormControl>

                        {/* times */}
                        <HStack>
                            <FormControl>
                                <FormLabel>Start</FormLabel>
                                <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                            </FormControl>
                            <FormControl>
                                <FormLabel>End</FormLabel>
                                <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                            </FormControl>
                        </HStack>

                        {/* search */}
                        <FormControl>
                            <FormLabel>Search</FormLabel>
                            <Input placeholder="Org / group / name..." value={search} onChange={(e) => setSearch(e.target.value)} />
                        </FormControl>

                        {/* selection */}
                        <Accordion allowMultiple>
                            {Object.entries(tree).map(([org, groups]) => (
                                <AccordionItem key={org}>
                                    <AccordionButton>
                                        <Checkbox isChecked={flattenOrg(org).every((i) => selectedIds.has(i))} onChange={() => toggleOrg(org)} mr={2} />
                                        <Box flex="1" textAlign="left">
                                            {org}
                                        </Box>
                                        <AccordionIcon />
                                    </AccordionButton>
                                    <AccordionPanel>
                                        <Accordion allowMultiple>
                                            {Object.entries(groups).map(([grp, users]) => (
                                                <AccordionItem key={grp}>
                                                    <AccordionButton>
                                                        <Checkbox
                                                            isChecked={flattenGroup(org, grp).every((i) => selectedIds.has(i))}
                                                            onChange={() => toggleGroup(org, grp)}
                                                            mr={2}
                                                        />
                                                        <Box flex="1" textAlign="left">
                                                            {grp}
                                                        </Box>
                                                        <AccordionIcon />
                                                    </AccordionButton>
                                                    <AccordionPanel>
                                                        <VStack align="stretch">
                                                            {users.map((u) => {
                                                                const uid = u._id.$oid;
                                                                return (
                                                                    <HStack key={uid}>
                                                                        <Checkbox isChecked={selectedIds.has(uid)} onChange={() => toggleUser(uid)} />
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

                        {/* presence */}
                        <Box>
                            <HStack justify="space-between">
                                <FormLabel>Presence</FormLabel>
                                <HStack>
                                    <Button size="sm" onClick={() => setAllPresence(true)}>
                                        All Present
                                    </Button>
                                    <Button size="sm" onClick={() => setAllPresence(false)}>
                                        All Absent
                                    </Button>
                                </HStack>
                            </HStack>
                            <Accordion allowMultiple>
                                {Object.entries(tree).map(([org, groups]) => {
                                    const selGroups = Object.entries(groups).filter(([grp]) => flattenGroup(org, grp).some((i) => selectedIds.has(i)));
                                    if (!selGroups.length) return null;
                                    return (
                                        <AccordionItem key={org}>
                                            <AccordionButton>
                                                <Box flex="1" textAlign="left">
                                                    {org}
                                                </Box>
                                                <AccordionIcon />
                                            </AccordionButton>
                                            <AccordionPanel>
                                                <Accordion allowMultiple>
                                                    {selGroups.map(([grp, users]) => (
                                                        <AccordionItem key={grp}>
                                                            <AccordionButton>
                                                                <Box flex="1" textAlign="left">
                                                                    {grp}
                                                                </Box>
                                                                <AccordionIcon />
                                                            </AccordionButton>
                                                            <AccordionPanel>
                                                                <VStack align="stretch">
                                                                    {users
                                                                        .filter((u) => selectedIds.has(u._id.$oid))
                                                                        .map((u) => (
                                                                            <HStack key={u._id.$oid} justify="space-between">
                                                                                <Box>{u.full_name}</Box>
                                                                                <Switch
                                                                                    isChecked={!!presence[u._id.$oid]}
                                                                                    onChange={(e) => setPresence({ ...presence, [u._id.$oid]: e.target.checked })}
                                                                                />
                                                                            </HStack>
                                                                        ))}
                                                                </VStack>
                                                            </AccordionPanel>
                                                        </AccordionItem>
                                                    ))}
                                                </Accordion>
                                            </AccordionPanel>
                                        </AccordionItem>
                                    );
                                })}
                            </Accordion>
                        </Box>

                        {/* advanced */}
                        <Accordion allowToggle>
                            <AccordionItem>
                                <AccordionButton>
                                    <Box flex="1" textAlign="left">
                                        Advanced
                                    </Box>
                                    <AccordionIcon />
                                </AccordionButton>
                                <AccordionPanel>
                                    <FormControl display="flex" alignItems="center">
                                        <FormLabel mb={0}>Anyone with link can open</FormLabel>
                                        <Switch isChecked={linkable} onChange={(e) => setLinkable(e.target.checked)} ml="auto" />
                                    </FormControl>

                                    <FormControl mt={4}>
                                        <FormLabel>Select extra viewers</FormLabel>
                                    </FormControl>
                                    <Accordion allowMultiple>
                                        {Object.entries(tree).map(([org, groups]) => (
                                            <AccordionItem key={org}>
                                                <AccordionButton>
                                                    <Box flex="1" textAlign="left">
                                                        {org}
                                                    </Box>
                                                    <AccordionIcon />
                                                </AccordionButton>
                                                <AccordionPanel>
                                                    <Accordion allowMultiple>
                                                        {Object.entries(groups).map(([grp, users]) => (
                                                            <AccordionItem key={grp}>
                                                                <AccordionButton>
                                                                    <Box flex="1" textAlign="left">
                                                                        {grp}
                                                                    </Box>
                                                                    <AccordionIcon />
                                                                </AccordionButton>
                                                                <AccordionPanel>
                                                                    <VStack align="stretch">
                                                                        {users.map((u) => {
                                                                            const uid = u._id.$oid;
                                                                            return (
                                                                                <HStack key={uid}>
                                                                                    <Checkbox isChecked={viewableIds.has(uid)} onChange={() => toggleViewable(uid)} />
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
                                </AccordionPanel>
                            </AccordionItem>
                        </Accordion>
                    </VStack>
                </ModalBody>
                <ModalFooter>
                    <Button colorScheme="accent" onClick={handleSubmit}>
                        {mode === 'create' ? 'Create' : 'Save Changes'}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
