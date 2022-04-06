const networks = require("./networks");
const bip39 = require("bip39");
const bip32 = require("bip32");
const bitcoin = require("bitcoinjs-lib");

class BitcoinActions {
    constructor() {
        this.mnemonic = '';
        this.password = '';
        this.root = '';
        this.selectedNetwork = '';
    }

    setup({
        id,
        method = 'setup',
        data: {
            mnemonic = this.mnemonic,
            password = this.password,
            selectedNetwork = this.selectedNetwork,
        }
    }) {
        return new Promise((resolve) => {
            try {
                if (!mnemonic) {
                    return resolve({ id, method, error: true, value: 'No mnemonic specified' });
                }
                if (!selectedNetwork) {
                    return resolve({ id, method, error: true, value: 'No network specified' });
                }
                this.mnemonic = mnemonic;
                this.selectedNetwork = selectedNetwork;
                this.password = password;

                this.mnemonicToSeed({
                    data: {
                        mnemonic,
                        password,
                        selectedNetwork,
                    }
                }).then((response) => {
                    if (response.error) {
                        return resolve({ id, method, error: true, value: response.value });
                    }
                    this.root = response.value;
                    return resolve({ id, method, error: false, value: 'Successfully setup bitcoin-actions.' });
                });
            } catch (e) {
                return resolve({id, method, error: true, value: e });
            }
        });
    }

    generateMnemonic({
        id,
        method = 'generateMnemonic',
        data: {
            strength = 256,
        }}) {
        return new Promise((resolve) => {
            try {
                const mnemonic = bip39.generateMnemonic(strength);
                return resolve({id, method, error: false, value: mnemonic});
            } catch (e) {
                return resolve({id, method, error: true, value: e});
            }
        });
    }

    mnemonicToSeed({
        id,
        method = 'mnemonicToSeed',
        data: {
            mnemonic = this.mnemonic,
            password = this.password,
            selectedNetwork = this.selectedNetwork,
        }}) {
        return new Promise((resolve) => {
            try {
                bip39.mnemonicToSeed(mnemonic, password).then((seed) => {
                    const network = networks[selectedNetwork];
                    const root = bip32.fromSeed(seed, network);
                    return resolve({id, method, error: false, value: root});
                });
            } catch (e) {
                return resolve({id, method, error: true, value: e});
            }
        });
    }

    getAddress({
        id,
        method = 'getAddress',
        data: {
            root = this.root,
            path = '',
            type = '',
            selectedNetwork = this.selectedNetwork,
        }}) {
        return new Promise(async (resolve) => {
            if (!this.mnemonic) {
                return resolve({ id, method, error: true, value: 'No mnemonic provided.' });
            }
            if (!this.root) {
                await this.setup({
                    selectedNetwork: this.selectedNetwork,
                    data: { mnemonic: this.mnemonic , password: this.password }
                });
            }
            if (!path) {
                return resolve({ id, method, error: true, value: 'No path provided.' });
            }
            const network = networks[selectedNetwork];
            const keyPair = root.derivePath(path);
            let address = '';
            switch (type) {
                case 'p2wpkh':
                    //Get Native Bech32 (bc1) addresses
                    address = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network }).address;
                    break;
                case 'p2sh':
                    //Get Segwit P2SH Address (3)
                    address = bitcoin.payments.p2sh({
                          redeem: bitcoin.payments.p2wpkh({
                              pubkey: keyPair.publicKey,
                              network,
                          }),
                          network,
                      }).address;
                    break;
              //Get Legacy Address (1)
                case 'p2pkh':
                    address = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network }).address;
                    break;
            }
            const value = {
                address,
                path,
                publicKey: keyPair.publicKey.toString('hex'),
                privKey: keyPair.toWIF(),
            }
            return resolve({ id, method, error: false, value });
        });
    };

    getScriptHash({
        id,
        method = 'getScriptHash',
        data: {
            address = '',
            selectedNetwork = this.selectedNetwork,
        },
    }) {
        return new Promise((resolve) => {
            try {
                if (!address || !selectedNetwork) {
                    return resolve({ error: true, value: 'No address or network provided.' });
                }
                const network = networks[selectedNetwork];
                const script = bitcoin.address.toOutputScript(address, network);
                const value = this.sha256(script);
                return resolve({ id, method, error: false, value });
            } catch {
                return resolve({ error: true, value: e });
            }
        });
    }

    getMnemonicPhraseFromEntropy({
        id,
        method = 'getMnemonicPhraseFromEntropy',
        data: {
            entropy = '',
        },
    }) {
        return new Promise((resolve) => {
            try {
                if (!entropy) {
                    return resolve({ error: true, value: 'No entropy provided.' });
                }
                const hash = this.sha256(entropy);
                const value = bip39.entropyToMnemonic(hash);
                return resolve({ id, method, error: false, value });
           } catch {
                return resolve({ error: true, value: e });
            }
        });
    }

    sha256(str) {
        const hash = bitcoin.crypto.sha256(str);
        const reversedHash = new Buffer(hash.reverse());
        return reversedHash.toString('hex');
    }


    getSha256({
        id,
        method = 'getSha256',
        data: {
            str = '',
        },
    }) {
        return new Promise((resolve) => {
            try {
                if (!str) {
                    return resolve({ error: true, value: 'No string provided.' });
                }
                const value = this.sha256(str);
                return resolve({ id, method, error: false, value });
            } catch {
                return resolve({ error: true, value: e });
            }
        });
    };
}

module.exports = {
    BitcoinActions
}
