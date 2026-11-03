/**
 * Lays out an icon's detail in a real browser: the tags sit beside the preview where the
 * column holds both, and wrap under it where it is too narrow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import type { IconEntry } from "~/app/services/icons";

import { DEFAULT_ICON_STYLE } from "~/app/services/icon-style";
import { findIcon } from "~/app/services/icons";
import IconDetail from "~/resources/components/icon-detail";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** Unmounts what a test mounted. */
let cleanups: Array<() => void> = [];

/** Mounts the detail for `x` in a column `width` pixels wide and returns its two boxes. */
function layout(width: number): { preview: DOMRect; tags: DOMRect } {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	let { cleanup } = render(
		<IconDetail icon={findIcon("x") as IconEntry} style={DEFAULT_ICON_STYLE} svg="<svg></svg>" />,
		{ container: host },
	);
	cleanups.push(cleanup);
	return {
		preview: host.querySelector('[data-slot="icon-detail-preview"]')!.getBoundingClientRect(),
		tags: host.querySelector('[data-slot="icon-detail-tags"]')!.getBoundingClientRect(),
	};
}

afterEach(() => {
	for (let cleanup of cleanups.splice(0)) cleanup();
	document.body.replaceChildren();
});

describe("IconDetail", () => {
	test("puts the tags beside the preview in a wide column", () => {
		let { preview, tags } = layout(800);

		expect(tags.left).toBeGreaterThanOrEqual(preview.right);
		expect(tags.top).toBe(preview.top);
	});

	test("wraps the tags under the preview in a narrow column", () => {
		let { preview, tags } = layout(320);

		expect(tags.top).toBeGreaterThanOrEqual(preview.bottom);
	});
});
