import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
};

export const BottomSheet = ({ open, onClose, title, children }: BottomSheetProps) => {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.button
            type="button"
            aria-label="Закрыть"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 w-full h-full bg-black/80 backdrop-blur-md cursor-pointer"
          />

          {/* Centered Modal container */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
            className="relative z-10 mx-auto flex max-h-[90dvh] w-full max-w-[480px] flex-col rounded-[28px] border border-line bg-[#131518] shadow-2xl overflow-hidden"
          >
            {title ? (
              <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3 border-b border-line/40">
                <h2 className="text-[18px] font-bold text-fg leading-tight tracking-tight">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Закрыть"
                  className="rounded-full p-1.5 text-fg-muted hover:text-fg hover:bg-raised transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : null}

            <div className="no-scrollbar overflow-y-auto px-6 py-5 flex-1">
              {children}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};
