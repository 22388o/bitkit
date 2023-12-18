import React, { memo, ReactElement, useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Switch } from '../../../styles/components';
import { Text01S, Text01M } from '../../../styles/text';
import BottomSheetNavigationHeader from '../../../components/BottomSheetNavigationHeader';
import SafeAreaInset from '../../../components/SafeAreaInset';
import GradientView from '../../../components/GradientView';
import GlowImage from '../../../components/GlowImage';
import Button from '../../../components/Button';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { closeSheet } from '../../../store/slices/ui';
import { updateSettings } from '../../../store/slices/settings';
import { pinForPaymentsSelector } from '../../../store/reselect/settings';
import type { PinScreenProps } from '../../../navigation/types';

const imageSrc = require('../../../assets/illustrations/check.png');

const Result = ({ route }: PinScreenProps<'Result'>): ReactElement => {
	const { bio, type } = route.params;
	const { t } = useTranslation('security');
	const dispatch = useAppDispatch();
	const pinForPayments = useAppSelector(pinForPaymentsSelector);

	const biometricsName = useMemo(
		() =>
			type === 'TouchID'
				? t('bio_touch_id')
				: type === 'FaceID'
				? t('bio_face_id')
				: type ?? t('bio'),
		[type, t],
	);

	const handleTogglePress = (): void => {
		dispatch(updateSettings({ pinForPayments: !pinForPayments }));
	};

	const handleButtonPress = (): void => {
		dispatch(closeSheet('PINNavigation'));
	};

	return (
		<GradientView style={styles.container}>
			<BottomSheetNavigationHeader
				title={t('success_title')}
				displayBackButton={false}
			/>

			<View style={styles.message}>
				{bio ? (
					<Text01S color="gray1">
						{t('success_bio', { biometricsName })}
					</Text01S>
				) : (
					<Text01S color="gray1">{t('success_no_bio')}</Text01S>
				)}
			</View>

			<GlowImage image={imageSrc} imageSize={200} glowColor="green" />

			<Pressable
				style={styles.toggle}
				onPress={handleTogglePress}
				testID="ToggleBioForPayments">
				<Text01M>{t('success_payments')}</Text01M>
				<Switch onValueChange={handleTogglePress} value={pinForPayments} />
			</Pressable>

			<View style={styles.buttonContainer}>
				<Button
					size="large"
					text={t('ok')}
					onPress={handleButtonPress}
					testID="OK"
				/>
			</View>
			<SafeAreaInset type="bottom" minPadding={16} />
		</GradientView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	message: {
		marginHorizontal: 32,
		alignSelf: 'flex-start',
	},
	toggle: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 32,
		marginBottom: 32,
	},
	buttonContainer: {
		marginTop: 'auto',
		paddingHorizontal: 32,
	},
});

export default memo(Result);
