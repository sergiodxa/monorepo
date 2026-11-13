/**
 * The browser half of Delta's file tree, which lives outside the swapped `main` area: after
 * each swap it marks the file now open as current, opens the folders around it and scrolls
 * it into the pane, so the tree keeps its open folders and scroll while the code changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

namespace DeltaTreeSync {
	export interface Props {
		/** The `id` of the tree whose rows follow the open file. */
		tree: string;
		/** The `id` of the pane the tree scrolls in. */
		pane: string;
	}
}

/**
 * Follows the screen in `main`: the element carrying `data-delta-path` names the open file,
 * and a screen without one leaves no row current.
 */
export const DeltaTreeSync = clientEntry(
	import.meta.url,
	function DeltaTreeSync(handle: Handle<DeltaTreeSync.Props>) {
		/** Marks the open file's row, opens its folders and keeps it inside the pane's view. */
		function follow() {
			let tree = document.getElementById(handle.props.tree);
			let pane = document.getElementById(handle.props.pane);
			if (tree === null) return;
			let marker = document.querySelector<HTMLElement>("[data-main-region] [data-delta-path]");
			let path = marker?.dataset.deltaPath;
			let current: HTMLElement | null = null;
			for (let leaf of tree.querySelectorAll<HTMLElement>("a[data-delta-leaf]")) {
				let isCurrent = path !== undefined && leaf.dataset.deltaLeaf === path;
				if (isCurrent) {
					leaf.setAttribute("aria-current", "page");
					current = leaf;
				} else leaf.removeAttribute("aria-current");
			}
			if (current === null) return;
			let folder = current.parentElement?.closest("details");
			while (folder !== null && folder !== undefined && tree.contains(folder)) {
				folder.open = true;
				folder = folder.parentElement?.closest("details");
			}
			if (pane === null) return;
			let row = current.getBoundingClientRect();
			let box = pane.getBoundingClientRect();
			if (row.top < box.top) pane.scrollTop -= box.top - row.top;
			else if (row.bottom > box.bottom) pane.scrollTop += row.bottom - box.bottom;
		}

		handle.queueTask(() => {
			if (handle.signal.aborted) return;
			let region = document.querySelector("[data-main-region]");
			if (region === null) return;
			let pending = false;
			let observer = new MutationObserver(() => {
				if (pending) return;
				pending = true;
				setTimeout(() => {
					pending = false;
					follow();
				});
			});
			observer.observe(region, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ["data-delta-path"],
			});
			handle.signal.addEventListener("abort", () => observer.disconnect());
			follow();
		});

		return () => <span hidden data-delta-tree-sync="" />;
	},
);
