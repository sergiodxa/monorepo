/**
 * Client island on the Reels screen: as each reel comes on screen, the document title names it,
 * so the tab, the history entry and a shared link all say which reel is playing. The address
 * itself is followed by the feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { REEL_CHANGE_EVENT } from "@sdxc/ui/video/reel-feed";
import { clientEntry, createMixin } from "remix/component";

/** Renames the document after the reel on screen until the marker leaves the page. */
const reelTitling = createMixin<HTMLElement>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		let feed = event.node.closest<HTMLElement>("[data-slot=reel-feed]");
		if (feed === null) return;
		controller = new AbortController();
		feed.addEventListener(
			REEL_CHANGE_EVENT,
			(change) => {
				let reel = (change.target as Element).querySelector<HTMLElement>("[data-reel-active]");
				let title = reel?.dataset.title;
				let screen = document.querySelector<HTMLElement>("[data-main-region] [data-main-screen]");
				if (title === undefined || screen === null) return;
				let previous = screen.dataset.title ?? "";
				let suffix = document.title.startsWith(previous)
					? document.title.slice(previous.length)
					: "";
				screen.dataset.title = title;
				document.title = `${title}${suffix}`;
			},
			{ signal: controller.signal },
		);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});

/** The island: a hidden marker inside the feed. */
export const ReelTitle = clientEntry(import.meta.url, function ReelTitle() {
	return () => <span hidden data-reel-title="" mix={[reelTitling()]} />;
});
