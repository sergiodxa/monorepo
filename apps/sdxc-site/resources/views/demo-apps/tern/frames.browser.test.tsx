/**
 * Holds Tern's frames to the box their placeholders reserve, and every screen to a phone's
 * width: the canvas, a project's files and the usage panel each land at their placeholder's
 * height, and no screen scrolls sideways at 375px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { themeScope } from "@sdxc/ui/styles";
import { render } from "remix/component/test";
import { afterAll, describe, expect, onTestFinished, test } from "vitest";
import { page } from "vitest/browser";

import { PENDING_FRAMES, blockSize } from "~/app/test/frame-size";
import { demoThemeTokens } from "~/resources/components/demo-theme";
import tern from "~/resources/views/demo-apps/tern";
import { CanvasPane } from "~/resources/views/demo-apps/tern/canvas";
import { CONVERSATIONS, PROJECTS } from "~/resources/views/demo-apps/tern/data";
import { ProjectFiles } from "~/resources/views/demo-apps/tern/screens";
import { UsagePanel } from "~/resources/views/demo-apps/tern/settings";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** The column widths the frames sit in: a phone's, the canvas beside a chat, a desktop's. */
const WIDTHS = [343, 640, 1100];

/** Wraps a node in Tern's theme tokens, so type and spacing match the page. */
function themed(node: RemixNode): RemixNode {
	return (
		<div
			mix={[
				themeScope(),
				raw({ ...demoThemeTokens(tern.theme), fontFamily: "var(--ui-font-sans)" }),
			]}
		>
			{node}
		</div>
	);
}

/** Expects the content to take the placeholder's height, to a pixel. */
function expectSameSize(content: number, fallback: number) {
	expect(content).toBeGreaterThan(0);
	expect(Math.abs(content - fallback)).toBeLessThanOrEqual(1);
}

describe("Tern frames keep their placeholder's size", () => {
	describe.each(WIDTHS)("at %ipx", (width) => {
		test.each(
			CONVERSATIONS.filter((conversation) => conversation.canvas).map((conversation) => [
				conversation.id,
				conversation,
			]),
		)("%s's canvas", (_, conversation) => {
			expectSameSize(
				blockSize(<CanvasPane conversation={conversation} />, width, themed),
				blockSize(<CanvasPane conversation={conversation} ghost />, width, themed),
			);
		});

		test.each(PROJECTS.map((project) => [project.slug, project]))("%s's files", (_, project) => {
			expectSameSize(
				blockSize(<ProjectFiles project={project} />, width, themed),
				blockSize(<ProjectFiles project={project} ghost />, width, themed),
			);
		});

		test("this month's usage", () => {
			expectSameSize(
				blockSize(<UsagePanel />, width, themed),
				blockSize(<UsagePanel ghost />, width, themed),
			);
		});
	});
});

describe("Tern at a phone's width", () => {
	afterAll(async () => {
		await page.viewport(414, 896);
	});

	test.each(tern.screens)("screen %j never scrolls sideways at 375px", async (screen) => {
		await page.viewport(375, 812);
		let [path = "", query = ""] = screen.split("?");
		let url = new URL(`http://localhost/demo/apps/tern/${path}${query ? `?${query}` : ""}`);
		let rendered = tern.render({ page: path, url, cookie: null });
		let mounted = render(themed(rendered.body), PENDING_FRAMES);
		onTestFinished(() => mounted.cleanup());
		await new Promise((resolve) => requestAnimationFrame(resolve));

		expect(mounted.container.querySelector("main"), screen).not.toBeNull();
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});
});
