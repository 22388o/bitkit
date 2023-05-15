import React, { memo, useEffect } from 'react';
import { __E2E__ } from '../constants/env';
import Animated, {
	cancelAnimation,
	Easing,
	useSharedValue,
	withRepeat,
	withTiming,
	useAnimatedStyle,
} from 'react-native-reanimated';

const imageSrc = require('../assets/spinner-gradient.png');

const LoadingSpinner = memo(({ size = 45 }: { size?: number }) => {
	const spinValue = useSharedValue(0);

	useEffect(() => {
		spinValue.value = withRepeat(
			withTiming(360, {
				duration: 1000,
				easing: Easing.linear,
			}),
			-1,
		);
		return (): void => cancelAnimation(spinValue);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const animatedStyle = useAnimatedStyle(() => {
		return {
			transform: [
				{
					rotateZ: `${spinValue.value}deg`,
				},
			],
		};
	}, [spinValue.value]);

	if (__E2E__) {
		return (
			<Animated.Image style={{ height: size, width: size }} source={imageSrc} />
		);
	}

	return (
		<Animated.Image
			style={{ ...animatedStyle, height: size, width: size }}
			source={imageSrc}
		/>
	);
});

export default memo(LoadingSpinner);
