/**
 * A demo app screen's swappable main area: the shell mounts it once as the named frame
 * `main`, and each screen describes itself to the browser (title, current nav item, address,
 * any toast), so moving between screens and posting forms replace only this region.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Toast } from "@sdxc/ui/app";
import type { Handle, RemixNode } from "remix/component";

import { generateUUID } from "@sdxc/uuid/v4";
import { Frame } from "remix/component";

import { DEMO_APP_ANCHOR_PARAM, DEMO_APP_TOAST_PARAM } from "~/resources/views/demo-apps";

/** The name every demo app gives the frame holding a screen's main area. */
export const MAIN_FRAME = "main";

/**
 * The address the main frame loads: the page's own, without its one-time toast and anchor, so
 * the frame caches per screen state and a reload never raises the toast or scrolls again.
 *
 * @param url The page's address.
 * @returns Its path and query.
 */
export function mainSource(url: URL): string {
	let clean = new URL(url);
	clean.searchParams.delete(DEMO_APP_TOAST_PARAM);
	clean.searchParams.delete(DEMO_APP_ANCHOR_PARAM);
	return `${clean.pathname}${clean.search}`;
}

namespace MainFrame {
	export interface Props {
		/** The screen's own address, which the frame loads with `X-Remix-Target: main`. */
		src: string;
	}
}

/**
 * Mounts the main area as a blocking frame, so the server inlines it and a page reads and
 * posts without scripts; the wrapper is the region the browser watches for swaps.
 */
export function MainFrame(handle: Handle<MainFrame.Props>) {
	return () => (
		<div data-main-region="">
			<Frame name={MAIN_FRAME} src={handle.props.src} />
		</div>
	);
}

namespace MainScreen {
	export interface Props {
		/** The document title the screen sets once it is swapped in. */
		title: string;
		/** The key of the nav item the screen marks current, matching a `data-main-nav` link. */
		nav?: string;
		/** The top bar's place name, written into every `data-main-crumb` element. */
		crumb?: string;
		/** The screen's address without its one-time toast, which the address bar settles on. */
		url: URL;
		/** The toast the post that led here named, raised by the browser after the swap. */
		toast?: Omit<Toast.Flash, "id">;
		children: RemixNode;
	}
}

/**
 * Wraps a screen's main content with what the browser needs after swapping it in. A toast is
 * carried as a hidden marker with a fresh id, so each post's toast is raised exactly once.
 */
export function MainScreen(handle: Handle<MainScreen.Props>) {
	return () => {
		let { children, crumb, nav, title, toast, url } = handle.props;
		return (
			<div
				data-main-screen=""
				data-title={title}
				data-nav={nav}
				data-crumb={crumb}
				data-url={mainSource(url)}
			>
				{children}
				<MainAnchor url={url} />
				{toast === undefined ? null : (
					<template data-main-toast={generateUUID()} data-toast={JSON.stringify(toast)} />
				)}
			</div>
		);
	};
}

namespace MainAnchor {
	export interface Props {
		/** The address a frame request answered, whose anchor parameter names the element. */
		url: URL;
	}
}

/**
 * Carries the `#hash` a post's redirect named into a frame's content, so the browser scrolls
 * the new post, message or comment into view after the swap. `MainScreen` includes it; a
 * named frame a post answers renders it itself.
 */
export function MainAnchor(handle: Handle<MainAnchor.Props>) {
	return () => {
		let anchor = handle.props.url.searchParams.get(DEMO_APP_ANCHOR_PARAM);
		return anchor === null || anchor === "" ? null : <template data-main-anchor={anchor} />;
	};
}
