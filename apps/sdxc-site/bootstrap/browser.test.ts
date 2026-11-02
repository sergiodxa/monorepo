/**
 * Holds every island to the identity the build can resolve: `clientEntry(import.meta.url, …)`
 * is rewritten into a `file:` id the renderer maps to the island's own chunk, while a written
 * URL names a source path that exists only in development and fails to hydrate once built,
 * and holds a navigation to fetching a page the current deploy rendered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { RunInit } from "remix/component";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

/** The app's root, which every path this test reports is relative to. */
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every `clientEntry(` call and the first argument it passes, across the app's components. */
function clientEntryCalls(): { file: string; id: string }[] {
	return globSync("{app,resources}/**/*.tsx", { cwd: APP_DIR }).flatMap((file) =>
		[...readFileSync(join(APP_DIR, file), "utf8").matchAll(/clientEntry\(\s*([^,]+),/g)].map(
			(match) => ({ file, id: match[1] ?? "" }),
		),
	);
}

test("every island is identified by its own module URL", () => {
	let calls = clientEntryCalls();

	expect(calls.length).toBeGreaterThan(0);
	expect(calls.filter((call) => call.id !== "import.meta.url")).toEqual([]);
});

/** Answers every page with the cache mode and frame header its request was sent under. */
const SERVER = setupServer(
	http.get("https://sdxc.dev/*", ({ request }) => {
		REQUESTS.push(new URL(request.url).pathname);
		return HttpResponse.json({ cache: request.cache, frame: request.headers.get("x-remix-frame") });
	}),
	http.post("https://sdxc.dev/*", () => new HttpResponse(null, { status: 204 })),
);

/** Every page path the server answered, in order, so a test counts what reached the network. */
const REQUESTS: string[] = [];

/** What the browser entry handed the runtime, captured once it boots. */
let options: RunInit | undefined;

beforeAll(async () => {
	SERVER.listen({ onUnhandledRequest: "error" });
	vi.doMock("remix/component", () => ({
		run: (given: RunInit) => {
			options = given;
		},
	}));
	await import("./browser.ts");
});
afterAll(() => SERVER.close());

/** How a request was sent, as the server saw it. */
interface Sent {
	cache: string;
	frame: string | null;
}

/** How the request for `src` was sent, as the server saw it. */
async function sentAs(src: string): Promise<Sent> {
	let response = await options?.resolveFrame?.(src, { target: "search" });
	if (!(response instanceof Response)) throw new Error("resolveFrame returned no response");
	return (await response.json()) as Sent;
}

test("a navigation revalidates the stored page instead of reusing it", async () => {
	expect((await sentAs("https://sdxc.dev/api/u")).cache).toBe("no-cache");
});

test("a frame request says it is one, so the Worker keeps the edge from rewriting it", async () => {
	expect((await sentAs("https://sdxc.dev/frames/search?q=dialog")).frame).toBe("true");
});

test("a prefetched page answers the next navigation to it once, without another request", async () => {
	REQUESTS.length = 0;
	options?.prefetch?.("https://sdxc.dev/demo/apps/pulse/services");
	await vi.waitFor(() => expect(REQUESTS).toEqual(["/demo/apps/pulse/services"]));

	let first = await options?.resolveFrame?.("https://sdxc.dev/demo/apps/pulse/services#top");
	expect(first).toBeInstanceOf(Response);
	expect(REQUESTS).toHaveLength(1);

	await options?.resolveFrame?.("https://sdxc.dev/demo/apps/pulse/services");
	expect(REQUESTS).toHaveLength(2);
});

test("a prefetched page older than its lifetime is fetched again", async () => {
	REQUESTS.length = 0;
	vi.useFakeTimers({ toFake: ["Date"] });
	options?.prefetch?.("https://sdxc.dev/demo/apps/relay");
	vi.setSystemTime(Date.now() + 31_000);
	await options?.resolveFrame?.("https://sdxc.dev/demo/apps/relay");
	vi.useRealTimers();

	expect(REQUESTS).toEqual(["/demo/apps/relay", "/demo/apps/relay"]);
});

test("a submission empties the prefetched pages, so none outlives what it changed", async () => {
	REQUESTS.length = 0;
	options?.prefetch?.("https://sdxc.dev/demo/apps/inkwell/posts");
	await options?.resolveFrame?.("https://sdxc.dev/demo/apps/inkwell/posts/new", {
		method: "POST",
		formData: new FormData(),
		encType: "application/x-www-form-urlencoded",
	});
	await options?.resolveFrame?.("https://sdxc.dev/demo/apps/inkwell/posts");

	expect(REQUESTS.filter((path) => path === "/demo/apps/inkwell/posts")).toHaveLength(2);
});
