import { useEffect, useRef } from "react";
import "./silver-orbit.css";

/** Decorative artwork. The CSS emblem also covers loading and unavailable WebGL. */
export function SilverOrbit() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import("./silver-orbit-scene").then(({ mountSilverOrbit }) => {
      if (!cancelled && host.current) dispose = mountSilverOrbit(host.current);
    }).catch(() => { /* Keep the static emblem if the graphics chunk cannot load. */ });
    return () => { cancelled = true; dispose?.(); };
  }, []);

  return (
    <div className="silver-orbit" aria-hidden="true">
      <div className="silver-orbit__halo" />
      <div ref={host} className="silver-orbit__scene">
        <div className="silver-orbit__fallback"><span /></div>
      </div>
      <div className="silver-orbit__shadow" />
      <span className="silver-orbit__signature">ЧЕСТНЫЙ МЕСЯЦ <i /> ВСЁ СХОДИТСЯ</span>
    </div>
  );
}
