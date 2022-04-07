import { INetwork, TAvailableNetworks } from '../networks';
import { networks } from '../networks';
import {
	assetNetworks,
	defaultKeyDerivationPath,
	defaultWalletShape,
} from '../../store/shapes/wallet';
import {
	EWallet,
	IAddress,
	IAddressContent,
	ICreateWallet,
	IDefaultWallet,
	IDefaultWalletShape,
	IFormattedTransaction,
	IKeyDerivationPath,
	IOnChainTransactionData,
	IOutput,
	IUtxo,
	TAddressType,
	TKeyDerivationAccount,
	TKeyDerivationAccountType,
	TKeyDerivationPurpose,
	IAddressType,
	IKeyDerivationPathData,
	ETransactionDefaults,
	IFormattedTransactionContent,
	TAssetNetwork,
} from '../../store/types/wallet';
import { err, ok, Result } from '../result';
import {
	IResponse,
	IGetAddress,
	IGenerateAddresses,
	IGetInfoFromAddressPath,
	IGenerateAddressesResponse,
} from '../types';
import {
	getKeychainValue,
	btcToSats,
	isOnline,
	setKeychainValue,
} from '../helpers';
import { getStore } from '../../store/helpers';
import {
	addAddresses,
	deleteBoostedTransaction,
	deleteOnChainTransactionById,
	updateAddressIndexes,
	updateExchangeRates,
	updateTransactions,
	updateUtxos,
} from '../../store/actions/wallet';
import {
	ICustomElectrumPeer,
	TCoinSelectPreference,
} from '../../store/types/settings';
import { updateOnChainActivityList } from '../../store/actions/activity';
import {
	getByteCount,
	getTotalFee,
	getTransactionOutputValue,
} from './transactions';
import { AddressInfo, getAddressInfo } from 'bitcoin-address-validation';
import {
	getAddressHistory,
	getTransactions,
	getTransactionsFromInputs,
	IGetAddressHistoryResponse,
	subscribeToAddresses,
	subscribeToHeader,
	TTxResult,
} from './electrum';
import { getDisplayValues, IDisplayValues } from '../exchange-rate';
import { IncludeBalances } from '../../hooks/wallet';
import { CipherSeed } from 'aezeed';
import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import { ENodeJsMethods, invokeNodeJsMethod } from '../nodejs-mobile';
import { DefaultNodeJsMethodsShape } from '../nodejs-mobile/shapes';

export const refreshWallet = async (): Promise<Result<string>> => {
	try {
		const { selectedWallet, selectedNetwork } = getCurrentWallet({});
		await updateAddressIndexes({ selectedWallet, selectedNetwork });
		await Promise.all([
			subscribeToHeader({ selectedNetwork }),
			subscribeToAddresses({
				selectedWallet,
				selectedNetwork,
			}),
			updateExchangeRates(),
			updateUtxos({
				selectedWallet,
				selectedNetwork,
			}),
			updateTransactions({
				selectedWallet,
				selectedNetwork,
			}),
			deleteBoostedTransactions({
				selectedWallet,
				selectedNetwork,
			}),
		]);

		await updateOnChainActivityList();

		return ok('');
	} catch (e) {
		return err(e);
	}
};

/**
 * Iterates over the boosted transactions array and removes all matching txid's from the transactions object.
 * @param {string} [selectedWallet]
 * @param {TAvailableNetworks} [selectedNetwork]
 * @return {Promise<string[]>}
 */
export const deleteBoostedTransactions = async ({
	selectedWallet,
	selectedNetwork,
}: {
	selectedWallet?: string;
	selectedNetwork?: TAvailableNetworks;
}): Promise<string[]> => {
	try {
		if (!selectedNetwork) {
			selectedNetwork = getSelectedNetwork();
		}
		if (!selectedWallet) {
			selectedWallet = getSelectedWallet();
		}
		const wallet = getStore().wallet.wallets[selectedWallet];
		const boostedTransactions = wallet.boostedTransactions[selectedNetwork];
		const transactionIds = Object.keys(wallet.transactions[selectedNetwork]);
		let deletedTransactions: string[] = [];
		await Promise.all(
			boostedTransactions.map((boostedTx) => {
				if (transactionIds.includes(boostedTx)) {
					deletedTransactions.push(boostedTx);
					deleteBoostedTransaction({
						txid: boostedTx,
						selectedNetwork,
						selectedWallet,
					});
					deleteOnChainTransactionById({
						txid: boostedTx,
						selectedNetwork,
						selectedWallet,
					});
				}
			}),
		);
		return deletedTransactions;
	} catch (e) {
		return e;
	}
};

/**
 * Generates a series of addresses based on the specified params.
 * @async
 * @param {string} selectedWallet - Wallet ID
 * @param {number} [addressAmount] - Number of addresses to generate.
 * @param {number} [changeAddressAmount] - Number of changeAddresses to generate.
 * @param {number} [addressIndex] - What index to start generating addresses at.
 * @param {number} [changeAddressIndex] - What index to start generating changeAddresses at.
 * @param {string} [selectedNetwork] - What network to generate addresses for (bitcoin or bitcoinTestnet).
 * @param {string} [keyDerivationPath] - The path to generate addresses from.
 * @param [TKeyDerivationAccountType] - Specifies which account to generate an address from (onchain, rgb, omnibolt).
 * @param {string} [addressType] - Determines what type of address to generate (p2pkh, p2sh, p2wpkh).
 */
export const generateAddresses = async ({
	selectedWallet = undefined,
	addressAmount = 1,
	changeAddressAmount = 1,
	addressIndex = 0,
	changeAddressIndex = 0,
	selectedNetwork,
	keyDerivationPath = { ...defaultKeyDerivationPath },
	accountType = 'onchain',
	addressType,
}: IGenerateAddresses): Promise<Result<IGenerateAddressesResponse>> => {
	try {
		if (!selectedWallet) {
			selectedWallet = getSelectedWallet();
		}
		if (!selectedNetwork) {
			selectedNetwork = getSelectedNetwork();
		}
		if (!addressType) {
			addressType = getSelectedAddressType({ selectedNetwork, selectedWallet });
		}
		const addressTypes = getAddressTypes();
		const { type } = addressTypes[addressType];
		const network = networks[selectedNetwork];

		const generateAddressData = async (
			_addressIndex = 0,
			_addressAmount = 0,
			changeAddress = false,
		): Promise<Result<IAddress>> => {
			let addresses: IAddress = {};
			for (let i = 0; i < _addressAmount; i++) {
				try {
					const index = i + _addressIndex;
					let path = { ...keyDerivationPath };
					path.addressIndex = `${index}`;
					const addressPath = formatKeyDerivationPath({
						path,
						selectedNetwork,
						accountType,
						changeAddress,
						addressIndex: `${index}`,
					});
					if (addressPath.isErr()) {
						return err(addressPath.error.message);
					}
					const addressInfo = await getAddress({
						path: addressPath.value.pathString,
						type,
						selectedNetwork,
					});
					if (addressInfo.isErr()) {
						return err(addressInfo.error.message);
					}
					const { address } = addressInfo.value;
					const scriptHash = await getScriptHash(address, network);
					addresses[scriptHash] = {
						index,
						scriptHash,
						...addressInfo.value,
					};
				} catch {}
			}
			return ok(addresses);
		};

		const [addresses, changeAddresses] = await Promise.all([
			generateAddressData(addressIndex, addressAmount, false),
			generateAddressData(changeAddressIndex, changeAddressAmount, true),
		]);

		if (addresses.isErr()) {
			return err(addresses.error.message);
		}
		if (changeAddresses.isErr()) {
			return err(changeAddresses.error.message);
		}
		return ok({
			addresses: addresses.value,
			changeAddresses: changeAddresses.value,
		});
	} catch (e) {
		return err(e);
	}
};

/**
 * Returns private key for the provided address data.
 * @param {IAddressContent} addressData
 * @param {string} [selectedWallet]
 * @param {TAvailableNetworks} [selectedNetwork]
 * @return {Promise<Result<string>>}
 */
export const getPrivateKey = async ({
	addressData,
	selectedWallet = undefined,
	selectedNetwork = undefined,
}: {
	addressData: IAddressContent;
	selectedWallet?: string | undefined;
	selectedNetwork?: TAvailableNetworks | undefined;
}): Promise<Result<string>> => {
	try {
		if (!addressData) {
			return err('No addressContent specified.');
		}
		if (!selectedNetwork) {
			selectedNetwork = getSelectedNetwork();
		}
		if (!selectedWallet) {
			selectedWallet = getSelectedWallet();
		}
		const network = networks[selectedNetwork];
		const getMnemonicPhraseResponse = await getMnemonicPhrase(selectedWallet);
		if (getMnemonicPhraseResponse.isErr()) {
			return err(getMnemonicPhraseResponse.error.message);
		}

		//Attempt to acquire the bip39Passphrase if available
		const bip39Passphrase = await getBip39Passphrase(selectedWallet);

		const mnemonic = getMnemonicPhraseResponse.value;
		const seed = await bip39.mnemonicToSeed(mnemonic, bip39Passphrase);
		const root = bip32.fromSeed(seed, network);

		const addressPath = addressData.path;
		const addressKeypair = root.derivePath(addressPath);
		return ok(addressKeypair.toWIF());
	} catch (e) {
		return err(e);
	}
};

