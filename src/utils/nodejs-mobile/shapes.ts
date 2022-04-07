import {
	ENodeJsMethods,
	INodeJsGenerateMnemonic,
	INodeJsGetAddress,
	INodeJsGetMnemonicPhraseFromEntropy,
	INodeJsGetScriptHash,
	INodeJsGetSha256,
	INodeJsMnemonicToSeed,
	INodeJsSetup,
} from './types';
import { v4 as uuidv4 } from 'uuid';

export const DefaultNodeJsMethodsShape = {
	setup: (): INodeJsSetup => {
		return {
			id: uuidv4(),
			method: ENodeJsMethods.setup,
			data: {
				mnemonic: '',
				password: '',
				selectedNetwork: undefined,
			},
		};
	},
	generateMnemonic: (): INodeJsGenerateMnemonic => {
		return {
			id: uuidv4(),
			method: ENodeJsMethods.generateMnemonic,
			data: {
				strength: 256,
			},
		};
	},
	mnemonicToSeed: (): INodeJsMnemonicToSeed => {
		return {
			id: uuidv4(),
			method: ENodeJsMethods.mnemonicToSeed,
			data: {
				mnemonic: '',
				password: '',
				selectedNetwork: undefined,
			},
		};
	},
	getScriptHash: (): INodeJsGetScriptHash => {
		return {
			id: uuidv4(),
			method: ENodeJsMethods.getScriptHash,
			data: {
				address: '',
				selectedNetwork: undefined,
			},
		};
	},
	getAddress: (): INodeJsGetAddress => {
		return {
			id: uuidv4(),
			method: ENodeJsMethods.getAddress,
			data: {
				root: undefined,
				path: '',
				type: '',
				selectedNetwork: undefined,
			},
		};
	},
	getMnemonicPhraseFromEntropy: (): INodeJsGetMnemonicPhraseFromEntropy => {
		return {
			id: uuidv4(),
			method: ENodeJsMethods.getMnemonicPhraseFromEntropy,
			data: {
				entropy: undefined,
			},
		};
	},
	getSha256: (): INodeJsGetSha256 => {
		return {
			id: uuidv4(),
			method: ENodeJsMethods.getSha256,
			data: {
				str: '',
			},
		};
	},
};

/*export const DefaultNodeJsMethodsShape: {
	setup: INodeJsSetup;
	generateMnemonic: INodeJsGenerateMnemonic;
	mnemonicToSeed: INodeJsMnemonicToSeed;
	getScriptHash: INodeJsGetScriptHash;
	getAddress: INodeJsGetAddress;
	getMnemonicPhraseFromEntropy: INodeJsGetMnemonicPhraseFromEntropy;
	getSha256: INodeJsGetSha256;
} = {
	setup: {
		id: uuidv4(),
		method: ENodeJsMethods.setup,
		data: {
			mnemonic: '',
			password: '',
			selectedNetwork: undefined,
		},
	},
	generateMnemonic: {
		id: uuidv4(),
		method: ENodeJsMethods.generateMnemonic,
		data: {
			strength: 256,
		},
	},
	mnemonicToSeed: {
		id: uuidv4(),
		method: ENodeJsMethods.mnemonicToSeed,
		data: {
			mnemonic: '',
			password: '',
			selectedNetwork: undefined,
		},
	},
	getScriptHash: {
		id: uuidv4(),
		method: ENodeJsMethods.getScriptHash,
		data: {
			address: '',
			selectedNetwork: undefined,
		},
	},
	getAddress: {
		id: uuidv4(),
		method: ENodeJsMethods.getAddress,
		data: {
			root: undefined,
			path: '',
			type: '',
			selectedNetwork: undefined,
		},
	},
	getMnemonicPhraseFromEntropy: {
		id: uuidv4(),
		method: ENodeJsMethods.getMnemonicPhraseFromEntropy,
		data: {
			entropy: undefined,
		},
	},
	getSha256: {
		id: uuidv4(),
		method: ENodeJsMethods.getSha256,
		data: {
			str: '',
		},
	},
};*/
