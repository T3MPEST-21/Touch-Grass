import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Switch, Platform, NativeModules, Animated, Image, ActivityIndicator, Dimensions, Modal, LayoutAnimation, UIManager } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { startBackgroundService, stopBackgroundService } from '../../../services/BackgroundService';
import * as IntentLauncher from 'expo-intent-launcher';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, G, Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import AppSelector from '../../../components/AppSelector';

const { PermissionModule } = NativeModules;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
    background: '#0F0F10',
    card: 'rgba(28, 28, 30, 0.7)',
    cardSolid: '#1C1C1E',
    primary: '#34C759',
    secondary: '#FFCC00',
    danger: '#FF3B30',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    segments: ['#34C759', '#5856D6', '#FF9500', '#AF52DE', '#FF2D55', '#007AFF', '#FFCC00'],
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ROASTS = {
    minimal: { title: "Suspiciously responsible.", sub: "Are you... actually doing something productive?" },
    low: { title: "You're drifting.", sub: "The phone is winning. Go outside before it's too late." },
    high: { title: "Sunlight is not your enemy.", sub: "Your eyes called. They miss the real world." },
    extreme: { title: "Legally required to touch grass.", sub: "You are a digital zombie. Help is available." }
};

const Home = () => {
    const [isServiceActive, setIsServiceActive] = useState(false);
    const [realScreenTime, setRealScreenTime] = useState(0);
    const [breakdown, setBreakdown] = useState<{ [pkg: string]: number }>({});
    const [weeklyTotals, setWeeklyTotals] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingWeekly, setIsLoadingWeekly] = useState(false);
    const [isSelectorVisible, setIsSelectorVisible] = useState(false);
    const [victimData, setVictimData] = useState<{ [pkg: string]: number }>({});
    const [activeTargets, setActiveTargets] = useState<any[]>([]);
    const [streak, setStreak] = useState(0);
    const [selectedAppDetail, setSelectedAppDetail] = useState<any>(null);
    const [peekIndex, setPeekIndex] = useState(-1); // -1 = Total, 0..N = App Index
    const [permissions, setPermissions] = useState({
        notifications: false,
        overlay: false,
        usageStats: false,
        batteryOptimized: true,
    });

    const scrollX = useRef(new Animated.Value(0)).current;
    const isFirstRun = useRef(true);

    const updateStreak = async (currentTime: number) => {
        const today = new Date().toISOString().split('T')[0];
        const lastDate = await AsyncStorage.getItem('last_active_date');
        const currentStreakStr = await AsyncStorage.getItem('grass_streak');
        let streakVal = currentStreakStr ? parseInt(currentStreakStr) : 0;

        if (lastDate === today) return;

        if (lastDate) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            if (lastDate === yesterdayStr) {
                const yesterdayTimeStr = await AsyncStorage.getItem('last_day_time');
                const yesterdayTime = yesterdayTimeStr ? parseFloat(yesterdayTimeStr) : 0;
                if (yesterdayTime < 4) streakVal += 1;
                else streakVal = 0;
            } else streakVal = 0;
        } else streakVal = 1;

        await AsyncStorage.setItem('last_active_date', today);
        await AsyncStorage.setItem('grass_streak', streakVal.toString());
        setStreak(streakVal);
    };

    const checkPermissions = async (forceLoad = false) => {
        if (forceLoad) {
            setIsRefreshing(true);
            setIsLoadingWeekly(true);
        }

        try {
            const { status } = await Notifications.getPermissionsAsync();
            let overlayGranted = false;
            let usageGranted = false;
            let batteryIgnoring = false;
            let screenTime = 0;

            if (Platform.OS === 'android' && PermissionModule) {
                overlayGranted = await PermissionModule.checkOverlayPermission();
                usageGranted = await PermissionModule.checkUsageStatsPermission();
                batteryIgnoring = await PermissionModule.checkBatteryOptimization();
            }

            const storedVictims = await AsyncStorage.getItem('selected_victim_apps');
            const data = storedVictims ? JSON.parse(storedVictims) : {};
            setVictimData(data);

            const victimPackages = Object.keys(data);

            if (Platform.OS === 'android' && PermissionModule) {
                if (victimPackages.length > 0) {
                    const allApps = await PermissionModule.getInstalledApps();
                    const targets = allApps.filter((a: any) => data[a.package]);
                    setActiveTargets(targets);

                    if (usageGranted) {
                        const [st, bd, wk] = await Promise.all([
                            PermissionModule.getTodayScreenTime(victimPackages),
                            PermissionModule.getTargetUsageBreakdown(victimPackages),
                            PermissionModule.getWeeklyTotalUsage(victimPackages)
                        ]);
                        screenTime = st;
                        setBreakdown(bd);
                        setWeeklyTotals(wk);
                    }
                } else {
                    setActiveTargets([]);
                    setBreakdown({});
                    setWeeklyTotals([]);
                    if (usageGranted) screenTime = await PermissionModule.getTodayScreenTime(null);
                }
            }

            updateStreak(screenTime);
            await AsyncStorage.setItem('last_day_time', screenTime.toString());

            setPermissions({
                notifications: status === 'granted',
                overlay: overlayGranted,
                usageStats: usageGranted,
                batteryOptimized: !batteryIgnoring,
            });
            setRealScreenTime(screenTime);
        } catch (e) {
            console.error("Sync error:", e);
        } finally {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setIsLoading(false);
            setIsRefreshing(false);
            setIsLoadingWeekly(false);
            isFirstRun.current = false;
        }
    };

    useFocusEffect(
        useCallback(() => {
            checkPermissions(isFirstRun.current);
            const interval = setInterval(() => checkPermissions(false), 20000);
            return () => clearInterval(interval);
        }, [])
    );

    const toggleService = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        if (isServiceActive) {
            if (Platform.OS === 'android' && PermissionModule) await PermissionModule.stopDetoxService();
            await stopBackgroundService();
            setIsServiceActive(false);
        } else {
            if (!permissions.notifications || !permissions.overlay || !permissions.usageStats) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                alert("Grant your powers first.");
                return;
            }
            if (Object.keys(victimData).length === 0) {
                setIsSelectorVisible(true);
                return;
            }
            if (Platform.OS === 'android' && PermissionModule) await PermissionModule.startDetoxService(victimData);
            await startBackgroundService();
            setIsServiceActive(true);
        }
    };

    const untargetApp = async (pkg: string) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
        const newData = { ...victimData };
        delete newData[pkg];
        setVictimData(newData);
        await AsyncStorage.setItem('selected_victim_apps', JSON.stringify(newData));
        checkPermissions(false);
    };

    const getRoast = () => {
        if (realScreenTime < 0.5) return ROASTS.minimal;
        if (realScreenTime < 2) return ROASTS.low;
        if (realScreenTime < 4) return ROASTS.high;
        return ROASTS.extreme;
    };

    const formatTime = (hours: number) => {
        const totalMinutes = Math.round(hours * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const renderHeroSlide1 = () => {
        const apps = Object.entries(breakdown).sort((a: any, b: any) => b[1] - a[1]);
        const currentPeek = peekIndex === -1 ? null : apps[peekIndex];

        const cyclePeek = () => {
            Haptics.selectionAsync();
            setPeekIndex(prev => prev >= apps.length - 1 ? -1 : prev + 1);
        };

        return (
            <View style={styles.heroSlide}>
                <TouchableOpacity activeOpacity={0.9} onPress={cyclePeek} style={styles.ringContainer}>
                    {isRefreshing && Object.keys(breakdown).length === 0 ? (
                        <Skeleton width={200} height={200} borderRadius={100} style={{ borderOuterWidth: 20 }} />
                    ) : (
                        <SegmentedRing
                            size={240}
                            strokeWidth={22}
                            breakdown={breakdown}
                            totalTime={realScreenTime}
                        />
                    )}
                    <View style={[styles.timeLabelContainer, { position: 'absolute' }]}>
                        {isRefreshing && realScreenTime === 0 ? (
                            <Skeleton width={120} height={40} borderRadius={8} />
                        ) : (
                            <>
                                <Text style={styles.heroTime}>
                                    {currentPeek ? formatTime(currentPeek[1] / 60) : formatTime(realScreenTime)}
                                </Text>
                                <Text style={[styles.heroSubLabel, currentPeek && { color: COLORS.segments[peekIndex % COLORS.segments.length] }]}>
                                    {currentPeek ? (activeTargets.find(t => t.package === currentPeek[0])?.name || 'TOTAL USAGE').toUpperCase() : 'TARGET USAGE'}
                                </Text>
                            </>
                        )}
                        <MaterialCommunityIcons name="gesture-tap" size={12} color="#444" style={{ marginTop: 8 }} />
                    </View>
                </TouchableOpacity>

                {apps.length > 0 && (
                    <View style={styles.legendContainer}>
                        {apps.slice(0, 3).map(([pkg, time], i) => (
                            <View key={pkg} style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: COLORS.segments[i % COLORS.segments.length] }]} />
                                <Text style={styles.legendText}>{activeTargets.find(t => t.package === pkg)?.name || pkg.split('.').pop()}</Text>
                            </View>
                        ))}
                        {apps.length > 3 && <Text style={styles.legendText}>+{apps.length - 3} more</Text>}
                    </View>
                )}

                <View style={styles.roastContainer}>
                    <Text style={styles.roastTitle}>{getRoast().title}</Text>
                    <Text style={styles.roastSub}>{getRoast().sub}</Text>
                </View>
            </View>
        );
    };

    const renderHeroSlide2 = () => {
        const labels = Array.from({ length: 7 }, (_, i) => {
            const dayIndex = (new Date().getDay() - (6 - i) + 7) % 7;
            return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dayIndex];
        });

        return (
            <View style={styles.heroSlide}>
                <View style={styles.weeklyCard}>
                    <View style={styles.weeklyHeader}>
                        <MaterialCommunityIcons name="chart-bar" size={24} color={COLORS.primary} />
                        <Text style={styles.weeklyTitle}>Weekly Trends</Text>
                    </View>
                    <Text style={styles.weeklySub}>Combined usage of monitored apps</Text>

                    {isLoadingWeekly ? (
                        <View style={{ marginTop: 20, width: '100%', height: 110, justifyContent: 'flex-end', flexDirection: 'row', gap: 10, }}>
                            {Array.from({ length: 7 }).map((_, i) => (
                                <Skeleton key={i} width={28} height={20 + Math.random() * 80} borderRadius={14} />
                            ))}
                        </View>
                    ) : (
                        <View style={{ width: '100%', marginTop: 20 }}>
                            <BarChart
                                data={weeklyTotals}
                                labels={labels}
                                height={110}
                            />
                        </View>
                    )}
                </View>
                <View style={styles.hintContainer}>
                    <MaterialCommunityIcons name="chevron-left" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.hintText}>Swipe back for live ring</Text>
                </View>
            </View>
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={[styles.statLabelPre, { marginTop: 16 }]}>Consulting the spirits...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.header}>
                    <View style={styles.streakPill}>
                        <MaterialCommunityIcons name="fire" size={16} color={COLORS.primary} />
                        <Text style={styles.streakText}>{streak} Day Streak</Text>
                    </View>
                    <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); checkPermissions(true); }}>
                        {isRefreshing ? (
                            <ActivityIndicator size="small" color={COLORS.textSecondary} />
                        ) : (
                            <MaterialCommunityIcons name="refresh" size={20} color={COLORS.textSecondary} />
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.heroContainer}>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
                        scrollEventThrottle={16}
                    >
                        {renderHeroSlide1()}
                        {renderHeroSlide2()}
                    </ScrollView>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>ACTIVE TARGETS</Text>
                    <TouchableOpacity onPress={() => setIsSelectorVisible(true)}>
                        <Text style={styles.sectionAction}>Manage</Text>
                    </TouchableOpacity>
                </View>

                {activeTargets.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.targetsScroll}>
                        {activeTargets.map(app => (
                            <TargetItem
                                key={app.package}
                                app={app}
                                victimQuota={victimData[app.package]}
                                breakdown={breakdown}
                                untargetApp={untargetApp}
                                onSelect={setSelectedAppDetail}
                            />
                        ))}
                    </ScrollView>
                ) : isRefreshing ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.targetsScroll}>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <View key={i} style={styles.targetItem}>
                                <Skeleton width={56} height={56} borderRadius={16} />
                                <Skeleton width={40} height={10} style={{ marginTop: 8 }} />
                                <Skeleton width={30} height={8} style={{ marginTop: 4 }} />
                            </View>
                        ))}
                    </ScrollView>
                ) : (
                    <TouchableOpacity style={styles.emptyTargets} onPress={() => setIsSelectorVisible(true)}>
                        <MaterialCommunityIcons name="plus-circle-outline" size={24} color={COLORS.textSecondary} />
                        <Text style={styles.emptyTargetsText}>No apps targeted. Tap to add.</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.card}>
                    <View style={styles.row}>
                        <View>
                            <Text style={styles.cardTitle}>Grass Enforcement</Text>
                            <Text style={styles.cardSub}>Persistent watcher</Text>
                        </View>
                        <Switch
                            value={isServiceActive}
                            onValueChange={toggleService}
                            trackColor={{ false: '#333', true: COLORS.primary }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>SYSTEM POWERS</Text>
                </View>

                <View style={styles.permissionsGrid}>
                    <PermissionIcon icon="bell-ring" status={permissions.notifications} onPress={() => Notifications.requestPermissionsAsync().then(() => checkPermissions(false))} />
                    <PermissionIcon icon="layers-triple" status={permissions.overlay} onPress={() => IntentLauncher.startActivityAsync('android.settings.action.MANAGE_OVERLAY_PERMISSION')} />
                    <PermissionIcon icon="eye" status={permissions.usageStats} onPress={() => IntentLauncher.startActivityAsync('android.settings.USAGE_ACCESS_SETTINGS')} />
                    <PermissionIcon icon="battery-charging-wireless-outline" status={!permissions.batteryOptimized} onPress={() => PermissionModule.requestBatteryOptimization().then(() => checkPermissions(false))} />
                </View>
            </ScrollView>

            <AppSelector visible={isSelectorVisible} onClose={() => { setIsSelectorVisible(false); checkPermissions(false); }} />

            <AppDetailModal
                app={selectedAppDetail}
                visible={!!selectedAppDetail}
                onClose={() => setSelectedAppDetail(null)}
            />
        </SafeAreaView>
    );
};