export const keyDerivationAccountTypes: {
	onchain: TKeyDerivationAccount;
	omnibolt: TKeyDerivationAccount;
} = {
	onchain: '0',
	omnibolt: '2',
};

/**
 * Returns the account param of the key derivation path based on the specified account type.
 * @param {TKeyDerivationAccountType} [accountType]
 * @return {TKeyDerivationAccount}
 */
export const getKeyDerivationAccount = (
	accountType: TKeyDerivationAccountType = 'onchain',
): TKeyDerivationAccount => {
	return keyDerivationAccountTypes[accountType];
};
/**
 * Formats and returns the provided derivation path string and object.
 * @param {IKeyDerivationPath} path
 * @param {TKeyDerivationPurpose | undefined} purpose
 * @param {boolean} [changeAddress]
 * @param {TKeyDerivationAccountType} [accountType]
 * @param {string} [addressIndex]
 * @param {TAvailableNetworks} [selectedNetwork]
 * @return {Result<{IKeyDerivationPathData}>} Derivation Path Data
 */
export const formatKeyDerivationPath = ({
	path,
	purpose,
	selectedNetwork,
	accountType = 'onchain',
	changeAddress = false,
	addressIndex = '0',
}: {
	path: IKeyDerivationPath | string;
	purpose?: TKeyDerivationPurpose | string | undefined;
	selectedNetwork?: TAvailableNetworks | undefined;
	accountType?: TKeyDerivationAccountType;
	changeAddress?: boolean;
	addressIndex?: string | undefined;
}): Result<IKeyDerivationPathData> => {
	try {
		if (!selectedNetwork) {
			selectedNetwork = getSelectedNetwork();
		}

		if (typeof path === 'string') {
			const derivationPathResponse = getKeyDerivationPathObject({
				path,
				purpose,
				selectedNetwork,
				accountType,
				changeAddress,
				addressIndex,
			});
			if (derivationPathResponse.isErr()) {
				return err(derivationPathResponse.error.message);
			}
			path = derivationPathResponse.value;
		}
		const pathObject = path;

		const pathStringResponse = getKeyDerivationPathString({
			path: pathObject,
			purpose,
			selectedNetwork,
			accountType,
			changeAddress,
			addressIndex,
		});
		if (pathStringResponse.isErr()) {
			return err(pathStringResponse.error.message);
		}
		const pathString = pathStringResponse.value;
		return ok({ pathObject, pathString });
	} catch (e) {
		return err(e);
	}
};

/**
 * Returns the preferred derivation path for the specified wallet and network.
 * @param {string} selectedWallet
 * @param {TAvailableNetworks} selectedNetwork
 * @return {string}
 */
export const getKeyDerivationPath = ({
	selectedWallet,
	selectedNetwork,
}: {
	selectedWallet?: string | undefined;
	selectedNetwork?: TAvailableNetworks | undefined;
}): IKeyDerivationPath => {
	try {
		if (!selectedWallet) {
			selectedWallet = getSelectedWallet();
		}
		if (!selectedNetwork) {
			selectedNetwork = getSelectedNetwork();
		}
		const addressTypes = getAddressTypes();
		const addressType =
			getStore().wallet.wallets[selectedWallet].addressType[selectedNetwork];
		const path = formatKeyDerivationPath({
			path: addressTypes[addressType].path,
			selectedNetwork,
		});
		if (path.isErr()) {
			return { ...defaultKeyDerivationPath };
		}
		return path.value.pathObject;
	} catch (e) {
		return e;
	}
};

/**
 * Get onchain mnemonic phrase for a given wallet from storage.
 * @async
 * @param {string} [selectedWallet]
 * @return {Promise<Result<string>>}
 */
export const getMnemonicPhrase = async (
	selectedWallet?: string,
): Promise<Result<string>> => {
	try {
		if (!selectedWallet) {
			selectedWallet = getSelectedWallet();
		}
		const response = await getKeychainValue({ key: selectedWallet });
		if (response.error) {
			return err(response.data);
		}
		return ok(response.data);
	} catch (e) {
		return err(e);
	}
};

/**
 * Generate a mnemonic phrase using a string as entropy.
 * @param {string} str
 * @return {string}
 */
export const getMnemonicPhraseFromEntropy = async (
	str: string,
): Promise<string> => {
	const data = DefaultNodeJsMethodsShape.getMnemonicPhraseFromEntropy();
	data.data.entropy = str;
	const response = await invokeNodeJsMethod(data);
	return response.value;
};

/**
 *.Returns any previously stored aezeed passphrase.
 * @async
 * @return {{error: boolean, data: string}}
 */
export const getAezeedPassphrase = async (): Promise<IResponse<string>> => {
	try {
		return await getKeychainValue({
			key: 'aezeedPassphrase',
		});
	} catch (e) {
		return { error: true, data: e };
	}
};

/**
 * Generate a mnemonic phrase.
 * @async
 * @param {number} strength
 * @return {Promise<string>}
 */
export const generateMnemonic = async (strength = 256): Promise<string> => {
	try {
		const data = DefaultNodeJsMethodsShape.generateMnemonic();
		data.data.strength = strength;
		const generateMnemonicResponse = await invokeNodeJsMethod<string>(data);
		return generateMnemonicResponse.value;
	} catch (e) {
		return '';
	}
};

/**
 * Get bip39 passphrase for a specified wallet.
 * @async
 * @param {string} wallet
 * @return {Promise<string>}
 */
export const getBip39Passphrase = async (wallet = ''): Promise<string> => {
	try {
		const key = `${wallet}passphrase`;
		const bip39PassphraseResult = await getKeychainValue({ key });
		if (!bip39PassphraseResult.error && bip39PassphraseResult.data) {
			return bip39PassphraseResult.data;
		}
		return '';
	} catch {
		return '';
	}
};

/**
 * Get scriptHash for a given address
 * @param {string} address
 * @param {string|Object} network
 * @return {string}
 */
export const getScriptHash = async (
	address: string = '',
	network: INetwork | TAvailableNetworks,
): Promise<string> => {
	try {
		if (!address || !network) {
			return '';
		}
		let selectedNetwork: TAvailableNetworks = 'bitcoin';
		if (network && typeof network !== 'string') {
			selectedNetwork = network?.bech32 === 'bc' ? 'bitcoin' : 'bitcoinTestnet';
		}
		if (typeof network === 'string' && network in networks) {
			selectedNetwork = network;
		}
		const data = DefaultNodeJsMethodsShape.getScriptHash();
		data.data.address = address;
		data.data.selectedNetwork = selectedNetwork;
		const getScriptHashResponse = await invokeNodeJsMethod<string>(data);
		if (getScriptHashResponse.error) {
			return '';
		}
		return getScriptHashResponse.value;
	} catch {
		return '';
	}
};

export interface IGetAddressResponse {
	address: string;
	path: string;
	publicKey: string;
	privKey: string;
}
/**
 * Get address for a given keyPair, network and type.
 * @param {string} path
 * @param {TAvailableNetworks} [selectedNetwork]
 * @param {string} type - Determines what type of address to generate (p2pkh, p2sh, p2wpkh).
 * @return {string}
 */
export const getAddress = async ({
	path,
	selectedNetwork,
	type = EWallet.addressType,
}: IGetAddress): Promise<Result<IGetAddressResponse>> => {
	if (!path) {
		return err('No path specified');
	}
	if (!selectedNetwork) {
		selectedNetwork = getSelectedNetwork();
	}
	try {
		const data = DefaultNodeJsMethodsShape.getAddress();
		data.data.path = path;
		data.data.type = type;
		data.data.selectedNetwork = selectedNetwork;
		const addressResponse = await invokeNodeJsMethod<IGetAddressResponse>(data);
		return ok(addressResponse.value);
	} catch (e) {
		return err(e);
	}
};

/**
 * Get info from an address path "m/49'/0'/0'/0/1"
 * @param {string} path - The path to derive information from.
 * @return {{error: <boolean>, isChangeAddress: <number>, addressIndex: <number>, data: <string>}}
 */
