import { ISettings } from '../types/settings';
import { arrayTypeItems } from './wallet';

export const defaultSettingsShape: ISettings = {
	loading: false,
	error: false,
	biometrics: false,
	pin: false,
	theme: 'dark',
	bitcoinUnit: 'satoshi', //BTC, mBTC, μBTC or satoshi
	selectedCurrency: 'USD',
	exchangeRateService: 'bitfinex',
	selectedLanguage: 'english',
	customElectrumPeers: { ...arrayTypeItems },
};
