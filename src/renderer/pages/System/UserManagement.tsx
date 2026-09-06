import { useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import QueryForm from '../../components/QueryForm/QueryForm';
import type { QueryFieldConfig, QueryOption } from '../../components/QueryForm/QueryForm';
import QueryTableLayout from '../../components/QueryTableLayout/QueryTableLayout';
import Pagination from '../../components/Pagination/Pagination';
import Modal from '../../components/Modal/Modal';
import { useQueryTable } from '../../hooks/useQueryTable';
import type { QueryParams } from '../../hooks/useQueryTable';
import type { UserInfo } from '../../types/user';
import { loadUsers, saveUser, deleteUser } from '../../services/sqlite';
import './UserManagement.css';

// 角色选项：value 为取用的标识（id），label 为展示名，desc 为附加属性 —— 用于演示「展示 name 取 id」
const roleOptions: QueryOption[] = [
  { value: 'admin', label: '管理员', desc: '系统最高权限' },
  { value: 'manager', label: '经理', desc: '业务管理权限' },
  { value: 'user', label: '普通用户', desc: '基础查看权限' },
];

const queryFields: QueryFieldConfig[] = [
  { name: 'username', label: '用户名', type: 'input' },
  { name: 'email', label: '邮箱', type: 'input' },
  { name: 'phone', label: '手机号', type: 'input' },
  {
    name: 'role',
    label: '角色',
    type: 'select',
    options: roleOptions,
    showSearch: true,
    // 自定义渲染：一行内展示名称 + 附加描述，但真正写入查询条件的是 option.value
    optionRender: (opt) => (
      <span className="role-option">
        <span className="role-option-name">{opt.label}</span>
        <span className="role-option-desc">{(opt.desc as string) || ''}</span>
      </span>
    ),
  },
  {
    name: 'status',
    label: '状态',
    type: 'select',
    multiple: true,
    maxTagCount: 2,
    options: [
      { value: 'active', label: '正常' },
      { value: 'disabled', label: '停用' },
    ],
  },
];

/** 从查询条件里安全取字符串值（文本/单选字段） */
const asStr = (v?: QueryParams[string]): string => (typeof v === 'string' ? v : '');
/** 从查询条件里安全取数组值（多选字段） */
const asArr = (v?: QueryParams[string]): string[] => (Array.isArray(v) ? v : []);

/**
 * 客户端过滤：必须是纯函数、定义在模块作用域，以保证 useQueryTable 中引用稳定。
 */
function filterUsers(records: UserInfo[], query: QueryParams): UserInfo[] {
  const username = asStr(query.username);
  const email = asStr(query.email);
  const phone = asStr(query.phone);
  const role = asStr(query.role);
  const statuses = asArr(query.status); // 状态为多选，空数组代表不限
  return records.filter((u) => {
    if (username && !u.username.includes(username)) return false;
    if (email && !u.email.includes(email)) return false;
    if (phone && !(u.phone || '').includes(phone)) return false;
    if (role && u.role !== role) return false;
    if (statuses.length > 0 && !statuses.includes(u.status || 'active')) return false;
    return true;
  });
}

const roleLabels: Record<string, string> = {
  admin: '管理员',
  manager: '经理',
  user: '普通用户',
};

interface UserFormState {
  id: string | null;
  username: string;
  /** 只读展示：新增时为空（保存后由服务端生成），编辑时回显 */
  userCode: string;
  email: string;
  phone: string;
  role: UserInfo['role'];
  status: 'active' | 'disabled';
}

const emptyForm: UserFormState = {
  id: null,
  username: '',
  userCode: '',
  email: '',
  phone: '',
  role: 'user',
  status: 'active',
};

function UserManagement() {
  const {
    loading,
    records: users,
    rows: pagedUsers,
    total,
    page,
    pageSize,
    search,
    reload,
    onPageChange,
  } = useQueryTable<UserInfo>({
    // 每次点击查询都重新拉取最新数据（空条件即查全部）；过滤与分页在拉取后进行。
    // A1：mock 兑底数据已下沉到适配层（纯浏览器演示模式），生产路径只读数据库
    fetcher: () => loadUsers(),
    filter: filterUsers,
  });

  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<UserInfo | null>(null);
  const [saveError, setSaveError] = useState('');

  const openAdd = () => {
    setForm(emptyForm);
    setSaveError('');
    setFormVisible(true);
  };

  const openEdit = (user: UserInfo) => {
    setForm({
      id: user.id,
      username: user.username,
      userCode: user.userCode || '',
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      status: user.status || 'active',
    });
    setSaveError('');
    setFormVisible(true);
  };

  const handleSave = async () => {
    setSaveError('');
    if (!form.username.trim()) {
      setSaveError('请输入用户名');
      return;
    }
    if (!form.email.trim()) {
      setSaveError('请输入邮箱');
      return;
    }

    const isEdit = !!form.id;
    // 编辑时以列表中的原始记录为基础，保留表单未暴露的字段（头像、昵称、创建时间），
    // 否则这些字段会在更新时被清空；新增时才生成 id 与 createdAt。
    const original = isEdit ? users.find((u) => u.id === form.id) : undefined;

    const userData: UserInfo = {
      id: form.id ?? `user-${Date.now()}`,
      username: form.username.trim(),
      // userCode 不随保存提交：新增由服务端生成，编辑不改（UserInput 无此字段）
      userCode: original?.userCode ?? '',
      email: form.email.trim(),
      phone: form.phone.trim(),
      avatar: original?.avatar ?? '',
      nickname: original?.nickname ?? '',
      role: form.role,
      status: form.status,
      createdAt: original?.createdAt ?? new Date().toISOString(),
    };

    try {
      // 显式告知底层是新增还是更新，不再依赖字段推断
      await saveUser(userData, isEdit);
      // 保存后只重新拉取一次，拿到带 created_at 等字段的最新记录，保证与库一致
      await reload();
      setFormVisible(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败，请重试');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteUser(deleteTarget.id);
    setDeleteTarget(null);
    // 删除后刷新一次；若当前页因总数变少越界，useQueryTable 会自动收敛页码
    await reload();
  };

  return (
    <QueryTableLayout
      loading={loading}
      query={<QueryForm fields={queryFields} onSearch={search} />}
      toolbar={
        <button className="btn-primary" onClick={openAdd}>
          <PlusOutlined /> 新增用户
        </button>
      }
      pagination={
        total > 0 ? (
          <Pagination current={page} pageSize={pageSize} total={total} onChange={onPageChange} />
        ) : undefined
      }
    >
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户编码</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>手机号</th>
            <th>角色</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {pagedUsers.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td className="user-code-cell">{user.userCode || '-'}</td>
              <td>{user.username}</td>
              <td>{user.email}</td>
              <td>{user.phone || '-'}</td>
              <td>
                <span className={`role-badge ${user.role}`}>{roleLabels[user.role]}</span>
              </td>
              <td>
                <span className={`status-badge ${user.status || 'active'}`}>
                  {user.status === 'disabled' ? '停用' : '正常'}
                </span>
              </td>
              <td>{new Date(user.createdAt).toLocaleDateString()}</td>
              <td>
                <button className="btn-link" onClick={() => openEdit(user)}>编辑</button>
                <button className="btn-link danger" onClick={() => setDeleteTarget(user)}>删除</button>
              </td>
            </tr>
          ))}
          {total === 0 && (
            <tr>
              <td colSpan={9} className="table-empty">暂无数据</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 新增/编辑用户弹窗 */}
      <Modal
        visible={formVisible}
        title={form.id ? '编辑用户' : '新增用户'}
        onClose={() => { setFormVisible(false); setSaveError(''); }}
        onConfirm={handleSave}
      >
        <div className="modal-form">
          {saveError && <p style={{ color: 'var(--color-danger)', margin: '0 0 12px', fontSize: '13px' }}>{saveError}</p>}
          <div className="modal-form-row">
            <label>用户编码</label>
            {/* 只读：新增时由单据号规则 USER 服务端生成，不可编辑（避免伪造/冲突） */}
            <input
              value={form.userCode || '保存后自动生成'}
              disabled
              className="readonly-input"
              placeholder="保存后自动生成"
            />
          </div>
          <div className="modal-form-row">
            <label>用户名</label>
            <input
              value={form.username}
              onChange={(e) => { setForm({ ...form, username: e.target.value }); setSaveError(''); }}
              placeholder="请输入用户名"
            />
          </div>
          <div className="modal-form-row">
            <label>邮箱</label>
            <input
              value={form.email}
              onChange={(e) => { setForm({ ...form, email: e.target.value }); setSaveError(''); }}
              placeholder="请输入邮箱"
            />
          </div>
          <div className="modal-form-row">
            <label>手机号</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="请输入手机号"
            />
          </div>
          <div className="modal-form-row">
            <label>角色</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserInfo['role'] })}
            >
              <option value="admin">管理员</option>
              <option value="manager">经理</option>
              <option value="user">普通用户</option>
            </select>
          </div>
          <div className="modal-form-row">
            <label>状态</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'disabled' })}
            >
              <option value="active">正常</option>
              <option value="disabled">停用</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        visible={deleteTarget !== null}
        title="删除确认"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        confirmText="删 除"
      >
        <p className="delete-confirm-text">
          确定要删除用户 <strong>{deleteTarget?.username}</strong> 吗？此操作不可恢复。
        </p>
      </Modal>
    </QueryTableLayout>
  );
}

export default UserManagement;