const SegmentedRing = React.memo(({ size, strokeWidth, breakdown, totalTime }: any) => {
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    const apps = Object.entries(breakdown).sort((a: any, b: any) => b[1] - a[1]);
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        animatedValue.setValue(0);
        Animated.timing(animatedValue, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: false,
        }).start();
    }, [breakdown]);

    let currentOffset = 0;

    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <Circle cx={center} cy={center} r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} fill="none" />
                <G transform={`rotate(-90 ${center} ${center})`}>
                    {apps.map(([pkg, time]: any, index) => {
                        const percentage = (time / (totalTime * 60)) || 0;
                        if (percentage < 0.005) return null;

                        const strokeDasharray = `${percentage * circumference} ${circumference}`;
                        const strokeDashoffset = -currentOffset;
                        currentOffset += percentage * circumference;

                        return (
                            <AnimatedCircle
                                key={pkg}
                                cx={center}
                                cy={center}
                                r={radius}
                                stroke={COLORS.segments[index % COLORS.segments.length]}
                                strokeWidth={strokeWidth}
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={animatedValue.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [circumference, strokeDashoffset]
                                })}
                                strokeLinecap="round"
                                fill="none"
                            />
                        );
                    })}
                </G>
            </Svg>
        </View>
    );
}, (prev, next) => JSON.stringify(prev.breakdown) === JSON.stringify(next.breakdown));

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const BarChart = React.memo(({ data, labels, quota, height = 120, showTooltips = true }: any) => {
    const maxVal = Math.max(...data, quota || 0, 10);
    const animatedValues = useRef(data.map(() => new Animated.Value(0))).current;

    useEffect(() => {
        Animated.stagger(50, animatedValues.map((anim: any, i: number) =>
            Animated.timing(anim, {
                toValue: (data[i] / maxVal) * height,
                duration: 800,
                useNativeDriver: false,
            })
        )).start();
    }, [data, maxVal, height]);

    const getBarColor = (val: number) => {
        if (!quota) return val > 60 ? COLORS.secondary : COLORS.primary;
        if (val >= quota) return COLORS.danger;
        if (val >= quota * 0.8) return COLORS.secondary;
        return COLORS.primary;
    };

    return (
        <View style={styles.chartWrapper}>
            <View style={[styles.yAxis, { height }]}>
                <Text style={styles.axisText}>{Math.round(maxVal)}m</Text>
                <Text style={styles.axisText}>{Math.round(maxVal / 2)}m</Text>
                <Text style={styles.axisText}>0</Text>
            </View>
            <View style={styles.chartArea}>
                {quota > 0 && (
                    <View style={[styles.quotaLine, { bottom: (quota / maxVal) * height }]}>
                        <View style={styles.quotaTag}><Text style={styles.quotaTagText}>LIMIT</Text></View>
                    </View>
                )}
                <View style={[styles.barsContainer, { height }]}>
                    {data.map((val: number, i: number) => (
                        <View key={i} style={styles.barGroup}>
                            {showTooltips && val > 0 && <Text style={styles.tooltip}>{Math.round(val)}</Text>}
                            <Animated.View style={[styles.bar, {
                                height: animatedValues[i],
                                backgroundColor: getBarColor(val),
                                opacity: i === 6 ? 1 : 0.6
                            }]} />
                            <Text style={styles.barLabel}>{labels[i]}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}, (prev, next) => JSON.stringify(prev.data) === JSON.stringify(next.data));

const AppDetailModal = ({ app, visible, onClose }: any) => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && app) {
            setLoading(true);
            PermissionModule.getAppUsageHistory(app.package, 7).then((data: any) => {
                setHistory(data);
                setLoading(false);
            });
        }
    }, [visible, app]);

    if (!app) return null;

    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const todayIndex = new Date().getDay();
    const orderedLabels = Array.from({ length: 7 }, (_, i) => labels[(todayIndex - (6 - i) + 7) % 7]);
    const chartData = history.map(d => d.time);

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalBg}>
                <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
                <View style={styles.modalContent}>
                    <View style={styles.modalIndicator} />
                    <View style={styles.modalHeader}>
                        <View style={styles.modalHeaderInfo}>
                            <View style={[styles.targetCard, { marginBottom: 0, marginRight: 16 }]}>
                                <Text style={styles.targetAbbr}>{app.name.substring(0, 1)}</Text>
                            </View>
                            <View>
                                <Text style={styles.modalTitle}>{app.name}</Text>
                                <Text style={styles.modalPkg}>{app.package}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <MaterialCommunityIcons name="close" size={24} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator style={{ margin: 40 }} color={COLORS.primary} />
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.detailStats}>
                                <View style={styles.detailStatBox}>
                                    <View style={styles.statHeader}>
                                        <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.primary} />
                                        <Text style={styles.statLabel}>Today</Text>
                                    </View>
                                    <Text style={styles.statVal}>{Math.round(history[6]?.time || 0)}m</Text>
                                </View>
                                <View style={styles.detailStatBox}>
                                    <View style={styles.statHeader}>
                                        <MaterialCommunityIcons name="trending-up" size={14} color={COLORS.primary} />
                                        <Text style={styles.statLabel}>Avg / Day</Text>
                                    </View>
                                    <Text style={styles.statVal}>{Math.round(history.reduce((a, b) => a + b.time, 0) / 7)}m</Text>
                                </View>
                            </View>

                            <Text style={styles.chartTitle}>7-Day History</Text>
                            <BarChart
                                data={chartData}
                                labels={orderedLabels}
                                quota={history[6]?.quota || 60}
                                height={140}
                            />

                            <View style={[styles.activityBox, { marginTop: 32 }]}>
                                <View style={styles.activityHeader}>
                                    <MaterialCommunityIcons name="shield-check" size={20} color={COLORS.primary} />
                                    <Text style={styles.activityTitle}>Integrity Status</Text>
                                </View>
                                <Text style={styles.activitySub}>No quota violations detected in the last session. Discipline is holding.</Text>
                            </View>
                            <View style={{ height: 40 }} />
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const Skeleton = ({ width, height, borderRadius = 8, style }: any) => {
    const animatedValue = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, { toValue: 1, duration: 1000, useNativeDriver: true }),
                Animated.timing(animatedValue, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View style={[{ width, height, borderRadius, backgroundColor: '#2C2C2E', opacity: animatedValue }, style]} />
    );
};

