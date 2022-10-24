import {
	removeKeysFromObject,
	mergeArrayOfObjects,
} from '../src/utils/helpers';

describe('removeKeysFromObject', () => {
	it('takes a string, removes a single key from the object and returns the result', () => {
		const input = {
			a: '1',
			b: '2',
			c: '3',
		};

		const expected = {
			a: '1',
			c: '3',
		};

		const result = removeKeysFromObject(input, 'b');
		expect(result).toEqual(expected);
	});

	it('takes an array of strings, removes multiple keys from the object and returns the result', () => {
		const input = {
			a: '1',
			b: '2',
			c: '3',
		};

		const expected = {
			c: '3',
		};

		const result = removeKeysFromObject(input, ['a', 'b']);
		expect(result).toEqual(expected);
	});
});

describe('mergeArrayOfObjects', () => {
	const array1 = [
		{
			id: 1,
			address: 'address1',
		},
	];
	const array2 = [
		{
			id: 1,
			address: 'address2',
			value: 10000,
		},
	];
	const array3 = [
		{
			id: 2,
			address: 'address3',
			value: 30000,
		},
	];

	it('takes two arrays with the same id, merges them and returns the result', () => {
		const expected = [
			{
				id: 1,
				address: 'address2',
				value: 10000,
			},
		];

		const result = mergeArrayOfObjects([array1, array2], 'id');
		expect(result).toEqual(expected);
	});

	it('takes three arrays with different ids, merges them and returns the result', () => {
		const expected = [
			{
				id: 1,
				address: 'address2',
				value: 10000,
			},
			{
				id: 2,
				address: 'address3',
				value: 30000,
			},
		];

		const result = mergeArrayOfObjects([array1, array2, array3], 'id');
		expect(result).toEqual(expected);
	});
});
