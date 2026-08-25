/**
 * The dev-mode missing-accessible-name check shared by every icon-only
 * control, landmark, and group across the component catalog. A control logs
 * a `console.warn` only when a consumer has supplied it no way to announce
 * itself to assistive technology: no `aria-label`, no `aria-labelledby`, and,
 * where the control can otherwise fall back to its own visible content, no
 * text in its `children` either. Every component wires the check to its own
 * message describing what it is and what it needs, right after destructuring
 * its props.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hasAccessibleText } from "./has-accessible-text";

/**
 * The two ARIA attributes this module's checks read to tell whether a
 * consumer already supplied an accessible name explicitly, regardless of
 * whatever other props a component's own type carries alongside them.
 */
export interface AccessibleNameProps {
	"aria-label"?: unknown;
	"aria-labelledby"?: unknown;
}

/**
 * Logs `message` through `console.warn`, in dev mode only, when `props`
 * carries neither `aria-label` nor `aria-labelledby` and `children` resolves to
 * no visible text — leaving assistive technology no accessible name to announce.
 *
 * @param props The component's own props, read for `aria-label` and `aria-labelledby`.
 * @param children The component's own `children` prop, walked by {@link hasAccessibleText} for visible text.
 * @param message The dev-mode warning to log when none of the three supply an accessible name.
 * @example
 * warnIfNoAccessibleName(
 * 	handle.props,
 * 	children,
 * 	"Button: an icon-only button needs an `aria-label` describing what it does.",
 * );
 */
export function warnIfNoAccessibleName(
	props: AccessibleNameProps,
	children: unknown,
	message: string,
): void {
	if (
		import.meta.env.DEV &&
		!props["aria-label"] &&
		!props["aria-labelledby"] &&
		!hasAccessibleText(children)
	) {
		console.warn(message);
	}
}

/**
 * Logs `message` through `console.warn`, in dev mode only, when `props`
 * carries neither `aria-label` nor `aria-labelledby` — for a host such as a
 * navigation landmark or grouping wrapper with no `children` fallback of its own.
 *
 * @param props The component's own props, read for `aria-label` and `aria-labelledby`.
 * @param message The dev-mode warning to log when neither attribute supplies an accessible name.
 * @example
 * warnIfNoAccessibleLabel(
 * 	handle.props,
 * 	'Pagination: needs an "aria-label" or "aria-labelledby" identifying which set of results it paginates.',
 * );
 */
export function warnIfNoAccessibleLabel(props: AccessibleNameProps, message: string): void {
	if (import.meta.env.DEV && !props["aria-label"] && !props["aria-labelledby"]) {
		console.warn(message);
	}
}
