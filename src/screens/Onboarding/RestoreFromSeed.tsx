import React, { ReactElement, useState, useRef, useEffect } from 'react';
import {
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { DisplayHaas, Text01S, Text02M } from '../../styles/components';
import GlowingBackground from '../../components/GlowingBackground';
import SafeAreaInsets from '../../components/SafeAreaInsets';
import SeedInput from '../../components/SeedInput';
import SeedInputAccessory from '../../components/SeedInputAccessory';
import VerticalShadow from '../../components/VerticalShadow';
import { validateMnemonic } from '../../utils/wallet';

const RestoreFromSeed = (): ReactElement => {
	const numberOfWords = 12;
	const [seed, setSeed] = useState(Array(numberOfWords).fill(''));
	const [focused, setFocused] = useState(null);
	const [validMnemonic, setValidMnemonic] = useState(false);
	const inputRefs = useRef<Array<TextInput>>([]);

	useEffect(() => {
		setValidMnemonic(validateMnemonic(seed.join(' ')));
	}, [seed]);

	const onSeedChange = (index, text): void => {
		setSeed((items) => {
			items[index] = text;
			return [...items];
		});
	};

	const handleFocus = (index): void => {
		setFocused(index);
	};

	const handleBlur = (): void => {
		setFocused(null);
	};

	return (
		<GlowingBackground topLeft="#FF6600" bottomRight="rgba(0, 133, 255, 0.3)">
			<KeyboardAvoidingView
				style={styles.root}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				keyboardVerticalOffset={0}>
				<ScrollView
					contentContainerStyle={styles.content}
					showsVerticalScrollIndicator={false}
					bounces={false}
					stickyHeaderIndices={[0]}>
					<View style={styles.shadowContainer}>
						<VerticalShadow />
					</View>
					<DisplayHaas>Restore your wallet</DisplayHaas>
					<Text01S>
						Please type in your 12 seed words from any (paper) backup.
					</Text01S>
					<View style={styles.inputsContainer}>
						{seed.map((word, index) => (
							<SeedInput
								key={index}
								ref={(el: TextInput): void => {
									inputRefs.current[index] = el;
								}}
								index={index}
								value={word}
								onChangeText={(text): void => onSeedChange(index, text)}
								onFocus={(): void => handleFocus(index)}
								onBlur={handleBlur}
							/>
						))}
					</View>

					<TouchableOpacity style={styles.button} onPress={(): void => {}}>
						<Text02M
							style={
								validMnemonic
									? styles.buttonEnabledText
									: styles.buttonDisabledText
							}>
							Get started
						</Text02M>
					</TouchableOpacity>
					<SafeAreaInsets type="bottom" />
				</ScrollView>
			</KeyboardAvoidingView>

			<SeedInputAccessory
				word={focused !== null ? seed[focused] : null}
				setWord={(text): void => {
					if (focused === null) {
						return;
					}
					onSeedChange(focused, text);
					if (focused > numberOfWords - 2) {
						// last input
						Keyboard.dismiss();
						return;
					}
					inputRefs.current[focused + 1].focus();
				}}
			/>
		</GlowingBackground>
	);
};

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	shadowContainer: {
		height: 110,
		marginHorizontal: -50,
	},
	content: {
		paddingHorizontal: 48,
	},
	inputsContainer: {
		flexWrap: 'wrap',
		flexDirection: 'row',
		width: '100%',
		justifyContent: 'space-between',
		paddingHorizontal: -2,
		marginVertical: 38,
	},
	button: {
		flex: 1,
		backgroundColor: 'rgba(255, 255, 255, 0.06)',
		display: 'flex',
		justifyContent: 'center',
		alignItems: 'center',
		height: 56,
		borderRadius: 64,
		marginBottom: 30,
	},
	buttonDisabledText: {
		opacity: 0.3,
	},
	buttonEnabledText: {
		opacity: 1,
	},
});

export default RestoreFromSeed;
