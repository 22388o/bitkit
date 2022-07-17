import React, { memo, ReactElement, useMemo } from 'react';
import { IListData } from '../../../components/List';
import SettingsView from '../SettingsView';

const AdvancedSettings = ({ navigation }): ReactElement => {
	const SettingsListData: IListData[] = useMemo(
		() => [
			{
				data: [
					{
						title: 'Coin selection',
						type: 'button',
						onPress: (): void => navigation.navigate('CoinSelectPreference'),
						hide: false,
					},
					{
						title: 'Payment preference',
						type: 'button',
						onPress: (): void => {},
						hide: false,
					},
					{
						title: 'Address types preference',
						type: 'button',
						onPress: (): void => navigation.navigate('AddressTypePreference'),
						hide: false,
					},
					{
						title: 'Dev settings',
						type: 'button',
						onPress: (): void => navigation.navigate('DevSettings'),
						hide: false,
					},
				],
			},
		],
		[navigation],
	);

	return (
		<SettingsView
			title={'Advanced'}
			listData={SettingsListData}
			showBackNavigation={true}
		/>
	);
};

export default memo(AdvancedSettings);