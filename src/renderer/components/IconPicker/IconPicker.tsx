import { useState, useMemo } from 'react';
import * as Icons from '@ant-design/icons';
import './IconPicker.css';

// 常用图标白名单（避免渲染全部 500+ 图标导致性能问题）
const COMMON_ICONS = [
  'DashboardOutlined',
  'SettingOutlined',
  'UserOutlined',
  'IdcardOutlined',
  'MenuOutlined',
  'FolderOutlined',
  'DatabaseOutlined',
  'CloudServerOutlined',
  'ToolOutlined',
  'FileOutlined',
  'HomeOutlined',
  'TeamOutlined',
  'LockOutlined',
  'MailOutlined',
  'PhoneOutlined',
  'CalendarOutlined',
  'BellOutlined',
  'StarOutlined',
  'HeartOutlined',
  'SearchOutlined',
  'PlusOutlined',
  'EditOutlined',
  'DeleteOutlined',
  'SaveOutlined',
  'UploadOutlined',
  'DownloadOutlined',
  'CloseOutlined',
  'CheckOutlined',
  'WarningOutlined',
  'InfoCircleOutlined',
  'QuestionCircleOutlined',
  'ExclamationCircleOutlined',
  'SyncOutlined',
  'LoadingOutlined',
  'PoweroffOutlined',
  'LogoutOutlined',
  'LoginOutlined',
  'ProfileOutlined',
  'SafetyCertificateOutlined',
  'KeyOutlined',
  'EyeOutlined',
  'EyeInvisibleOutlined',
  'CameraOutlined',
  'PictureOutlined',
  'VideoCameraOutlined',
  'SoundOutlined',
  'RocketOutlined',
  'ThunderboltOutlined',
  'FireOutlined',
  'TrophyOutlined',
  'MedalOutlined',
  'CrownOutlined',
  'GiftOutlined',
  'ShoppingCartOutlined',
  'CarOutlined',
  'BikeOutlined',
  'MoneyCollectOutlined',
  'CreditCardOutlined',
  'BankOutlined',
  'InsuranceOutlined',
  'FundOutlined',
  'PieChartOutlined',
  'BarChartOutlined',
  'LineChartOutlined',
  'DotChartOutlined',
  'RadarChartOutlined',
  'AreaChartOutlined',
];

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

function IconPicker({ value, onChange }: IconPickerProps) {
  const [search, setSearch] = useState('');

  const filteredIcons = useMemo(() => {
    if (!search) return COMMON_ICONS;
    const keyword = search.toLowerCase();
    return COMMON_ICONS.filter((name) => name.toLowerCase().includes(keyword));
  }, [search]);

  const SelectedIcon = value ? (Icons as any)[value] : null;

  return (
    <div className="icon-picker">
      <input
        className="icon-search"
        value={search}
        placeholder="搜索图标名称..."
        onChange={(e) => setSearch(e.target.value)}
      />
      {SelectedIcon && (
        <div className="icon-selected-preview">
          <SelectedIcon className="icon-selected-icon" />
          <span>{value}</span>
        </div>
      )}
      <div className="icon-grid">
        {filteredIcons.map((iconName) => {
          const IconComp = (Icons as any)[iconName];
          if (!IconComp) return null;
          const isSelected = iconName === value;
          return (
            <button
              key={iconName}
              type="button"
              className={`icon-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onChange(iconName)}
              title={iconName}
            >
              <IconComp />
            </button>
          );
        })}
        {filteredIcons.length === 0 && (
          <div className="icon-empty">未找到匹配的图标</div>
        )}
      </div>
    </div>
  );
}

export default IconPicker;
