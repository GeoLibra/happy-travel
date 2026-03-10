import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ThreeRose from './ThreeRose';

interface RoseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RoseModal({ isOpen, onClose }: RoseModalProps) {
  // 处理点击背景遮罩层关闭弹窗
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  // 处理 Esc 键关闭和锁定背景滚动
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
          transition={{ duration: 0.25 }}
          onClick={handleBackdropClick}
          // pointer-events-auto 确保背景层可点击
          className="fixed inset-0 z-[100] flex items-center justify-center p-0 bg-black/80 backdrop-blur-sm cursor-pointer"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            // 阻止 3D 交互点击冒泡到背景层，否则无法进行 OrbitControls 操作
            onClick={(e) => e.stopPropagation()}
            className="relative w-[90vw] h-[80vh] max-w-4xl cursor-default"
            style={{ minWidth: '600px', minHeight: '600px' }}
          >
            {/* 修正：直接传入 isOpen 状态，并使用组件 props 中的 onClose */}
            <ThreeRose isOpen={isOpen} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}