import Client from '@synonymdev/backpack-client';
import { err, ok, Result } from '../result';
import {
	getKeychainValue,
	resetKeychainValue,
	setKeychainValue,
} from '../helpers';

//TODO move to config or .env
const server = {
	id: 'test123',
	url: 'wss://backpack.synonym.to',
};
const padding = 1024;

enum BackpackKeychainKeys {
	username = 'backpackUsername',
	password = 'backpackPassword',
	key = 'backpackKey',
}

export interface IBackpackAuth {
	username: string;
	password: string;
}

const opts = {
	memlimit: 16777216, // crypto_pwhash_MEMLIMIT_MIN
	opslimit: 2, // crypto_pwhash_OPSLIMIT_MIN
};

/**
 * Username and password should be supplied on registration.
 * Is username and password is supplied those will be used.
 * If none are supplied the details found in the keychain will be used each time.
 * @param auth
 * @returns Client
 */
let clientSingleton: Client | undefined;

const clientFactory = async (auth?: IBackpackAuth): Promise<Client> => {
	let username = '';
	let password = '';
	if (auth) {
		username = auth.username;
		password = auth.password;
	} else {
		username = await backpackUsername();
		password = await backpackPassword();
	}

	//If we didn't get passed auth details and none were found in the keychain then we can't proceed
	if (!username || !password) {
		throw new Error('No backpack auth details provided');
	}

	if (!clientSingleton) {
		let keyHex = await backpackKey();

		clientSingleton = new Client(
			{ username, password, keyHex },
			server,
			opts,
			padding,
		);
	}

	return clientSingleton;
};

/**
 * This function can be time consuming
 * @returns {Promise<void>}
 */
const createKeyIfMissing = async (client: Client) => {
	let keyHex = await backpackKey();
	if (keyHex) {
		return client.setKey(keyHex, opts);
	}

	//No cached key found then hash a new one
	try {
		keyHex = await client.createKey();
		await saveEncryptionKey(keyHex);
	} catch (e) {
		console.error(e);
		throw e;
	}
};

/**
 * Saved backpack auth details to keychain
 * @param auth
 * @returns {Promise<void>}
 */
const saveAuthDetails = async (auth: IBackpackAuth): Promise<void> => {
	//TODO replace with just key
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
 * Saved backpack encryption key details to keychain
 * @param auth
 * @returns {Promise<void>}
 */
const saveEncryptionKey = async (key: string): Promise<void> => {
	await setKeychainValue({
		key: BackpackKeychainKeys.key,
		value: key,
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

//TODO remove username/password as we should only store the encryption key
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
 * Gets backpack password. Returns empty string if not registered.
 * @return {Promise<string>}
 */
export const backpackPassword = async (): Promise<string> => {
	try {
		return (await getKeychainValue({ key: BackpackKeychainKeys.password }))
			.data;
	} catch (e) {
		return '';
	}
};

/**
 * Gets backpack encryption key. Returns empty string if not registered.
 * @return {Promise<string>}
 */
export const backpackKey = async (): Promise<string> => {
	try {
		return (await getKeychainValue({ key: BackpackKeychainKeys.key })).data;
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

		await client.register();

		await saveAuthDetails(auth);

		return ok('Registered');
	} catch (e) {
		console.error(e);
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
		//TODO place back once we can store the password hash. Freezes the app while hashing on each backup.
		const client = await clientFactory();
		await createKeyIfMissing(client);
		await client.store(backup);

		return ok('Stored successfully');
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
		await createKeyIfMissing(client);
		const res = await client.retrieve();

		if (auth) {
			await saveAuthDetails(auth);
		}

		return ok(res);
	} catch (e) {
		return err(e);
	}
};
