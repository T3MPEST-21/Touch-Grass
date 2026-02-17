import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const SLIDES = [
    {
        icon: 'leaf',
        title: 'Focus on Life.',
        subtitle: 'Touch Grass is a digital detox utility designed to embarrass you into productivity.',
        color: '#2ECC71'
    },
    {
        icon: 'target',
        title: 'Target & Block.',
        subtitle: 'Set daily quotas for your most addictive apps. Once the limit is hit, we lock you out.',
        color: '#34C759'
    },
    {
        icon: 'nature',
        title: 'Touch Grass.',
        subtitle: 'To unlock your apps, you must physically go outside and prove you are present.',
        color: '#27AE60'
    }
];

const Onboarding = () => {
    const router = useRouter();
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollX = React.useRef(new Animated.Value(0)).current;

    const handleNext = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (activeIndex < SLIDES.length - 1) {
            setActiveIndex(activeIndex + 1);
        } else {
            await AsyncStorage.setItem('has_completed_onboarding', 'true');
            router.replace('/(tabs)/home');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.brand}>TOUCH GRASS</Text>
                    <View style={styles.progressDots}>
                        {SLIDES.map((_, i) => (
                            <View
                                key={i}
                                style={[styles.dot, activeIndex === i && styles.activeDot]}
                            />
                        ))}
                    </View>
                </View>

                <View style={styles.slideContent}>
                    <MaterialCommunityIcons
                        name={SLIDES[activeIndex].icon as any}
                        size={120}
                        color={SLIDES[activeIndex].color}
                        style={styles.icon}
                    />
                    <Text style={[styles.title, { color: SLIDES[activeIndex].color }]}>
                        {SLIDES[activeIndex].title}
                    </Text>
                    <Text style={styles.subtitle}>
                        {SLIDES[activeIndex].subtitle}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.button, { borderColor: SLIDES[activeIndex].color }]}
                    onPress={handleNext}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.buttonText, { color: SLIDES[activeIndex].color }]}>
                        {activeIndex === SLIDES.length - 1 ? 'GET STARTED' : 'CONTINUE'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    content: {
        flex: 1,
        padding: 40,
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    brand: {
        color: '#2ECC71',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 2,
    },
    progressDots: {
        flexDirection: 'row',
        gap: 8,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#333',
    },
    activeDot: {
        width: 16,
        backgroundColor: '#2ECC71',
    },
    slideContent: {
        alignItems: 'center',
        paddingBottom: 60,
    },
    icon: {
        marginBottom: 40,
        opacity: 0.9,
    },
    title: {
        fontSize: 32,
        fontWeight: '200',
        textAlign: 'center',
        marginBottom: 20,
    },
    subtitle: {
        color: '#8E8E93',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    button: {
        width: '100%',
        paddingVertical: 18,
        borderRadius: 35,
        borderWidth: 1.5,
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1.5,
    },
});

export default Onboarding;
