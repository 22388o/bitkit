import React, {
	PropsWithChildren,
	ReactElement,
	memo,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { useSelector } from 'react-redux';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import {
	Canvas,
	Path,
	RadialGradient,
	Rect,
	Skia,
	vec,
} from '@shopify/react-native-skia';

import {
	Caption13M,
	Caption13Up,
	DisplayHaas,
	GitBranchIcon,
	TimerIconAlt,
	NoteIcon,
	ReceiveIcon,
	SendIcon,
	Text02M,
	TitleHaas,
	UserIcon,
	CheckCircleIcon,
	ClockIcon,
	View as ThemedView,
} from '../../styles/components';
import Button from '../../components/Button';
import NavigationHeader from '../../components/NavigationHeader';
import { EActivityTypes, IActivityItem } from '../../store/types/activity';
import {
	canBoost,
	getBlockExplorerLink,
	setupBoost,
} from '../../utils/wallet/transactions';
import useDisplayValues from '../../hooks/displayValues';
import SafeAreaView from '../../components/SafeAreaView';
import SafeAreaInsets from '../../components/SafeAreaInsets';
import Store from '../../store/types';
import { resetOnChainTransaction } from '../../store/actions/wallet';
import useColors from '../../hooks/colors';

const Section = memo(
	({ title, value }: { title: string; value: React.ReactNode }) => {
		const { gray4 } = useColors();

		return (
			<View style={[styles.sRoot, { borderBottomColor: gray4 }]}>
				<View style={styles.sText}>
					<Caption13Up color="gray1">{title}</Caption13Up>
				</View>
				<View style={styles.sText}>{value}</View>
			</View>
		);
	},
);

const Glow = ({
	color,
	size,
}: {
	color: string;
	size: { width: number; height: number };
}): ReactElement => {
	return (
		<Rect x={0} y={0} width={size.width} height={size.height} opacity={0.3}>
			<RadialGradient c={vec(0, 100)} r={600} colors={[color, 'transparent']} />
		</Rect>
	);
};

const ZigZag = ({ color }): ReactElement => {
	const step = 12;
	let n = 0;
	const path = Skia.Path.Make();
	path.moveTo(0, 0);
	do {
		path.lineTo((n + 1) * step, step);
		path.lineTo((n + 2) * step, 0);
		n += 2;
	} while (n < 100);
	path.close();

	return <Path path={path} color={color} />;
};

interface Props extends PropsWithChildren<any> {
	navigation: any;
	route: { params: { activityItem: IActivityItem; extended: boolean } };
}

const emptyActivityItem: IActivityItem = {
	id: '',
	message: '',
	address: '',
	activityType: EActivityTypes.onChain,
	txType: 'sent',
	value: 0,
	confirmed: false,
	fee: 0,
	timestamp: 0,
};

const ActivityDetail = (props: Props): ReactElement => {
	const [
		{ id, message, activityType, txType, value, confirmed, timestamp, address },
	] = useState<IActivityItem>(
		props.route.params?.activityItem ?? emptyActivityItem,
	);
	const [size, setSize] = useState({ width: 0, height: 0 });
	const colors = useColors();
	const extended = props.route.params?.extended ?? false;
	const selectedNetwork = useSelector(
		(state: Store) => state.wallet.selectedNetwork,
	);
	const selectedWallet = useSelector(
		(state: Store) => state.wallet.selectedWallet,
	);

	const boostData = useMemo(() => canBoost(id), [id]);
	useEffect(() => {
		setupBoost({ selectedWallet, selectedNetwork, txid: id });

		return (): void => {
			if (boostData.canBoost && !confirmed) {
				resetOnChainTransaction({ selectedNetwork, selectedWallet });
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleLayout = (e): void => {
		const { height, width } = e.nativeEvent.layout;
		setSize((s) => (s.width === 0 ? { width, height } : s));
	};

	let status = '';
	if (value < 0) {
		if (confirmed) {
			status = 'Sent';
		} else {
			status = 'Sending...';
		}
	} else {
		if (confirmed) {
			status = 'Received';
		} else {
			status = 'Receiving...';
		}
	}

	let glowColor;

	switch (activityType) {
		case EActivityTypes.onChain:
			glowColor = 'brand';
			break;
		case EActivityTypes.lightning:
			glowColor = 'purple';
			break;
		case EActivityTypes.tether:
			glowColor = 'green';
			break;
	}

	glowColor = colors[glowColor] ?? glowColor;

	const { bitcoinFormatted, fiatFormatted, fiatSymbol } =
		useDisplayValues(value);

	const blockExplorerUrl =
		activityType === 'onChain' ? getBlockExplorerLink(id) : '';

	const handleBlockExplorerOpen = useCallback(async () => {
		if (await Linking.canOpenURL(blockExplorerUrl)) {
			await Linking.openURL(blockExplorerUrl);
		}
	}, [blockExplorerUrl]);

	return (
		<SafeAreaView onLayout={handleLayout}>
			<Canvas style={[styles.canvas, size]}>
				<Glow color={glowColor} size={size} />
			</Canvas>
			<NavigationHeader title={status} />
			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}>
				<View style={styles.title}>
					<View style={styles.titleBlock}>
						<DisplayHaas>
							{Number(bitcoinFormatted) > 0 ? '+' : ''}
							{bitcoinFormatted}
						</DisplayHaas>
					</View>

					<ThemedView
						color={txType === 'sent' ? 'red16' : 'green16'}
						style={styles.iconContainer}>
						{txType === 'sent' ? (
							<SendIcon height={19} color="red" />
						) : (
							<ReceiveIcon height={19} color="green" />
						)}
					</ThemedView>
				</View>

				<View style={styles.sectionContainer}>
					<Section
						title={`VALUE (${fiatSymbol})`}
						value={<Text02M>{fiatFormatted}</Text02M>}
					/>
					<Section
						title="STATUS"
						value={
							<View style={styles.confStatus}>
								{confirmed ? (
									<CheckCircleIcon color="white" style={styles.checkmarkIcon} />
								) : (
									<ClockIcon color="white" style={styles.checkmarkIcon} />
								)}
								<Text02M color={confirmed ? 'green' : 'white'}>
									{confirmed ? 'Confirmed' : 'Confirming'}
								</Text02M>
							</View>
						}
					/>
				</View>

				<View style={styles.sectionContainer}>
					<Section
						title="DATE"
						value={
							<Text02M>
								{new Date(timestamp).toLocaleString(undefined, {
									year: 'numeric',
									month: 'long',
									day: 'numeric',
								})}
							</Text02M>
						}
					/>
					<Section
						title="TIME"
						value={
							<Text02M>
								{new Date(timestamp).toLocaleString(undefined, {
									hour: 'numeric',
									minute: 'numeric',
									hour12: false,
								})}
							</Text02M>
						}
					/>
				</View>

				{!extended ? (
					<>
						{message ? (
							<View>
								<Caption13M color="brand" style={styles.sText}>
									NOTE
								</Caption13M>
								<ThemedView color="gray5">
									<Canvas style={styles.zRoot}>
										<ZigZag color={colors.background} />
									</Canvas>

									<View style={styles.note}>
										<TitleHaas>{message}</TitleHaas>
									</View>
								</ThemedView>
							</View>
						) : null}

						<View style={styles.buttonsContainer}>
							<View style={styles.sectionContainer}>
								<Button
									style={styles.button}
									text="Assign"
									icon={<UserIcon />}
									onPress={(): void => Alert.alert('TODO')}
								/>
								<Button
									style={styles.button}
									text="Explore"
									icon={<GitBranchIcon />}
									disabled={!blockExplorerUrl}
									onPress={handleBlockExplorerOpen}
								/>
							</View>
							<View style={styles.sectionContainer}>
								<Button
									style={styles.button}
									text="Label"
									icon={<NoteIcon />}
									onPress={(): void => Alert.alert('TODO')}
								/>
								<Button
									style={styles.button}
									text="Boost"
									icon={<TimerIconAlt color="brand" />}
									disabled={!boostData.canBoost}
									onPress={(): void => Alert.alert('TODO')}
								/>
							</View>
						</View>

						<View style={styles.buttonDetailsContainer}>
							<Button
								text="Transaction details"
								size="large"
								onPress={(): void =>
									props.navigation.push('ActivityDetail', {
										extended: true,
										activityItem: props.route.params.activityItem,
									})
								}
							/>
						</View>
					</>
				) : (
					<>
						<View style={styles.sectionContainer}>
							<Section title="TRANSACTION ID" value={<Text02M>{id}</Text02M>} />
						</View>
						<View style={styles.sectionContainer}>
							<Section title="ADDRESS" value={<Text02M>{address}</Text02M>} />
						</View>
						<View style={styles.sectionContainer}>
							<Section title="INPUTS" value={<Text02M>TODO</Text02M>} />
						</View>
						<View style={styles.sectionContainer}>
							<Section title="OUTPUTS" value={<Text02M>TODO</Text02M>} />
						</View>

						<View style={styles.buttonDetailsContainer}>
							<Button
								text="Open Block explorer"
								size="large"
								disabled={!blockExplorerUrl}
								onPress={handleBlockExplorerOpen}
							/>
						</View>
					</>
				)}

				<SafeAreaInsets type="bottom" />
			</ScrollView>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	scrollContent: {
		paddingHorizontal: 16,
		flexGrow: 1,
		position: 'relative',
	},
	canvas: {
		position: 'absolute',
	},
	title: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginVertical: 32,
	},
	titleBlock: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	iconContainer: {
		borderRadius: 30,
		overflow: 'hidden',
		height: 48,
		width: 48,
		justifyContent: 'center',
		alignItems: 'center',
	},
	confStatus: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	checkmarkIcon: {
		marginRight: 10,
	},
	sectionContainer: {
		marginHorizontal: -4,
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	sRoot: {
		paddingBottom: 10,
		marginHorizontal: 4,
		marginBottom: 16,
		borderBottomWidth: 1,
		flex: 1,
	},
	sText: {
		marginBottom: 8,
	},
	note: {
		padding: 24,
	},
	buttonsContainer: {
		marginVertical: 10,
	},
	buttonDetailsContainer: {
		flex: 1,
		justifyContent: 'flex-end',
	},
	button: {
		marginHorizontal: 4,
		marginVertical: 4,
		flex: 1,
	},
	zRoot: {
		height: 12,
	},
});

export default memo(ActivityDetail);
