import { ipcMain, dialog } from 'electron';
import * as svc from '../service';
import type { FileConfigInput, FileUploadMeta, FileDirInput } from '../dto';

export async function registerFileIpc(): Promise<void> {
  ipcMain.handle('file:list', () => svc.fileList());

  // 目录：逻辑目录树（不落盘）——列表/新增/删除（只允许删空目录，业务规则在 service）
  ipcMain.handle('file:dir-list', () => svc.fileDirList());
  ipcMain.handle('file:dir-create', (_event, input: FileDirInput) => svc.fileDirCreate(input ?? { parentId: null, name: '' }));
  ipcMain.handle('file:dir-delete', (_event, id: string) => svc.fileDirDelete(String(id || '')));

  // 上传：二进制走 IPC 结构化克隆（Uint8Array 整块传输，单文件上限见 file-util.FILE_MAX_BYTES）
  ipcMain.handle('file:upload', (_event, meta: FileUploadMeta, data: Uint8Array) =>
    svc.fileUpload(meta, new Uint8Array(data)),
  );

  // 删除：单条/批量统一入口（单条即长度 1 的数组）
  ipcMain.handle('file:delete', (_event, ids: string[]) => svc.fileDelete(ids));

  // 下载：读物理文件并写入用户选择的目录（二进制不过渲染进程，主进程直连磁盘）
  ipcMain.handle('file:save-to', (_event, ids: string[], targetDir: string) =>
    svc.fileSaveTo(Array.isArray(ids) ? ids.map(String) : [], String(targetDir || '')),
  );

  // 选择下载目录：主进程原生目录选择器（浏览器环境无此能力，HTTP 通路不暴露）
  ipcMain.handle('file:select-dir', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle('file:config-get', () => svc.fileConfigGet());
  ipcMain.handle('file:config-save', (_event, input: FileConfigInput) => svc.fileConfigSave(input));
}