const TargetItem = React.memo(({ app, victimQuota, breakdown, untargetApp, onSelect }: any) => {
    const appsSorted = Object.entries(breakdown).sort((a: any, b: any) => b[1] - a[1]);
    const colorIndex = appsSorted.findIndex(([pkg]) => pkg === app.package);
    const appColor = colorIndex !== -1 ? COLORS.segments[colorIndex % COLORS.segments.length] : '#333';

    return (
        <TouchableOpacity style={styles.targetItem} onPress={() => { Haptics.selectionAsync(); onSelect(app); }}>
            <View style={[styles.targetCard, { borderColor: appColor + '40' }]}>
                <View style={[styles.colorIndicator, { backgroundColor: appColor }]} />
                <Text style={styles.targetAbbr}>{app.name.substring(0, 1)}</Text>
                <TouchableOpacity style={styles.untargetBtn} onPress={() => untargetApp(app.package)}>
                    <MaterialCommunityIcons name="close-circle" size={16} color={COLORS.danger} />
                </TouchableOpacity>
            </View>
            <Text style={targetNameStyle(appColor)} numberOfLines={1}>{app.name}</Text>
            <Text style={styles.targetQuota}>{victimQuota}m</Text>
        </TouchableOpacity>
    );
});

const targetNameStyle = (color: string) => ({
    color: color === '#333' ? COLORS.text : color,
    fontSize: 10,
    fontWeight: '600' as const,
    width: '100%' as const,
    textAlign: 'center' as const,
});

