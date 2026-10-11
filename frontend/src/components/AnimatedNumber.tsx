import { useEffect, useRef } from "react";
import gsap from "gsap";

export function AnimatedNumber({
  value,
  duration = 1.2,
  prefix = "",
  suffix = "",
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const displayed = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { v: displayed.current };
    gsap.to(obj, {
      v: value,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = `${prefix}${Math.round(obj.v).toLocaleString()}${suffix}`;
        displayed.current = obj.v;
      },
    });
  }, [value, duration, prefix, suffix]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}