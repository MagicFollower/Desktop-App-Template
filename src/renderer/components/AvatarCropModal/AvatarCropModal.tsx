import { useEffect, useRef, useState, useCallback } from 'react';
import Modal from '../Modal/Modal';

interface Props {
  visible: boolean;
  imageSrc: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

/**
 * 头像圆形裁剪弹窗
 * 交互：拖拽移动图片 / 滚轮缩放 / 滑块缩放 / 重置
 * 输出：200×200 JPEG 正方形区域（由 CSS border-radius 显示为圆形）
 */
function AvatarCropModal({ visible, imageSrc, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // 图片当前缩放与偏移
  const stateRef = useRef({ scale: 1, x: 0, y: 0 });
  // 拖拽起始
  const dragRef = useRef({ active: false, startX: 0, startY: 0, imgX: 0, imgY: 0 });

  const [zoomValue, setZoomValue] = useState(0);

  const SIZE = 300;   // 画布 CSS 尺寸
  const R = 120;      // 圆形裁剪半径
  const OUTPUT = 200; // 输出头像尺寸（与原有压缩逻辑一致）

  /** 计算当前图片的有效缩放范围 [minS, maxS] */
  const getScaleRange = () => {
    const img = imgRef.current!;
    const minDim = Math.min(img.naturalWidth, img.naturalHeight);
    const minS = (R * 2) / minDim; // 短边刚好填满圆形直径
    return { minS, maxS: minS * 4 };
  };

  /** 以画布中心为锚点应用新缩放，并约束位置、重绘 */
  const applyScale = (newScale: number) => {
    const cx = SIZE / 2;
    const { scale: oldS, x: oldX, y: oldY } = stateRef.current;
    const newX = cx - (cx - oldX) * (newScale / oldS);
    const newY = cx - (cx - oldY) * (newScale / oldS);
    const pos = clamp(newX, newY, newScale);
    stateRef.current = { scale: newScale, x: pos.x, y: pos.y };
    draw();
  };

  /** 同步滑块值（将实际缩放线性映射到 0-100） */
  const syncZoomSlider = (currentScale: number) => {
    const { minS, maxS } = getScaleRange();
    setZoomValue(Math.round(((currentScale - minS) / (maxS - minS)) * 100));
  };

  // 约束图片位置，保证圆形裁剪区域始终被图片完全覆盖
  // 圆形区域范围：[SIZE/2 - R, SIZE/2 + R]
  // 需要满足：x ≤ SIZE/2 - R 且 x + dw ≥ SIZE/2 + R（Y 轴同理）
  const clamp = useCallback((x: number, y: number, s: number) => {
    const img = imgRef.current;
    if (!img) return { x, y };
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    const edge = SIZE / 2 - R; // 圆形区域左/上边界 = 30
    const maxX = edge;
    const minX = SIZE / 2 + R - dw; // 圆形区域右/下边界 - 图片宽
    const maxY = edge;
    const minY = SIZE / 2 + R - dh;
    return {
      x: Math.max(Math.min(x, maxX), minX),
      y: Math.max(Math.min(y, maxY), minY),
    };
  }, []);

  // 绘制画布：图片 + 半透明遮罩 + 圆形可视区 + 网格参考线
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y, scale: s } = stateRef.current;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // 绘制图片
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    ctx.drawImage(img, x, y, dw, dh);

    // 圆形半透明遮罩
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SIZE, SIZE);
    ctx.arc(SIZE / 2, SIZE / 2, R, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();
    ctx.restore();

    // 圆形白色边框
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, R, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 中心十字参考线（淡色）
    ctx.beginPath();
    ctx.moveTo(SIZE / 2 - 10, SIZE / 2);
    ctx.lineTo(SIZE / 2 + 10, SIZE / 2);
    ctx.moveTo(SIZE / 2, SIZE / 2 - 10);
    ctx.lineTo(SIZE / 2, SIZE / 2 + 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, []);

  // 图片加载完成后初始化位置与缩放
  useEffect(() => {
    if (!visible || !imageSrc) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = SIZE;
      canvas.height = SIZE;

      // 初始缩放：让图片短边刚好填满圆形直径
      const minDim = Math.min(img.naturalWidth, img.naturalHeight);
      const initScale = (R * 2) / minDim;
      const dw = img.naturalWidth * initScale;
      const dh = img.naturalHeight * initScale;
      stateRef.current = {
        scale: initScale,
        x: (SIZE - dw) / 2,
        y: (SIZE - dh) / 2,
      };
      setZoomValue(0);
      draw();
    };
    img.src = imageSrc;
  }, [visible, imageSrc, draw]);

