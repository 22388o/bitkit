import { TAvailableNetworks } from '../networks';
import {
	TAddressType,
	IAddress,
	IKeyDerivationPath,
	TKeyDerivationAccountType,
} from '../../store/types/wallet';

export interface IResponse<T> {
	error: boolean;
	data: T;
}

export interface ISetKeychainValue {
	key: string;
	value: string;
}

export interface IGetKeychainValue {
	key: string;
}

export interface IGetAddress {
	path: string;
	selectedNetwork?: TAvailableNetworks;
	type?: TAddressType;
}

export interface IGetInfoFromAddressPath {
	error: boolean;
	isChangeAddress?: boolean;
	addressIndex?: number;
	data?: string;
}

export interface IGenerateAddresses {
	selectedWallet?: string;
	addressAmount?: number;
	changeAddressAmount?: number;
	addressIndex?: number;
	changeAddressIndex?: number;
	selectedNetwork?: TAvailableNetworks;
	keyDerivationPath?: IKeyDerivationPath;
	accountType?: TKeyDerivationAccountType;
	addressType?: string;
}

export interface IGenerateAddressesResponse {
	addresses: IAddress;
	changeAddresses: IAddress;
}
