import React, { useEffect, useCallback } from 'react';

/**
 * The two ways everyone expects to leave a modal without hunting for the X:
 * the Escape key, and clicking the dark area around it. Every modal in the
 * site takes both from here, so none of them drifts.
 */
export function useEscapeToClose(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);
}

/**
 * Put on the overlay element. Closes only when the press starts and ends on
 * the overlay itself, so selecting text inside the dialog and releasing over
 * the backdrop doesn't dismiss it.
 */
export function useBackdropClose(onClose: () => void) {
  return useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );
}
