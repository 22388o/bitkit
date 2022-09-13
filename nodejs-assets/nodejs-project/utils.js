const bip39 = require("bip39");
const bitcoin = require("bitcoinjs-lib");

const sha256 = (str) => {
    return bitcoin.crypto.sha256(str);
}

module.exports = {
    sha256,
}
