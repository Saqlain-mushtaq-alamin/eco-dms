/**
 * VotePanel — Community eco-verification voting UI
 *
 * Design rules:
 * • Votes are completely hidden while the window is open.
 *   No one — including the post owner — can see what others voted.
 * • Only the viewer knows their own vote (local state highlight).
 * • After the window closes the aggregate result is revealed.
 * • The panel is subtle by default; the eco badge draws attention first.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { useTheme } from '../theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export type VotePath = 'auto' | 'standard' | 'extended';

export interface VoteStatus {
    post_cid: string;
    path: VotePath;
    quorum: number;
    deadline: number;   // unix timestamp
    seconds_left: number;
    window_open: boolean;
    total_votes: number;
    quorum_met: boolean;
    has_voted: boolean | null;
    ml_confidence: number;   // 0-1
    // revealed after close
    eco_votes?: number;
    not_eco_votes?: number;
    final_verdict?: boolean | null;
    settled?: boolean;
}

export interface VotePanelProps {
    postCid: string;
    /** Viewer's wallet address (undefined = not logged in) */
    viewerWallet?: string;
    /** ECO token balance of viewer (needed to qualify) */
    ecoBalance?: number;
    /** Fetch vote status from backend */
    onFetchStatus: (postCid: string) => Promise<VoteStatus | null>;
    /** Submit signed vote */
    onCastVote: (postCid: string, choice: 'eco' | 'not_eco', sig: string, balance: number) => Promise<{ success: boolean; message: string }>;
    /** Sign the vote using the connected wallet (EIP-712 or simple personal_sign) */
    onSignVote?: (postCid: string, choice: 'eco' | 'not_eco') => Promise<string>;
    style?: ViewStyle;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
    if (seconds <= 0) return 'Closed';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function pathLabel(path: VotePath): string {
    return { auto: '⚡ Fast track', standard: '🗳️ Standard', extended: '🔍 Extended review' }[path];
}

// ── Component ─────────────────────────────────────────────────────────────────

