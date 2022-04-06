import { networks as _networks } from 'bitcoinjs-lib';

export type TAvailableNetworks = 'bitcoin' | 'bitcoinTestnet';

export enum EAvailableNetworks {
	bitcoin = 'bitcoin',
	bitcoinTestnet = 'bitcoinTestnet',
}

export interface INetwork {
	messagePrefix: string;
	bech32: string;
	bip32: {
		public: number;
		private: number;
	};
	pubKeyHash: number;
	scriptHash: number;
	wif: number;
}

export type INetworks = {
	[key in EAvailableNetworks]: INetwork;
};

/*
Source: https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/networks.js
List of address prefixes: https://en.bitcoin.it/wiki/List_of_address_prefixes
 */
export const networks: INetworks = {
	bitcoin: _networks.bitcoin,
	bitcoinTestnet: _networks.testnet,
};

//Returns an array of all available networks from the networks object.
export const availableNetworks = (): EAvailableNetworks[] =>
	Object.values(EAvailableNetworks);
