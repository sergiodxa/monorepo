import { useEffect, useLayoutEffect } from "react";

/**
 * A hook that uses `useLayoutEffect` on the client and `useEffect` on the
 * server to avoid SSR warnings.
 *
 * Use this when you need synchronous DOM measurements or mutations that must
 * happen before the browser paints, but also need to support server-side
 * rendering.
 *
 * @example
 * function Tooltip({ targetRef }) {
 *   let [position, setPosition] = useState({ top: 0, left: 0 });
 *
 *   useIsomorphicLayoutEffect(() => {
 *     let rect = targetRef.current.getBoundingClientRect();
 *     setPosition({ top: rect.bottom, left: rect.left });
 *   }, [targetRef]);
 *
 *   return <div style={position}>Tooltip</div>;
 * }
 */
export const useIsomorphicLayoutEffect =
	typeof window !== "undefined" ? useLayoutEffect : useEffect;
