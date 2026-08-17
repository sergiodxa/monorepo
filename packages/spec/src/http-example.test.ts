/**
 * Runs the functional `http` examples (`packages/spec/examples/http/`) through
 * the real `spec` CLI as a child process, against an in-process `Bun.serve` on
 * 127.0.0.1. This is the connecting acceptance layer the CI-safe `spec/http.spec`
 * meta-tests cannot be: it grants exactly the served host:port and demonstrates
 * the `net` scope authorizing real GET/POST traffic and JSON-body observables.
 * It needs no external service, so it runs in CI whenever the fixed port is
 * free, and skips only when that port cannot bind.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, expect, test } from "bun:test";
import { resolve } from "node:path";

/** Absolute path of this package, the example run's working directory. */
const PACKAGE_DIR = resolve(import.meta.dir, "..");

/**
 * The port the example server binds and the CLI is granted. It is coupled to
 * the absolute URLs in examples/http/requests.spec: v1 has no base-URL binding,
 * so the spec hardcodes the port and this constant must match it exactly.
 */
const HTTP_EXAMPLE_PORT = 50617;

/** How long the example run may take: it spawns one CLI over local sockets. */
const EXAMPLE_TIMEOUT_MS = 60_000;

/**
 * The example server: a tiny router covering the routes the specs hit — a text
 * GET, a JSON GET, a POST that echoes its JSON body back with a 201, and a
 * method-agnostic `/reflect` that mirrors the request's authorization header,
 * content type, and raw body so a spec can prove exactly what the request-option
 * tags (`headers`/`form`/`json`/`text`) put on the wire.
 */
async function handle(request: Request): Promise<Response> {
	let url = new URL(request.url);
	if (request.method === "GET" && url.pathname === "/ping") {
		return new Response("pong", { headers: { "content-type": "text/plain" } });
	}
	if (request.method === "GET" && url.pathname === "/info") {
		return Response.json({ ok: true, service: "spec-http-example" });
	}
	if (request.method === "POST" && url.pathname === "/echo") {
		let body = (await request.json()) as unknown;
		return Response.json(body, { status: 201 });
	}
	if (url.pathname === "/reflect") {
		return Response.json({
			method: request.method,
			authorization: request.headers.get("authorization"),
			content_type: request.headers.get("content-type"),
			body: await request.text(),
		});
	}
	return new Response("not found", { status: 404 });
}

/**
 * Bind the example server up front so the test can skip cleanly when the fixed
 * port is already in use. `Bun.serve` throws synchronously on a bind failure,
 * which the catch turns into a skip signal.
 */
function startServer() {
	try {
		return Bun.serve({ port: HTTP_EXAMPLE_PORT, hostname: "127.0.0.1", fetch: handle });
	} catch {
		return undefined;
	}
}

let server = startServer();

afterAll(async () => {
	await server?.stop(true);
});

test.skipIf(server === undefined)(
	"the examples/http suite passes through the real CLI against a local server",
	async () => {
		let child = Bun.spawn({
			cmd: [
				process.execPath,
				resolve(PACKAGE_DIR, "src", "cli.ts"),
				"run",
				"examples/http",
				`--allow-net=127.0.0.1:${HTTP_EXAMPLE_PORT}`,
			],
			cwd: PACKAGE_DIR,
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
		});
		let [stdout, stderr, exitCode] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		let report = `http example CLI output:\n${stdout}${stderr}`;

		expect(exitCode, report).toBe(0);
		expect(stdout, report).not.toContain("✗");
		let summary = /(\d+) passed, (\d+) failed/.exec(stdout);
		expect(summary, report).not.toBeNull();
		expect(Number(summary?.[1]), report).toBeGreaterThan(0);
		expect(Number(summary?.[2]), report).toBe(0);
	},
	EXAMPLE_TIMEOUT_MS,
);
