import { EAvailableNetwork } from '../../utils/networks';
import { IExchangeRates } from '../../utils/exchange-rate';
import { IAddressTypeContent } from '../shapes/wallet';
import { IHeader } from '../../utils/types/electrum';
import {
	EAddressType,
	IAddress,
	IAddresses,
	IBoostedTransactions,
	IFormattedTransactions,
	ISendTransaction,
	IUtxo,
	TServer,
} from 'beignet';

export type TKeyDerivationAccountType = 'onchain';
export type TAssetType = 'bitcoin' | 'tether';

export enum EConversionUnit {
	satoshi = 'satoshi',
	BTC = 'BTC',
	fiat = 'fiat',
}

export enum EUnit {
	BTC = 'BTC',
	fiat = 'fiat',
}

export enum EDenomination {
	modern = 'modern',
	classic = 'classic',
}

export type TWalletName = `wallet${number}`;

export interface IWalletStore {
	walletExists: boolean;
	selectedNetwork: EAvailableNetwork;
	selectedWallet: TWalletName;
	exchangeRates: IExchangeRates;
	header: IWalletItem<IHeader>;
	addressTypesToMonitor: EAddressType[];
	wallets: { [key: TWalletName]: IWallet };
}

export interface IWalletItem<T> {
	[EAvailableNetwork.bitcoin]: T;
	[EAvailableNetwork.bitcoinTestnet]: T;
	[EAvailableNetwork.bitcoinRegtest]: T;
	timestamp?: number | null;
}

export interface ICreateWallet {
	walletName?: TWalletName;
	mnemonic: string;
	bip39Passphrase?: string;
	restore?: boolean;
	addressAmount?: number;
	changeAddressAmount?: number;
	addressTypesToCreate?: EAddressType[];
	selectedNetwork?: EAvailableNetwork;
	servers?: TServer | TServer[];
}

export type TTransfer = TTransferToSpending | TTransferToSavings;

export enum ETransferType {
	open = 'open',
	coopClose = 'coop-close',
	forceClose = 'force-close',
}

export enum ETransferStatus {
	pending = 'pending',
	done = 'done',
}

export type TTransferToSpending = {
	txId: string; // The txId of the transaction that paid for the channel.
	type: ETransferType.open;
	orderId: string;
	status: ETransferStatus.pending | ETransferStatus.done;
	amount: number;
};

export type TTransferToSavings = {
	txId: string; // The txId of the transaction that closed the channel.
	type: ETransferType.coopClose | ETransferType.forceClose;
	status: ETransferStatus.pending | ETransferStatus.done;
	amount: number;
	confirmations: number;
};

export interface IWallet {
	id: string;
	name: string;
	seedHash?: string; // Help components/hooks recognize when a seed is set/updated for the same wallet id/name.
	addresses: IWalletItem<IAddressTypeContent<IAddresses>>;
	addressIndex: IWalletItem<IAddressTypeContent<IAddress>>;
	lastUsedAddressIndex: IWalletItem<IAddressTypeContent<IAddress>>;
	changeAddresses: IWalletItem<IAddressTypeContent<IAddresses>>;
	changeAddressIndex: IWalletItem<IAddressTypeContent<IAddress>>;
	lastUsedChangeAddressIndex: IWalletItem<IAddressTypeContent<IAddress>>;
	utxos: IWalletItem<IUtxo[]>;
	blacklistedUtxos: IWalletItem<[]>;
	boostedTransactions: IWalletItem<IBoostedTransactions>;
	unconfirmedTransactions: IWalletItem<IFormattedTransactions>;
	transfers: IWalletItem<TTransfer[]>;
	transactions: IWalletItem<IFormattedTransactions>;
	transaction: IWalletItem<ISendTransaction>;
	balance: IWalletItem<number>;
	addressType: IWalletItem<EAddressType>;
}

export interface IWallets {
	[key: TWalletName]: IWallet;
}