export const getInfoFromAddressPath = (path = ''): IGetInfoFromAddressPath => {
	try {
		if (path === '') {
			return { error: true, data: 'No path specified' };
		}
		let isChangeAddress = false;
		const lastIndex = path.lastIndexOf('/');
		const addressIndex = Number(path.substr(lastIndex + 1));
		const firstIndex = path.lastIndexOf('/', lastIndex - 1);
		const addressType = path.substr(firstIndex + 1, lastIndex - firstIndex - 1);
		if (Number(addressType) === 1) {
			isChangeAddress = true;
		}
		return { error: false, isChangeAddress, addressIndex };
	} catch (e) {
		console.log(e);
		return { error: true, isChangeAddress: false, addressIndex: 0, data: e };
	}
};

/**
 * Determine if a given mnemonic is valid.
 * @param {string} mnemonic - The mnemonic to validate.
 * @param password
 * @return {boolean}
 */
export const validateMnemonic = (mnemonic = '', password = ''): boolean => {
	try {
		const bip39Response = bip39.validateMnemonic(mnemonic);
		if (bip39Response) {
			return true;
		}
		return !!CipherSeed.fromMnemonic(mnemonic, password);
	} catch {
		return false;
	}
};

/**
 * Get the current Bitcoin balance in sats. (Confirmed+Unconfirmed)
 * @param {string} selectedWallet
 * @param {string} selectedNetwork
 * @return number - Will always return balance in sats.
 */
export const getOnChainBalance = ({
	selectedWallet,
	selectedNetwork,
}: {
	selectedWallet?: string;
	selectedNetwork?: TAvailableNetworks;
}): number => {
	if (!selectedWallet) {
		selectedWallet = getSelectedWallet();
	}
	if (!selectedNetwork) {
		selectedNetwork = getSelectedNetwork();
	}
	return (
		getStore().wallet.wallets[selectedWallet]?.balance[selectedNetwork] ?? 0
	);
};

/**
 *
 * @param {string} asset
 * @return {string}
 */
export const getAssetTicker = (asset = 'bitcoin'): string => {
	try {
		switch (asset) {
			case 'bitcoin':
				return 'BTC';
			case 'bitcoinTestnet':
				return 'BTC';
			default:
				return '';
		}
	} catch {
		return '';
	}
};

/**
 * This method will compare a set of specified addresses to the currently stored addresses and remove any duplicates.
 * @param addresses
 * @param changeAddresses
 * @param selectedWallet
 * @param selectedNetwork
 */
export const removeDuplicateAddresses = async ({
	addresses = {},
	changeAddresses = {},
	selectedWallet = undefined,
	selectedNetwork = undefined,
}: {
	addresses?: IAddress | {};
	changeAddresses?: IAddress | {};
	selectedWallet?: string | undefined;
	selectedNetwork?: TAvailableNetworks;
}): Promise<Result<IGenerateAddressesResponse>> => {
	try {
		if (!selectedWallet) {
			selectedWallet = getSelectedWallet();
		}
		if (!selectedNetwork) {
			selectedNetwork = getSelectedNetwork();
		}
		const { currentWallet } = getCurrentWallet({
			selectedWallet,
			selectedNetwork,
		});
		const currentAddresses = currentWallet.addresses[selectedNetwork];
		const currentChangeAddresses =
			currentWallet.changeAddresses[selectedNetwork];

		//Remove any duplicate addresses.
		await Promise.all([
			Object.keys(currentAddresses).map(async (key) => {
				await Promise.all(
					Object.keys(addresses).map((scriptHash) => {
						if (scriptHash in currentAddresses[key]) {
							delete addresses[scriptHash];
						}
					}),
				);
			}),

			Object.keys(currentChangeAddresses).map(async (key) => {
				await Promise.all(
					Object.keys(changeAddresses).map((scriptHash) => {
						if (scriptHash in currentChangeAddresses[key]) {
							delete changeAddresses[scriptHash];
						}
					}),
				);
			}),
		]);
		return ok({ addresses, changeAddresses });
	} catch (e) {
		return err(e);
	}
};

interface ITxHashes extends TTxResult {
	scriptHash: string;
}
interface IGetNextAvailableAddressResponse {
	addressIndex: IAddressContent;
	changeAddressIndex: IAddressContent;
}
interface IGetNextAvailableAddress {
	selectedWallet?: string | undefined;
	selectedNetwork?: TAvailableNetworks | undefined;
	addressType?: TAddressType;
}
export const getNextAvailableAddress = async ({
	selectedWallet,
	selectedNetwork,
	addressType,
}: IGetNextAvailableAddress): Promise<
	Result<IGetNextAvailableAddressResponse>
