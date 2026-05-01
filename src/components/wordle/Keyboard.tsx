import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TileState } from '../../services/wordle';

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
];

const KEY_BG: Record<TileState, string> = {
  correct: '#538D4E',
  present: '#B59F3B',
  absent: '#3A3A3C',
  pending: '#818384',
  empty: '#818384',
};

interface Props {
  keyColors: Record<string, TileState>;
  onKey: (key: string) => void;
  disabled?: boolean;
}

export function Keyboard({ keyColors, onKey, disabled = false }: Props) {
  return (
    <View style={styles.container} testID="keyboard">
      {ROWS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map(key => {
            const state = keyColors[key];
            const bg = state ? KEY_BG[state] : '#818384';
            const isWide = key === 'ENTER' || key === '⌫';
            return (
              <Pressable
                key={key}
                testID={`key-${key}`}
                style={[styles.key, isWide && styles.wide, { backgroundColor: bg }]}
                onPress={() => onKey(key)}
                disabled={disabled}
              >
                <Text style={styles.keyText}>{key}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  key: {
    height: 56,
    minWidth: 36,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  wide: { minWidth: 56 },
  keyText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
