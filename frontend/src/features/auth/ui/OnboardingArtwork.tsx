import { useEffect, useRef, useState } from "react";
import { SilverOrbit } from "./SilverOrbit";

/** One persistent scene per page; content transitions do not restart the animation. */
export function OnboardingArtwork() {
  const layer = useRef<HTMLDivElement>(null);
  const [obscured, setObscured] = useState(true);

  useEffect(() => {
    const element = layer.current;
    const page = element?.parentElement;
    if (!element || !page) return;
    let frame = 0;
    const measure = () => {
      const art = element.getBoundingClientRect();
      // The visible coin occupies the middle of its transparent canvas.
      const insetX = art.width * .16;
      const insetY = art.height * .16;
      const overlaps = [...page.querySelectorAll("h1, p, button, input, ul, [data-art-occluder]")]
        .some(node => {
          if (element.contains(node)) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 &&
            rect.left < art.right - insetX && rect.right > art.left + insetX &&
            rect.top < art.bottom - insetY && rect.bottom > art.top + insetY;
        });
      setObscured(overlaps);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    const observeContent = () => {
      resize.disconnect();
      resize.observe(element);
      resize.observe(page);
      page.querySelectorAll("h1, p, button, input, ul, [data-art-occluder]")
        .forEach(node => resize.observe(node));
      schedule();
    };
    // AnimatePresence replaces the content after its exit, not at the state change.
    const mutations = new MutationObserver(observeContent);
    mutations.observe(page, { childList: true, subtree: true, characterData: true });
    observeContent();
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div ref={layer} className="onboarding-artwork" data-obscured={obscured} aria-hidden="true">
      <SilverOrbit />
    </div>
  );
}