> => {
	return new Promise(async (resolve) => {
		const isConnected = await isOnline();
		if (!isConnected) {
			return resolve(err('Offline'));
		}

		try {
			if (!selectedNetwork) {
				selectedNetwork = getSelectedNetwork();
			}
			if (!selectedWallet) {
				selectedWallet = getSelectedWallet();
			}
			const { currentWallet } = getCurrentWallet({
				selectedNetwork,
				selectedWallet,
			});
			if (!addressType) {
				addressType = getSelectedAddressType({
					selectedNetwork,
					selectedWallet,
				});
			}
			if (!addressType) {
				return resolve(err('No address type available.'));
			}
			const addressTypes = getAddressTypes();
			const { path } = addressTypes[addressType];

			let addresses: IAddress | {} =
				currentWallet.addresses[selectedNetwork][addressType];
			let changeAddresses: IAddress | {} =
				currentWallet.changeAddresses[selectedNetwork][addressType];

			if (!selectedNetwork) {
				selectedNetwork = getSelectedNetwork();
			}
			if (!selectedWallet) {
				selectedWallet = getSelectedWallet();
			}

			const result = formatKeyDerivationPath({ path, selectedNetwork });
			if (result.isErr()) {
				return resolve(err(result.error.message));
			}
			const { pathObject: keyDerivationPath } = result.value;

			//How many addresses/changeAddresses are currently stored
			const addressCount = Object.values(addresses).length;
			const changeAddressCount = Object.values(changeAddresses).length;

			//The currently known/stored address index.
			let addressIndex =
				currentWallet.addressIndex[selectedNetwork][addressType];
			let changeAddressIndex =
				currentWallet.changeAddressIndex[selectedNetwork][addressType];
			if (!addressIndex?.address) {
				const generatedAddresses = await generateAddresses({
					selectedWallet,
					selectedNetwork,
					addressAmount: 1,
					changeAddressAmount: 0,
					keyDerivationPath,
					addressType,
				});
				if (generatedAddresses.isErr()) {
					return resolve(err(generatedAddresses.error));
				}
				const key = Object.keys(generatedAddresses.value.addresses)[0];
				addressIndex = generatedAddresses.value.addresses[key];
			}

			if (!changeAddressIndex?.address) {
				const generatedChangeAddresses = await generateAddresses({
					selectedWallet,
					selectedNetwork,
					addressAmount: 0,
					changeAddressAmount: 1,
					keyDerivationPath,
					addressType,
				});
				if (generatedChangeAddresses.isErr()) {
					return resolve(err(generatedChangeAddresses.error));
				}
				const key = Object.keys(
					generatedChangeAddresses.value.changeAddresses,
				)[0];
				changeAddressIndex =
					generatedChangeAddresses.value.changeAddresses[key];
			}

			/*
			 *	Create more addresses if none exist or the highest address index matches the current address count
			 */
			if (addressCount <= 0 || addressIndex.index === addressCount) {
				const newAddresses = await addAddresses({
					addressAmount: 5,
					changeAddressAmount: 0,
					addressIndex: addressIndex.index,
					changeAddressIndex: 0,
					selectedNetwork,
					selectedWallet,
					keyDerivationPath,
					addressType,
				});
				if (!newAddresses.isErr()) {
					addresses = newAddresses.value.addresses;
				}
			}

			/*
			 *	Create more change addresses if none exist or the highest change address index matches the current
			 *	change address count
			 */
			if (
				changeAddressCount <= 0 ||
				changeAddressIndex.index === changeAddressCount
			) {
				const newChangeAddresses = await addAddresses({
					addressAmount: 0,
					changeAddressAmount: 5,
					addressIndex: 0,
					changeAddressIndex: changeAddressIndex.index,
					selectedNetwork,
					selectedWallet,
					keyDerivationPath,
					addressType,
				});
				if (!newChangeAddresses.isErr()) {
					changeAddresses = newChangeAddresses.value.changeAddresses;
				}
			}

			//Store all addresses that are to be searched and used in this method.
			let allAddresses: IAddressContent[] = Object.values(addresses).slice(
				addressIndex.index,
				addressCount,
			);
			let addressesToScan = allAddresses;

			//Store all change addresses that are to be searched and used in this method.
			let allChangeAddresses: IAddressContent[] = Object.values(
				changeAddresses,
			).slice(changeAddressIndex.index, changeAddressCount);
			let changeAddressesToScan = allChangeAddresses;

			//Prep for batch request
			let combinedAddressesToScan = [
				...addressesToScan,
				...changeAddressesToScan,
			];

			let foundLastUsedAddress = false;
			let foundLastUsedChangeAddress = false;
			let addressHasBeenUsed = false;
			let changeAddressHasBeenUsed = false;

			while (!foundLastUsedAddress || !foundLastUsedChangeAddress) {
				//Check if transactions are pending in the mempool.
				const addressHistory = await getAddressHistory({
					scriptHashes: combinedAddressesToScan,
					selectedNetwork,
					selectedWallet,
				});

				if (addressHistory.isErr()) {
					return resolve(ok({ addressIndex, changeAddressIndex }));
				}

				const txHashes: IGetAddressHistoryResponse[] = addressHistory.value;

				const highestUsedIndex = await getHighestUsedIndexFromTxHashes({
					txHashes,
					addresses,
					changeAddresses,
					addressIndex,
					changeAddressIndex,
				});
				if (highestUsedIndex.isErr()) {
					return resolve(err(highestUsedIndex.error));
				}

				addressIndex = highestUsedIndex.value.addressIndex;
				changeAddressIndex = highestUsedIndex.value.changeAddressIndex;
				if (highestUsedIndex.value.foundAddressIndex) {
					addressHasBeenUsed = true;
				}
				if (highestUsedIndex.value.foundChangeAddressIndex) {
					changeAddressHasBeenUsed = true;
				}

				const highestStoredIndex = getHighestStoredAddressIndex({
					selectedNetwork,
					selectedWallet,
					addressType,
				});

				if (highestStoredIndex.isErr()) {
					return resolve(err(highestStoredIndex.error));
				}

				if (
					highestUsedIndex.value.addressIndex.index <
					highestStoredIndex.value.addressIndex.index
				) {
					foundLastUsedAddress = true;
				}

				if (
					highestUsedIndex.value.changeAddressIndex.index <
					highestStoredIndex.value.changeAddressIndex.index
				) {
					foundLastUsedChangeAddress = true;
				}

				if (foundLastUsedAddress && foundLastUsedChangeAddress) {
					//Increase index by one if the current index was found in a txHash or is greater than the previous index.
					let newAddressIndex = addressIndex.index;
					if (
						highestUsedIndex.value.addressIndex.index > addressIndex.index ||
						addressHasBeenUsed
					) {
						newAddressIndex = highestUsedIndex.value.addressIndex.index + 1;
					}

					let newChangeAddressIndex = changeAddressIndex.index;
					if (
						highestUsedIndex.value.changeAddressIndex.index >
							changeAddressIndex.index ||
						changeAddressHasBeenUsed
					) {
						newChangeAddressIndex =
							highestUsedIndex.value.changeAddressIndex.index + 1;
					}

					//Filter for and return the new index.
					const nextAvailableAddress = Object.values(allAddresses).filter(
						({ index }) => index === newAddressIndex,
					);
					const nextAvailableChangeAddress = Object.values(
						allChangeAddresses,
					).filter(({ index }) => index === newChangeAddressIndex);

					return resolve(
						ok({
							addressIndex: nextAvailableAddress[0],
							changeAddressIndex: nextAvailableChangeAddress[0],
						}),
					);
				}
				//Create receiving addresses for the next round
				if (!foundLastUsedAddress) {
					const newAddresses = await addAddresses({
						addressAmount: 5,
						changeAddressAmount: 0,
						addressIndex: highestStoredIndex.value.addressIndex.index,
						changeAddressIndex: 0,
						selectedNetwork,
						selectedWallet,
						keyDerivationPath,
						addressType,
					});
					if (!newAddresses.isErr()) {
						addresses = newAddresses.value.addresses || {};
					}
				}
				//Create change addresses for the next round
				if (!foundLastUsedChangeAddress) {
					const newChangeAddresses = await addAddresses({
						addressAmount: 0,
						changeAddressAmount: 5,
						addressIndex: 0,
						changeAddressIndex:
							highestStoredIndex.value.changeAddressIndex.index,
						selectedNetwork,
						selectedWallet,
						keyDerivationPath,
						addressType,
					});
					if (!newChangeAddresses.isErr()) {
						changeAddresses = newChangeAddresses.value.changeAddresses || {};
					}
				}

				//Store newly created addresses to scan in the next round.
				addressesToScan = Object.values(addresses);
				changeAddressesToScan = Object.values(changeAddresses);
				combinedAddressesToScan = [
					...addressesToScan,
					...changeAddressesToScan,
				];
				//Store the newly created addresses used for this method.
				allAddresses = [...allAddresses, ...addressesToScan];
				allChangeAddresses = [...allChangeAddresses, ...changeAddressesToScan];
			}
		} catch (e) {
			console.log(e);
			return resolve(err(e));
		}
	});
};

interface IIndexes {
	addressIndex: IAddressContent;
	changeAddressIndex: IAddressContent;
	foundAddressIndex: boolean;
	foundChangeAddressIndex: boolean;
}
export const getHighestUsedIndexFromTxHashes = async ({
	txHashes = [],
	addresses = {},
	changeAddresses = {},
	addressIndex,
	changeAddressIndex,
}: {
	txHashes: ITxHashes[];
	addresses: IAddress | {};
	changeAddresses: IAddress | {};
	addressIndex: IAddressContent;
	changeAddressIndex: IAddressContent;
}): Promise<Result<IIndexes>> => {
	try {
		let foundAddressIndex = false;
		let foundChangeAddressIndex = false;
		txHashes = txHashes.flat();
		await Promise.all(
			txHashes.map(({ scriptHash }) => {
				if (
					scriptHash in addresses &&
					addresses[scriptHash].index >= addressIndex.index
				) {
					foundAddressIndex = true;
					addressIndex = addresses[scriptHash];
				} else if (
					scriptHash in changeAddresses &&
					changeAddresses[scriptHash].index >= changeAddressIndex.index
				) {
					foundChangeAddressIndex = true;
					changeAddressIndex = changeAddresses[scriptHash];
				}
			}),
		);
		const data = {
			addressIndex,
			changeAddressIndex,
			foundAddressIndex,
			foundChangeAddressIndex,
		};
		return ok(data);
	} catch (e) {
		return err(e);
	}
};

/**
 * Returns the highest address and change address index stored in the app for the specified wallet and network.
 */
export const getHighestStoredAddressIndex = ({
	selectedWallet = EWallet.defaultWallet,
	selectedNetwork = EWallet.selectedNetwork,
	addressType,
}: {
	selectedWallet: string;
	selectedNetwork: TAvailableNetworks;
	addressType: string;
}): Result<{
	addressIndex: IAddressContent;
	changeAddressIndex: IAddressContent;
}> => {
	try {
		const wallet = getStore().wallet;
		const addresses: IAddress =
			wallet.wallets[selectedWallet].addresses[selectedNetwork][addressType];
		const changeAddresses: IAddress =
			wallet.wallets[selectedWallet].changeAddresses[selectedNetwork][
				addressType
			];

		const addressIndex = Object.values(addresses).reduce((prev, current) =>
			prev.index > current.index ? prev : current,
		);

		const changeAddressIndex = Object.values(changeAddresses).reduce(
			(prev, current) => (prev.index > current.index ? prev : current),
		);

		return ok({ addressIndex, changeAddressIndex });
	} catch (e) {
		return err(e);
	}
};

/**
 * Returns the currently selected network (bitcoin | bitcoinTestnet).
 * @return {TAvailableNetworks}
 */
export const getSelectedNetwork = (): TAvailableNetworks => {
	return getStore().wallet.selectedNetwork;
};

/**
 * Returns the currently selected address type (p2pkh | p2sh | p2wpkh | p2tr).
 * @return {TAddressType}
 */
export const getSelectedAddressType = ({
	selectedWallet,
	selectedNetwork,
}: {
	selectedWallet?: string;
	selectedNetwork?: TAvailableNetworks;
}): TAddressType => {
	if (!selectedNetwork) {
		selectedNetwork = getSelectedNetwork();
	}
	if (!selectedWallet) {
		selectedWallet = getSelectedWallet();
	}
	return getStore().wallet.wallets[selectedWallet].addressType[selectedNetwork];
};

/**
 * Returns the currently selected wallet (Ex: 'wallet0').
 * @return {string}
 */
export const getSelectedWallet = (): string => {
	return getStore()?.wallet?.selectedWallet ?? EWallet.defaultWallet;
};

/**
 * Returns all state data for the currently selected wallet.
 * @param {TAvailableNetworks} [selectedNetwork]
 * @param {string} [selectedWallet]
 * @return {{ currentWallet: IDefaultWalletShape, selectedWallet: string, selectedNetwork: TAvailableNetworks }}
 */
