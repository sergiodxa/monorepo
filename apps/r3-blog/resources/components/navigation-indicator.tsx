/**
 * Pending-navigation indicator: a spinner pinned to the block-start/inline-end
 * corner of the viewport, shown while a client-side navigation is in flight. It
 * exists because intercepting navigations through the Navigation API takes away
 * the browser's own loading feedback — the tab spinner a full page load would
 * have drawn — leaving a click with no acknowledgement at all until the new
 * content lands.
 *
 * It carries no behavior of its own. The element is server-rendered on every page
 * and idles hidden; `bootstrap/browser.ts` toggles the `[data-navigating]`
 * attribute on `<html>`, which this component's styling reads as an ancestor
 * condition.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Spinner } from "@pkg/r3-ui";
import { spin } from "@pkg/r3-ui/animations";
import { visibility } from "@pkg/u/effects";
import { fixed, insBs, insIe } from "@pkg/u/layout";
import { z } from "@pkg/u/stacking";
import { when } from "@pkg/u/state";

/**
 * Selector matching the flag `bootstrap/browser.ts` sets while a navigation is
 * pending. It sits on `<html>` rather than on the spinner itself because the
 * client runtime diffs the document's body on every navigation, which would drop
 * an attribute written onto an element inside it mid-flight.
 */
const NAVIGATING_SELECTOR = ":root[data-navigating] &";

namespace NavigationIndicator {
	export interface Props {
		/**
		 * Accessible name describing what is pending. Required because the design
		 * system ships no copy, and a progressbar with no accessible name announces
		 * nothing.
		 */
		label: string;
	}
}

/**
 * Renders the pinned, initially hidden navigation spinner.
 *
 * @param handle Runtime handle carrying the indicator's accessible label.
 * @returns A renderer producing the indicator's markup.
 */
export function NavigationIndicator(handle: Handle<NavigationIndicator.Props>) {
	return () => {
		let { label } = handle.props;

		return (
			<Spinner
				aria-label={label}
				color="brand"
				size="sm"
				mix={[
					/* Pinned to the corner rather than placed in the page flow: the
					indicator must not shift any layout when it appears, and the corner is
					where a browser's own loading affordance used to live. */
					fixed(),
					insBs(4),
					insIe(4),
					/* Above every page surface — this is the one thing that must stay
					visible over whatever it happens to overlap. */
					z(50),
					/* Idle: hidden from sight and from the accessibility tree, since
					`visibility: hidden` removes it from both. Only the reveal below is
					conditional, so a page without JavaScript never shows it. */
					visibility("hidden"),
					when(NAVIGATING_SELECTOR, visibility("visible")),
					/* Ungated on purpose. `spin()` emits its own `@keyframes`, and passing
					it through `when()` would nest that at-rule under a selector, which
					serializes to broken CSS. So the rotation runs even while the spinner is
					hidden — one transform on a 16px glyph — and `spin()` already swaps to an
					opacity breathe under `prefers-reduced-motion: reduce`. */
					spin(),
				]}
			/>
		);
	};
}
