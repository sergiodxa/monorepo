/**
 * Drives `sdxc-webmention` through `invoke()` against pages and endpoints MSW stands in for:
 * what each command prints, in both forms, and the exit code each outcome maps to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

/** The page doing the mentioning. */
const SOURCE = "https://example.com/articles/hello";

/** The page it mentions. */
const TARGET = "https://ada.example.com/notes/1";

/** Where the target's site takes mentions. */
const ENDPOINT = "https://ada.example.com/webmention";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Serves the target page advertising the endpoint in its `Link` header. */
function targetAdvertising() {
	return http.get(
		TARGET,
		() => new HttpResponse(null, { headers: { Link: `<${ENDPOINT}>; rel="webmention"` } }),
	);
}

/** Serves the target page with no endpoint anywhere. */
function targetWithoutEndpoint() {
	return http.get(TARGET, () => HttpResponse.html("<p>No endpoint here.</p>"));
}

describe("discover", () => {
	test("prints the endpoint the target advertises", async () => {
		server.use(targetAdvertising());

		let run = await invoke(cli, ["discover", TARGET]);

		expect(run).toMatchObject({ code: 0, stdout: `${ENDPOINT}\n`, stderr: "" });
	});

	test("prints it as JSON", async () => {
		server.use(targetAdvertising());

		let run = await invoke(cli, ["discover", TARGET, "--json"]);

		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({ endpoint: ENDPOINT });
	});

	test("exits 1 when the target advertises none", async () => {
		server.use(targetWithoutEndpoint());

		let run = await invoke(cli, ["discover", TARGET]);

		expect(run.code).toBe(1);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("advertises no Webmention endpoint");
	});

	test("reports none as a null endpoint in JSON", async () => {
		server.use(targetWithoutEndpoint());

		let run = await invoke(cli, ["discover", TARGET, "--json"]);

		expect(run.code).toBe(1);
		expect(JSON.parse(run.stdout)).toEqual({ endpoint: null });
	});

	test("exits 1 with the reason when the target cannot be fetched", async () => {
		server.use(http.get(TARGET, () => HttpResponse.error()));

		let run = await invoke(cli, ["discover", TARGET, "--json"]);

		expect(run.code).toBe(1);
		expect(JSON.parse(run.stdout)).toMatchObject({ endpoint: null, retryable: true });
	});

	test("exits 2 for a target that is not a URL", async () => {
		let run = await invoke(cli, ["discover", "not a url"]);

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("is not a URL");
	});

	test("sends the user agent it is given", async () => {
		let agent: string | null = null;
		server.use(
			http.get(TARGET, ({ request }) => {
				agent = request.headers.get("user-agent");
				return HttpResponse.html("<p>Hi</p>");
			}),
		);

		await invoke(cli, ["discover", TARGET, "--user-agent", "Example/1.0"]);

		expect(agent).toBe("Example/1.0");
	});
});

describe("send", () => {
	test("posts the pair and prints the endpoint's answer", async () => {
		let body = "";
		server.use(
			targetAdvertising(),
			http.post(ENDPOINT, async ({ request }) => {
				body = await request.text();
				return new HttpResponse(null, { status: 201, headers: { Location: "/status/9" } });
			}),
		);

		let run = await invoke(cli, ["send", SOURCE, TARGET]);

		expect(run).toMatchObject({
			code: 0,
			stdout: `Sent to ${ENDPOINT}: 201\nStatus: https://ada.example.com/status/9\n`,
		});
		let params = new URLSearchParams(body);
		expect(params.get("source")).toBe(SOURCE);
		expect(params.get("target")).toBe(TARGET);
	});

	test("prints the delivery as JSON", async () => {
		server.use(
			targetAdvertising(),
			http.post(ENDPOINT, () => new HttpResponse(null, { status: 202 })),
		);

		let run = await invoke(cli, ["send", SOURCE, TARGET, "--json"]);

		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			sent: true,
			endpoint: ENDPOINT,
			status: 202,
			location: null,
		});
	});

	test("exits 1 when the endpoint refuses", async () => {
		server.use(
			targetAdvertising(),
			http.post(ENDPOINT, () => new HttpResponse("no", { status: 400 })),
		);

		let run = await invoke(cli, ["send", SOURCE, TARGET, "--json"]);

		expect(run.code).toBe(1);
		expect(JSON.parse(run.stdout)).toMatchObject({ sent: false, status: 400 });
	});

	test("exits 1 when the target advertises no endpoint", async () => {
		server.use(targetWithoutEndpoint());

		let run = await invoke(cli, ["send", SOURCE, TARGET]);

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("advertises no Webmention endpoint");
	});

	test("exits 2 for a source that is not a URL", async () => {
		let run = await invoke(cli, ["send", "nope", TARGET]);

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("The source nope is not a URL");
	});
});

describe("verify", () => {
	test("prints the mention a source linking to the target becomes", async () => {
		server.use(
			http.get(SOURCE, () =>
				HttpResponse.html(`<article class="h-entry">
					<a class="u-in-reply-to" href="${TARGET}">Ada's note</a>
					<a class="p-author h-card" href="https://example.com/">Sergio</a>
					<p class="e-content">Nice note!</p>
				</article>`),
			),
		);

		let run = await invoke(cli, ["verify", SOURCE, TARGET]);

		expect(run.code).toBe(0);
		expect(run.stdout).toContain("Linked: a reply by Sergio\n");
		expect(run.stdout).toContain("Nice note!");
	});

	test("prints the outcome as JSON", async () => {
		server.use(http.get(SOURCE, () => HttpResponse.html(`<a href="${TARGET}">Ada</a>`)));

		let run = await invoke(cli, ["verify", SOURCE, TARGET, "--json"]);

		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toMatchObject({
			status: "linked",
			finalUrl: SOURCE,
			mention: { kind: "mention", url: SOURCE },
		});
	});

	test("exits 1 when the source does not link to the target", async () => {
		server.use(http.get(SOURCE, () => HttpResponse.html("<p>Nothing here.</p>")));

		let run = await invoke(cli, ["verify", SOURCE, TARGET]);

		expect(run.code).toBe(1);
		expect(run.stderr).toContain(`does not link to ${TARGET}`);
	});

	test("exits 1 for a source that is gone", async () => {
		server.use(http.get(SOURCE, () => new HttpResponse(null, { status: 410 })));

		let run = await invoke(cli, ["verify", SOURCE, TARGET, "--json"]);

		expect(run.code).toBe(1);
		expect(JSON.parse(run.stdout)).toEqual({ status: "gone" });
	});

	test("exits 2 for a target that is not a URL", async () => {
		let run = await invoke(cli, ["verify", SOURCE, "nope"]);

		expect(run.code).toBe(2);
	});
});