export const getCurrentWallet = ({
	selectedNetwork = undefined,
	selectedWallet = undefined,
}: {
	selectedNetwork?: undefined | TAvailableNetworks;
	selectedWallet?: string;
}): {
	currentWallet: IDefaultWalletShape;
	selectedNetwork: TAvailableNetworks;
	selectedWallet: string;
} => {
	const wallet = getStore().wallet;
	if (!selectedNetwork) {
		selectedNetwork = wallet.selectedNetwork;
	}
	if (!selectedWallet) {
		selectedWallet = wallet.selectedWallet;
	}
	const wallets = wallet.wallets;
	return {
		currentWallet: wallets[selectedWallet],
		selectedNetwork,
		selectedWallet,
	};
};

export const getOnChainTransactions = ({
	selectedWallet,
	selectedNetwork,
}: {
	selectedWallet: string;
	selectedNetwork: TAvailableNetworks;
}): IFormattedTransaction => {
	if (!selectedWallet) {
		selectedWallet = getSelectedWallet();
	}
	if (!selectedNetwork) {
		selectedNetwork = getSelectedNetwork();
	}
	return (
		getStore().wallet?.wallets[selectedWallet]?.transactions[selectedNetwork] ??
		{}
	);
};

/**
 * @param {string} txid
 * @param {string} [selectedWallet]
 * @param {TAvailableNetworks} [selectedNetwork]
 * @return {Result<IFormattedTransactionContent>}
 */
export const getTransactionById = ({
	txid,
	selectedWallet,
	selectedNetwork,
}: {
	txid: string;
	selectedWallet?: string;
	selectedNetwork?: TAvailableNetworks;
}): Result<IFormattedTransactionContent> => {
	if (!selectedWallet) {
		selectedWallet = getSelectedWallet();
	}
	if (!selectedNetwork) {
		selectedNetwork = getSelectedNetwork();
	}
	const transactions = getOnChainTransactions({
		selectedNetwork,
		selectedWallet,
	});
	if (txid in transactions) {
		return ok(transactions[txid]);
	} else {
		return err('Unable to locate the specified txid.');
	}
};

export interface ITransaction<T> {
	id: number;
	jsonrpc: string;
	param: string;
	data: T;
	result: {
		blockhash: string;
		blocktime: number;
		confirmations: number;
		hash: string;
		hex: string;
		locktime: number;
		size: number;
		time: number;
		txid: string;
		version: number;
		vin: IVin[];
		vout: IVout[];
		vsize: number;
		weight: number;
	};
}

export interface ITxHash {
	tx_hash: string;
}

export const getInputData = async ({
	selectedNetwork = undefined,
	inputs = [],
}: {
	inputs: { tx_hash: string; vout: number }[];
	selectedNetwork?: undefined | TAvailableNetworks;
}): Promise<Result<{ [key: string]: { addresses: []; value: number } }>> => {
	try {
		if (!selectedNetwork) {
			selectedNetwork = getSelectedNetwork();
		}
		const getTransactionsResponse = await getTransactionsFromInputs({
			txHashes: inputs,
			selectedNetwork,
		});
		const inputData = {};
		if (getTransactionsResponse.isErr()) {
			return err(getTransactionsResponse.error.message);
		}
		getTransactionsResponse.value.data.map(({ data, result }) => {
			const vout = result.vout[data.vout];
			const addresses = vout.scriptPubKey?.addresses
				? vout.scriptPubKey?.addresses
				: [vout.scriptPubKey.address];
			const value = vout.value;
			const key = data.tx_hash;
			inputData[key] = { addresses, value };
		});
		return ok(inputData);
	} catch (e) {
		return err(e);
	}
};

export const formatTransactions = async ({
	selectedNetwork = undefined,
	selectedWallet = EWallet.defaultWallet,
	transactions = [],
}: {
	selectedNetwork: undefined | TAvailableNetworks;
	selectedWallet: string;
	transactions: ITransaction<IUtxo>[];
}): Promise<Result<IFormattedTransaction>> => {
	if (transactions.length < 1) {
		return ok({});
	}
	if (!selectedNetwork) {
		selectedNetwork = getSelectedNetwork();
	}
	if (!selectedWallet) {
		selectedWallet = getSelectedWallet();
	}
	const { currentWallet } = getCurrentWallet({
		selectedNetwork,
		selectedWallet,
	});

	// Batch and pre-fetch input data.
	let inputs: { tx_hash: string; vout: number }[] = [];
	transactions.map(({ result: { vin } }) => {
		vin.map(({ txid, vout }) => {
			inputs.push({ tx_hash: txid, vout });
		});
	});
	const inputDataResponse = await getInputData({
		selectedNetwork,
		inputs,
	});
	if (inputDataResponse.isErr()) {
		return err(inputDataResponse.error.message);
	}
	const addressTypes = getAddressTypes();

	const inputData = inputDataResponse.value;

	const currentAddresses = currentWallet.addresses[selectedNetwork];
	const currentChangeAddresses = currentWallet.changeAddresses[selectedNetwork];

	let addresses = {};
	let changeAddresses = {};

	await Promise.all([
		Object.keys(addressTypes).map((addressType) => {
			addresses = { ...addresses, ...currentAddresses[addressType] };
		}),
		Object.keys(addressTypes).map((addressType) => {
			changeAddresses = {
				...changeAddresses,
				...currentChangeAddresses[addressType],
			};
		}),
	]);
	const addressScriptHashes = Object.keys(addresses);
	const changeAddressScriptHashes = Object.keys(changeAddresses);
	const [addressArray, changeAddressArray] = await Promise.all([
		addressScriptHashes.map((key) => {
			return addresses[key].address;
		}),
		changeAddressScriptHashes.map((key) => {
			return changeAddresses[key].address;
		}),
	]);

	let formattedTransactions: IFormattedTransaction = {};

	transactions.map(({ data, result }) => {
		let totalInputValue = 0; // Total value of all inputs.
		let matchedInputValue = 0; // Total value of all inputs with addresses that belong to this wallet.
		let totalOutputValue = 0; // Total value of all outputs.
		let matchedOutputValue = 0; // Total value of all outputs with addresses that belong to this wallet.
		let messages: string[] = []; // Array of OP_RETURN messages.

		//Iterate over each input
		const vin = result?.vin || [];
		vin.map(({ txid, scriptSig }) => {
			//Push any OP_RETURN messages to messages array
			try {
				const asm = scriptSig.asm;
				if (asm !== '' && asm.includes('OP_RETURN')) {
					const OpReturnMessages = decodeOpReturnMessage(asm);
					messages = messages.concat(OpReturnMessages);
				}
			} catch {}

			const { addresses: _addresses, value } = inputData[txid];
			totalInputValue = totalInputValue + value;
			Array.isArray(_addresses) &&
				_addresses.map((address) => {
					if (
						addressArray.includes(address) ||
						changeAddressArray.includes(address)
					) {
						matchedInputValue = matchedInputValue + value;
					}
				});
		});

		//Iterate over each output
		const vout = result?.vout || [];
		vout.map(({ scriptPubKey, value }) => {
			const _addresses = scriptPubKey?.addresses
				? scriptPubKey.addresses
				: [scriptPubKey.address];
			totalOutputValue = totalOutputValue + value;
			Array.isArray(_addresses) &&
				_addresses.map((address) => {
					if (
						addressArray.includes(address) ||
						changeAddressArray.includes(address)
					) {
						matchedOutputValue = matchedOutputValue + value;
					}
				});
		});

		const txid = result.txid;
		const type = matchedInputValue > matchedOutputValue ? 'sent' : 'received';
		const totalMatchedValue = matchedOutputValue - matchedInputValue;
		const value = Number(totalMatchedValue.toFixed(8));
		const totalValue = totalInputValue - totalOutputValue;
		const fee = Number(Math.abs(totalValue).toFixed(8));
		const { address, height, scriptHash } = data;
		let timestamp = Date.now();

		if (height > 0 && result?.blocktime) {
			timestamp = result.blocktime * 1000;
		}

		formattedTransactions[txid] = {
			address,
			height,
			scriptHash,
			totalInputValue,
			matchedInputValue,
			totalOutputValue,
			matchedOutputValue,
			fee,
			type,
			value,
			txid,
			messages,
			timestamp,
		};
	});
	return ok(formattedTransactions);
};

//Returns an array of messages from an OP_RETURN message
export const decodeOpReturnMessage = (opReturn = ''): string[] => {
	let messages: string[] = [];
	try {
		//Remove OP_RETURN from the string & trim the string.
		if (opReturn.includes('OP_RETURN')) {
			opReturn = opReturn.replace('OP_RETURN', '');
			opReturn = opReturn.trim();
		}

		const regex = /[0-9A-Fa-f]{6}/g;
		//Separate the string into an array based upon a space and insert each message into an array to be returned
		const data = opReturn.split(' ');
		data.forEach((msg) => {
			try {
				//Ensure the message is in fact a hex
				if (regex.test(msg)) {
					const message = new Buffer(msg, 'hex').toString();
					messages.push(message);
				}
			} catch {}
		});
		return messages;
	} catch (e) {
		console.log(e);
		return messages;
	}
};

