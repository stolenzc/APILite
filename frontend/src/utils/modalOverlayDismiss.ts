import { useCallback, useRef } from 'react';

/**
 * Dismiss only when press starts and ends on the overlay itself.
 * Avoids closing when the user selects text inside the modal and releases outside.
 */
export function useModalOverlayDismiss(onClose: () => void) {
  const pointerDownOnOverlay = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    pointerDownOnOverlay.current = e.target === e.currentTarget;
  }, []);

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (pointerDownOnOverlay.current && e.target === e.currentTarget) {
        onClose();
      }
      pointerDownOnOverlay.current = false;
    },
    [onClose],
  );

  return { onMouseDown, onMouseUp };
}
