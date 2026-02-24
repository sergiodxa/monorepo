import { useCallback, useEffect, useRef } from "react";

import { useStableReference } from "./use-stable-reference.js";

/**
 * A hook that manages a timeout with conditional triggering.
 *
 * @param callback - The function to call when the timeout fires.
 * @param options - Configuration options for the timeout.
 * @returns A function to manually clear the timeout.
 *
 * @example
 * // Run timeout when a condition is met
 * useTimeout(() => clipboard.reset(), {
 *   delay: 2000,
 *   when: clipboard.status === "success",
 * });
 *
 * @example
 * // Manually clear the timeout
 * let clear = useTimeout(() => console.log("fired"), {
 *   delay: 1000,
 *   when: isActive,
 * });
 *
 * return <button onClick={clear}>Cancel</button>;
 */
export function useTimeout(
	callback: () => void,
	{ delay, when = false }: useTimeout.Options,
): useTimeout.ClearFunction {
	let timerId = useRef<useTimeout.TimerID>(null);
	let callbackRef = useStableReference(callback);

	useEffect(() => {
		if (!when) return;

		let id = setTimeout(() => {
			callbackRef.current();
		}, delay);

		timerId.current = id;

		return () => {
			clearTimeout(id);
			timerId.current = null;
		};
	}, [delay, when, callbackRef]);

	return useCallback<useTimeout.ClearFunction>(() => {
		if (timerId.current) {
			clearTimeout(timerId.current);
			timerId.current = null;
		}
	}, []);
}

export namespace useTimeout {
	export interface Options {
		/** The delay in milliseconds before the callback is invoked. */
		delay: number;
		/**
		 * Condition that controls when the timeout starts.
		 * - When `true`, the timeout starts (or restarts if already running).
		 * - When `false`, the timeout is cleared.
		 * @default false
		 */
		when?: boolean;
	}

	export type ClearFunction = () => void;

	export type TimerID = ReturnType<typeof setTimeout> | null;
}
