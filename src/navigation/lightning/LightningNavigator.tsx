import React, { ReactElement } from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TransitionPresets } from '@react-navigation/stack';

import Introduction from '../../screens/Lightning/Introduction';
import CustomSetup from '../../screens/Lightning/CustomSetup';
import CustomConfirm from '../../screens/Lightning/CustomConfirm';
import Result from '../../screens/Lightning/Result';
import QuickSetup from '../../screens/Lightning/QuickSetup';
import QuickConfirm from '../../screens/Lightning/QuickConfirm';

const Stack = createNativeStackNavigator();

const transitionPreset =
	Platform.OS === 'ios'
		? TransitionPresets.SlideFromRightIOS
		: TransitionPresets.DefaultTransition;

const navOptions = {
	headerShown: false,
	gestureEnabled: true,
	...transitionPreset,
	detachInactiveScreens: true,
};

const screenOptions = {
	...navOptions,
};

const LightningStack = (): ReactElement => {
	return (
		<Stack.Navigator initialRouteName="Introduction">
			<Stack.Group screenOptions={screenOptions}>
				<Stack.Screen name="Introduction" component={Introduction} />
				<Stack.Screen name="CustomSetup" component={CustomSetup} />
				<Stack.Screen name="CustomConfirm" component={CustomConfirm} />
				<Stack.Screen name="Result" component={Result} />
				<Stack.Screen name="QuickSetup" component={QuickSetup} />
				<Stack.Screen name="QuickConfirm" component={QuickConfirm} />
			</Stack.Group>
		</Stack.Navigator>
	);
};

export default LightningStack;