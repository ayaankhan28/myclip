import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
import notifee, { EventType } from '@notifee/react-native';

// Register background handler
notifee.onBackgroundEvent(async ({ type, detail }) => {
    const { notification, pressAction } = detail;

    // Check if the user pressed the "Stop Sync" action
    if (type === EventType.ACTION_PRESS && pressAction.id === 'stop') {
        await notifee.stopForegroundService();
    }
});

registerRootComponent(App);