export const VotePanel: React.FC<VotePanelProps> = ({
    postCid,
    viewerWallet,
    ecoBalance = 0,
    onFetchStatus,
    onCastVote,
    onSignVote,
    style,
}) => {
    const theme = useTheme();
    const [status, setStatus] = useState<VoteStatus | null>(null);
    const [voting, setVoting] = useState(false);
    const [localVote, setLocalVote] = useState<'eco' | 'not_eco' | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const toastAnim = useRef(new Animated.Value(0)).current;
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Data fetching ─────────────────────────────────────────────────────────

    const fetchStatus = async () => {
        try {
            const s = await onFetchStatus(postCid);
            if (s) {
                setStatus(s);
                setSecondsLeft(s.seconds_left);
            } else {
                // No voting window for this post yet — stop polling to avoid 404 spam
                if (pollRef.current) {
                    clearInterval(pollRef.current);
                    pollRef.current = null;
                }
            }
        } catch { /* silent — voting panel is non-critical */ }
    };

    useEffect(() => {
        fetchStatus();
        // Poll every 30 s while window is open; cancelled early if no window found
        pollRef.current = setInterval(fetchStatus, 30_000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [postCid]);

    // ── Live countdown ────────────────────────────────────────────────────────

    useEffect(() => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        if (!status?.window_open) return;

        countdownRef.current = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current!);
                    fetchStatus(); // refresh after window closes
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
    }, [status?.window_open, status?.deadline]);

    // ── Toast helper ──────────────────────────────────────────────────────────

    const showToast = (msg: string) => {
        setToast(msg);
        Animated.sequence([
            Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.delay(2400),
            Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => setToast(null));
    };

    // ── Vote handler ──────────────────────────────────────────────────────────

    const handleVote = async (choice: 'eco' | 'not_eco') => {
        if (!viewerWallet) { showToast('Sign in to vote'); return; }
        if (status?.has_voted || localVote) { showToast('You already voted'); return; }
        if (!status?.window_open) { showToast('Voting window closed'); return; }
        if (ecoBalance < 10) { showToast('You need at least 10 ECO to vote'); return; }

        setVoting(true);
        try {
            // Sign the vote (EIP-712 or fallback)
            let sig = 'mock_sig';
            if (onSignVote) {
                try { sig = await onSignVote(postCid, choice); }
                catch { showToast('Signature cancelled'); setVoting(false); return; }
            }

            const result = await onCastVote(postCid, choice, sig, ecoBalance);
            if (result.success) {
                setLocalVote(choice);
                await fetchStatus();
                showToast(choice === 'eco' ? '🌿 Voted Eco-Friendly!' : '🚫 Voted Not Eco');
            } else {
                showToast(result.message);
            }
        } catch {
            showToast('Failed to cast vote');
        } finally {
            setVoting(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    if (!status) {
        // Voting window not open yet — show a subtle placeholder so users know
        // it will appear once the ML analysis window is ready.
        return (
            <View style={[styles.container, { borderColor: theme.colors.border, opacity: 0.7 }, style]}>
                <View style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: '#f59e0b' }]} />
                    <Text style={[styles.tinyLabel, { color: theme.colors.textSecondary, marginLeft: 6 }]}>
                        Community voting opens after analysis completes
                    </Text>
                </View>
            </View>
        );
    }

    const hasVoted = localVote !== null || status.has_voted === true;
    const windowOpen = status.window_open && secondsLeft > 0;
    const mlPct = Math.round(status.ml_confidence * 100);

    // ── Closed state: show results ────────────────────────────────────────────
    if (!windowOpen) {
        const total = (status.eco_votes ?? 0) + (status.not_eco_votes ?? 0);
        const ecoRat = total > 0 ? ((status.eco_votes ?? 0) / total) : 0;
        const isEco = status.final_verdict === true;
        const verdict = status.final_verdict === null ? null : isEco;

        return (
            <View style={[styles.container, { borderColor: theme.colors.border }, style]}>
                <View style={styles.row}>
                    {verdict !== null && (
                        <View style={[
                            styles.verdictBadge,
                            { backgroundColor: isEco ? '#d1fae5' : '#fee2e2' },
                        ]}>
                            <Text style={[styles.verdictText, { color: isEco ? '#065f46' : '#991b1b' }]}>
                                {isEco ? '🌿 Eco-Friendly' : '🚫 Not Eco'}
                            </Text>
                        </View>
                    )}
                    <Text style={[styles.closeLabel, { color: theme.colors.textSecondary }]}>
                        Voting closed
                    </Text>
                </View>

                {total > 0 && (
                    <View style={styles.resultBar}>
                        <View style={[styles.barFill, { width: `${Math.round(ecoRat * 100)}%` as any, backgroundColor: '#34d399' }]} />
                        <View style={[styles.barFill, { width: `${Math.round((1 - ecoRat) * 100)}%` as any, backgroundColor: '#f87171' }]} />
                    </View>
                )}

                <View style={styles.row}>
                    <Text style={[styles.tinyLabel, { color: '#065f46' }]}>
                        🌿 {status.eco_votes ?? 0}
                    </Text>
                    <Text style={[styles.tinyLabel, { color: theme.colors.textSecondary, marginHorizontal: 8 }]}>
                        {total} votes
                    </Text>
                    <Text style={[styles.tinyLabel, { color: '#991b1b' }]}>
                        {status.not_eco_votes ?? 0} 🚫
                    </Text>
                </View>

                <Text style={[styles.tinyLabel, { color: theme.colors.textSecondary, marginTop: 4 }]}>
                    ML score: {mlPct}%  ·  {pathLabel(status.path)}
                </Text>
            </View>
        );
    }

    // ── Open state: voting buttons ────────────────────────────────────────────
    return (
        <View style={[styles.container, { borderColor: theme.colors.border }, style]}>

            {/* Header row */}
            <View style={styles.row}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Community Vote
                </Text>
                <View style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />
                    <Text style={[styles.tinyLabel, { color: theme.colors.textSecondary }]}>
                        {formatCountdown(secondsLeft)}
                    </Text>
                </View>
            </View>

            {/* Path + vote count */}
            <Text style={[styles.tinyLabel, { color: theme.colors.textSecondary, marginBottom: 10 }]}>
                {pathLabel(status.path)}  ·  {status.total_votes} vote{status.total_votes !== 1 ? 's' : ''}
                {status.quorum_met ? '  ✓ quorum' : `  (need ${status.quorum})`}
            </Text>

            {/* Buttons */}
            {hasVoted ? (
                <View style={[styles.votedBadge, { backgroundColor: 'rgba(34,197,94,0.10)' }]}>
                    <Text style={{ color: '#16a34a', fontSize: 13, fontWeight: '600' }}>
                        ✓ Vote recorded — results hidden until window closes
                    </Text>
                </View>
            ) : (
                <View style={styles.buttonRow}>
                    <VoteButton
                        label="🌿 Eco-Friendly"
                        onPress={() => handleVote('eco')}
                        disabled={voting || !viewerWallet || ecoBalance < 10}
                        color="#16a34a"
                        bg="#d1fae5"
                        hoverBg="#bbf7d0"
                    />
                    <VoteButton
                        label="🚫 Not Eco"
                        onPress={() => handleVote('not_eco')}
                        disabled={voting || !viewerWallet || ecoBalance < 10}
                        color="#dc2626"
                        bg="#fee2e2"
                        hoverBg="#fecaca"
                    />
                </View>
            )}

            {/* Qualification hint */}
            {!viewerWallet && (
                <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
                    Sign in to vote
                </Text>
            )}
            {viewerWallet && ecoBalance < 10 && !hasVoted && (
                <Text style={[styles.hint, { color: '#b45309' }]}>
                    Minimum 10 ECO required to vote
                </Text>
            )}

            {/* Toast */}
            {toast && (
                <Animated.View style={[styles.toast, { opacity: toastAnim }]}>
                    <Text style={styles.toastText}>{toast}</Text>
                </Animated.View>
            )}
        </View>
    );
};

// ── Inner button ──────────────────────────────────────────────────────────────

interface VoteBtnProps {
    label: string;
    onPress: () => void;
    disabled: boolean;
    color: string;
    bg: string;
    hoverBg: string;
}

const VoteButton: React.FC<VoteBtnProps> = ({ label, onPress, disabled, color, bg, hoverBg }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <TouchableOpacity
            style={[
                styles.voteBtn,
                {
                    backgroundColor: hovered && !disabled ? hoverBg : bg,
                    borderColor: color,
                    opacity: disabled ? 0.45 : 1,
                    transform: [{ scale: hovered && !disabled ? 1.03 : 1 }],
                },
            ]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.85}
            {...(Platform.OS === 'web' ? {
                onMouseEnter: () => setHovered(true),
                onMouseLeave: () => setHovered(false),
            } : {})}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Text style={[styles.voteBtnText, { color }]}>{label}</Text>
        </TouchableOpacity>
    );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        marginRight: 5,
    },
    tinyLabel: {
        fontSize: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    voteBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1.5,
        alignItems: 'center',
    },
    voteBtnText: {
        fontSize: 13,
        fontWeight: '700',
    },
    votedBadge: {
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        alignItems: 'center',
        marginTop: 4,
    },
    resultBar: {
        flexDirection: 'row',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        backgroundColor: '#f3f4f6',
        marginVertical: 8,
    },
    barFill: {
        height: '100%',
    },
    verdictBadge: {
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    verdictText: {
        fontSize: 13,
        fontWeight: '700',
    },
    closeLabel: {
        fontSize: 12,
    },
    hint: {
        fontSize: 11,
        marginTop: 6,
        textAlign: 'center',
    },
    toast: {
        position: 'absolute',
        bottom: -36,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(15,15,15,0.85)',
        borderRadius: 8,
        paddingVertical: 7,
        paddingHorizontal: 14,
        alignItems: 'center',
    },
    toastText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
});
