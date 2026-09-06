export interface UserInfo {
  id: string;
  username: string;
  /** 用户编码（用户账号）：单据号规则 USER 自动生成，只读 */
  userCode: string;
  nickname?: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user' | 'manager';
  phone?: string;
  status?: 'active' | 'disabled';
  createdAt: string;
}
