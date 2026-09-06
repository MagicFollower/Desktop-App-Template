import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraOutlined, DeleteOutlined } from '@ant-design/icons';
import Modal from '../../components/Modal/Modal';
import { useAuthStore } from '../../stores/useAuthStore';
import { saveProfile, changePassword } from '../../services/sqlite';
import './Profile.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^1\d{10}$/;
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

const roleLabels: Record<string, string> = {
  admin: '管理员',
  manager: '经理',
  user: '普通用户',
};

interface ProfileForm {
  nickname: string;
  email: string;
  phone: string;
}

interface PasswordForm {
  current: string;
  next: string;
  confirm: string;
}

const emptyPasswordForm: PasswordForm = { current: '', next: '', confirm: '' };

function Profile() {
  const userInfo = useAuthStore((state) => state.userInfo);
  const updateUserInfo = useAuthStore((state) => state.updateUserInfo);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>({ nickname: '', email: '', phone: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);
  const [passwordError, setPasswordError] = useState('');

  // 非编辑态时，表单始终跟随最新的用户信息（保存、登录后自动回填）
  useEffect(() => {
    if (editing || !userInfo) return;
    setForm({
      nickname: userInfo.nickname ?? '',
      email: userInfo.email ?? '',
      phone: userInfo.phone ?? '',
    });
  }, [editing, userInfo]);

  // 登录状态失效时自动跳转到登录页
  // 注意：不要调用 logout()，因为 userInfo 为 null 时 isAuthenticated 已经是 false，
  // 再次调用 logout() 会导致 AppLayout 同步返回 null 从而中断正在进行的导航
  useEffect(() => {
    if (!userInfo) {
      navigate('/login', { replace: true });
    }
  }, [userInfo, navigate]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  // userInfo 为空时（正在跳转中），不渲染页面内容
  if (!userInfo) {
    return null;
  }

  const applyPatch = async (patch: { nickname?: string; email?: string; phone?: string; avatar?: string }) => {
    updateUserInfo(patch);
    if (userInfo) {
      await saveProfile({ username: userInfo.username, ...patch });
    }
  };

  const handleAvatarSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 清空 value，保证连续选择同一个文件也能触发 change
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: '只能上传图片文件（jpg / png / gif / webp）' });
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setMessage({ type: 'error', text: '图片大小不能超过 2MB' });
      return;
    }

    // 使用 Canvas 压缩图片到 200x200
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (readEvent) => {
      img.src = String(readEvent.target?.result || '');
    };
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 200;
      let width = img.width;
      let height = img.height;

      // 计算缩放比例
      if (width > height) {
        if (width > MAX_SIZE) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setMessage({ type: 'error', text: '图片处理失败' });
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // 转换为 JPEG（质量 0.85，进一步减小体积）
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      applyPatch({ avatar: compressedDataUrl });
      setMessage({ type: 'success', text: '头像已更新（已自动压缩）' });
    };
    img.onerror = () => setMessage({ type: 'error', text: '图片加载失败，请重试' });
    reader.onerror = () => setMessage({ type: 'error', text: '头像读取失败，请重试' });
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    await applyPatch({ avatar: '' });
    setMessage({ type: 'success', text: '已恢复默认头像' });
  };

  const handleSave = async () => {
    const nickname = form.nickname.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (!nickname) {
      setMessage({ type: 'error', text: '昵称不能为空' });
      return;
    }
    if (nickname.length > 20) {
      setMessage({ type: 'error', text: '昵称长度不能超过 20 个字符' });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setMessage({ type: 'error', text: '邮箱格式不正确' });
      return;
    }
    if (phone && !PHONE_RE.test(phone)) {
      setMessage({ type: 'error', text: '手机号应为 11 位数字' });
      return;
    }
    await applyPatch({ nickname, email, phone });
    setForm({ nickname, email, phone });
    setEditing(false);
    setMessage({ type: 'success', text: '保存成功，设置已立即生效' });
  };

  const handleCancel = () => {
    setForm({
      nickname: userInfo.nickname ?? '',
      email: userInfo.email ?? '',
      phone: userInfo.phone ?? '',
    });
    setEditing(false);
  };

  const openPasswordModal = () => {
    setPasswordForm(emptyPasswordForm);
    setPasswordError('');
    setPasswordVisible(true);
  };

  const handleChangePassword = async () => {
    if (!userInfo) return;
    if (!passwordForm.current) {
      setPasswordError('请输入当前密码');
      return;
    }
    if (passwordForm.next.length < 6) {
      setPasswordError('新密码长度至少 6 位');
      return;
    }
    if (passwordForm.next === passwordForm.current) {
      setPasswordError('新密码不能与当前密码相同');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }
    try {
      // S3：旧密码校验 + bcrypt 哈希全部在主进程完成，渲染层不再接触哈希逻辑
      await changePassword(userInfo.username, passwordForm.current, passwordForm.next);
      setPasswordVisible(false);
      setMessage({ type: 'success', text: '密码修改成功，下次登录请使用新密码' });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : '密码修改失败，请重试');
    }
  };

  return (
    <div className="page-container">
      {message && (
        <div className={`profile-message ${message.type}`}>{message.text}</div>
      )}

      <div className="profile-layout">
        <section className="profile-side">
          <div className="avatar-preview">
            {userInfo.avatar ? (
              <img src={userInfo.avatar} alt="用户头像" />
            ) : (
              <span className="avatar-fallback">
                {userInfo.username.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="avatar-account">
            <span className="avatar-name">{userInfo.nickname || userInfo.username}</span>
            <span className={`role-badge ${userInfo.role}`}>
              {roleLabels[userInfo.role] || userInfo.role}
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="avatar-file-input"
            onChange={handleAvatarSelected}
          />
          <div className="avatar-actions">
            <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
              <CameraOutlined /> 上传头像
            </button>
            {userInfo.avatar && (
              <button className="btn-secondary" onClick={handleRemoveAvatar}>
                <DeleteOutlined /> 移除
              </button>
            )}
          </div>
          <p className="avatar-hint">支持 jpg / png / gif / webp，大小不超过 2MB</p>
        </section>

        <section className="profile-main">
          <div className="profile-section-header">
            <h3>基本资料</h3>
            {!editing ? (
              <button className="btn-primary" onClick={() => setEditing(true)}>
                编辑资料
              </button>
            ) : (
              <div className="profile-section-actions">
                <button className="btn-secondary" onClick={handleCancel}>取 消</button>
                <button className="btn-primary" onClick={handleSave}>保 存</button>
              </div>
            )}
          </div>

          <div className="profile-fields">
            <div className="profile-field">
              <label>用户名</label>
              <span className="profile-readonly">{userInfo.username}</span>
            </div>
            <div className="profile-field">
              <label>昵称</label>
              {editing ? (
                <input
                  value={form.nickname}
                  maxLength={20}
                  placeholder="请输入昵称"
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                />
              ) : (
                <span className="profile-readonly">{userInfo.nickname || '未设置'}</span>
              )}
            </div>
            <div className="profile-field">
              <label>邮箱</label>
              {editing ? (
                <input
                  value={form.email}
                  placeholder="请输入邮箱"
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              ) : (
                <span className="profile-readonly">{userInfo.email}</span>
              )}
            </div>
            <div className="profile-field">
              <label>手机号</label>
              {editing ? (
                <input
                  value={form.phone}
                  maxLength={11}
                  placeholder="请输入手机号"
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              ) : (
                <span className="profile-readonly">{userInfo.phone || '未设置'}</span>
              )}
            </div>
            <div className="profile-field">
              <label>角色</label>
              <span className="profile-readonly">
                {roleLabels[userInfo.role] || userInfo.role}
              </span>
            </div>
            <div className="profile-field">
              <label>注册时间</label>
              <span className="profile-readonly">
                {userInfo.createdAt ? new Date(userInfo.createdAt).toLocaleString() : '-'}
              </span>
            </div>
          </div>

          <div className="profile-security">
            <div className="profile-security-row">
              <div>
                <div className="profile-security-title">登录密码</div>
                <div className="profile-security-desc">
                  密码以 bcrypt 哈希保存，修改后请使用新密码登录
                </div>
              </div>
              <button className="btn-secondary" onClick={openPasswordModal}>
                修改密码
              </button>
            </div>
          </div>
        </section>
      </div>

      <Modal
        visible={passwordVisible}
        title="修改密码"
        onClose={() => setPasswordVisible(false)}
        onConfirm={handleChangePassword}
      >
        <div className="modal-form">
          <div className="modal-form-row">
            <label>当前密码</label>
            <input
              type="password"
              value={passwordForm.current}
              placeholder="请输入当前密码"
              onChange={(e) => {
                setPasswordError('');
                setPasswordForm({ ...passwordForm, current: e.target.value });
              }}
            />
          </div>
          <div className="modal-form-row">
            <label>新密码</label>
            <input
              type="password"
              value={passwordForm.next}
              placeholder="至少 6 位"
              onChange={(e) => {
                setPasswordError('');
                setPasswordForm({ ...passwordForm, next: e.target.value });
              }}
            />
          </div>
          <div className="modal-form-row">
            <label>确认新密码</label>
            <input
              type="password"
              value={passwordForm.confirm}
              placeholder="请再次输入新密码"
              onChange={(e) => {
                setPasswordError('');
                setPasswordForm({ ...passwordForm, confirm: e.target.value });
              }}
            />
          </div>
          {passwordError && <p className="profile-error-text">{passwordError}</p>}
        </div>
      </Modal>
    </div>
  );
}

export default Profile;
