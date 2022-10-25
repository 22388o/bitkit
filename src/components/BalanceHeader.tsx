import React, {
	memo,
	ReactElement,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';

import { Caption13Up, EyeIcon } from '../styles/components';
import Store from '../store/types';
import { useBalance } from '../hooks/wallet';
import { updateSettings } from '../store/actions/settings';
import Money from './Money';
import { getClaimableBalances } from '../utils/lightning';
import { reduceValue } from '../utils/helpers';

/**
 * Displays the total available balance for the current wallet & network.
 */
const BalanceHeader = (): ReactElement => {
	const [claimableBalance, setClaimableBalance] = useState(0);
	const selectedWallet = useSelector(
		(store: Store) => store.wallet.selectedWallet,
	);
	const selectedNetwork = useSelector(
		(store: Store) => store.wallet.selectedNetwork,
	);
	const channels = useSelector(
		(store: Store) =>
			store.lightning.nodes[selectedWallet].channels[selectedNetwork],
	);
	const openChannels = useSelector(
		(store: Store) =>
			store.lightning.nodes[selectedWallet].openChannelIds[selectedNetwork],
	);
	const balanceUnit = useSelector((store: Store) => store.settings.balanceUnit);
	const hideBalance = useSelector((state: Store) => state.settings.hideBalance);
	const { satoshis } = useBalance({
		onchain: true,
		lightning: true,
	});

	const channelsLength = useMemo(() => {
		return Object.keys(channels).length;
	}, [channels]);

	const updateClaimableBalance = useCallback(async () => {
		const claimableBalanceResponse = await getClaimableBalances();
		if (claimableBalanceResponse.isErr()) {
			return;
		}
		const _claimableBalance = reduceValue({
			arr: claimableBalanceResponse.value,
			value: 'claimable_amount_satoshis',
		});
		if (_claimableBalance.isOk()) {
			setClaimableBalance(_claimableBalance.value);
		}
	}, []);

	useEffect(() => {
		updateClaimableBalance().then();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [channelsLength, openChannels.length, satoshis]);

	const handlePress = (): void => {
		// BTC -> satoshi -> fiat
		const nextUnit =
			balanceUnit === 'BTC'
				? 'satoshi'
				: balanceUnit === 'satoshi'
				? 'fiat'
				: 'BTC';
		const payload = {
			balanceUnit: nextUnit,
			...(nextUnit !== 'fiat' && { bitcoinUnit: nextUnit }),
		};
		updateSettings(payload);
	};

	const toggleHideBalance = (): void => {
		updateSettings({ hideBalance: !hideBalance });
	};

	return (
		<TouchableOpacity style={styles.container} onPress={handlePress}>
			<Caption13Up style={styles.title} color="gray1">
				Total balance
			</Caption13Up>
			<View style={styles.row}>
				<View>
					<Money
						sats={satoshis}
						unit={balanceUnit}
						enableHide={true}
						highlight={true}
						symbol={true}
					/>
					{claimableBalance > 0 && (
						<View style={styles.pendingRow}>
							<Money
								color="gray1"
								size={'text01s'}
								sats={claimableBalance}
								unit={balanceUnit}
								enableHide={true}
								highlight={true}
								symbol={true}
							/>
							<Caption13Up color="gray1"> pending </Caption13Up>
						</View>
					)}
				</View>
				{hideBalance && (
					<TouchableOpacity style={styles.toggle} onPress={toggleHideBalance}>
						<EyeIcon />
					</TouchableOpacity>
				)}
			</View>
		</TouchableOpacity>
	);
};

export default memo(BalanceHeader);

const styles = StyleSheet.create({
	title: {
		marginBottom: 9,
	},
	container: {
		flex: 1,
		justifyContent: 'flex-start',
		marginTop: 32,
		paddingLeft: 16,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		height: 41,
		marginTop: 5,
	},
	pendingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-start',
	},
	toggle: {
		paddingRight: 16,
	},
});
