/**
 * Holds a post's row to the width of the pane it sits in rather than the screen: beside the
 * app's sidebar a pane can be narrow on a wide screen, and the row has to give its title the
 * room there, wrapping it onto a second line instead of clipping it to its first letters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { Timeline as TimelineView } from "~/resources/views/timeline";

import Timeline from "~/resources/views/timeline";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/** A title long enough that one clipped line would hide most of it. */
const LONG_TITLE = "Moving away from Tailwind, and learning to structure my CSS the slow way";

/** The list's copy, which nothing here asserts on. */
const COPY: TimelineView.Copy = {
	markRead: "Mark as read",
	markUnread: "Mark as unread",
	read: "Read",
	markFailed: "Failed",
	save: "Save",
	unsave: "Remove from saved",
	saveFailed: "Failed",
	saveFull: "Full",
	saved: "Saved",
	flagged: "Flagged",
	readHere: "Read here",
	newer: "Newer posts",
	older: "Older posts",
	end: "You have reached the end.",
};

/** Mounts one row in a pane `width` wide, named the way the app shell names its content. */
function mountRow(width: string) {
	mounted = render(
		<div
			style={{ inlineSize: width, containerType: "inline-size", containerName: "ui-app-content" }}
		>
			<div style={{ paddingInline: "1rem" }}>
				<Timeline
					copy={COPY}
					returnTo="/reading"
					cursors={{ next: null, prev: null }}
					entries={[
						{
							id: "item-1",
							title: LONG_TITLE,
							url: "https://jvns.ca/post",
							ping: null,
							readHref: "/reading/feed-1/item-1",
							source: "Julia Evans",
							summary: "A while back I decided to stop using Tailwind for new projects.",
							time: "May 15",
							timeLabel: "May 15, 2026",
							dateTime: "2026-05-15T12:00:00.000Z",
							isRead: false,
							isSaved: false,
							isFlagged: false,
						},
					]}
				/>
			</div>
		</div>,
	);
	let words = mounted.container.querySelector<HTMLElement>("[data-post-words]");
	if (!words) throw new Error("The row drew no words");
	return words;
}

describe("Timeline row", () => {
	test("gives the title the row's width in a narrow pane on a wide screen", async () => {
		await page.viewport(1024, 900);
		let words = mountRow("500px");

		/** Beside a 256px sidebar a 768px screen leaves a pane this narrow. */
		expect(words.getBoundingClientRect().width).toBeGreaterThan(300);
	});

	test("wraps a long title onto a second line on a phone instead of clipping it", async () => {
		await page.viewport(375, 812);
		let words = mountRow("343px");
		let lineHeight = Number.parseFloat(getComputedStyle(words).lineHeight);

		expect(words.getBoundingClientRect().height).toBeGreaterThan(lineHeight * 1.5);
	});

	test("keeps the title, source and time on one line in a wide pane", async () => {
		await page.viewport(1440, 900);
		let words = mountRow("1100px");
		let lineHeight = Number.parseFloat(getComputedStyle(words).lineHeight);

		expect(words.getBoundingClientRect().height).toBeLessThan(lineHeight * 1.5);
	});
});