  // ---- 交互：拖拽 ----
  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      imgX: stateRef.current.x,
      imgY: stateRef.current.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const pos = clamp(
      dragRef.current.imgX + dx,
      dragRef.current.imgY + dy,
      stateRef.current.scale,
    );
    stateRef.current.x = pos.x;
    stateRef.current.y = pos.y;
    draw();
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
  };

  // ---- 交互：滚轮缩放 ----
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!imgRef.current) return;
    const { minS, maxS } = getScaleRange();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const newScale = Math.max(minS, Math.min(stateRef.current.scale * factor, maxS));
    applyScale(newScale);
    syncZoomSlider(newScale);
  };

  // ---- 交互：滑块缩放 ----
  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!imgRef.current) return;
    const val = Number(e.target.value);
    setZoomValue(val);
    const { minS, maxS } = getScaleRange();
    applyScale(minS + (val / 100) * (maxS - minS));
  };

  // 重置到初始位置与缩放
  const handleReset = () => {
    if (!imgRef.current) return;
    const { minS } = getScaleRange();
    const img = imgRef.current;
    const dw = img.naturalWidth * minS;
    const dh = img.naturalHeight * minS;
    stateRef.current = { scale: minS, x: (SIZE - dw) / 2, y: (SIZE - dh) / 2 };
    setZoomValue(0);
    draw();
  };

  // 确认裁剪：从原图按当前视口区域裁出 200×200 正方形，JPEG 0.85 压缩
  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;
    const { x, y, scale: s } = stateRef.current;
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    // 圆形区域中心在原图上的坐标
    const srcCx = (cx - x) / s;
    const srcCy = (cy - y) / s;
    // 裁剪正方形边长（原图像素）
    const srcHalf = R / s;
    const srcX = srcCx - srcHalf;
    const srcY = srcCy - srcHalf;
    const srcSize = srcHalf * 2;

    const out = document.createElement('canvas');
    out.width = OUTPUT;
    out.height = OUTPUT;
    const octx = out.getContext('2d');
    if (!octx) return;
    octx.drawImage(
      img,
      srcX, srcY, srcSize, srcSize,
      0, 0, OUTPUT, OUTPUT,
    );
    // 保持原有压缩逻辑：JPEG 质量 0.85
    onConfirm(out.toDataURL('image/jpeg', 0.85));
  };

  return (
    <Modal visible={visible} title="调整头像" onConfirm={handleConfirm} onClose={onCancel} confirmText="确认裁剪">
      <div className="avatar-crop-body">
        <canvas
          ref={canvasRef}
          className="avatar-crop-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
        />
        <div className="avatar-crop-controls">
          <span className="avatar-crop-label">缩放</span>
          <input
            type="range"
            min={0}
            max={100}
            value={zoomValue}
            onChange={handleZoomChange}
            className="avatar-crop-range"
          />
          <button className="btn-secondary avatar-crop-reset" onClick={handleReset}>
            重置
          </button>
        </div>
        <p className="avatar-crop-tip">拖拽移动图片 · 滚轮缩放 · 在圆形区域内选择头像</p>
      </div>
    </Modal>
  );
}

export default AvatarCropModal;
