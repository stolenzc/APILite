import { useCallback, useEffect, useRef } from 'react';

const MIN_WIDTH = 200;
const MAX_WIDTH = 720;

interface Props {
  width: number;
  onWidthChange: (width: number) => void;
  disabled?: boolean;
}

export default function VerticalResizableSplitter({ width, onWidthChange, disabled }: Props) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const getMaxWidth = useCallback(() => {
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - 480));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      startX.current = e.clientX;
      startWidth.current = width;
      dragging.current = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [disabled, width],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX;
      const maxW = getMaxWidth();
      const newWidth = Math.max(MIN_WIDTH, Math.min(maxW, startWidth.current + delta));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onWidthChange, getMaxWidth]);

  return (
    <div
      className={`splitter splitter-v ${disabled ? 'splitter-v-disabled' : ''}`}
      onMouseDown={handleMouseDown}
      aria-hidden
    >
      <div className="splitter-handle splitter-handle-v" />
    </div>
  );
}
