import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Mini'>;

export function MiniScreen({ route }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.text}>Mini Crossword — {route.params.date}</Text>
      <Text style={styles.sub}>Coming soon</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  text: { fontSize: 20, fontWeight: '700' },
  sub: { color: '#9CA3AF', marginTop: 8 },
});
