import { useState, useCallback, useRef, type RefCallback } from "react";

/** Returns [ref, inView]. The element is considered "in view" once the
 *  IntersectionObserver fires — never resets to false. Use rootMargin
 *  to trigger ahead of actual viewport entry (default 400px). */
export function useInView(
  rootMargin = "400px 0px",
): [RefCallback<Element>, boolean] {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref: RefCallback<Element> = useCallback(
    (node) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (!node || inView) return;
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) setInView(true);
        },
        { rootMargin },
      );
      observerRef.current.observe(node);
    },
    [inView, rootMargin],
  );

  return [ref, inView];
}
