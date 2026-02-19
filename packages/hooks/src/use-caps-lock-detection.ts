import { useEffectEvent, useState } from "react";

import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";

/**
 * Detects whether the CapsLock key is currently enabled.
 *
 * Uses keyboard events to track CapsLock state changes, and a one-time
 * mousemove listener to detect the initial state before any key is pressed.
 *
 * @returns `true` if CapsLock is enabled, `false` otherwise
 *
 * @example
 * function PasswordInput() {
 *   let capsLockOn = useCapsLockDetection();
 *   return (
 *     <div>
 *       <input type="password" />
 *       {capsLockOn && <span>CapsLock is on</span>}
 *     </div>
 *   );
 * }
 */
export function useCapsLockDetection(): boolean {
	let [detected, setDetected] = useState(false);

	let detect = useEffectEvent((event: KeyboardEvent | MouseEvent) => {
		setDetected(event.getModifierState?.("CapsLock") ?? false);
	});

	useIsomorphicLayoutEffect(() => {
		let controller = new AbortController();

		window.addEventListener("keydown", detect, { signal: controller.signal });
		window.addEventListener("keyup", detect, { signal: controller.signal });
		window.addEventListener("mousemove", detect, { signal: controller.signal, once: true });

		return () => controller.abort();
	}, []);

	return detected;
}
