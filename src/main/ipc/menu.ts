import { ipcMain } from 'electron';
import * as svc from '../service';
import type { MenuInput, MenuReorderEntry } from '../dto';

export async function registerMenuIpc(): Promise<void> {
  ipcMain.handle('menu:list', () => svc.menuList());
  ipcMain.handle('menu:upsert', (_event, menu: MenuInput) => svc.menuUpsert(menu));
  ipcMain.handle('menu:batch-update', (_event, entries: MenuReorderEntry[]) => svc.menuBatchUpdate(entries));
  ipcMain.handle('menu:delete', (_event, id: string) => svc.menuDelete(id));
}
