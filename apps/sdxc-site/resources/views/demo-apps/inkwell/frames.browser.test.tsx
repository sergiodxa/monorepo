/**
 * Holds every Inkwell frame to the box its placeholder reserves: each part's placeholder and
 * its content take the same height at a phone's and a desktop's column width, so a frame
 * landing never moves what follows it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { p } from "@sdxc/u/size";
import { themeScope } from "@sdxc/ui/styles";
import { describe, expect, test } from "vitest";

import { blockSize } from "~/app/test/frame-size";
import { demoThemeTokens } from "~/resources/components/demo-theme";
import inkwell from "~/resources/views/demo-apps/inkwell";
import { MEDIA, POSTS } from "~/resources/views/demo-apps/inkwell/data";
import {
	HISTORY_REGION,
	HistoryPlaceholder,
	PostHistory,
} from "~/resources/views/demo-apps/inkwell/editor";
import {
	ACTIVITY_REGION,
	ActivityFeed,
	ActivityPlaceholder,
	COMMENTS_REGION,
	CommentsPlaceholder,
	DraftList,
	HomeStats,
	ReaderComments,
	RowsPlaceholder,
	ScheduledList,
	StatsPlaceholder,
} from "~/resources/views/demo-apps/inkwell/home";
import {
	AttachmentDetails,
	AttachmentPlaceholder,
} from "~/resources/views/demo-apps/inkwell/media";
import { FrameRegion } from "~/resources/views/demo-apps/inkwell/placeholders";
import { QuickEditForm, QuickEditPlaceholder } from "~/resources/views/demo-apps/inkwell/posts";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** The column widths the frames sit in, from a phone's content column to a desktop's. */
const WIDTHS = [343, 1100];

/** The moment every part renders at, so relative times read the same in each run. */
const NOW = new Date("2026-11-02T09:00:00Z");

/** Wraps a node in Inkwell's theme tokens, so type and spacing match the page. */
function themed(node: RemixNode): RemixNode {
	return (
		<div
			mix={[
				themeScope(),
				raw({ ...demoThemeTokens(inkwell.theme), fontFamily: "var(--ui-font-sans)" }),
			]}
		>
			{node}
		</div>
	);
}

/**
 * Expects a placeholder and its content to take the same height at one width.
 *
 * @param placeholder The frame's fallback.
 * @param content The part the frame answers with.
 * @param width The column width.
 */
function expectSameSize(placeholder: RemixNode, content: RemixNode, width: number) {
	let fallback = blockSize(placeholder, width, themed);
	let landed = blockSize(content, width, themed);
	expect(landed).toBeGreaterThan(0);
	expect(
		Math.abs(landed - fallback),
		`content ${landed}px, placeholder ${fallback}px`,
	).toBeLessThanOrEqual(1);
}

/** The panel body the activity feed sits in, padded like the overview's panel. */
function activityBox(node: RemixNode): RemixNode {
	return (
		<div mix={[p(4)]}>
			<FrameRegion {...ACTIVITY_REGION}>{node}</FrameRegion>
		</div>
	);
}

/** The posts the overview lists, for the placeholders' row counts. */
const DRAFTS = POSTS.filter((post) => post.status === "draft").length;

/** The queued posts, for the scheduled panel's row count. */
const QUEUED = POSTS.filter((post) => post.status === "scheduled").length;

describe("Inkwell's overview frames keep their placeholder's size", () => {
	test.each(WIDTHS)("the stat cards at %ipx", (width) => {
		expectSameSize(<StatsPlaceholder />, <HomeStats now={NOW} />, width);
	});

	test.each(WIDTHS)("the drafts in progress at %ipx", (width) => {
		expectSameSize(
			<RowsPlaceholder rows={DRAFTS} lead="initials" />,
			<DraftList now={NOW} />,
			width,
		);
	});

	test.each(WIDTHS)("going out next at %ipx", (width) => {
		expectSameSize(
			<RowsPlaceholder rows={QUEUED} lead="leaf" />,
			<ScheduledList now={NOW} />,
			width,
		);
	});

	test.each([...WIDTHS, 459])("the recent activity at %ipx", (width) => {
		expectSameSize(
			activityBox(<ActivityPlaceholder />),
			activityBox(<ActivityFeed now={NOW} />),
			width,
		);
	});

	test.each([...WIDTHS, 459])("the reader comments at %ipx", (width) => {
		expectSameSize(
			<FrameRegion {...COMMENTS_REGION}>
				<CommentsPlaceholder />
			</FrameRegion>,
			<FrameRegion {...COMMENTS_REGION}>
				<ReaderComments />
			</FrameRegion>,
			width,
		);
	});
});

describe("Inkwell's editor and sheet frames keep their placeholder's size", () => {
	test.each([...WIDTHS, 255])("a post's history at %ipx", (width) => {
		for (let post of POSTS) {
			expectSameSize(
				<FrameRegion {...HISTORY_REGION}>
					<HistoryPlaceholder />
				</FrameRegion>,
				<FrameRegion {...HISTORY_REGION}>
					<PostHistory post={post} now={NOW} />
				</FrameRegion>,
				width,
			);
		}
	});

	test.each(WIDTHS)("the quick-edit form at %ipx", (width) => {
		for (let post of POSTS) {
			expectSameSize(
				<QuickEditPlaceholder />,
				<QuickEditForm post={post} back="" titleIssue={false} />,
				width,
			);
		}
	});

	test.each(WIDTHS)("the attachment sheet at %ipx", (width) => {
		for (let item of MEDIA) {
			expectSameSize(
				<AttachmentPlaceholder />,
				<AttachmentDetails item={item} view="grid" now={NOW} />,
				width,
			);
		}
	});
});