export const getCustomElectrumPeers = ({
	selectedNetwork = undefined,
}: {
	selectedNetwork: undefined | TAvailableNetworks;
}): ICustomElectrumPeer[] | [] => {
	try {
		if (!selectedNetwork) {
			selectedNetwork = getSelectedNetwork();
		}
		const settings = getStore().settings;
		return settings.customElectrumPeers[selectedNetwork] || [];
	} catch {
		return [];
	}
};

export interface IVin {
	scriptSig: {
		asm: string;
		hex: string;
	};
	sequence: number;
	txid: string;
	txinwitness: string[];
	vout: number;
}

export interface IVout {
	n: number; //0
	scriptPubKey: {
		addresses?: string[];
		address?: string;
		asm: string;
		hex: string;
		reqSigs?: number;
		type?: string;
	};
	value: number;
}

// TODO: Update ICreateTransaction to match this pattern.
export interface IRbfData {
	outputs: IOutput[];
	selectedWallet: string;
	balance: number;
	selectedNetwork: TAvailableNetworks;
	addressType: TAddressType;
	fee: number; // Total fee in sats.
	inputs: IUtxo[];
	message: string;
}

/**
 * Using a tx_hash this method will return the necessary data to create a
 * replace-by-fee transaction for any 0-conf, RBF-enabled tx.
 * @param txHash
 * @param selectedWallet
 * @param selectedNetwork
 */

export const getRbfData = async ({
	txHash = undefined,
	selectedWallet = undefined,
	selectedNetwork = undefined,
}: {
	txHash: ITxHash | undefined;
	selectedWallet: string | undefined;
	selectedNetwork: TAvailableNetworks | undefined;
}): Promise<Result<IRbfData>> => {
	if (!txHash) {
		return err('No txid provided.');
	}
	if (!selectedWallet) {
		selectedWallet = getSelectedWallet();
	}
	if (!selectedNetwork) {
		selectedNetwork = getSelectedNetwork();
	}
	const txResponse = await getTransactions({
		txHashes: [txHash],
		selectedNetwork,
	});
	if (txResponse.isErr()) {
		return err(txResponse.error.message);
	}
	const txData: ITransaction<ITxHash>[] = txResponse.value.data;

	const addresses =
		getStore().wallet.wallets[selectedWallet].addresses[selectedNetwork];
	const changeAddresses =
		getStore().wallet.wallets[selectedWallet].changeAddresses[selectedNetwork];

	const allAddressTypes = Object.keys(getAddressTypes());
	let allAddresses = {};
	let allChangeAddresses = {};
	await Promise.all(
		allAddressTypes.map((addressType) => {
			allAddresses = {
				...allAddresses,
				...addresses[addressType],
				...changeAddresses[addressType],
			};
			allChangeAddresses = {
				...allChangeAddresses,
				...changeAddresses[addressType],
			};
		}),
	);
	let changeAddressData: IOutput = {
		address: '',
		value: 0,
		index: 0,
	};
	let inputs: IUtxo[] = [];
	let address: string = '';
	let scriptHash = '';
	let path = '';
	let value: number = 0;
	let addressType: TAddressType = EWallet.addressType;
	let outputs: IOutput[] = [];
	let message: string = '';
	let inputTotal = 0;
	let outputTotal = 0;
	let fee = 0;

	const insAndOuts = await Promise.all(
		txData.map(({ result: { vin, vout } }) => {
			return { vins: vin, vouts: vout };
		}),
	);
	const { vins, vouts } = insAndOuts[0];
	for (let i = 0; i < vins.length; i++) {
		try {
			const input = vins[i];
			const txId = input.txid;
			const tx = await getTransactions({
				txHashes: [{ tx_hash: txId }],
				selectedNetwork,
			});
			if (tx.isErr()) {
				return err(tx.error.message);
			}
			if (tx.value.data[0].data.height > 0) {
				return err('Transaction is already confirmed. Unable to RBF.');
			}
			const txVout = tx.value.data[0].result.vout[input.vout];
			address = txVout.scriptPubKey.addresses[0];
			scriptHash = await getScriptHash(address, selectedNetwork);
			path = allAddresses[scriptHash].path;
			value = btcToSats(txVout.value);
			inputs.push({
				tx_hash: input.txid,
				index: input.vout,
				tx_pos: input.vout,
				height: 0,
				address,
				scriptHash,
				path,
				value,
			});
			if (value) {
				inputTotal = inputTotal + value;
			}
		} catch {}
	}
	for (let i = 0; i < vouts.length; i++) {
		const vout = vouts[i];
		const voutValue = btcToSats(vout.value);
		if (!vout.scriptPubKey?.addresses) {
			try {
				if (vout.scriptPubKey.asm.includes('OP_RETURN')) {
					message = decodeOpReturnMessage(vout.scriptPubKey.asm)[0] || '';
				}
			} catch {}
		} else {
			address = vout.scriptPubKey.addresses[0];
		}
		const changeAddressScriptHash = await getScriptHash(
			address,
			selectedNetwork,
		);

		// If the address scripthash matches one of our change address scripthashes, add it accordingly. Otherwise, add it as another output.
		if (Object.keys(allChangeAddresses).includes(changeAddressScriptHash)) {
			changeAddressData = {
				address,
				value: voutValue,
				index: i,
			};
		} else {
			const index = outputs?.length ?? 0;
			outputs.push({
				address,
				value: voutValue,
				index,
			});
			outputTotal = outputTotal + voutValue;
		}
	}

	if (!changeAddressData?.address && outputs.length >= 2) {
		return err(
			'Unable to determine change address. Performing an RBF could divert funds from the incorrect output. Consider CPFP instead.',
		);
	}

	if (outputTotal > inputTotal) {
		return err('Outputs should not be greater than the inputs.');
	}
	fee = Number(inputTotal - (changeAddressData?.value ?? 0) - outputTotal);
	//outputs = outputs.filter((o) => o);

	return ok({
		selectedWallet,
		changeAddress: changeAddressData.address,
		inputs,
		balance: inputTotal,
		outputs,
		fee,
		selectedNetwork,
		message,
		addressType,
		rbf: true,
	});
};

/**
 * Converts IRbfData to IOnChainTransactionData.
 * @param data
 */
export const formatRbfData = async (
	data: IRbfData,
): Promise<IOnChainTransactionData> => {
	const { selectedWallet, inputs, outputs, fee, selectedNetwork, message } =
		data;

	let changeAddress: undefined | string;
	let satsPerByte = 1;
	let recommendedFee = ETransactionDefaults.recommendedBaseFee; //Total recommended fee in sats
	let transactionSize = ETransactionDefaults.baseTransactionSize; //In bytes (250 is about normal)
	let label = ''; // User set label for a given transaction.

	const { currentWallet } = getCurrentWallet({
		selectedWallet,
		selectedNetwork,
	});
	const changeAddressesObj = currentWallet.changeAddresses[selectedNetwork];
	const changeAddresses = Object.values(changeAddressesObj).map(
		({ address }) => address,
	);
	let newOutputs = outputs;
	await Promise.all(
		outputs.map(({ address }, index) => {
			if (address && changeAddresses.includes(address)) {
				if (address) {
					changeAddress = address;
					newOutputs.splice(index, 1);
				}
			}
		}),
	);

	let newFee = 0;
	let newSatsPerByte = satsPerByte;
	while (fee > newFee) {
		newFee = getTotalFee({
			selectedWallet,
			satsPerByte: newSatsPerByte,
			selectedNetwork,
			message,
		});
		newSatsPerByte = newSatsPerByte + 1;
	}

	const newFiatAmount = getTransactionOutputValue({ outputs });

	return {
		changeAddress: changeAddress || '',
		message,
		label,
		outputs: newOutputs,
		inputs,
		fee: newFee,
		satsPerByte: newSatsPerByte,
		fiatAmount: newFiatAmount,
		recommendedFee,
		transactionSize,
	};
};

/**
 * Generates a newly specified wallet.
 * @param {string} [wallet]
 * @param {number} [addressAmount]
 * @param {number} [changeAddressAmount]
 * @param {string} [mnemonic]
 * @param {TAddressType} [addressTypes]
 * @return {Promise<Result<IDefaultWallet>>}
 */
