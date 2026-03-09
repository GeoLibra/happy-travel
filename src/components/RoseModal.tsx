import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import ThreeRose from './ThreeRose';

interface RoseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RoseModal({ isOpen, onClose }: RoseModalProps) {
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative bg-gradient-to-br from-pink-50/95 to-white/95 rounded-3xl shadow-2xl overflow-hidden max-w-md w-full border border-white/50"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors shadow-lg"
              aria-label="关闭"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="text-center pt-8 pb-4 px-6">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-pink-600 bg-clip-text text-transparent">
                  绽放玫瑰
                </h2>
                <p className="text-slate-500 text-sm mt-2">
                  Three.js 程序化生成
                </p>
              </motion.div>
            </div>

            {/* Rose Container */}
            <div className="flex justify-center items-center py-4">
              <ThreeRose isOpen={isOpen} />
            </div>

            {/* Footer */}
            <div className="text-center pb-6 px-6">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xs text-slate-400"
              >
                🌹 点击任意位置关闭
              </motion.p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
