/**
 * Runs the functional `http` examples (`packages/spec/examples/http/`) through
 * the real `spec` CLI as a child process, against an in-process HTTP server on
 * 127.0.0.1. This is the connecting acceptance layer the CI-safe `spec/http.spec`
 * meta-tests cannot be: it grants exactly the served host:port and demonstrates
 * the `net` scope authorizing real GET/POST traffic and JSON-body observables.
 * It needs no external service, so it runs in CI whenever the fixed port is
 * free, and skips only when that port cannot bind.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";

import { afterAll, expect, test } from "vitest";

/** Absolute path of this package, the example run's working directory. */
const PACKAGE_DIR = resolve(import.meta.dirname, "..");

/**
 * The Bun executable, found on PATH. The CLI under test is a Bun program, so
 * spawning it by name keeps the executable fixed no matter which runtime
 * happens to be running this file.
 */
const BUN_EXECUTABLE = "bun";

/**
 * The port the example server binds and the CLI is granted. It is coupled to
 * the absolute URLs in examples/http/requests.spec: v1 has no base-URL binding,
 * so the spec hardcodes the port and this constant must match it exactly.
 */
const HTTP_EXAMPLE_PORT = 50617;

/** How long the example run may take: it spawns one CLI over local sockets. */
const EXAMPLE_TIMEOUT_MS = 60_000;

/** The slice of an incoming request the example router reads, kept structural. */
interface ServerRequest {
	/** The HTTP method the routes dispatch on. */
	method?: string | undefined;
	/** The request target, path and query. */
	url?: string | undefined;
	/** The headers `/reflect` mirrors back, lower-cased as `node:http` presents them. */
	headers: { authorization?: string | undefined; "content-type"?: string | undefined };
	/** Decode the body stream as text. */
	setEncoding(encoding: "utf8"): unknown;
	/** Subscribe to the body stream: `data` carries text, `end` closes it. */
	on(event: "data" | "end", listener: (chunk: string) => void): unknown;
}

/** The slice of a response the example router writes, kept structural. */
interface ServerReply {
	/** Write the status line and headers. */
	writeHead(status: number, headers: Record<string, string>): unknown;
	/** Finish the response, optionally with a body. */
	end(body?: string): unknown;
}

/** The slice of the running server the teardown needs, kept structural. */
interface RunningServer {
	/** Drop live sockets so `close` returns immediately, before keep-alive connections could hold it open. */
	closeAllConnections(): void;
	/** Stop listening, calling back once the last connection is gone. */
	close(done: () => void): unknown;
}

/** Reply with a JSON body, the shape every route but `/ping` answers with. */
function sendJson(response: ServerReply, status: number, body: unknown): undefined {
	response.writeHead(status, { "content-type": "application/json" });
	response.end(JSON.stringify(body));
	return undefined;
}

/** Read a request's whole body as UTF-8 text; empty for a bodyless method. */
async function readBody(request: ServerRequest): Promise<string> {
	request.setEncoding("utf8");
	return await new Promise<string>((settle) => {
		let body = "";
		request.on("data", (chunk) => void (body += chunk));
		request.on("end", () => settle(body));
	});
}

/**
 * The example server: a tiny router covering the routes the specs hit — a
 * text GET, a JSON GET, a POST that echoes its body back with a 201, and a
 * `/reflect` route that mirrors the request so specs can verify the wire.
 */
async function handle(request: ServerRequest, response: ServerReply): Promise<undefined> {
	let url = new URL(request.url ?? "/", `http://127.0.0.1:${HTTP_EXAMPLE_PORT}`);
	if (request.method === "GET" && url.pathname === "/ping") {
		response.writeHead(200, { "content-type": "text/plain" });
		response.end("pong");
		return undefined;
	}
	if (request.method === "GET" && url.pathname === "/info") {
		return sendJson(response, 200, { ok: true, service: "spec-http-example" });
	}
	if (request.method === "POST" && url.pathname === "/echo") {
		return sendJson(response, 201, JSON.parse(await readBody(request)) as unknown);
	}
	if (url.pathname === "/reflect") {
		return sendJson(response, 200, {
			method: request.method,
			authorization: request.headers.authorization ?? null,
			content_type: request.headers["content-type"] ?? null,
			body: await readBody(request),
		});
	}
	response.writeHead(404, { "content-type": "text/plain" });
	response.end("not found");
	return undefined;
}

/**
 * Bind the example server up front so the test can skip cleanly when the
 * fixed port is already in use. A bind failure surfaces as an `error` event,
 * and resolving to `undefined` there is what turns it into a skip.
 */
async function startServer(): Promise<RunningServer | undefined> {
	let server = createServer((request, response) => void handle(request, response));
	return await new Promise<RunningServer | undefined>((settle) => {
		server.once("error", () => settle(undefined));
		server.listen(HTTP_EXAMPLE_PORT, "127.0.0.1", () => settle(server));
	});
}

let server = await startServer();

afterAll(async () => {
	let running = server;
	if (running === undefined) return;
	running.closeAllConnections();
	await new Promise<void>((settle) => void running.close(() => settle()));
});

test.skipIf(server === undefined)(
	"the examples/http suite passes through the real CLI against a local server",
	async () => {
		let child = spawn(
			BUN_EXECUTABLE,
			[
				resolve(PACKAGE_DIR, "src", "cli.ts"),
				"run",
				"examples/http",
				`--allow-net=127.0.0.1:${HTTP_EXAMPLE_PORT}`,
			],
			{ cwd: PACKAGE_DIR, stdio: ["ignore", "pipe", "pipe"] },
		);
		let stdout = "";
		let stderr = "";
		child.stdout?.setEncoding("utf8");
		child.stderr?.setEncoding("utf8");
		child.stdout?.on("data", (chunk: string) => void (stdout += chunk));
		child.stderr?.on("data", (chunk: string) => void (stderr += chunk));
		let exitCode = await new Promise<number>((settle, reject) => {
			child.once("error", reject);
			child.once("close", (code: number | null) => settle(code ?? 1));
		});
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
