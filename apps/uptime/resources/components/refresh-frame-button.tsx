/**
 * Client island: a link that reloads the `Frame` it is rendered inside,
 * spinning its icon while the reload is in flight.
 *
 * It renders as a real anchor with the `link` mixin's `rmx-target`/`rmx-src`
 * attributes, so a pre-hydration click still refreshes via the runtime's nav
 * listener, or falls back to {@link RefreshFrameButtonProps.href} as a page
 * load. Once hydrated, `on("click")` takes over, reloading the frame directly
 * and holding a pending state to spin the icon while it waits.
 *
 * Its label arrives as a prop, since these fragments render without an `IntlProvider` to source it from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { RefreshCwIcon } from "@pkg/lucide-remix";
import { LinkButton } from "@pkg/ui";
import { spin } from "@pkg/ui/animations";
import { clientEntry, link, on } from "remix/ui";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type RefreshFrameButtonProps = {
	/** Page the click falls back to when neither this island nor the runtime is there to intercept it. */
	href: string;
	/** Fragment URL the frame reloads from. */
	src: string;
	/** Name of the `Frame` a pre-hydration click re-navigates. */
	target: string;
	/** Visible label, e.g. "Refresh". */
	label: string;
};

/**
 * Reloads the enclosing frame from {@link RefreshFrameButtonProps.src},
 * spinning its icon until the reload settles. Modified and non-primary clicks
 * pass through to the browser so the fallback page can still open in a new tab.
 */
export const RefreshFrameButton = clientEntry(
	"/resources/components/refresh-frame-button.tsx#RefreshFrameButton",
	function RefreshFrameButton(handle: Handle<RefreshFrameButtonProps>) {
		let pending = false;

		return () => {
			let { href, src, target, label } = handle.props;

			return (
				<LinkButton
					href={href}
					color="neutral"
					variant="ghost"
					size="sm"
					aria-busy={pending || undefined}
					mix={[
						link(href, { target, src, resetScroll: false }),
						on("click", async (event) => {
							if (event.button !== 0) return;
							if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

							event.preventDefault();
							if (pending) return;

							pending = true;
							void handle.update();
							try {
								handle.frame.src = src;
								await handle.frame.reload();
							} finally {
								pending = false;
								void handle.update();
							}
						}),
					]}
				>
					<RefreshCwIcon size={16} strokeWidth={1.5} mix={pending ? [spin()] : []} />
					{label}
				</LinkButton>
			);
		};
	},
);

export default RefreshFrameButton;