export const createDefaultWallet = async ({
	walletName = 'wallet0',
	addressAmount = 1,
	changeAddressAmount = 1,
	mnemonic,
	addressTypes,
	selectedNetwork,
}: ICreateWallet): Promise<Result<IDefaultWallet>> => {
	try {
		if (!addressTypes) {
			//addressTypes = getAddressTypes().p2wpkh;
			addressTypes = {
				p2wpkh: {
					label: 'bech32',
					path: "m/84'/0'/0'/0/0",
					type: 'p2wpkh',
				},
			};
		}
		const selectedAddressType = getSelectedAddressType({});
		const getMnemonicPhraseResponse = await getMnemonicPhrase(walletName);
		let error = true;
		let data;
		if (getMnemonicPhraseResponse.isOk()) {
			error = false;
			data = getMnemonicPhraseResponse.value;
		}
		const { wallets } = getStore().wallet;
		if (!error && data && walletName in wallets && wallets[walletName]?.id) {
			return err(`Wallet ID, "${walletName}" already exists.`);
		}

		//Generate Mnemonic if none was provided
		if (!mnemonic) {
			mnemonic = validateMnemonic(data) ? data : await generateMnemonic();
		}
		if (!mnemonic || !validateMnemonic(mnemonic)) {
			return err('Invalid Mnemonic');
		}
		await setKeychainValue({ key: walletName, value: mnemonic });

		//Generate a set of addresses & changeAddresses for each network.
		const addressesObj = { ...defaultWalletShape.addresses };
		const changeAddressesObj = { ...defaultWalletShape.changeAddresses };
		const addressIndex = { ...defaultWalletShape.addressIndex };
		const changeAddressIndex = { ...defaultWalletShape.changeAddressIndex };
		await Promise.all(
			Object.values(addressTypes).map(async ({ type, path }) => {
				if (!selectedNetwork) {
					selectedNetwork = getSelectedNetwork();
				}
				if (selectedAddressType !== type) {
					return;
				}
				const pathObject = getKeyDerivationPathObject({
					path,
					selectedNetwork,
				});
				if (pathObject.isErr()) {
					return err(pathObject.error.message);
				}
				const generatedAddresses = await generateAddresses({
					selectedWallet: walletName,
					selectedNetwork,
					addressAmount,
					changeAddressAmount,
					keyDerivationPath: pathObject.value,
					addressType: type,
				});
				if (generatedAddresses.isErr()) {
					return err(generatedAddresses.error);
				}
				const { addresses, changeAddresses } = generatedAddresses.value;
				addressIndex[selectedNetwork][type] = Object.values(addresses)[0];
				changeAddressIndex[selectedNetwork][type] =
					Object.values(changeAddresses)[0];
				addressesObj[selectedNetwork][type] = { ...addresses };
				changeAddressesObj[selectedNetwork][type] = { ...changeAddresses };
			}),
		);
		const payload: IDefaultWallet = {
			[walletName]: {
				...defaultWalletShape,
				addressType: {
					bitcoin: selectedAddressType,
					bitcoinTestnet: selectedAddressType,
				},
				addressIndex,
				changeAddressIndex,
				addresses: { ...addressesObj },
				changeAddresses: { ...changeAddressesObj },
				id: walletName,
			},
		};
		return ok(payload);
	} catch (e) {
		return err(e);
	}
};

/**
 * large = Sort by and use largest UTXO first. Lowest fee, but reveals your largest UTXO's and reduces privacy.
 * small = Sort by and use smallest UTXO first. Higher fee, but hides your largest UTXO's and increases privacy.
 * consolidate = Use all available UTXO's regardless of the amount being sent. Preferable to use this method when fees are low in order to reduce fees in future transactions.
 */
export interface IAddressTypes {
	inputs: {
		[key in TAddressType]: number;
	};
	outputs: {
		[key in TAddressType]: number;
	};
}
/**
 * Returns the transaction fee and outputs along with the inputs that best fit the sort method.
 * @async
 * @param {IAddress[]} inputs
 * @param {IAddress[]} outputs
 * @param {number} [satsPerByte]
 * @param {sortMethod}
 * @return {Promise<number>}
 */
export interface ICoinSelectResponse {
	fee: number;
	inputs: IUtxo[];
	outputs: IOutput[];
}

/**
 * This method will do its best to select only the necessary inputs that are provided base on the selected sortMethod.
 * @param {IUtxo[]} inputs
 * @param {IUtxo[]} outputs
 * @param {number} [satsPerByte]
 * @param {TCoinSelectPreference} [sortMethod]
 * @param {number | undefined} [amountToSend]
 */
export const autoCoinSelect = async ({
	inputs = [],
	outputs = [],
	satsPerByte = 1,
	sortMethod = 'small',
	amountToSend = 0,
}: {
	inputs: IUtxo[] | undefined;
	outputs: IOutput[] | undefined;
	satsPerByte?: number;
	sortMethod?: TCoinSelectPreference;
	amountToSend?: number | undefined;
}): Promise<Result<ICoinSelectResponse>> => {
	try {
		if (!inputs) {
			return err('No inputs provided');
		}
		if (!outputs) {
			return err('No outputs provided');
		}
		if (!amountToSend) {
			//If amountToSend is not specified, attempt to determine how much to send from the output values.
			amountToSend = outputs.reduce((acc, cur) => {
				return acc + Number(cur?.value) || 0;
			}, 0);
		}

		//Sort by the largest UTXO amount (Lowest fee, but reveals your largest UTXO's)
		if (sortMethod === 'large') {
			inputs.sort((a, b) => Number(b.value) - Number(a.value));
		} else {
			//Sort by the smallest UTXO amount (Highest fee, but hides your largest UTXO's)
			inputs.sort((a, b) => Number(a.value) - Number(b.value));
		}

		//Add UTXO's until we have more than the target amount to send.
		let inputAmount = 0;
		let newInputs: IUtxo[] = [];
		let oldInputs: IUtxo[] = [];

		//Consolidate UTXO's if unable to determine the amount to send.
		if (sortMethod === 'consolidate' || !amountToSend) {
			//Add all inputs
			newInputs = [...inputs];
			inputAmount = newInputs.reduce((acc, cur) => {
				return acc + Number(cur.value);
			}, 0);
		} else {
			//Add only the necessary inputs based on the amountToSend.
			await Promise.all(
				inputs.map((input) => {
					if (inputAmount < amountToSend) {
						inputAmount += input.value;
						newInputs.push(input);
					} else {
						oldInputs.push(input);
					}
				}),
			);

			//The provided UTXO's do not have enough to cover the transaction.
			if ((amountToSend && inputAmount < amountToSend) || !newInputs?.length) {
				return err('Not enough funds.');
			}
		}

		// Get all input and output address types for fee calculation.
		let addressTypes: IAddressTypes | { inputs: {}; outputs: {} } = {
			inputs: {},
			outputs: {},
		};
		await Promise.all([
			newInputs.map(({ address }) => {
				const validateResponse: AddressInfo = getAddressInfo(address);
				if (!validateResponse) {
					return;
				}
				const type = validateResponse.type.toUpperCase();
				if (type in addressTypes.inputs) {
					addressTypes.inputs[type] = addressTypes.inputs[type] + 1;
				} else {
					addressTypes.inputs[type] = 1;
				}
			}),
			outputs.map(({ address }) => {
				if (!address) {
					return;
				}
				const validateResponse = getAddressInfo(address);
				if (!validateResponse) {
					return;
				}
				const type = validateResponse.type.toUpperCase();
				if (type in addressTypes.outputs) {
					addressTypes.outputs[type] = addressTypes.outputs[type] + 1;
				} else {
					addressTypes.outputs[type] = 1;
				}
			}),
		]);

		let baseFee = getByteCount(addressTypes.inputs, addressTypes.outputs);
		if (baseFee < ETransactionDefaults.recommendedBaseFee) {
			baseFee = ETransactionDefaults.recommendedBaseFee;
		}
		let fee = baseFee * satsPerByte;

		//Ensure we can still cover the transaction with the previously selected UTXO's. Add more UTXO's if not.
		const totalTxCost = amountToSend + fee;
		if (amountToSend && inputAmount < totalTxCost) {
			await Promise.all(
				oldInputs.map((input) => {
					if (inputAmount < totalTxCost) {
						inputAmount += input.value;
						newInputs.push(input);
					}
				}),
			);
		}

		//The provided UTXO's do not have enough to cover the transaction.
		if (inputAmount < totalTxCost || !newInputs?.length) {
			return err('Not enough funds');
		}
		return ok({ inputs: newInputs, outputs, fee });
	} catch (e) {
		return err(e);
	}
};

/**
 * Parses a key derivation path object and returns it in string format. Ex: "m/84'/0'/0'/0/0"
 * @param {IKeyDerivationPath} path
 * @param {TKeyDerivationPurpose | undefined} purpose
 * @param {boolean} [changeAddress]
 * @param {TKeyDerivationAccountType} [accountType]
 * @param {string} [addressIndex]
 * @param {TAvailableNetworks} [selectedNetwork]
 * @return {Result<string>}
 */
