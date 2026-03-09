import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ThreeRose from './ThreeRose';

interface RoseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RoseModal({ isOpen, onClose }: RoseModalProps) {
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleBackdropClick}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative"
          >
            <ThreeRose isOpen={isOpen} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
