import React, { memo, ReactElement, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { __DISABLE_SLASHTAGS__ } from '../../../constants/env';
import actions from '../../../store/actions/actions';
import {
	clearUtxos,
	injectFakeTransaction,
	resetSelectedWallet,
	resetWalletStore,
	updateWallet,
} from '../../../store/actions/wallet';
import { resetUserStore } from '../../../store/actions/user';
import { resetActivityStore } from '../../../store/actions/activity';
import { resetLightningStore } from '../../../store/actions/lightning';
import { resetBlocktankStore } from '../../../store/actions/blocktank';
import { resetSlashtagsStore } from '../../../store/actions/slashtags';
import { resetWidgetsStore } from '../../../store/actions/widgets';
import { resetFeesStore } from '../../../store/actions/fees';
import { resetTodos } from '../../../store/actions/todos';
import { resetUiStore } from '../../../store/actions/ui';
import { resetSettingsStore, wipeApp } from '../../../store/actions/settings';
import {
	addressTypeSelector,
	selectedNetworkSelector,
	selectedWalletSelector,
} from '../../../store/reselect/wallet';
import { resetMetaStore } from '../../../store/actions/metadata';
import { EItemType, IListData } from '../../../components/List';
import SettingsView from './../SettingsView';
import type { SettingsScreenProps } from '../../../navigation/types';
import { getWalletStore } from '../../../store/helpers';
import { runChecks } from '../../../utils/wallet/checks';
import { warningsSelector } from '../../../store/reselect/checks';
import { getFakeTransaction } from '../../../utils/wallet/testing';
import { refreshWallet } from '../../../utils/wallet';

const DevSettings = ({
	navigation,
}: SettingsScreenProps<'DevSettings'>): ReactElement => {
	const dispatch = useDispatch();
	const [throwError, setThrowError] = useState(false);
	const selectedWallet = useSelector(selectedWalletSelector);
	const selectedNetwork = useSelector(selectedNetworkSelector);
	const addressType = useSelector(addressTypeSelector);
	const warnings = useSelector((state) =>
		warningsSelector(state, selectedWallet, selectedNetwork),
	);

	const settingsListData: IListData[] = [
		{
			title: 'Slashtags',
			data: [
				{
					title: 'Slashtags Settings',
					type: EItemType.button,
					enabled: !__DISABLE_SLASHTAGS__,
					testID: 'SlashtagsSettings',
					onPress: (): void => {
						navigation.navigate('SlashtagsSettings');
					},
				},
			],
		},
		{
			title: 'Debug',
			data: [
				{
					title: 'Trigger exception in React render',
					type: EItemType.button,
					testID: 'TriggerRenderError',
					onPress: (): void => {
						setThrowError(true);
					},
				},
				{
					title: 'Trigger exception in action handler',
					type: EItemType.button,
					testID: 'TriggerActionError',
					onPress: (): void => {
						throw new Error('test action error');
					},
				},
				{
					title: 'Trigger unhandled async exception',
					type: EItemType.button,
					testID: 'TriggerAsyncError',
					onPress: async (): Promise<void> => {
						throw new Error('test async error');
					},
				},
				{
					title: 'Inject Fake Transaction',
					type: EItemType.button,
					testID: 'InjectFakeTransaction',
					onPress: async (): Promise<void> => {
						const id =
							'9c0bed5b4c0833824210d29c3c847f47132c03f231ef8df228862132b3a8d80a';
						const fakeTx = getFakeTransaction(id);
						fakeTx[id].height = 0;
						await injectFakeTransaction({
							selectedWallet,
							selectedNetwork,
							fakeTx,
						});
						refreshWallet({ selectedWallet, selectedNetwork }).then();
					},
				},
			],
		},
		{
			title: 'Wallet Checks',
			data: [
				{
					title: `Warnings: ${warnings.length}`,
					type: EItemType.textButton,
					value: '',
					testID: 'Warnings',
				},
			],
		},
		{
			title: 'App Cache',
			data: [
				{
					title: 'Reset Current Wallet Store',
					type: EItemType.button,
					onPress: async (): Promise<void> => {
						await resetSelectedWallet({ selectedWallet });
					},
				},
				{
					title: 'Reset Entire Wallet Store',
					type: EItemType.button,
					onPress: resetWalletStore,
				},
				{
					title: "Clear UTXO's",
					type: EItemType.button,
					onPress: clearUtxos,
				},
				{
					title: 'Reset Lightning Store',
					type: EItemType.button,
					onPress: resetLightningStore,
				},
				{
					title: 'Reset Metadata Store',
					type: EItemType.button,
					onPress: resetMetaStore,
				},
				{
					title: 'Reset Fees Store',
					type: EItemType.button,
					onPress: resetFeesStore,
				},
				{
					title: 'Reset Settings Store',
					type: EItemType.button,
					onPress: resetSettingsStore,
				},
				{
					title: 'Reset Activity Store',
					type: EItemType.button,
					onPress: resetActivityStore,
				},
				{
					title: 'Reset User Store',
					type: EItemType.button,
					onPress: resetUserStore,
				},
				{
					title: 'Reset Blocktank Store',
					type: EItemType.button,
					onPress: resetBlocktankStore,
				},
				{
					title: 'Reset Slashtags Store',
					type: EItemType.button,
					onPress: resetSlashtagsStore,
				},
				{
					title: 'Reset Todos Store',
					type: EItemType.button,
					onPress: resetTodos,
				},
				{
					title: 'Reset UI Store',
					type: EItemType.button,
					onPress: resetUiStore,
				},
				{
					title: 'Reset Widgets Store',
					type: EItemType.button,
					onPress: resetWidgetsStore,
				},
				{
					title: 'Reset All Stores',
					type: EItemType.button,
					onPress: (): void => {
						dispatch({ type: actions.WIPE_APP });
					},
				},
				{
					title: 'Wipe App',
					type: EItemType.button,
					onPress: wipeApp,
				},
			],
		},
	];

	if (selectedNetwork === 'bitcoinRegtest') {
		settingsListData[3].data.push({
			title: 'Trigger Storage Warning',
			type: EItemType.button,
			testID: 'TriggerStorageWarning',
			onPress: async (): Promise<void> => {
				const wallet = getWalletStore();
				const addresses =
					wallet.wallets[selectedWallet].addresses[selectedNetwork][
						addressType
					];
				Object.keys(addresses).map((key) => {
					if (addresses[key].index === 0) {
						addresses[key].address =
							'bcrt1qjp22nm804mtl6vtzf65z2jgmeaedrlvzlxffjv';
					}
				});
				const changeAddresses =
					wallet.wallets[selectedWallet].changeAddresses[selectedNetwork][
						addressType
					];
				Object.keys(changeAddresses).map((key) => {
					if (changeAddresses[key].index === 0) {
						changeAddresses[key].address =
							'bcrt1qwxfllzxchc9eq95zrcc9cjxhzqpkgtznc4wpzc';
					}
				});
				updateWallet(wallet);
				runChecks({ selectedWallet, selectedNetwork }).then();
			},
		});
	}

	if (throwError) {
		throw new Error('test render error');
	}

	return (
		<SettingsView
			title="Dev Settings"
			listData={settingsListData}
			showBackNavigation={true}
		/>
	);
};

export default memo(DevSettings);
