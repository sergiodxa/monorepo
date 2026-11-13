/**
 * Tests the server half of a demo app's swappable main area: the address the `main` frame
 * loads drops the one-time toast, and a screen's manifest carries what the browser syncs
 * after a swap, with a toast marker that has its own id each render.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { MAIN_FRAME, mainSource, MainScreen } from "~/resources/views/demo-apps/main-frame";

describe("mainSource", () => {
	test("keeps the screen's path and query and drops its one-time toast", () => {
		let url = new URL("https://sdxc.test/demo/apps/pulse/services?status=down&toast=x.1a2b3c4d");
		expect(mainSource(url)).toBe("/demo/apps/pulse/services?status=down");
	});

	test("drops the anchor a framed post's redirect carried", () => {
		let url = new URL("https://sdxc.test/demo/apps/chorus?toast=posted.1a2b3c4d&at=post-n-1");
		expect(mainSource(url)).toBe("/demo/apps/chorus");
	});
});

describe("MainScreen", () => {
	test("describes the screen for the browser: title, nav, crumb and its own address", async () => {
		let html = await renderToString(
			<MainScreen
				title="Services"
				nav="services"
				crumb="Services"
				url={new URL("https://sdxc.test/demo/apps/pulse/services?toast=x.1a2b3c4d")}
			>
				<h1>Services</h1>
			</MainScreen>,
		);

		expect(html).toContain('data-title="Services"');
		expect(html).toContain('data-nav="services"');
		expect(html).toContain('data-crumb="Services"');
		expect(html).toContain('data-url="/demo/apps/pulse/services"');
		expect(html).not.toContain("data-main-toast");
	});

	test("carries the anchor a framed post's redirect named as a marker", async () => {
		let html = await renderToString(
			<MainScreen title="Home" url={new URL("https://sdxc.test/demo/apps/chorus?at=post-n-1")}>
				<h1>Home</h1>
			</MainScreen>,
		);

		expect(html).toContain('data-main-anchor="post-n-1"');
		expect(html).toContain('data-url="/demo/apps/chorus"');
	});

	test("carries the post's toast as a marker with a fresh id each render", async () => {
		let render = () =>
			renderToString(
				<MainScreen
					title="Services"
					url={new URL("https://sdxc.test/demo/apps/pulse/services")}
					toast={{ color: "success", title: "Service paused" }}
				>
					<h1>Services</h1>
				</MainScreen>,
			);
		let [first, second] = await Promise.all([render(), render()]);
		let id = (html: string) => /data-main-toast="([^"]+)"/.exec(html)?.[1];

		expect(first).toContain("Service paused");
		expect(id(first)).toBeTruthy();
		expect(id(first)).not.toBe(id(second));
	});

	test("names the frame every demo app mounts its main area under", () => {
		expect(MAIN_FRAME).toBe("main");
	});
});
