import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as BackgroundTask from 'expo-background-task';
import { Platform } from 'react-native';

const BACKGROUND_MONITOR_TASK = 'BACKGROUND_MONITOR_TASK';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

const triggerNotification = async () => {
    await Notifications.setNotificationChannelAsync('background-service', {
        name: 'Background Shamer',
        importance: Notifications.AndroidImportance.LOW,
        sound: null,
    });

    await Notifications.scheduleNotificationAsync({
        content: {
            title: "TOUCH GRASS IS WATCHING",
            body: "You're doing great. Or are you? Put the phone down.",
            sticky: true,
            color: '#2ECC71',
        },
        trigger: null,
        identifier: 'status-notification',
    });
};

// Define the background task
TaskManager.defineTask(BACKGROUND_MONITOR_TASK, async () => {
    try {
        console.log('[BackgroundService] Task running...');
        await triggerNotification();
        return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
        console.error('[BackgroundService] Task failed:', error);
        return BackgroundTask.BackgroundTaskResult.Failed;
    }
});

export const startBackgroundService = async () => {
    if (Platform.OS !== 'android') return;

    // Trigger immediately
    await triggerNotification();

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_MONITOR_TASK);
    if (!isRegistered) {
        console.log('[BackgroundService] Registering task...');
        await BackgroundTask.registerTaskAsync(BACKGROUND_MONITOR_TASK);
    }
};

export const stopBackgroundService = async () => {
    if (Platform.OS !== 'android') return;

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_MONITOR_TASK);
    if (isRegistered) {
        await BackgroundTask.unregisterTaskAsync(BACKGROUND_MONITOR_TASK);
    }
};
