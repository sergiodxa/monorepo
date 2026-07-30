/**
 * Client island: a link that reloads the `Frame` it is rendered inside, spinning
 * its icon for as long as the reload is in flight.
 *
 * It renders as a real anchor carrying the `link` mixin's `rmx-target`/`rmx-src`
 * attributes, so before this module hydrates — and with no JS at all — a click
 * still refreshes: the runtime's own navigation listener re-navigates the named
 * frame, or, failing that, the browser follows {@link RefreshFrameButtonProps.href}
 * as an ordinary page load. Once hydrated, `on("click")` takes over instead and
 * reloads the enclosing frame directly, which is what lets it hold a pending
 * state across the request and rotate the icon while it waits.
 *
 * Its label comes in as a prop rather than through `@pkg/i18n/ui`'s
 * `intl(handle)`, since the fragments this renders inside wire up no
 * `IntlProvider` of their own for the server-rendered pass.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { RefreshCwIcon } from "@pkg/lucide-remix";
import { LinkButton } from "@pkg/r3-ui";
import { spin } from "@pkg/r3-ui/animations";
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

/** Reloads the enclosing frame from {@link RefreshFrameButtonProps.src}, spinning its icon until the reload settles. */
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
							// Modified and non-primary clicks stay the browser's to handle, so
							// opening the fallback page in a new tab keeps working.
							if (event.button !== 0) return;
							if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

							event.preventDefault();
							if (pending) return;

							pending = true;
							handle.update();
							try {
								handle.frame.src = src;
								await handle.frame.reload();
							} finally {
								pending = false;
								handle.update();
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
