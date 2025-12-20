import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class NotificationServiceClass {
  async initialize(): Promise<void> {
    try {
      // Request permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('Notification permission denied');
        return;
      }

      // Get FCM token
      const token = await messaging().getToken();
      await AsyncStorage.setItem('fcmToken', token);
      console.log('FCM Token:', token);

      // Send token to backend
      await this.registerToken(token);

      // Setup message handlers
      this.setupMessageHandlers();

      // Create notification channels
      await this.createChannels();

      console.log('Notification service initialized');
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  }

  private async registerToken(token: string): Promise<void> {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      
      await fetch('/api/user/fcm-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token }),
      });
    } catch (error) {
      console.error('Failed to register FCM token:', error);
    }
  }

  private setupMessageHandlers(): void {
    // Foreground messages
    messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground message:', remoteMessage);
      await this.displayNotification(remoteMessage);
    });

    // Background messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background message:', remoteMessage);
      await this.displayNotification(remoteMessage);
    });

    // Notification opened app
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app:', remoteMessage);
      this.handleNotificationPress(remoteMessage);
    });

    // App opened from quit state
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('App opened from quit state:', remoteMessage);
          this.handleNotificationPress(remoteMessage);
        }
      });
  }

  private async createChannels(): Promise<void> {
    // Create notification channels for Android
    await notifee.createChannel({
      id: 'orders',
      name: 'Order Updates',
      importance: AndroidImportance.HIGH,
    });

    await notifee.createChannel({
      id: 'positions',
      name: 'Position Updates',
      importance: AndroidImportance.HIGH,
    });

    await notifee.createChannel({
      id: 'alerts',
      name: 'Price Alerts',
      importance: AndroidImportance.HIGH,
    });

    await notifee.createChannel({
      id: 'general',
      name: 'General',
      importance: AndroidImportance.DEFAULT,
    });
  }

  private async displayNotification(remoteMessage: any): Promise<void> {
    const { notification, data } = remoteMessage;

    await notifee.displayNotification({
      title: notification?.title || 'QuantumTrade',
      body: notification?.body || '',
      data,
      android: {
        channelId: data?.type || 'general',
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
      },
      ios: {
        sound: 'default',
      },
    });
  }

  private handleNotificationPress(remoteMessage: any): void {
    const { data } = remoteMessage;

    // Navigate based on notification type
    switch (data?.type) {
      case 'order_filled':
        // Navigate to orders screen
        break;
      case 'position_liquidated':
        // Navigate to positions screen
        break;
      case 'price_alert':
        // Navigate to market screen
        break;
      default:
        // Navigate to home
        break;
    }
  }

  async sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
    await notifee.displayNotification({
      title,
      body,
      data,
      android: {
        channelId: 'general',
        importance: AndroidImportance.DEFAULT,
      },
    });
  }

  async scheduleNotification(
    title: string,
    body: string,
    triggerTime: Date,
    data?: any
  ): Promise<string> {
    const trigger = {
      type: 'timestamp' as const,
      timestamp: triggerTime.getTime(),
    };

    const notificationId = await notifee.createTriggerNotification(
      {
        title,
        body,
        data,
        android: {
          channelId: 'general',
        },
      },
      trigger
    );

    return notificationId;
  }

  async cancelNotification(notificationId: string): Promise<void> {
    await notifee.cancelNotification(notificationId);
  }

  async cancelAllNotifications(): Promise<void> {
    await notifee.cancelAllNotifications();
  }
}

export const NotificationService = new NotificationServiceClass();
