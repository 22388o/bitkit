// what bip21.decode() returns
// amount is number, rest are strings
export type Bip21DecodeResult = {
	address: string;
	options: {
		amount: number;
		message: string;
		lightning: string;
	};
};
