import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SyncStatus } from '../services/puzzleStore';

interface Props {
  status: SyncStatus;
}

const BG: Record<SyncStatus, string> = {
  synced: '#34D399',
  pending: '#FBBF24',
  failed: '#F87171',
};

const LABEL: Record<SyncStatus, string> = {
  synced: 'Synced',
  pending: 'Pending',
  failed: 'Failed',
};

export function SyncBadge({ status }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: BG[status] }]}>
      <Text style={styles.label}>{LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  label: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
