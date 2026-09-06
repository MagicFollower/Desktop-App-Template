import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {LockOutlined, UserOutlined} from '@ant-design/icons';
import {useAuthStore} from '../../stores/useAuthStore';
import {authLogin} from '../../services/sqlite';
import {APP_NAME, APP_NAME_EN} from '../../app-config';
import './login.css';

function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username || !password) {
            setError('请输入用户名和密码');
            return;
        }

        setLoading(true);

        // B1：一次调用完成验证 + 取回库内完整用户信息。
        // 旧实现先验布尔，再在本地拼 id/role（username === 'admin' 硬编码），
        // 数据库中 zhangsan 的 manager 角色被无视，权限控制的源头即不可信。
        // 昵称/头像等个人资料已由 authLogin 在主进程合并（与个人信息页编辑结果一致）。
        const user = await authLogin(username, password);
        if (!user) {
            setError('用户名或密码错误');
            setLoading(false);
            return;
        }

        // 登录成功：token 为演示级占位（S4，见 README 第 8 章取舍声明）
        login('mock-token-' + Date.now(), user);
        navigate('/');

        setLoading(false);
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <h1>{APP_NAME}</h1>
                    <p>{APP_NAME_EN}</p>
                </div>

                <form className="login-form" onSubmit={handleLogin}>
                    {error && <div className="login-error">{error}</div>}

                    <div className="form-group">
                        <UserOutlined className="input-icon"/>
                        <input
                            type="text"
                            placeholder="用户名"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <LockOutlined className="input-icon"/>
                        <input
                            type="password"
                            placeholder="密码"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? '登录中...' : '登 录'}
                    </button>
                </form>

                <div className="login-footer">
                    <p>默认账号：admin / admin123（修改密码后以新密码登录）</p>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
