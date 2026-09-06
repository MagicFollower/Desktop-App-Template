import { ipcMain } from 'electron';
import * as svc from '../service';
import type { DocRuleInput } from '../dto';

export async function registerDocIpc(): Promise<void> {
  ipcMain.handle('doc:rule-list', () => svc.docRuleList());
  ipcMain.handle('doc:rule-upsert', (_event, rule: DocRuleInput) => svc.docRuleUpsert(rule));
  ipcMain.handle('doc:rule-delete', (_event, id: string) => svc.docRuleDelete(id));
  ipcMain.handle('doc:next-number', (_event, code: string) => svc.docNextNumber(code));
}
