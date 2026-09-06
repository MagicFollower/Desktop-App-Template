/**
 * 应用展示信息单点配置（D7）。
 *
 * 起项目第一步就改这里：标题栏、侧边栏、登录页全部引用本文件，
 * 不再散落三处硬编码（旧实现登录页"企业管理后台"、标题栏"Desktop App(测试环境)"、
 * 侧边栏"管理系统"各说各话）。index.html 的 <title> 与 electron-builder 的
 * productName 仍需同步修改（见 README 9.1）。
 */
export const APP_NAME = 'Desktop App';

/** 登录页副标题（应用定位的一句话说明） */
export const APP_NAME_EN = 'Desktop App Template';

/** 开发态窗口标题后缀：打包后不显示 */
export const DEV_TITLE_SUFFIX = '(dev)';

/** 标题栏文案：开发态带后缀，便于区分 dev 窗口与安装版 */
export function titleBarText(): string {
  // import.meta.env.DEV 由 Vite 注入：dev server 下为 true，生产构建为 false
  return import.meta.env.DEV ? `${APP_NAME}${DEV_TITLE_SUFFIX}` : APP_NAME;
}
