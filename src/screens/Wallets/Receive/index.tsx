import React, {
	memo,
	ReactElement,
	useMemo,
	useState,
	useEffect,
	useRef,
	MutableRefObject,
	useCallback,
} from 'react';
import { useSelector } from 'react-redux';
import {
	ActivityIndicator,
	StyleSheet,
	useWindowDimensions,
	View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { FadeIn, FadeOut } from 'react-native-reanimated';
import Clipboard from '@react-native-clipboard/clipboard';
import Share from 'react-native-share';
import Swiper from 'react-native-swiper';

import {
	View as ThemedView,
	AnimatedView,
	TouchableOpacity,
	CopyIcon,
	ShareIcon,
	Text01B,
} from '../../../styles/components';
import Store from '../../../store/types';
import { resetInvoice } from '../../../store/actions/receive';
import { updateMetaIncTxTags } from '../../../store/actions/metadata';
import {
	getReceiveAddress,
	getSelectedAddressType,
} from '../../../utils/wallet';
import { getUnifiedUri } from '../../../utils/receive';
import { refreshLdk } from '../../../utils/lightning';
import BottomSheetNavigationHeader from '../../../components/BottomSheetNavigationHeader';
import Button from '../../../components/Button';
import Tooltip from '../../../components/Tooltip';
import Dot from '../../../components/SliderDots';
import { generateNewReceiveAddress } from '../../../store/actions/wallet';
import { useBottomSheetBackPress } from '../../../hooks/bottomSheet';
import { createLightningInvoice } from '../../../store/actions/lightning';
import { useBalance } from '../../../hooks/wallet';

import BitcoinLogo from '../../../assets/bitcoin-logo-small.svg';
import LightningLogo from '../../../assets/lightning-logo-small.svg';

const QrIcon = ({
	type,
}: {
	type: 'unified' | 'lightning' | 'onchain';
}): ReactElement => {
	return (
		<View style={styles.qrIconContainer}>
			{type === 'unified' && (
				<View style={styles.unifiedIcons}>
					<LightningLogo style={styles.unifiedIconLeft} />
					<BitcoinLogo style={styles.unifiedIconRight} />
				</View>
			)}
			{type === 'lightning' && (
				<View style={styles.qrIcon}>
					<LightningLogo />
				</View>
			)}
			{type === 'onchain' && (
				<View style={styles.qrIcon}>
					<BitcoinLogo />
				</View>
			)}
		</View>
	);
};

// const Slide = ({ data }: { data: string }) => (
// 	<View style={styles.slide}>
// 		<TouchableOpacity
// 			color="white"
// 			activeOpacity={1}
// 			onPress={():void => handleCopy(data)}
// 			onLongPress={handleCopyQrCode}
// 			style={styles.qrCode}>
// 			<QRCode
// 				value={data}
// 				size={qrSize}
// 				getRef={(c): void => {
// 					if (!c || !qrRef) {
// 						return;
// 					}
// 					c.toDataURL(
// 						(data) => ((qrRef as MutableRefObject<object>).current = data),
// 					);
// 				}}
// 			/>
// 			<QrIcon type="unified" />
// 		</TouchableOpacity>
// 		<View style={styles.actions}>
// 			<Button
// 				icon={<CopyIcon width={18} color="brand" />}
// 				text="Copy"
// 				onPress={():void => handleCopy(uri)}
// 			/>
// 			<View style={styles.buttonSpacer} />
// 			<Button
// 				icon={<ShareIcon width={18} color="brand" />}
// 				text="Share"
// 				onPress={handleShare}
// 			/>
// 		</View>
// 	</View>
// );

const Receive = ({ navigation }): ReactElement => {
	const dimensions = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const buttonContainerStyles = useMemo(
		() => ({
			...styles.buttonContainer,
			paddingBottom: insets.bottom + 16,
		}),
		[insets.bottom],
	);

	const { amount, message, tags } = useSelector(
		(store: Store) => store.receive,
	);
	const receiveNavigationIsOpen = useSelector(
		(store: Store) => store.user.viewController.receiveNavigation.isOpen,
	);
	const selectedWallet = useSelector(
		(store: Store) => store.wallet.selectedWallet,
	);
	const selectedNetwork = useSelector(
		(store: Store) => store.wallet.selectedNetwork,
	);
	const addressType = useMemo(
		(): string =>
			getSelectedAddressType({
				selectedWallet,
				selectedNetwork,
			}),
		[selectedNetwork, selectedWallet],
	);

	const swiperRef = useRef<Swiper>(null);
	const [loading, setLoading] = useState(true);
	const [showCopy, setShowCopy] = useState(false);
	const [receiveAddress, setReceiveAddress] = useState('');
	const [lightningInvoice, setLightningInvoice] = useState('');
	const lightningBalance = useBalance({ lightning: true });
	const qrRef = useRef<object>(null);

	useBottomSheetBackPress('receiveNavigation');

	const getLightningInvoice = useCallback(async (): Promise<void> => {
		if (!receiveNavigationIsOpen || lightningBalance.satoshis === 0) {
			return;
		}
		const response = await createLightningInvoice({
			amountSats: amount,
			description: message,
			expiryDeltaSeconds: 180,
			selectedNetwork,
			selectedWallet,
		});

		if (response.isErr()) {
			console.log(response.error.message);
			return;
		}

		console.info(`lightning invoice: ${response.value.to_str}`);
		setLightningInvoice(response.value.to_str);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [amount, message]);

	const getAddress = useCallback(async (): Promise<void> => {
		if (!receiveNavigationIsOpen) {
			return;
		}
		if (amount > 0) {
			console.info('getting fresh address');
			const response = await generateNewReceiveAddress({
				selectedNetwork,
				selectedWallet,
				addressType,
			});
			if (response.isOk()) {
				console.info(`generated fresh address ${response.value.address}`);
				setReceiveAddress(response.value.address);
			}
		} else {
			const response = getReceiveAddress({
				selectedNetwork,
				selectedWallet,
				addressType,
			});
			if (response.isOk()) {
				console.info(`reusing address ${response.value}`);
				setReceiveAddress(response.value);
			}
		}
	}, [
		amount,
		receiveNavigationIsOpen,
		selectedNetwork,
		selectedWallet,
		addressType,
	]);

	const setInvoiceDetails = useCallback(async (): Promise<void> => {
		if (!loading) {
			setLoading(true);
		}
		await Promise.all([getLightningInvoice(), getAddress()]);
		setLoading(false);
	}, [getAddress, getLightningInvoice, loading]);

	useEffect(() => {
		resetInvoice();
		if (receiveNavigationIsOpen) {
			refreshLdk({ selectedWallet, selectedNetwork }).then();
		}
	}, [selectedNetwork, selectedWallet, receiveNavigationIsOpen]);

	useEffect(() => {
		setInvoiceDetails().then();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [amount, message, selectedNetwork, selectedWallet]);

	useEffect(() => {
		if (tags.length !== 0 && receiveAddress) {
			updateMetaIncTxTags(receiveAddress, lightningInvoice, tags);
		}
	}, [receiveAddress, lightningInvoice, tags]);

	const uri = useMemo((): string => {
		return getUnifiedUri({
			address: receiveAddress,
			amount,
			label: message,
			message,
			lightning: lightningInvoice,
		});
	}, [amount, lightningInvoice, message, receiveAddress]);

	const handleCopy = (text: string): void => {
		setShowCopy(() => true);
		setTimeout(() => setShowCopy(() => false), 1200);
		Clipboard.setString(text);
	};

	const handleCopyQrCode = (): void => {
		console.log('TODO: copy QR code');
	};

	const handleShare = (): void => {
		const url = `data:image/png;base64,${qrRef.current}`;

		try {
			Share.open({
				title: 'Share receiving address',
				message: uri,
				url,
				type: 'image/png',
			});
		} catch (e) {
			console.log(e);
		}
	};

	const qrMaxHeight = useMemo(
		() => dimensions.height / 2.5,
		[dimensions?.height],
	);
	const qrMaxWidth = useMemo(
		() => dimensions.width - 16 * 4,
		[dimensions?.width],
	);
	const qrSize = useMemo(
		() => Math.min(qrMaxWidth, qrMaxHeight),
		[qrMaxHeight, qrMaxWidth],
	);

	console.log('uri', uri);
	console.log('lightningInvoice', lightningInvoice);
	console.log('receiveAddress', receiveAddress);

	const slides = useMemo(
		() => [
			{
				slide: (): ReactElement => (
					<View style={styles.slide}>
						<TouchableOpacity
							color="white"
							activeOpacity={1}
							onPress={(): void => handleCopy(uri)}
							onLongPress={handleCopyQrCode}
							style={styles.qrCode}>
							<QRCode
								value={uri}
								size={qrSize}
								getRef={(c): void => {
									if (!c || !qrRef) {
										return;
									}
									c.toDataURL(
										(data) =>
											((qrRef as MutableRefObject<object>).current = data),
									);
								}}
							/>
							<QrIcon type="unified" />
						</TouchableOpacity>
						<View style={styles.actions}>
							<Button
								icon={<CopyIcon width={18} color="brand" />}
								text="Copy"
								onPress={(): void => handleCopy(uri)}
							/>
							<View style={styles.buttonSpacer} />
							<Button
								icon={<ShareIcon width={18} color="brand" />}
								text="Share"
								onPress={handleShare}
							/>
						</View>
					</View>
				),
			},
			{
				slide: (): ReactElement => (
					<View style={styles.slide}>
						{!lightningInvoice ? (
							<>
								<ThemedView
									// color="white"
									style={[
										styles.qrCode,
										styles.emptyQr,
										{ width: qrSize + 16 * 2, height: qrSize + 16 * 2 },
									]}>
									{/* <QRCode value="ln" size={qrSize} /> */}
									<View style={styles.emptyContent}>
										<View style={styles.emptyIcon}>
											<LightningLogo />
										</View>
										<Text01B style={styles.emptyText}>
											Lightning not enabled
										</Text01B>
									</View>
								</ThemedView>
								<View style={styles.actions}>
									<Button
										icon={<CopyIcon width={18} color="brand" />}
										text="Copy"
										disabled
									/>
									<View style={styles.buttonSpacer} />
									<Button
										icon={<ShareIcon width={18} color="brand" />}
										text="Share"
										disabled
									/>
								</View>
							</>
						) : (
							<>
								<TouchableOpacity
									color="white"
									activeOpacity={1}
									onPress={(): void => handleCopy(lightningInvoice)}
									onLongPress={handleCopyQrCode}
									style={styles.qrCode}>
									<QRCode
										value={lightningInvoice || 'a'}
										size={qrSize}
										getRef={(c): void => {
											if (!c || !qrRef) {
												return;
											}
											c.toDataURL(
												(data) =>
													((qrRef as MutableRefObject<object>).current = data),
											);
										}}
									/>
									<QrIcon type="lightning" />
								</TouchableOpacity>
								<View style={styles.actions}>
									<Button
										icon={<CopyIcon width={18} color="brand" />}
										text="Copy"
										onPress={(): void => handleCopy(lightningInvoice)}
									/>
									<View style={styles.buttonSpacer} />
									<Button
										icon={<ShareIcon width={18} color="brand" />}
										text="Share"
										onPress={handleShare}
									/>
								</View>
							</>
						)}
					</View>
				),
			},
			{
				slide: (): ReactElement => (
					<View style={styles.slide}>
						<TouchableOpacity
							color="white"
							activeOpacity={1}
							onPress={(): void => handleCopy(receiveAddress)}
							onLongPress={handleCopyQrCode}
							style={styles.qrCode}>
							<QRCode
								value={receiveAddress || 'b'}
								size={qrSize}
								getRef={(c): void => {
									if (!c || !qrRef) {
										return;
									}
									c.toDataURL(
										(data) =>
											((qrRef as MutableRefObject<object>).current = data),
									);
								}}
							/>
							<QrIcon type="onchain" />
						</TouchableOpacity>
						<View style={styles.actions}>
							<Button
								icon={<CopyIcon width={18} color="brand" />}
								text="Copy"
								onPress={(): void => handleCopy(receiveAddress)}
							/>
							<View style={styles.buttonSpacer} />
							<Button
								icon={<ShareIcon width={18} color="brand" />}
								text="Share"
								onPress={handleShare}
							/>
						</View>
					</View>
				),
			},
		],
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[uri, lightningInvoice, receiveAddress],
	);

	return (
		<View style={styles.container}>
			<BottomSheetNavigationHeader
				title="Receive Bitcoin"
				displayBackButton={false}
			/>
			<View style={styles.qrCodeContainer}>
				{loading && (
					<View style={[styles.loading, { height: qrSize, width: qrSize }]}>
						<ActivityIndicator color="white" />
					</View>
				)}

				{!loading && (
					<Swiper
						ref={swiperRef}
						paginationStyle={styles.dots}
						dot={<Dot />}
						activeDot={<Dot active />}
						// index={index}
						// onIndexChanged={onScroll}
						loop={false}>
						{slides.map(({ slide: Slide }, i) => (
							<Slide key={i} />
						))}
					</Swiper>
				)}

				{showCopy && (
					<AnimatedView
						entering={FadeIn.duration(500)}
						exiting={FadeOut.duration(500)}
						color="transparent"
						style={styles.tooltip}>
						<Tooltip text="Invoice Copied To Clipboard" />
					</AnimatedView>
				)}
			</View>
			<View style={buttonContainerStyles}>
				<Button
					size="large"
					text="Specify Invoice"
					onPress={(): void => navigation.navigate('ReceiveDetails')}
				/>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	slide: {
		flex: 1,
		paddingHorizontal: 16,
		alignItems: 'center',
	},
	qrCodeContainer: {
		flex: 1,
		alignItems: 'center',
		marginBottom: 32,
	},
	qrCode: {
		borderRadius: 10,
		padding: 16,
		position: 'relative',
		justifyContent: 'center',
		alignItems: 'center',
	},
	qrIconContainer: {
		...StyleSheet.absoluteFillObject,
		justifyContent: 'center',
		alignItems: 'center',
	},
	qrIcon: {
		backgroundColor: 'white',
		borderRadius: 50,
		padding: 9,
	},
	unifiedIcons: {
		flexDirection: 'row',
		backgroundColor: 'white',
		borderRadius: 50,
		paddingVertical: 9,
		padding: 3,
	},
	unifiedIconLeft: {
		position: 'relative',
		left: 6,
	},
	unifiedIconRight: {
		position: 'relative',
		right: 6,
	},
	emptyQr: {
		backgroundColor: 'rgba(255, 255, 255, 0.16)',
		borderColor: 'rgba(255, 255, 255, 0.34)',
		borderWidth: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	emptyContent: {
		...StyleSheet.absoluteFillObject,
		justifyContent: 'center',
		alignItems: 'center',
	},
	emptyIcon: {
		backgroundColor: 'rgba(255, 255, 255, 0.34)',
		borderRadius: 50,
		padding: 9,
	},
	emptyText: {
		marginTop: 12,
	},
	actions: {
		marginTop: 24,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
	dots: {
		// position: 'relative',
		// bottom: 34,
	},
	tooltip: {
		position: 'absolute',
		top: '50%',
	},
	buttonSpacer: {
		width: 16,
	},
	buttonContainer: {
		paddingHorizontal: 16,
		marginTop: 'auto',
	},
	loading: {
		justifyContent: 'center',
		alignItems: 'center',
	},
});

export default memo(Receive);
