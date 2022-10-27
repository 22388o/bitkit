import React, { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { View } from '../styles/components';

const Dot = ({ active }: { active?: boolean }): ReactElement => (
	<View style={styles.dot} color={active ? 'white' : 'gray2'} />
);

const styles = StyleSheet.create({
	dot: {
		width: 7,
		height: 7,
		borderRadius: 4,
		marginLeft: 4,
		marginRight: 4,
	},
});

export default Dot;
