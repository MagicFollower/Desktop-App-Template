import { useState } from 'react';
import './WindowControls.css';

function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = () => {
    (window as any).electronAPI?.minimize();
  };

  const handleMaximize = () => {
    (window as any).electronAPI?.maximize();
    setIsMaximized(!isMaximized);
  };

  const handleClose = () => {
    (window as any).electronAPI?.close();
  };

  return (
    <div className="window-controls">
      <button className="control-btn close" onClick={handleClose}>
        <span className="control-icon">✕</span>
      </button>
      <button className="control-btn maximize" onClick={handleMaximize}>
        <span className="control-icon">{isMaximized ? '❐' : '□'}</span>
      </button>
      <button className="control-btn minimize" onClick={handleMinimize}>
        <span className="control-icon">—</span>
      </button>
    </div>
  );
}

export default WindowControls;
