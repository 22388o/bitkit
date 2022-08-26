import React, { memo, ReactElement, useState, useRef, useMemo } from 'react';
import {
	Image,
	StyleSheet,
	TouchableOpacity,
	useWindowDimensions,
	View,
	Linking,
} from 'react-native';
import Swiper from 'react-native-swiper';
import { FadeIn, FadeOut } from 'react-native-reanimated';
import {
	AnimatedView,
	Display,
	Text01M,
	Text01S,
	View as ThemedView,
} from '../../styles/components';
import SafeAreaInsets from '../../components/SafeAreaInsets';
import GlowingBackground from '../../components/GlowingBackground';
import Button from '../../components/Button';
import { createNewWallet } from '../../utils/startup';
import { showErrorNotification } from '../../utils/notifications';
import { sleep } from '../../utils/helpers';
import useColors from '../../hooks/colors';
import LoadingWalletScreen from './Loading';

const Dot = ({ active }: { active?: boolean }): ReactElement => {
	return (
		<ThemedView color={active ? 'white' : 'gray2'} style={styles.pageDot} />
	);
};

/**
 * Slideshow for Welcome screen
 */
const Slideshow = ({
	navigation,
	route,
}: {
	navigation: any;
	route: { params: { skipIntro?: boolean } };
}): ReactElement => {
	const skipIntro = route?.params?.skipIntro;
	const swiperRef = useRef<Swiper>(null);
	const [isCreatingWallet, setIsCreatingWallet] = useState(false);
	const colors = useColors();
	// because we can't properly scala image inside the <Swiper let's calculate with by hand
	const dimensions = useWindowDimensions();
	const illustrationStyles = useMemo(
		() => ({
			...styles.illustration,
			width: dimensions.width * 0.6,
			height: dimensions.width * 0.6,
		}),
		[dimensions.width],
	);

	const onNewWallet = async (): Promise<void> => {
		setIsCreatingWallet(true);
		await sleep(500); // wait fot animation to be started
		const res = await createNewWallet();
		if (res.isErr()) {
			setIsCreatingWallet(false);
			showErrorNotification({
				title: 'Wallet creation failed',
				message: res.error.message,
			});
		}
	};
	const showTOS = async (): Promise<void> => {
		const link = 'https://synonym.to/terms-of-use/';
		if (await Linking.canOpenURL(link)) {
			await Linking.openURL(link);
		}
	};

	const slides = useMemo(
		() => [
			{
				topLeftColor: colors.brand,
				slide: (): ReactElement => (
					<View style={styles.slide}>
						<View style={styles.imageContainer}>
							<Image
								style={illustrationStyles}
								source={require('../../assets/illustrations/shield-b.png')}
							/>
						</View>
						<View style={styles.textContent}>
							<Display>
								Bitcoin,
								<Display color="brand"> Everywhere.</Display>
							</Display>
							<Text01S color="gray1" style={styles.text}>
								Pay anyone, anywhere, any time and spend your Bitcoin on the
								things that you value in life.
							</Text01S>
						</View>
						<SafeAreaInsets type="bottom" />
					</View>
				),
			},

			{
				topLeftColor: colors.purple,
				slide: (): ReactElement => (
					<View style={styles.slide}>
						<View style={styles.imageContainer}>
							<Image
								style={illustrationStyles}
								source={require('../../assets/illustrations/lightning.png')}
							/>
						</View>
						<View style={styles.textContent}>
							<Display>
								Lightning
								<Display style={styles.headline2}> Fast.</Display>
							</Display>
							<Text01S color="gray1" style={styles.text}>
								Send Bitcoin faster than ever.{'\n'}Enjoy instant transactions
								with friends, family and merchants.
							</Text01S>
						</View>
						<SafeAreaInsets type="bottom" />
					</View>
				),
			},

			{
				topLeftColor: colors.blue,
				slide: (): ReactElement => (
					<View style={styles.slide}>
						<View style={styles.imageContainer}>
							<Image
								style={illustrationStyles}
								source={require('../../assets/illustrations/padlock.png')}
							/>
						</View>
						<View style={styles.textContent}>
							<Display>
								Log in with
								<Display color="blue"> just a Tap.</Display>
							</Display>
							<Text01S color="gray1" style={styles.text}>
								Experience the web without passwords. Use Slashtags to control
								your profile, contacts & accounts.
							</Text01S>
						</View>
						<SafeAreaInsets type="bottom" />
					</View>
				),
			},

			{
				topLeftColor: colors.brand,
				slide: (): ReactElement => (
					<View style={styles.slide}>
						<View style={styles.imageContainer}>
							<Image
								style={illustrationStyles}
								source={require('../../assets/illustrations/wallet.png')}
							/>
						</View>
						<View style={styles.textContent}>
							<Display>
								Let’s create
								<Display color="brand"> your Wallet.</Display>
							</Display>
							<Text01S color="gray1" style={styles.text}>
								By tapping ‘New Wallet’ or ‘Restore’ you accept our{' '}
								<Text01S onPress={showTOS} color="brand">
									terms of service
								</Text01S>
								.
							</Text01S>

							<View style={styles.buttonsContainer}>
								<Button
									size="large"
									style={[styles.button, styles.restoreButton]}
									onPress={onNewWallet}
									text="New Wallet"
									testID="NewWallet"
								/>

								<Button
									size="large"
									variant="secondary"
									style={[styles.button, styles.newButton]}
									onPress={(): void => navigation.navigate('RestoreFromSeed')}
									text="Restore"
									testID="Restore"
								/>
							</View>
						</View>
						<SafeAreaInsets type="bottom" />
					</View>
				),
			},
		],
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	const onScroll = (i): void => {
		if (i > slides.length - 1) {
			// react-native-swiper bug. on Andoid
			// If you Skip to last slide and then try to swipe back
			// it calls onScroll with index more that number of slides you have
			i = slides.length - 2;
		}
		setIndex(i);
	};
	const onSkip = (): void => {
		swiperRef.current?.scrollBy(slides.length - 1 - index);
	};

	const [index, setIndex] = useState(skipIntro ? slides.length - 1 : 0);

	if (isCreatingWallet) {
		return (
			<GlowingBackground topLeft={colors.brand}>
				<LoadingWalletScreen />
			</GlowingBackground>
		);
	}

	const glowColor = slides[index]?.topLeftColor ?? colors.brand;

	return (
		<GlowingBackground topLeft={glowColor}>
			<>
				<Swiper
					ref={swiperRef}
					dot={<Dot />}
					activeDot={<Dot active />}
					loop={false}
					index={index}
					onIndexChanged={onScroll}>
					{slides.map(({ slide: Slide }, i) => (
						<Slide key={i} />
					))}
				</Swiper>

				{index !== slides.length - 1 && (
					<AnimatedView
						entering={FadeIn}
						exiting={FadeOut}
						color="transparent"
						style={styles.headerButtonContainer}>
						<TouchableOpacity style={styles.skipButton} onPress={onSkip}>
							<SafeAreaInsets type="top" />
							<Text01M color="gray1">Skip</Text01M>
						</TouchableOpacity>
					</AnimatedView>
				)}
			</>
		</GlowingBackground>
	);
};

const styles = StyleSheet.create({
	headerButtonContainer: {
		flexDirection: 'row',
		width: '100%',
		justifyContent: 'flex-end',
		top: 20,
		paddingHorizontal: 28,
		position: 'absolute',
	},
	skipButton: {
		backgroundColor: 'transparent',
	},
	buttonsContainer: {
		flexDirection: 'row',
		marginTop: 32,
	},
	button: {
		flex: 1,
		paddingHorizontal: 10,
	},
	restoreButton: {
		marginRight: 6,
	},
	newButton: {
		marginLeft: 6,
	},
	slide: {
		flex: 1,
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	imageContainer: {
		flex: 3,
		alignItems: 'center',
		marginBottom: 25,
		justifyContent: 'flex-end',
		position: 'relative', // for first slide background image
	},
	illustration: {
		resizeMode: 'contain',
	},
	textContent: {
		flex: 3,
		width: 280,
	},
	pageDot: {
		width: 7,
		height: 7,
		borderRadius: 4,
		marginLeft: 4,
		marginRight: 4,
		marginBottom: 30, // lift dot's up
	},
	headline2: {
		color: 'rgba(172, 101, 225, 1)',
		lineHeight: 48,
	},
	text: {
		marginTop: 8,
	},
});

export default memo(Slideshow);
