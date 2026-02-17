import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, NativeModules, Platform, Modal, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const { PermissionModule } = NativeModules;

const COLORS = {
    background: '#0F0F10',
    card: '#1C1C1E',
    primary: '#34C759',
    secondary: '#FFCC00',
    danger: '#FF3B30',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
};

interface AppInfo {
    name: string;
    package: string;
}

interface VictimData {
    [pkg: string]: number; // minutes
}

const AppSelector = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const [apps, setApps] = useState<AppInfo[]>([]);
    const [selectedApps, setSelectedApps] = useState<VictimData>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (visible) {
            loadApps();
            loadStoredSelection();
        }
    }, [visible]);

    const loadApps = async () => {
        if (Platform.OS === 'android' && PermissionModule) {
            try {
                const installedApps = await PermissionModule.getInstalledApps();
                setApps(installedApps.sort((a: AppInfo, b: AppInfo) => a.name.localeCompare(b.name)));
            } catch (error) {
                console.error('Failed to load apps:', error);
            }
        }
        setLoading(false);
    };

    const loadStoredSelection = async () => {
        try {
            const stored = await AsyncStorage.getItem('selected_victim_apps');
            if (stored) {
                const data = JSON.parse(stored);
                // Handle legacy array format if it exists
                if (Array.isArray(data)) {
                    const migrated: VictimData = {};
                    data.forEach(pkg => migrated[pkg] = 60);
                    setSelectedApps(migrated);
                } else {
                    setSelectedApps(data);
                }
            }
        } catch (error) {
            console.error('Failed to load selection:', error);
        }
    };

    const toggleApp = async (pkg: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const newSelection = { ...selectedApps };
        if (newSelection[pkg]) {
            delete newSelection[pkg];
        } else {
            newSelection[pkg] = 60; // Default 60 minutes
        }
        setSelectedApps(newSelection);
        await AsyncStorage.setItem('selected_victim_apps', JSON.stringify(newSelection));
    };

    const updateQuota = async (pkg: string, minutes: number) => {
        Haptics.selectionAsync();
        const newSelection = { ...selectedApps, [pkg]: minutes };
        setSelectedApps(newSelection);
        await AsyncStorage.setItem('selected_victim_apps', JSON.stringify(newSelection));
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.container}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>DESIGNATE TARGETS</Text>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialCommunityIcons name="close" size={24} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>Apps exceeding their quota will trigger the lock.</Text>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <Text style={styles.loadingText}>Initializing system scan...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={apps}
                            keyExtractor={item => item.package}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            renderItem={({ item }) => {
                                const isSelected = !!selectedApps[item.package];
                                return (
                                    <View style={[styles.appItem, isSelected && styles.appItemActive]}>
                                        <TouchableOpacity
                                            style={styles.appMain}
                                            onPress={() => toggleApp(item.package)}
                                        >
                                            <View style={styles.appInfo}>
                                                <Text style={styles.appName}>{item.name}</Text>
                                                <Text style={styles.appPkg}>{item.package}</Text>
                                            </View>
                                            <MaterialCommunityIcons
                                                name={isSelected ? "shield-check" : "shield-outline"}
                                                size={24}
                                                color={isSelected ? COLORS.primary : COLORS.card}
                                            />
                                        </TouchableOpacity>

                                        {isSelected && (
                                            <View style={styles.quotaRow}>
                                                <Text style={styles.quotaLabel}>Daily Quota:</Text>
                                                <View style={styles.quotaControls}>
                                                    {[30, 60, 120].map(mins => (
                                                        <TouchableOpacity
                                                            key={mins}
                                                            onPress={() => updateQuota(item.package, mins)}
                                                            style={[
                                                                styles.quotaButton,
                                                                selectedApps[item.package] === mins && styles.quotaButtonActive
                                                            ]}
                                                        >
                                                            <Text style={[
                                                                styles.quotaText,
                                                                selectedApps[item.package] === mins && styles.quotaTextActive
                                                            ]}>
                                                                {mins}m
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                );
                            }}
                        />
                    )}

                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={() => {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            onClose();
                        }}
                    >
                        <Text style={styles.saveButtonText}>CONFIRM ENFORCEMENT</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: '85%',
        padding: 24,
        borderTopWidth: 1,
        borderColor: '#1C1C1E',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1.5,
    },
    subtitle: {
        color: COLORS.textSecondary,
        fontSize: 13,
        marginBottom: 24,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: COLORS.textSecondary,
        fontSize: 14,
        fontStyle: 'italic',
    },
    appItem: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        marginBottom: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    appItemActive: {
        borderColor: COLORS.primary + '40',
    },
    appMain: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    appInfo: {
        flex: 1,
    },
    appName: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: '600',
    },
    appPkg: {
        color: COLORS.textSecondary,
        fontSize: 11,
        marginTop: 2,
    },
    quotaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#2C2C2E',
    },
    quotaLabel: {
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    quotaControls: {
        flexDirection: 'row',
    },
    quotaButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: COLORS.background,
        marginLeft: 8,
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    quotaButtonActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primary + '10',
    },
    quotaText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: 'bold',
    },
    quotaTextActive: {
        color: COLORS.primary,
    },
    saveButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 20,
        paddingVertical: 18,
        alignItems: 'center',
        marginTop: 10,
    },
    saveButtonText: {
        color: COLORS.background,
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1,
    },
});

export default AppSelector;

