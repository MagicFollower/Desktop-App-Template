import type { ReactNode } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import './Modal.css';

interface ModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onConfirm?: () => void;
  children: ReactNode;
  confirmText?: string;
  width?: number;
}

function Modal({ visible, title, onClose, onConfirm, children, confirmText = '确 定', width }: ModalProps) {
  if (!visible) return null;

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-container" style={width ? { width } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <CloseOutlined />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>取 消</button>
          {onConfirm && (
            <button className="btn-primary" onClick={onConfirm}>{confirmText}</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Modal;
