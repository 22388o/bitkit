import { Client } from 'backpack-host';
import bint from 'bint8array';
import { Readable, Duplex } from 'streamx';
import WSStream from 'webnet/websocket';
import { err, ok, Result } from '../result';
import {
	getKeychainValue,
	resetKeychainValue,
	setKeychainValue,
} from '../helpers';

//TODO move to config or .env
const serverInfo = {
	id: bint.fromString('test123'),
	url: 'wss://backpack.synonym.to',
};

enum BackpackKeychainKeys {
	username = 'backpackUsername',
	password = 'backpackPassword',
}

export interface IBackpackAuth {
	username: string;
	password: string;
}

/**
 * Username and password should be supplied on registration.
 * Is username and password is supplied those will be used.
 * If none are supplied the details found in the keychain will be used each time.
 * @param auth
 * @returns Client
 */
const clientFactory = async (auth?: IBackpackAuth): Client => {
	let username = '';
	let password = '';
	if (auth) {
		username = auth.username;
		password = auth.password;
	} else {
		username = (await getKeychainValue({ key: BackpackKeychainKeys.username }))
			.data;
		password = (await getKeychainValue({ key: BackpackKeychainKeys.password }))
			.data;
	}

	//If we didn't get passed auth details and none were found in the keychain then we can't proceed
	if (!username || !password) {
		throw new Error('No backpack auth details provided');
	}

	return new Client(bint.fromString(username), bint.fromString(password), {
		connect: (info, cb): void => {
			const socket = new WebSocket(info.url);
			socket.onerror = (socketErr): void => cb(socketErr);

			// socket must have stream api
			const ws = new WSStream(socket, {
				onconnect: (): void => cb(null, ws),
			});
		},
	});
};

/**
 * Saved backpack auth details to keychain
 * @param auth
 * @returns {Promise<void>}
 */
const saveAuthDetails = async (auth: IBackpackAuth): Promise<void> => {
	await setKeychainValue({
		key: BackpackKeychainKeys.username,
		value: auth.username,
	});
	await setKeychainValue({
		key: BackpackKeychainKeys.password,
		value: auth.password,
	});
};

/**
 * Wipes backpack auth details from keychain
 * @returns {Promise<void>}
 */
export const wipeAuthDetails = async (): Promise<void> => {
	await Promise.all([
		resetKeychainValue({
			key: BackpackKeychainKeys.username,
		}),
		resetKeychainValue({
			key: BackpackKeychainKeys.password,
		}),
	]);
};

/**
 * Gets backpack username. Returns empty string if not registered.
 * @return {Promise<string>}
 */
export const backpackUsername = async (): Promise<string> => {
	try {
		return (await getKeychainValue({ key: BackpackKeychainKeys.username }))
			.data;
	} catch (e) {
		return '';
	}
};

/**
 * Registers a new user on the Backpack server
 * @param auth
 * @returns {Promise<Ok<string> | Err<string>>}
 */
export const backpackRegister = async (
	auth: IBackpackAuth,
): Promise<Result<string>> => {
	try {
		const client = await clientFactory(auth);

		return new Promise((resolve) => {
			client.register(serverInfo, (registerErr) => {
				if (registerErr) {
					resolve(err(registerErr));
				}

				saveAuthDetails(auth)
					.then(() => {
						resolve(ok('Registered'));
					})
					.catch((e) => {
						resolve(err(e));
					});
			});
		});
	} catch (e) {
		return err(e);
	}
};

/**
 * Stores a string on the backpack server
 * @param backup
 * @returns {Promise<Ok<string> | Err<string>>}
 */
export const backpackStore = async (
	backup: Uint8Array,
): Promise<Result<string>> => {
	try {
		const client = await clientFactory();

		return new Promise((resolve) => {
			client.store(serverInfo, (storeErr, str) => {
				if (storeErr) {
					resolve(err(storeErr));
				}

				Readable.from(backup).pipe(str);

				resolve(ok('Stored successfully'));
			});
		});
	} catch (e) {
		return err(e);
	}
};

/**
 * Retrieves a string from the backpack server
 * @returns {Promise<Ok<string> | Err<string>>}
 */
export const backpackRetrieve = async (
	auth?: IBackpackAuth,
): Promise<Result<Uint8Array>> => {
	try {
		const client = await clientFactory(auth);

		return new Promise((resolve) => {
			client.retrieve(serverInfo, (retrieveErr, channel) => {
				if (retrieveErr) {
					return resolve(err(retrieveErr));
				}

				if (!channel) {
					return resolve(err('No channel found'));
				}

				channel.pipe(
					new Duplex({
						write(data, cb): void {
							const onDone = (): void => {
								resolve(ok(data));
								cb();
							};

							if (!auth) {
								return onDone();
							}

							saveAuthDetails(auth).finally(() => {
								onDone();
							});
						},
					}),
				);
			});
		});
	} catch (e) {
		return err(e);
	}
};