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
	http.get("https://sdxc.dev/*", ({ request }) =>
		HttpResponse.json({ cache: request.cache, frame: request.headers.get("x-remix-frame") }),
	),
);

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
