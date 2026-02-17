import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, ImageBackground, Dimensions, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const Index = () => {
  const router = useRouter();
  const progress = useRef(new Animated.Value(0)).current;
  const [percent, setPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Initializing shame...');
  const [subMessage, setSubMessage] = useState('Calculating hours wasted on social media');

  const messages = [
    { threshold: 0, m1: 'Initializing shame...', m2: 'Calculating hours wasted on social media' },
    { threshold: 25, m1: 'Analyzing addiction...', m2: 'Checking screen time alerts ignored' },
    { threshold: 50, m1: 'Mocking user...', m2: 'Comparing your life to influencers' },
    { threshold: 75, m1: 'Finalizing judgment...', m2: 'Preparing direct insults' },
    { threshold: 95, m1: 'Ready for detox...', m2: 'Go outside, seriously.' },
  ];

  useEffect(() => {
    const listener = progress.addListener(({ value }) => {
      const p = Math.floor(value * 100);
      setPercent(p);

      const current = [...messages].reverse().find(m => p >= m.threshold);
      if (current) {
        setStatusMessage(current.m1);
        setSubMessage(current.m2);
      }
    });

    Animated.timing(progress, {
      toValue: 1,
      duration: 4000,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setTimeout(async () => {
          const hasCompleted = await AsyncStorage.getItem('has_completed_onboarding');
          if (hasCompleted === 'true') {
            router.replace('/(tabs)/home');
          } else {
            router.replace('/onboarding');
          }
        }, 800);
      }
    });

    return () => {
      progress.removeAllListeners();
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ImageBackground
        source={require('../assets/images/Forest Path at Night.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <View style={{ transform: [{ scale: 1.1 }] }}>
                <MaterialCommunityIcons name="grass" size={80} color="#2ECC71" />
              </View>
            </View>
          </View>

          {/* Title Section */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>TOUCH GRASS</Text>
            <View style={styles.subtitleContainer}>
              <View style={styles.line} />
              <Text style={styles.subtitle}>DIGITAL DETOX UTILITY</Text>
              <View style={styles.line} />
            </View>
          </View>

          {/* Footer Section */}
          <View style={styles.footer}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>STATUS: {statusMessage.toUpperCase()}</Text>
              <Text style={styles.percentage}>{percent}%</Text>
            </View>

            <View style={styles.progressContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    })
                  }
                ]}
              />
            </View>

            <View style={styles.statusMessages}>
              <Text style={styles.messageItalic}>{statusMessage}</Text>
              <Text style={styles.messageSmall}>{subMessage}</Text>
            </View>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)', // Subtle darkening
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    marginBottom: 40,
    marginTop: -100, // Offset upwards slightly
  },
  logoCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46, 204, 113, 0.05)',
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#2ECC71',
    letterSpacing: 4,
    fontFamily: 'System', // Bold Grotesque feel
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  subtitle: {
    color: '#2ECC71',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginHorizontal: 10,
    opacity: 0.8,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(46, 204, 113, 0.4)',
    maxWidth: 40,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    paddingHorizontal: 40,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    color: '#2ECC71',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  percentage: {
    color: '#2ECC71',
    fontSize: 10,
    fontWeight: '800',
  },
  progressContainer: {
    height: 4,
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2ECC71',
  },
  statusMessages: {
    marginTop: 20,
    alignItems: 'center',
  },
  messageItalic: {
    color: '#2ECC71',
    fontSize: 16,
    fontStyle: 'italic',
    opacity: 0.7,
    marginBottom: 4,
  },
  messageSmall: {
    color: '#2ECC71',
    fontSize: 10,
    opacity: 0.5,
  },
});

export default Index;