import { useEffect, useState } from 'react';
import { CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import './Toast.css';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircleOutlined />,
  warning: <ExclamationCircleOutlined />,
  error: <CloseCircleOutlined />,
  info: <InfoCircleOutlined />,
};

export default function Toast({ id, type, message, duration = 3000, onClose }: ToastProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsRemoving(true);
    // 等待动画完成后再真正移除
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  return (
    <div className={`toast toast-${type} ${isRemoving ? 'removing' : ''}`}>
      <span className="toast-icon">{iconMap[type]}</span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={handleClose}>×</button>
    </div>
  );
}
