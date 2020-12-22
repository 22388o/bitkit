import actions from '../actions/actions';
import { ISettings } from '../types/settings';

const settings = (
	state: ISettings = {
		loading: false,
		error: false,
		biometrics: false,
		pin: false,
		pinAttemptsRemaining: 5,
		theme: 'dark',
		bitcoinUnit: 'satoshi', //BTC, mBTC, μBTC or satoshi
		selectedCurrency: 'USD',
		exchangeRateService: 'bitfinex',
		selectedLanguage: 'english',
	},
	action,
): ISettings => {
	switch (action.type) {
		case actions.UPDATE_SETTINGS:
			return {
				...state,
				...action.payload,
			};

		default:
			return state;
	}
};

export default settings;
