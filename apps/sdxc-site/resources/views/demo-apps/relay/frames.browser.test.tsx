/**
 * Holds every Relay frame to the box its placeholder reserves: each part's placeholder and
 * its content take the same height at a phone's and a desktop's column width, and the open
 * conversation's first message lands where its placeholder card stood.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { themeScope } from "@sdxc/ui/styles";
import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { blockSize } from "~/app/test/frame-size";
import { demoThemeTokens } from "~/resources/components/demo-theme";
import relay from "~/resources/views/demo-apps/relay";
import { ContactConversations } from "~/resources/views/demo-apps/relay/contact";
import { ContactActivity, ContactSheetBody } from "~/resources/views/demo-apps/relay/contacts";
import {
	ConversationPane,
	ConversationPlaceholder,
} from "~/resources/views/demo-apps/relay/conversation";
import { CONTACTS, CONVERSATIONS } from "~/resources/views/demo-apps/relay/data";
import {
	ChartPlaceholder,
	ReportChart,
	ReportStats,
} from "~/resources/views/demo-apps/relay/reports";
import { findView } from "~/resources/views/demo-apps/relay/views";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** The column widths the frames sit in, from a phone's content column to a desktop's. */
const WIDTHS = [343, 1100];

/** The contact sheet's body widths: a phone's full-width sheet, then the desktop sheet from 28rem to 36rem. */
const SHEET_WIDTHS = [343, 416, 544];

/** Wraps a node in Relay's theme tokens, so type and spacing match the page. */
function themed(node: RemixNode): RemixNode {
	return (
		<div
			mix={[
				themeScope(),
				raw({ ...demoThemeTokens(relay.theme), fontFamily: "var(--ui-font-sans)" }),
			]}
		>
			{node}
		</div>
	);
}

/**
 * Wraps a node in the theme and in the split view's named container, so the toolbar's
 * labels hide below 40rem as they do in the reading pane.
 */
function inPane(node: RemixNode): RemixNode {
	return themed(<div mix={[raw({ container: "ui-split-view / inline-size" })]}>{node}</div>);
}

/**
 * Mounts a node `width` pixels wide and reads how far below its top the messages list starts,
 * which is the toolbar's and the header's height together.
 */
function messagesOffset(node: RemixNode, width: number): number {
	let mounted = render(<div style={`inline-size:${width}px`}>{inPane(node)}</div>);
	let root = mounted.container.getBoundingClientRect().top;
	let list = mounted.container.querySelector('[data-slot="relay-messages"]');
	let offset = Math.round((list?.getBoundingClientRect().top ?? -1) - root);
	mounted.cleanup();
	return offset;
}

/** Expects the content to take the placeholder's height, to a pixel. */
function expectSameSize(content: number, fallback: number) {
	expect(content).toBeGreaterThan(0);
	expect(Math.abs(content - fallback)).toBeLessThanOrEqual(1);
}

describe("Relay frames keep their placeholder's size", () => {
	let inbox = findView("inbox");

	describe.each(WIDTHS)("at %ipx", (width) => {
		test.each(CONVERSATIONS.map((conversation) => [conversation.id, conversation]))(
			"conversation %s's toolbar and header",
			(_, conversation) => {
				if (!inbox) throw new Error("Relay has no inbox view");
				let fallback = messagesOffset(
					<ConversationPlaceholder conversation={conversation} />,
					width,
				);
				let content = messagesOffset(
					<ConversationPane view={inbox} conversation={conversation} />,
					width,
				);
				expectSameSize(content, fallback);
			},
		);

		test("the reports' figures", () => {
			expectSameSize(
				blockSize(<ReportStats />, width, themed),
				blockSize(<ReportStats ghost />, width, themed),
			);
		});

		test("the reports' chart", () => {
			expectSameSize(
				blockSize(<ReportChart failed={false} />, width, themed),
				blockSize(<ChartPlaceholder />, width, themed),
			);
		});

		test.each(CONTACTS.map((contact) => [contact.id, contact]))(
			"%s's conversations and activity",
			(_, contact) => {
				expectSameSize(
					blockSize(<ContactConversations contact={contact} />, width, themed),
					blockSize(<ContactConversations contact={contact} ghost />, width, themed),
				);
				expectSameSize(
					blockSize(<ContactActivity contact={contact} />, width, themed),
					blockSize(<ContactActivity contact={contact} ghost />, width, themed),
				);
			},
		);
	});

	describe.each(SHEET_WIDTHS)("in the sheet at %ipx", (width) => {
		test.each(CONTACTS.map((contact) => [contact.id, contact]))("%s's sheet body", (_, contact) => {
			expectSameSize(
				blockSize(<ContactSheetBody contact={contact} />, width, themed),
				blockSize(<ContactSheetBody contact={contact} ghost />, width, themed),
			);
		});
	});
});
