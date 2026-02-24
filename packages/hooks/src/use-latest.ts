import { useEffect, useRef } from "react";

/**
 * Returns a ref that always contains the latest value.
 *
 * Useful for accessing the latest value inside callbacks or effects
 * without adding the value to the dependency array, avoiding stale closures.
 *
 * @param value - The value to keep a reference to.
 * @returns A ref object with the current property always set to the latest value.
 *
 * @example
 * // Access latest callback without re-creating the timeout
 * function useTimeout(callback: () => void, delay: number) {
 *   let callbackRef = useLatest(callback);
 *
 *   useEffect(() => {
 *     let id = setTimeout(() => callbackRef.current(), delay);
 *     return () => clearTimeout(id);
 *   }, [delay]); // callback not in deps, but always up-to-date via ref
 * }
 *
 * @example
 * // Access latest props in an event listener
 * function Component({ onClick }: { onClick: () => void }) {
 *   let onClickRef = useLatest(onClick);
 *
 *   useEffect(() => {
 *     let controller = new AbortController();
 *     window.addEventListener("click", () => onClickRef.current(), { signal: controller.signal });
 *     return () => controller.abort()
 *   }, []); // No need to re-subscribe when onClick changes
 * }
 */
export function useLatest<T>(value: T) {
	let ref = useRef(value);

	useEffect(() => {
		ref.current = value;
	}, [value]);

	return ref;
}
