import { TAvailableNetworks } from '../networks';

export enum ENodeJsMethods {
	setup = 'setup',
	generateMnemonic = 'generateMnemonic',
	mnemonicToSeed = 'mnemonicToSeed',
	getScriptHash = 'getScriptHash',
	getAddress = 'getAddress',
	getMnemonicPhraseFromEntropy = 'getMnemonicPhraseFromEntropy',
	getSha256 = 'getSha256',
}

export type TNodeJsMethodsData =
	| INodeJsSetup
	| INodeJsMnemonicToSeed
	| INodeJsGenerateMnemonic
	| INodeJsGetMnemonicPhraseFromEntropy
	| INodeJsGetAddress
	| INodeJsGetScriptHash
	| INodeJsGetSha256;

export interface IInvokeNodeJsMethod {
	data: TNodeJsMethodsData;
}

export interface INodeJsSetup {
	id: string;
	method: ENodeJsMethods.setup;
	data: {
		mnemonic: string;
		password?: string;
		selectedNetwork?: TAvailableNetworks;
	};
}

export interface INodeJsGenerateMnemonic {
	id: string;
	method: ENodeJsMethods.generateMnemonic;
	data: {
		strength?: number;
	};
}

export interface INodeJsMnemonicToSeed {
	id: string;
	method: ENodeJsMethods.mnemonicToSeed;
	data: {
		mnemonic: string;
		password?: string;
		selectedNetwork?: TAvailableNetworks;
	};
}

export interface INodeJsGetScriptHash {
	id: string;
	method: ENodeJsMethods.getScriptHash;
	data: {
		address: string;
		selectedNetwork?: TAvailableNetworks;
	};
}

export interface INodeJsGetAddress {
	id: string;
	method: ENodeJsMethods.getAddress;
	data: {
		root?: string;
		path: string;
		type: string;
		selectedNetwork?: TAvailableNetworks;
	};
}

export interface INodeJsGetMnemonicPhraseFromEntropy {
	id: string;
	method: ENodeJsMethods.getMnemonicPhraseFromEntropy;
	data: {
		entropy?: string;
	};
}

export interface INodeJsGetSha256 {
	id: string;
	method: ENodeJsMethods.getSha256;
	data: {
		str: string;
	};
}
