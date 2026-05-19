import { useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/useSettings';

const MIN_HEIGHT = 100;
// Chrome above response area: header + tab-bar + URL bar + params tabs + splitter + bottom history dock
const RESERVED = 182;

export default function ResizableSplitter() {
  const { responseHeight, setResponseHeight } = useSettingsStore();
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const getMaxHeight = useCallback(() => {
    return Math.max(MIN_HEIGHT, window.innerHeight - RESERVED);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startY.current = e.clientY;
    startHeight.current = responseHeight;
    dragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [responseHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startY.current - e.clientY;
      const maxH = getMaxHeight();
      const newHeight = Math.max(MIN_HEIGHT, Math.min(maxH, startHeight.current + delta));
      setResponseHeight(newHeight);
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
  }, [setResponseHeight, getMaxHeight]);

  return (
    <div
      className="splitter"
      onMouseDown={handleMouseDown}
    >
      <div className="splitter-handle" />
    </div>
  );
}
