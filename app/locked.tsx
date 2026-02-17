import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, BackHandler, StatusBar, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { LightSensor, Accelerometer } from 'expo-sensors';

const COLORS = {
    background: '#000000',
    primary: '#34C759',
    secondary: '#FFCC00',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
};

const ROASTS = [
    "The grass missed you. Don't leave so soon.",
    "Your phone won't miss you. I promise.",
    "Look up. See that big blue thing? That's the sky.",
    "Nature doesn't have a 'Scroll' button. Enjoy it.",
    "Oxygen is free. Go get some.",
    "Your streak is the only thing you should be scrolling.",
];

const Locked = () => {
    const router = useRouter();
    const [roast] = useState(() => ROASTS[Math.floor(Math.random() * ROASTS.length)]);
    const [progress] = useState(new Animated.Value(0));
    const [isHolding, setIsHolding] = useState(false);

    // Sensor States
    const [lux, setLux] = useState(0);
    const [isMoving, setIsMoving] = useState(false);
    const [isNight, setIsNight] = useState(() => {
        const hour = new Date().getHours();
        return hour < 7 || hour > 19;
    });

    const holdTimer = useRef<any>(null);
    const hapticInterval = useRef<any>(null);

    useEffect(() => {
        const backAction = () => true;
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

        // Sensor Listeners
        LightSensor.setUpdateInterval(1000);
        const lightSub = LightSensor.addListener(data => setLux(data.illuminance));

        Accelerometer.setUpdateInterval(500);
        const accelSub = Accelerometer.addListener(data => {
            const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
            // 1.0 is stationary. Threshold for "active movement"
            setIsMoving(magnitude > 1.2 || magnitude < 0.8);
        });

        return () => {
            backHandler.remove();
            lightSub.remove();
            accelSub.remove();
            if (holdTimer.current) clearTimeout(holdTimer.current);
            if (hapticInterval.current) clearInterval(hapticInterval.current);
        };
    }, []);

    const isSunVerified = lux > 8000;
    const holdDuration = isSunVerified ? 3000 : 5000;
    const canGround = isSunVerified || isMoving || isNight; // Night allows grounding but requires movement (handled in haptics/logic)

    const startHapticHeartbeat = () => {
        let count = 0;
        const totalPulses = holdDuration / 250;
        hapticInterval.current = setInterval(() => {
            count++;

            // If movement is required but not detected, pulse danger haptic
            if (!isSunVerified && !isMoving) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                return;
            }

            if (count < totalPulses * 0.5) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            else if (count < totalPulses * 0.8) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }, 250);
    };

    const handlePressIn = () => {
        setIsHolding(true);
        Animated.timing(progress, {
            toValue: 1,
            duration: holdDuration,
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished) {
                // Final check: must be moving OR in sun if we finished the time
                if (isSunVerified || isMoving) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    router.replace('/(tabs)/home');
                } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    handlePressOut();
                }
            }
        });

        startHapticHeartbeat();
    };

    const handlePressOut = () => {
        setIsHolding(false);
        Animated.timing(progress, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
        }).start();

        if (hapticInterval.current) {
            clearInterval(hapticInterval.current);
            hapticInterval.current = null;
        }
    };

    const size = 200;
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <View style={styles.content}>
                <View style={[styles.textContainer, { marginBottom: 40 }]}>
                    <Text style={styles.title}>Stay Grounded.</Text>
                    <Text style={styles.subtitle}>{roast}</Text>
                </View>

                <View style={styles.ringContainer}>
                    <Svg width={size} height={size}>
                        <Circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            stroke="rgba(255, 255, 255, 0.05)"
                            strokeWidth={strokeWidth}
                            fill="none"
                        />
                        <AnimatedCircle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            stroke={isSunVerified ? COLORS.primary : COLORS.secondary}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${circumference} ${circumference}`}
                            strokeDashoffset={progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [circumference, 0],
                            })}
                            strokeLinecap="round"
                            fill="none"
                            transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        />
                    </Svg>
                    <View style={styles.centerIcon}>
                        <MaterialCommunityIcons
                            name={isSunVerified ? "sun-wireless" : isMoving ? "walk" : "leaf"}
                            size={64}
                            color={isSunVerified ? COLORS.primary : COLORS.secondary}
                        />
                        {isSunVerified && (
                            <View style={styles.verificationBadge}>
                                <MaterialCommunityIcons name="check-decagram" size={16} color={COLORS.primary} />
                            </View>
                        )}
                    </View>
                </View>

                <View style={styles.statusIndicator}>
                    <MaterialCommunityIcons
                        name={isSunVerified ? "weather-sunny" : isNight ? "weather-night" : "cloud-outline"}
                        size={14}
                        color={COLORS.textSecondary}
                    />
                    <Text style={styles.statusText}>
                        {isSunVerified ? "SUN-VERIFIED" : isNight ? "MOONLIGHT MODE" : "OVERCAST MODE"}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.button, isHolding && styles.buttonActive]}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    activeOpacity={1}
                >
                    <Text style={[styles.buttonText, isHolding && styles.buttonTextActive]}>
                        {isHolding ? "RETAINING..." : isSunVerified ? "TOUCH SUNLIGHT" : "MOVE TO GROUND"}
                    </Text>
                </TouchableOpacity>

                {!isSunVerified && (
                    <Text style={[styles.hintText, isMoving && { color: COLORS.primary, opacity: 1 }]}>
                        {isMoving ? "Movement detected • Hold to unlock" : "Stand up and walk to verify presence"}
                    </Text>
                )}
                {isSunVerified && (
                    <Text style={[styles.hintText, { color: COLORS.primary, opacity: 1 }]}>
                        Direct sunlight detected • 3s quick-grounding active
                    </Text>
                )}
            </View>
        </SafeAreaView>
    );
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    ringContainer: {
        width: 200,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 60,
    },
    centerIcon: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    verificationBadge: {
        position: 'absolute',
        top: -10,
        right: -10,
        backgroundColor: COLORS.background,
        borderRadius: 12,
        padding: 2,
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 60,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 80,
    },
    title: {
        color: COLORS.primary,
        fontSize: 32,
        fontWeight: '200',
        textAlign: 'center',
        letterSpacing: 2,
    },
    subtitle: {
        color: COLORS.textSecondary,
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    button: {
        backgroundColor: 'transparent',
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: 35,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        width: '100%',
        maxWidth: 300,
    },
    buttonActive: {
        backgroundColor: 'rgba(52, 199, 89, 0.1)',
        borderColor: COLORS.primary,
    },
    buttonText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: 1.5,
    },
    buttonTextActive: {
        color: COLORS.primary,
    },
    hintText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: 24,
        opacity: 0.6,
    }
});

export default Locked;
