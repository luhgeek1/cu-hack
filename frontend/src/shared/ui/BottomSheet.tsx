import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
};

const DESKTOP = "(min-width: 768px)";

/** На телефоне шторка выезжает снизу, на десктопе это обычная модалка по центру */
const useIsDesktop = (): boolean => {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP).matches
  );

  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
};

export const BottomSheet = ({ open, onClose, title, children }: BottomSheetProps) => {
  const isDesktop = useIsDesktop();

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
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <motion.button
            type="button"
            aria-label="Закрыть"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 size-full cursor-pointer bg-black/75 backdrop-blur-[3px]"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={isDesktop ? { opacity: 0, scale: 0.96 } : { y: "100%" }}
            animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.96 } : { y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="relative z-10 flex max-h-[90dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[28px] border-t border-line bg-[#131518] md:max-h-[85dvh] md:rounded-[28px] md:border md:shadow-2xl"
          >
            {/* Ручка — подсказка, что шторку можно закрыть свайпом вниз */}
            <div className="flex justify-center pt-3 md:hidden">
              <span className="h-1 w-10 rounded-full bg-line-strong" />
            </div>

            {title ? (
              <div className="flex items-center justify-between gap-4 border-b border-line/40 px-5 pb-3 pt-4 md:px-6 md:pt-5">
                <h2 className="text-[18px] font-bold leading-tight tracking-tight text-fg">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Закрыть"
                  className="cursor-pointer rounded-full p-1.5 text-fg-muted transition-colors hover:bg-raised hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : null}

            <div className="no-scrollbar flex-1 overflow-y-auto px-5 pt-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] md:px-6 md:py-5">
              {children}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};
