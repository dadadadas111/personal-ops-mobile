import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { exportBackupPayload, importBackupPayload } from './database';
import type { BackupPayload } from './types';

export async function exportBackupFile() {
  const payload = await exportBackupPayload();
  const fileName = `personal-ops-backup-${payload.exportedAt.slice(0, 10)}.json`;
  const uri = `${FileSystem.documentDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Personal Ops Backup',
    });
  }

  return uri;
}

export async function importBackupFile() {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (result.canceled || !result.assets.length) {
    return false;
  }

  const asset = result.assets[0];
  const raw = await FileSystem.readAsStringAsync(asset.uri);
  const parsed = JSON.parse(raw) as BackupPayload;

  if (!parsed.schemaVersion || !parsed.data) {
    throw new Error('Invalid backup file');
  }

  await importBackupPayload(parsed);
  return true;
}
