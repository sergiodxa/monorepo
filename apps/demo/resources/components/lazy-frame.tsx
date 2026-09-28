/**
 * Client island that holds a `Frame` back until the dialog around it is opened, so a
 * position's detail is fetched by the visitor who asked to read it and by nobody else.
 *
 * It renders `children` until then — a plain link to the position's own page, which is what
 * a browser running no script keeps and follows — so the deferred content is an upgrade of
 * a working page rather than the only way to reach the thing.
 *
 * The signal is the dialog's own `toggle` event, which fires however the dialog came to be
 * shown: a declarative invoker, `showModal()`, or a form. Watching the control instead would
 * answer for one of those and miss the rest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixElement } from "remix/ui";

import { clientEntry, Frame, ref } from "remix/ui";

/**
 * Declared as a `type` to satisfy the serializable-props constraint a client entry's props
 * are checked against.
 */
export type LazyFrameProps = {
	/** Where the detail is fetched from once the dialog is open. */
	src: string;
	/**
	 * The `id` of the control that leads to this position. Without script it is a link the
	 * browser follows to the position's own page; with script it opens the dialog this frame
	 * sits in, so one control serves both and neither is a dead end.
	 */
	triggerId: string;
	/** What stands in while the detail is in the air. */
	fallback?: RemixElement | string | number | boolean | null;
	/** What the server sends, and what a browser running no script keeps. */
	children?: RemixElement | string | number | boolean | null;
};

/**
 * Swaps `children` for a `Frame` the first time the surrounding dialog is shown.
 *
 * The swap latches: a position's detail does not change while the page is open, so a second
 * opening keeps what the first one fetched instead of emptying the panel and asking again.
 */
export const LazyFrame = clientEntry(
	"/resources/components/lazy-frame.tsx#LazyFrame",
	function LazyFrame(handle: Handle<LazyFrameProps>) {
		let requested = false;

		let watch = ref((node, signal) => {
			let dialog = node.closest("dialog");
			if (!(dialog instanceof HTMLDialogElement)) return;

			/**
			 * The control leads to the position's page on its own and opens this dialog once
			 * there is script to open it with, which is the whole of the enhancement: the
			 * markup the server sent already works, and this is what layers over it.
			 */
			let trigger = document.getElementById(handle.props.triggerId);

			if (trigger !== null) {
				trigger.addEventListener(
					"click",
					(event) => {
						if (event.defaultPrevented) return;
						event.preventDefault();
						dialog.showModal();
					},
					{ signal },
				);
			}

			dialog.addEventListener(
				"toggle",
				(event) => {
					if (requested) return;
					if (!("newState" in event) || event.newState !== "open") return;

					requested = true;
					void handle.update();
				},
				{ signal },
			);
		});

		return () => (
			<div mix={[watch]}>
				{requested ? (
					<Frame src={handle.props.src} fallback={handle.props.fallback} />
				) : (
					handle.props.children
				)}
			</div>
		);
	},
);

export default LazyFrame;
