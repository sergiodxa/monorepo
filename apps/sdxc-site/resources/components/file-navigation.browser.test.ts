/**
 * Tests that a click on a link to a file opens the file itself. A stand-in for the client
 * runtime intercepts every navigation it sees, as the real one does, inside an iframe so the
 * document load a file needs leaves the test page in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test, vi } from "vitest";

import { isFileAddress, leaveFilesToTheBrowser } from "~/resources/components/file-navigation";

/** The page the iframe opens: one link to a screenshot served from the app's public folder. */
const FIXTURE_URL = new URL("./fixtures/file-navigation.html", import.meta.url).href;

/** Resolves once the frame finishes loading its next document. */
function nextLoad(frame: HTMLIFrameElement): Promise<void> {
	return new Promise((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
}

/**
 * Opens the fixture in an iframe and wires its navigation as the site's client entry does:
 * the file guard when asked for, then a listener that intercepts like the runtime.
 */
async function openFixture(guarded: boolean) {
	let frame = document.createElement("iframe");
	let loaded = nextLoad(frame);
	frame.src = FIXTURE_URL;
	document.body.appendChild(frame);
	await loaded;

	let navigation = frame.contentWindow?.navigation;
	if (!navigation) throw new Error("The fixture frame has no Navigation API");
	if (guarded) navigation.addEventListener("navigate", leaveFilesToTheBrowser);
	let runtime = vi.fn((event: NavigateEvent) => event.intercept({ async handler() {} }));
	navigation.addEventListener("navigate", runtime);

	return { frame, runtime };
}

afterEach(() => {
	for (let frame of document.querySelectorAll("iframe")) frame.remove();
});

describe("leaveFilesToTheBrowser", () => {
	test("a click on a screenshot link loads the image as its own document", async () => {
		let { frame, runtime } = await openFixture(true);
		let loaded = nextLoad(frame);
		frame.contentDocument?.querySelector<HTMLAnchorElement>("#file")?.click();
		await loaded;

		expect(runtime).not.toHaveBeenCalled();
		expect(frame.contentDocument?.contentType).toBe("image/webp");
	});

	test("without the guard the runtime takes the click and the page stays HTML", async () => {
		let { frame, runtime } = await openFixture(false);
		frame.contentDocument?.querySelector<HTMLAnchorElement>("#file")?.click();
		await vi.waitFor(() => expect(runtime).toHaveBeenCalledOnce());

		expect(frame.contentDocument?.contentType).toBe("text/html");
	});
});

describe("isFileAddress", () => {
	test("an address whose last segment has an extension names a file", () => {
		expect(isFileAddress("https://sdxc.dev/showcase/malfoid/moods.webp")).toBe(true);
		expect(isFileAddress("https://sdxc.dev/docs/guides/forms.md")).toBe(true);
		expect(isFileAddress("https://sdxc.dev/rss.xml?page=2")).toBe(true);
	});

	test("pages, dotted folders and HTML files stay with the runtime", () => {
		expect(isFileAddress("https://sdxc.dev/showcase/malfoid")).toBe(false);
		expect(isFileAddress("https://sdxc.dev/")).toBe(false);
		expect(isFileAddress("https://sdxc.dev/v1.2/guide")).toBe(false);
		expect(isFileAddress("https://sdxc.dev/.well-known/")).toBe(false);
		expect(isFileAddress("https://sdxc.dev/about.html")).toBe(false);
	});
});
