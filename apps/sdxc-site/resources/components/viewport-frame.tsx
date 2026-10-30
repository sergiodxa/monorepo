/**
 * Client island: the iframe a viewport stage draws its demo in, grown to the height of the
 * demo it holds. The demo is a page of its own, so it lays out against the iframe's width the
 * way it does on a visitor's screen; without script the iframe keeps the stage's fallback height.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { block } from "@sdxc/u/layout";
import { clientEntry, ref } from "remix/component";

/** The element a standalone frame wraps its demo in, which is what the iframe measures. */
export const FRAME_ROOT = "[data-frame-root]";

/** The custom property the demo's height is published as, on the screen holding the iframe. */
export const FRAME_HEIGHT = "--viewport-frame-height";

/** The screen the height is published on, so its own size and the iframe's both read it. */
const SCREEN = '[data-slot="viewport-screen"]';

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type ViewportFrameProps = {
	/** The demo's standalone URL. */
	src: string;
	/** What the iframe holds, read out by assistive technology in place of its contents. */
	title: string;
};

/**
 * Renders the iframe and publishes its demo's height: on every load, and whenever the demo
 * reflows, as it does when the stage switches between the desktop and phone widths. The
 * stage caps the height, so a demo taller than a screen scrolls inside it as it would there.
 */
export const ViewportFrame = clientEntry(
	import.meta.url,
	function ViewportFrame(handle: Handle<ViewportFrameProps>) {
		let follow = ref<HTMLIFrameElement>((node, signal) => {
			let observer = new ResizeObserver(([entry]) => {
				let height = entry?.borderBoxSize[0]?.blockSize;
				let screen = node.closest<HTMLElement>(SCREEN);
				if (height && screen) screen.style.setProperty(FRAME_HEIGHT, `${Math.ceil(height)}px`);
			});

			function measure() {
				observer.disconnect();
				let root = node.contentDocument?.querySelector(FRAME_ROOT);
				if (root) observer.observe(root);
			}

			node.addEventListener("load", measure, { signal });
			if (node.contentDocument?.readyState === "complete") measure();
			signal.addEventListener("abort", () => observer.disconnect(), { once: true });
		});

		return () => {
			let { src, title } = handle.props;
			return <iframe src={src} title={title} loading="lazy" mix={[block(), follow]} />;
		};
	},
);

export default ViewportFrame;