const PermissionIcon = React.memo(({ icon, status, onPress }: any) => (
    <TouchableOpacity
        style={[styles.permissionCircle, status && styles.permissionCircleActive]}
        onPress={() => { Haptics.selectionAsync(); onPress(); }}
    >
        <MaterialCommunityIcons name={icon} size={24} color={status ? COLORS.primary : COLORS.textSecondary} />
    </TouchableOpacity>
));

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: 24 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    streakPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#2C2C2E' },
    streakText: { color: COLORS.primary, fontSize: 13, fontWeight: 'bold', marginLeft: 6 },
    heroContainer: { height: 380, width: SCREEN_WIDTH - 48 },
    heroSlide: { width: SCREEN_WIDTH - 48, alignItems: 'center' },
    ringContainer: { justifyContent: 'center', alignItems: 'center', height: 260 },
    timeLabelContainer: { alignItems: 'center' },
    heroTime: { color: COLORS.text, fontSize: 48, fontWeight: '200' },
    heroSubLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginTop: 4 },
    roastContainer: { alignItems: 'center', marginTop: 20 },
    roastTitle: { color: COLORS.text, fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
    roastSub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
    weeklyCard: { width: '100%', backgroundColor: COLORS.card, borderRadius: 24, padding: 24, alignItems: 'center', height: 280, borderWidth: 1, borderColor: '#2C2C2E' },
    weeklyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    weeklyTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
    weeklySub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6, marginBottom: 20, },
    chartWrapper: { flexDirection: 'row', alignItems: 'flex-end', width: '100%' },
    yAxis: { width: 35, justifyContent: 'space-between', paddingBottom: 25 },
    axisText: { color: COLORS.textSecondary, fontSize: 9, textAlign: 'right', paddingRight: 6 },
    chartArea: { flex: 1, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: '#2C2C2E' },
    quotaLine: { position: 'absolute', width: '100%', borderTopWidth: 1, borderTopColor: COLORS.secondary, borderStyle: 'dashed', zIndex: 1 },
    quotaTag: { position: 'absolute', top: -14, left: 4, backgroundColor: COLORS.secondary, paddingHorizontal: 4, borderRadius: 4 },
    quotaTagText: { color: COLORS.background, fontSize: 7, fontWeight: 'bold' },
    barsContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingBottom: 20 },
    barGroup: { alignItems: 'center', flex: 1 },
    tooltip: { color: COLORS.text, fontSize: 9, fontWeight: 'bold', marginBottom: 4 },
    bar: { width: 14, borderRadius: 7 },
    barLabel: { position: 'absolute', bottom: -18, color: COLORS.textSecondary, fontSize: 9 },
    statHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
    hintContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 4 },
    hintText: { color: COLORS.textSecondary, fontSize: 11 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 16 },
    sectionTitle: { color: COLORS.textSecondary, fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2 },
    sectionAction: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
    targetsScroll: { marginBottom: 24, marginLeft: -8 },
    targetItem: { alignItems: 'center', width: 70, marginHorizontal: 8 },
    targetCard: { width: 56, height: 56, backgroundColor: COLORS.card, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 8, overflow: 'hidden' },
    targetAbbr: { color: COLORS.primary, fontSize: 20, fontWeight: 'bold', opacity: 0.9 },
    untargetBtn: { position: 'absolute', top: -6, right: -6 },
    targetName: { color: COLORS.text, fontSize: 10, fontWeight: '600', width: '100%', textAlign: 'center' },
    targetQuota: { color: COLORS.textSecondary, fontSize: 9, marginTop: 2 },
    emptyTargets: { height: 80, backgroundColor: COLORS.card, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center', marginBottom: 24, flexDirection: 'row' },
    emptyTargetsText: { color: COLORS.textSecondary, fontSize: 13, marginLeft: 12 },
    card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2C2C2E' },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTitle: { color: COLORS.text, fontSize: 17, fontWeight: '600' },
    cardSub: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
    permissionsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
    permissionCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2C2C2E' },
    permissionCircleActive: { borderColor: COLORS.primary + '40', backgroundColor: COLORS.primary + '10' },
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '85%' },
    modalIndicator: { width: 40, height: 4, backgroundColor: '#2C2C2E', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
    modalHeaderInfo: { flexDirection: 'row', alignItems: 'center' },
    modalTitle: { color: COLORS.text, fontSize: 22, fontWeight: 'bold' },
    modalPkg: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
    closeBtn: { backgroundColor: COLORS.card, padding: 8, borderRadius: 20 },
    detailStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
    detailStatBox: { flex: 1, backgroundColor: COLORS.card, padding: 20, borderRadius: 20, marginHorizontal: 6, alignItems: 'center', borderWidth: 1, borderColor: '#2C2C2E' },
    statVal: { color: COLORS.primary, fontSize: 24, fontWeight: 'bold' },
    statLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 4, fontWeight: '600' },
    statLabelPre: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
    chartTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
    detailBarContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 140, paddingHorizontal: 10, marginBottom: 40 },
    detailBarColumn: { alignItems: 'center' },
    detailBar: { width: 28, borderRadius: 14 },
    detailBarLabel: { color: COLORS.textSecondary, fontSize: 10, marginTop: 12 },
    activityBox: { backgroundColor: COLORS.card, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#2C2C2E' },
    activityHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    activityTitle: { color: COLORS.text, fontSize: 16, fontWeight: 'bold' },
    activitySub: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
    legendContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, paddingHorizontal: 20 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '600', },
    colorIndicator: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
});

export default Home;
