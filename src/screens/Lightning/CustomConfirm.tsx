import React, { ReactElement, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { FadeIn, FadeOut } from 'react-native-reanimated';

import {
	AnimatedView,
	Caption13Up,
	Display,
	Text01S,
	Text01M,
	LightningIcon,
	PenIcon,
} from '../../styles/components';
import SafeAreaInsets from '../../components/SafeAreaInsets';
import GlowingBackground from '../../components/GlowingBackground';
import NavigationHeader from '../../components/NavigationHeader';
import SwipeToConfirm from '../../components/SwipeToConfirm';
import AmountToggle from '../../components/AmountToggle';
import useDisplayValues from '../../hooks/displayValues';
import NumberPadWeeks from './NumberPadWeeks';
import { LightningScreenProps } from '../../navigation/types';
import { sleep } from '../../utils/helpers';
import Store from '../../store/types';
import {
	confirmChannelPurchase,
	startChannelPurchase,
} from '../../store/actions/blocktank';
import { showErrorNotification } from '../../utils/notifications';
import { addTodo } from '../../store/actions/todos';
import {
	selectedNetworkSelector,
	selectedWalletSelector,
	transactionFeeSelector,
} from '../../store/reselect/wallet';
import {
	blocktankOrderSelector,
	blocktankServiceSelector,
} from '../../store/reselect/blocktank';

const CustomConfirm = ({
	navigation,
	route,
}: LightningScreenProps<'CustomConfirm'>): ReactElement => {
	const { spendingAmount, receivingAmount } = route.params;
	const selectedNetwork = useSelector(selectedNetworkSelector);
	const selectedWallet = useSelector(selectedWalletSelector);
	const [keybrd, setKeybrd] = useState(false);
	const [loading, setLoading] = useState(false);
	const [weeks, setWeeks] = useState(6);
	const [orderId, setOrderId] = useState(route.params.orderId);
	const blocktankService = useSelector(blocktankServiceSelector);
	const order = useSelector((state: Store) =>
		blocktankOrderSelector(state, orderId),
	);

	const blocktankPurchaseFee = useDisplayValues(order?.price ?? 0);
	const transactionFee = useSelector(transactionFeeSelector);
	const fiatTransactionFee = useDisplayValues(transactionFee ?? 0);
	const channelOpenCost = useMemo(() => {
		return (
			blocktankPurchaseFee.fiatValue + fiatTransactionFee.fiatValue
		).toFixed(2);
	}, [fiatTransactionFee.fiatValue, blocktankPurchaseFee.fiatValue]);

	const handleConfirm = async (): Promise<void> => {
		setLoading(true);
		await sleep(5);
		const res = await confirmChannelPurchase({ orderId, selectedNetwork });
		if (res.isErr()) {
			setLoading(false);
			return;
		}
		addTodo('lightningSettingUp');
		navigation.navigate('Result');
	};

	const updateOrderExpiration = async (): Promise<void> => {
		const purchaseResponse = await startChannelPurchase({
			productId: blocktankService.product_id,
			remoteBalance: order.remote_balance,
			localBalance: order.local_balance,
			channelExpiry: Math.max(weeks, 1),
			selectedWallet,
			selectedNetwork,
		});
		if (purchaseResponse.isErr()) {
			showErrorNotification({
				title: 'Channel Purchase Error',
				message: purchaseResponse.error.message,
			});
			return;
		}
		setOrderId(purchaseResponse.value);
	};

	return (
		<GlowingBackground topLeft="purple">
			<SafeAreaInsets type="top" />
			<NavigationHeader
				title="Add Instant Payments"
				onClosePress={(): void => {
					navigation.navigate('Tabs');
				}}
			/>
			<View style={styles.root}>
				{!keybrd && (
					<AnimatedView color="transparent" entering={FadeIn} exiting={FadeOut}>
						<Display>
							3) <Display color="purple">Please{'\n'}Confirm.</Display>
						</Display>
						<Text01S color="gray1" style={styles.text}>
							It costs
							<Text01S>{` ${blocktankPurchaseFee.fiatSymbol}${channelOpenCost} `}</Text01S>
							to connect you and set up your spending balance. Your Lightning
							connection will stay open for at least
							<Text01S onPress={(): void => setKeybrd(true)}>
								{' '}
								{weeks} weeks <PenIcon height={18} width={18} />
							</Text01S>
							.
						</Text01S>

						<View style={styles.block}>
							<Caption13Up color="purple" style={styles.space}>
								SPENDING BALANCE
							</Caption13Up>
							<AmountToggle sats={spendingAmount} />
						</View>

						<View style={styles.block}>
							<Caption13Up color="purple" style={styles.space}>
								Receiving capacity
							</Caption13Up>
							<AmountToggle sats={receivingAmount} unit="fiat" />
						</View>
					</AnimatedView>
				)}

				{!keybrd && (
					<AnimatedView color="transparent" entering={FadeIn} exiting={FadeOut}>
						<SwipeToConfirm
							text="Swipe To Pay & Connect"
							color="purple"
							onConfirm={handleConfirm}
							icon={<LightningIcon width={30} height={30} color="black" />}
							loading={loading}
							confirmed={loading}
						/>
						<SafeAreaInsets type="bottom" />
					</AnimatedView>
				)}

				{keybrd && (
					<AnimatedView color="transparent" entering={FadeIn} exiting={FadeOut}>
						<Display color="purple">Connection Duration.</Display>
						<Text01S color="gray1" style={styles.text}>
							Choose the minimum number of weeks you want your connection to
							remain open.
						</Text01S>
					</AnimatedView>
				)}

				{keybrd && (
					<AnimatedView
						color="transparent"
						entering={FadeIn}
						exiting={FadeOut}
						style={styles.weeks}>
						<Display>{weeks}</Display>
						<Text01M color="gray1" style={styles.text}>
							weeks
						</Text01M>
					</AnimatedView>
				)}

				{keybrd && (
					<NumberPadWeeks
						weeks={weeks}
						onChange={setWeeks}
						onDone={(): void => {
							if (order.channel_expiry !== weeks) {
								updateOrderExpiration().then();
							}
							setKeybrd(false);
						}}
						style={styles.numberpad}
					/>
				)}
			</View>
		</GlowingBackground>
	);
};

const styles = StyleSheet.create({
	root: {
		flex: 1,
		justifyContent: 'space-between',
		marginTop: 8,
		paddingHorizontal: 16,
	},
	text: {
		marginTop: 8,
		marginBottom: 40,
	},
	space: {
		marginBottom: 8,
		alignItems: 'center',
	},
	block: {
		borderBottomWidth: 1,
		marginBottom: 32,
	},
	weeks: {
		alignSelf: 'flex-start',
		alignItems: 'center',
	},
	numberpad: {
		marginHorizontal: -16,
	},
});

export default CustomConfirm;
