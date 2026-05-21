import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  width: number;
  onWidthChange: (width: number) => void;
  disabled?: boolean;
  /** `left`: drag right to widen (collection sidebar). `right`: drag left to widen (cURL panel). */
  side?: 'left' | 'right';
  minWidth?: number;
  maxWidth?: number;
}

export default function VerticalResizableSplitter({
  width,
  onWidthChange,
  disabled,
  side = 'right',
  minWidth = 200,
  maxWidth = 720,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const getMaxWidth = useCallback(() => {
    return Math.min(maxWidth, Math.max(minWidth, window.innerWidth - 480));
  }, [maxWidth, minWidth]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      startX.current = e.clientX;
      startWidth.current = width;
      draggingRef.current = true;
      setDragging(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [disabled, width],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = side === 'left' ? e.clientX - startX.current : startX.current - e.clientX;
      const maxW = getMaxWidth();
      const newWidth = Math.max(minWidth, Math.min(maxW, startWidth.current + delta));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onWidthChange, getMaxWidth, minWidth, side]);

  return (
    <div
      className={`splitter-v ${disabled ? 'splitter-v-disabled' : ''} ${dragging ? 'splitter-dragging' : ''}`}
      onMouseDown={handleMouseDown}
      aria-hidden
    />
  );
}
