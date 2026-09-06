import { ipcMain } from 'electron';
import * as svc from '../service';
import type { UserInput, ProfilePatch } from '../dto';

export async function registerUserIpc(): Promise<void> {
  ipcMain.handle('user:list', () => svc.userList());
  ipcMain.handle('user:create', (_event, user: UserInput) => svc.userCreate(user));
  ipcMain.handle('user:update', (_event, user: UserInput) => svc.userUpdate(user));
  ipcMain.handle('user:delete', (_event, id: string) => svc.userDelete(id));

  // profile:get 已随 profileGet 一并删除（渲染端无调用方，登录时由 authLogin 合并资料）
  ipcMain.handle('profile:update', (_event, patch: ProfilePatch) => svc.profileUpdate(patch));

  ipcMain.handle('auth:login', (_event, { username, password }: { username: string; password: string }) =>
    svc.authLogin(username, password),
  );
  // S3：旧密码验证 + bcrypt 哈希全部在主进程完成
  ipcMain.handle('password:change', (_event, { username, currentPassword, newPassword }: { username: string; currentPassword: string; newPassword: string }) =>
    svc.passwordChangeSecure(username, currentPassword, newPassword),
  );
}
