/**
 * Client island: holds a `Frame` back until its host approaches the viewport, so a page
 * that continues below the fold fetches the continuation as the reader arrives at it
 * rather than on load.
 *
 * What it renders before that — and what a browser running no script renders forever — is
 * `children`. The continuation replaces them only once script has taken over and the
 * reader has reached the end of what is on screen, which is what makes the plain links a
 * default rather than something hidden and restored.
 *
 * Vendored from the `lazy-frames` demo in the Remix repository, which publishes no module
 * to import. Three things differ from the original: the branch that paused descendant CSS
 * animations while the frame sat off screen is gone, since nothing here animates; the
 * frame's own loading state falls back to `children`, because the links a reader can
 * follow themselves are the right thing to leave standing while their replacement is in
 * the air; and `children` is one node rather than many, which is what that default needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixElement } from "remix/ui";

import { clientEntry, Frame, ref } from "remix/ui";

/**
 * Declared as a `type` to satisfy the serializable-props constraint a client entry's
 * props are checked against.
 */
export type LazyFrameProps = {
	/** Where the continuation is fetched from. */
	src: string;
	/** How far ahead of the viewport the fetch starts. */
	rootMargin?: string;
	/** What stands in while the frame is in the air; defaults to {@link children}. */
	fallback?: RemixElement | string | number | boolean | null;
	/**
	 * What the server sends, and what a browser running no script keeps. One node rather
	 * than the original's whole `RemixNode`, since it doubles as the frame's own loading
	 * state and a frame takes one.
	 */
	children?: RemixElement | string | number | boolean | null;
};

/**
 * Defers mounting a Frame until its stable host approaches the viewport.
 *
 * `children` render on the server and before intersection. Once observed, the Frame mounts
 * and its own fallback covers the network request. Once mounted, the Frame remains in the
 * document when it leaves the viewport.
 */
export const LazyFrame = clientEntry(
	"/resources/components/lazy-frame.tsx#LazyFrame",
	function LazyFrame(handle: Handle<LazyFrameProps>) {
		let requested = false;

		let observe = ref((node, signal) => {
			let loadObserver = new IntersectionObserver(
				(entries) => {
					if (requested || signal.aborted || !entries.some((entry) => entry.isIntersecting)) return;

					/**
					 * Latched before the observer is let go, so a second crossing reported in the
					 * same batch asks for the same page again.
					 */
					requested = true;
					loadObserver.disconnect();
					void handle.update();
				},
				{ rootMargin: handle.props.rootMargin ?? "320px 0px" },
			);

			loadObserver.observe(node);
			signal.addEventListener("abort", () => loadObserver.disconnect(), { once: true });
		});

		return () => (
			<div mix={[observe]}>
				{requested ? (
					<Frame src={handle.props.src} fallback={handle.props.fallback ?? handle.props.children} />
				) : (
					handle.props.children
				)}
			</div>
		);
	},
);

export default LazyFrame;