export const getKeyDerivationPathString = ({
	path,
	purpose,
	accountType,
	changeAddress,
	addressIndex = '0',
	selectedNetwork,
}: {
	path: IKeyDerivationPath;
	purpose?: TKeyDerivationPurpose | string | undefined;
	accountType?: TKeyDerivationAccountType;
	changeAddress?: boolean;
	addressIndex?: string | undefined;
	selectedNetwork?: TAvailableNetworks | undefined;
}): Result<string> => {
	try {
		if (!path) {
			return err('No path specified.');
		}
		if (accountType === 'omnibolt') {
			path.purpose = '44'; //TODO: Remove once omnibolt supports native segwit.
		}
		//Specifically specifying purpose will override the default accountType purpose value.
		if (purpose) {
			path.purpose = purpose;
		}

		if (selectedNetwork) {
			path.coinType = selectedNetwork.toLocaleLowerCase().includes('testnet')
				? '1'
				: '0';
		}
		if (accountType) {
			path.account = getKeyDerivationAccount(accountType);
		}
		if (changeAddress !== undefined) {
			path.change = changeAddress ? '1' : '0';
		}
		return ok(
			`m/${path.purpose}'/${path.coinType}'/${path.account}'/${path.change}/${addressIndex}`,
		);
	} catch (e) {
		return err(e);
	}
};

/**
 * Parses a key derivation path in string format Ex: "m/84'/0'/0'/0/0" and returns IKeyDerivationPath.
 * @param {string} keyDerivationPath
 * @param {TKeyDerivationPurpose | undefined} purpose
 * @param {boolean} [changeAddress]
 * @param {TKeyDerivationAccountType} [accountType]
 * @param {string} [addressIndex]
 * @param {TAvailableNetworks} [selectedNetwork]
 * @return {Result<IKeyDerivationPath>}
 */
export const getKeyDerivationPathObject = ({
	path = '',
	purpose,
	accountType,
	changeAddress,
	addressIndex,
	selectedNetwork,
}: {
	path: string;
	purpose?: TKeyDerivationPurpose | string | undefined;
	accountType?: TKeyDerivationAccountType;
	changeAddress?: boolean;
	addressIndex?: string | undefined;
	selectedNetwork?: TAvailableNetworks | undefined;
}): Result<IKeyDerivationPath> => {
	try {
		const parsedPath = path.replace(/'/g, '').split('/');

		//Specifically specifying purpose will override the default accountType purpose value.
		if (!purpose && accountType === 'omnibolt') {
			purpose = '44'; //TODO: Remove once omnibolt supports native segwit.
		}
		if (!purpose) {
			purpose = parsedPath[1];
		}

		let coinType = parsedPath[2];
		if (selectedNetwork) {
			coinType = selectedNetwork.toLocaleLowerCase().includes('testnet')
				? '1'
				: '0';
		}

		let account = parsedPath[3];
		if (accountType) {
			account = getKeyDerivationAccount(accountType);
		}

		let change = parsedPath[4];
		if (changeAddress !== undefined) {
			change = changeAddress ? '1' : '0';
		}

		if (!addressIndex) {
			addressIndex = parsedPath[5];
		}

		return ok({
			purpose,
			coinType,
			account,
			change,
			addressIndex,
		});
	} catch (e) {
		return err(e);
	}
};

/**
 * Returns available address types for the given network and wallet
 * @return IAddressType
 */
export const getAddressTypes = (): IAddressType =>
	getStore().wallet.addressTypes;

/**
 * The method returns the base key derivation path for a given address type.
 * @param {TAddressType} [addressType]
 * @param {TAvailableNetworks} [selectedNetwork]
 * @param {string} [selectedWallet]
 * @param {boolean} [changeAddress]
 * @return {Result<{ pathString: string, pathObject: IKeyDerivationPath }>}
 */
export const getAddressTypePath = ({
	addressType,
	selectedNetwork,
	selectedWallet,
	changeAddress,
}: {
	addressType?: TAddressType;
	selectedNetwork?: TAvailableNetworks;
	selectedWallet?: string;
	changeAddress?: boolean;
}): Result<IKeyDerivationPathData> => {
	try {
		if (!selectedNetwork) {
			selectedNetwork = getSelectedNetwork();
		}
		if (!selectedWallet) {
			selectedWallet = getSelectedWallet();
		}
		if (!addressType) {
			addressType = getSelectedAddressType({ selectedNetwork, selectedWallet });
		}
		const addressTypes = getAddressTypes();

		const path = addressTypes[addressType].path;
		const pathData = formatKeyDerivationPath({
			path,
			selectedNetwork,
			changeAddress,
		});
		if (pathData.isErr()) {
			return err(pathData.error.message);
		}

		return ok({
			pathString: pathData.value.pathString,
			pathObject: pathData.value.pathObject,
		});
	} catch (e) {
		return err(e);
	}
};

/**
 * Returns the next available receive address for the given network and wallet.
 * @param {TAddressType} [addressType]
 * @param {TAvailableNetworks} [selectedNetwork]
 * @param {string} [selectedWallet]
 * @return {Result<string>}
 */
export const getReceiveAddress = ({
	addressType,
	selectedNetwork,
	selectedWallet,
}: {
	addressType?: TAddressType;
	selectedNetwork?: TAvailableNetworks;
	selectedWallet?: string;
}): Result<string> => {
	try {
		if (!selectedNetwork) {
			selectedNetwork = getSelectedNetwork();
		}
		if (!selectedWallet) {
			selectedWallet = getSelectedWallet();
		}
		if (!addressType) {
			addressType = getSelectedAddressType({ selectedNetwork, selectedWallet });
		}
		const wallet = getStore().wallet?.wallets[selectedWallet];
		const addressIndex = wallet?.addressIndex[selectedNetwork];
		const receiveAddress = addressIndex[addressType]?.address;
		if (!receiveAddress) {
			return err('No receive address available.');
		}
		return ok(receiveAddress);
	} catch (e) {
		return err(e);
	}
};

/**
 * Determines the asset network based on the provided asset name.
 * @param {string} asset
 * @return {TAssetNetwork}
 */
export const getAssetNetwork = (asset: string): TAssetNetwork => {
	switch (asset) {
		case 'bitcoin':
			return 'bitcoin';
		case 'lightning':
			return 'lightning';
		default:
			return 'omnibolt';
	}
};

/**
 * This method returns all available asset names (bitcoin, lightning, and any available omnibolt assets).
 * @param {string} [selectedWallet]
 * @param {TAvailableNetworks} [selectedNetwork]
 * @return {string[]>}
 */
export const getAssetNames = ({
	selectedWallet,
	selectedNetwork,
}: {
	selectedWallet?: string;
	selectedNetwork?: TAvailableNetworks;
}): string[] => {
	if (!selectedWallet) {
		selectedWallet = getSelectedWallet();
	}
	if (!selectedNetwork) {
		selectedNetwork = getSelectedNetwork();
	}
	const assetNames: string[] = assetNetworks.filter((a) => a !== 'omnibolt');
	try {
		// Grab available omni assets.
		const omniboltAssetData = getStore().omnibolt.assetData;
		const channels = Object.values(
			getStore().omnibolt.wallets[selectedWallet].channels[selectedNetwork],
		);
		channels.map((channel) => {
			if (channel.property_id in omniboltAssetData) {
				assetNames.push(omniboltAssetData[channel.property_id].name);
			}
		});
	} catch {}
	return assetNames;
};

interface IGetBalanceProps extends IncludeBalances {
	selectedWallet?: string;
	selectedNetwork?: TAvailableNetworks;
}
/**
 * Retrieves the total wallet display values for the currently selected wallet and network.
 */
export const getBalance = ({
	onchain = false,
	lightning = false,
	omnibolt,
	selectedWallet,
	selectedNetwork,
}: IGetBalanceProps): IDisplayValues => {
	if (!selectedWallet) {
		selectedWallet = getSelectedWallet();
	}
	if (!selectedNetwork) {
		selectedNetwork = getSelectedNetwork();
	}
	let balance = 0;

	if (onchain) {
		balance +=
			getStore().wallet?.wallets[selectedWallet]?.balance[selectedNetwork] ?? 0;
	}

	if (lightning) {
		balance += Number(getStore().lightning.channelBalance.balance);
	}

	if (omnibolt) {
		/*
		TODO: We'll need to implement a method that resolves the usd->sat value
		      of a given omni token before adding it to the balance.
		 */
		/*const channels = Object.keys(
			getStore().omnibolt.wallets[selectedWallet].channels[selectedNetwork],
		);
		omnibolt.map((id) => {
			if (id in channels) {
				balance += channels[id].balance_a;
			}
		});*/
	}

	return getDisplayValues({ satoshis: balance });
};
