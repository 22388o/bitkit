import {
	slashtagsPrimaryKey,
	generateMnemonicPhraseFromEntropy,
} from '../../src/utils/wallet';
import * as bip39 from 'bip39';

describe('slashtagsPrimaryKey', () => {
	it('should generate the correct primaryKey from mnemonic phrase', async () => {
		const mnemonic = generateMnemonicPhraseFromEntropy('foo');
		const seed = await bip39.mnemonicToSeed(mnemonic);

		expect(await slashtagsPrimaryKey(seed)).toEqual(
			'92d7332911133d8ebe1a9a32b2046a1961cc75665da53287e9e7a613a0fc8a74',
		);
	});
});
