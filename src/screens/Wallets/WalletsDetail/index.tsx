import React, {
	PropsWithChildren,
	ReactElement,
	memo,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import {
	LayoutAnimation,
	NativeScrollEvent,
	NativeSyntheticEvent,
	Platform,
	StyleSheet,
} from 'react-native';
import Animated, { EasingNode, FadeIn, FadeOut } from 'react-native-reanimated';
import { BlurView } from '@react-native-community/blur';
import {
	Canvas,
	RadialGradient,
	Rect,
	rect,
	useCanvas,
	useDerivedValue,
	vec,
} from '@shopify/react-native-skia';
import {
	AnimatedView,
	DisplayHaas,
	TitleHaas,
	View,
} from '../../../styles/components';
import NavigationHeader from '../../../components/NavigationHeader';
import { useBalance } from '../../../hooks/wallet';
import useColors from '../../../hooks/colors';
import ActivityList from '../../Activity/ActivityList';
import BitcoinBreakdown from './BitcoinBreakdown';
import SafeAreaInsets from '../../../components/SafeAreaInsets';
import { EActivityTypes } from '../../../store/types/activity';
import { TAssetType } from '../../../store/types/wallet';
import BitcoinLogo from '../../../assets/bitcoin-logo.svg';

const Blur = Platform.OS === 'ios' ? BlurView : View;

const updateHeight = ({
	height = new Animated.Value(0),
	toValue = 0,
	duration = 250,
}): void => {
	try {
		Animated.timing(height, {
			toValue,
			duration,
			easing: EasingNode.inOut(EasingNode.ease),
		}).start();
	} catch {}
};

interface Props extends PropsWithChildren<any> {
	route: {
		params: {
			assetType: TAssetType;
		};
	};
}

const Glow = ({ colors }): ReactElement => {
	const { size } = useCanvas();
	const rct = useDerivedValue(
		() => rect(0, 0, size.current.width, size.current.height),
		[size],
	);

	return (
		<Rect rect={rct}>
			<RadialGradient
				c={vec(-250, 100)}
				r={600}
				colors={[colors.brand, 'transparent']}
			/>
		</Rect>
	);
};

const WalletsDetail = (props: Props): ReactElement => {
	const { route } = props;

	const { assetType } = route.params;

	const { fiatWhole, fiatDecimal, fiatDecimalValue, fiatSymbol } = useBalance({
		onchain: true,
		lightning: true,
	});

	const colors = useColors();

	let title = '';
	let assetFilter: EActivityTypes[] = [];
	switch (assetType) {
		case 'bitcoin': {
			title = 'Bitcoin';
			assetFilter = [EActivityTypes.onChain, EActivityTypes.lightning];
			break;
		}
		case 'tether': {
			title = 'Tether';
			assetFilter = [EActivityTypes.tether];
			break;
		}
	}

	const [showDetails, setShowDetails] = useState(true);
	const [radiusContainerHeight, setRadiusContainerHeight] = useState(400);
	const [headerHeight, setHeaderHeight] = useState(0);

	const activityPadding = useMemo(
		() => ({ paddingTop: radiusContainerHeight, paddingBottom: 230 }),
		[radiusContainerHeight],
	);
	const [height] = useState(new Animated.Value(0));

	useEffect(() => {
		updateHeight({ height, toValue: headerHeight });
	}, [height, headerHeight]);

	const onScroll = useCallback(
		(e: NativeSyntheticEvent<NativeScrollEvent>) => {
			const { y } = e.nativeEvent.contentOffset;

			//HIDE
			if (y > 150 && showDetails) {
				//Shrink the detail view
				LayoutAnimation.easeInEaseOut();
				setShowDetails(false);
				updateHeight({ height, toValue: 30 });
			}

			//SHOW
			if (y < 100 && !showDetails) {
				//They scrolled up so show more details now
				LayoutAnimation.easeInEaseOut();
				setShowDetails(true);
				updateHeight({ height, toValue: headerHeight });
			}
		},
		[showDetails, height, headerHeight],
	);

	return (
		<AnimatedView style={styles.container}>
			<View color={'transparent'} style={styles.txListContainer}>
				<ActivityList
					assetFilter={assetFilter}
					onScroll={onScroll}
					style={styles.txList}
					contentContainerStyle={activityPadding}
					progressViewOffset={radiusContainerHeight + 10}
				/>
			</View>
			<View color={'transparent'} style={styles.radiusContainer}>
				<Blur>
					<Canvas style={styles.glowCanvas}>
						<Glow colors={colors} />
					</Canvas>
					<View
						style={styles.assetDetailContainer}
						color="white01"
						onLayout={(e): void => {
							const hh = e.nativeEvent.layout.height;
							setRadiusContainerHeight((h) => (h === 400 ? hh : h));
						}}>
						<SafeAreaInsets type={'top'} />

						<NavigationHeader />

						<AnimatedView
							color={'transparent'}
							style={[styles.header, { minHeight: height }]}
							onLayout={(e): void => {
								const hh = e.nativeEvent.layout.height;
								setHeaderHeight((h) => (h === 0 ? hh : h));
							}}>
							<View color={'transparent'} style={styles.row}>
								<View color={'transparent'} style={styles.cell}>
									<BitcoinLogo viewBox="0 0 70 70" height={32} width={32} />
									<TitleHaas style={styles.title}>{title}</TitleHaas>
								</View>
								{!showDetails ? (
									<AnimatedView
										color={'transparent'}
										style={styles.cell}
										entering={FadeIn}
										exiting={FadeOut}>
										<TitleHaas color={'gray'}>{fiatSymbol} </TitleHaas>
										<TitleHaas>{fiatWhole}</TitleHaas>
										<TitleHaas color={'gray'}>
											{fiatDecimal}
											{fiatDecimalValue}
										</TitleHaas>
									</AnimatedView>
								) : null}
							</View>

							{showDetails ? (
								<AnimatedView
									color={'transparent'}
									entering={FadeIn}
									exiting={FadeOut}>
									<View color={'transparent'} style={styles.balanceContainer}>
										<View
											color={'transparent'}
											style={styles.largeValueContainer}>
											<DisplayHaas color={'gray'}>{fiatSymbol}</DisplayHaas>
											<DisplayHaas>{fiatWhole}</DisplayHaas>
											<DisplayHaas color={'gray'}>
												{fiatDecimal}
												{fiatDecimalValue}
											</DisplayHaas>
										</View>
									</View>
									{assetType === 'bitcoin' ? <BitcoinBreakdown /> : null}
								</AnimatedView>
							) : null}
						</AnimatedView>
					</View>
				</Blur>
			</View>
			<SafeAreaInsets type={'bottom'} maxPaddingBottom={20} />
		</AnimatedView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	assetDetailContainer: {
		paddingBottom: 20,
	},
	radiusContainer: {
		overflow: 'hidden',
		borderBottomRightRadius: 16,
		borderBottomLeftRadius: 16,
		position: 'relative',
	},
	glowCanvas: {
		width: '100%',
		height: 500, // it needs to be static, otherwise android lagging
		position: 'absolute',
	},
	header: {
		paddingHorizontal: 16,
	},
	balanceContainer: {
		marginTop: 20,
		marginBottom: 30,
	},
	largeValueContainer: {
		display: 'flex',
		flexDirection: 'row',
	},
	txListContainer: {
		flex: 1,
		position: 'absolute',
		width: '100%',
		height: '100%',
	},
	txList: {
		paddingHorizontal: 16,
	},
	row: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	cell: {
		alignItems: 'center',
		flexDirection: 'row',
	},
	title: {
		marginLeft: 16,
	},
});

export default memo(WalletsDetail);
