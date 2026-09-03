/**
 * Tests for the built-in `browser` plugin. The unit tests never launch a
 * browser: they exercise the static descriptors, the `net` permission gate,
 * URL validation, and word-argument checking, all before any `agent-browser`
 * process would spawn. The end-to-end tests drive a real browser against a
 * tiny in-process page and are skipped when `agent-browser` is not on PATH.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createServer } from "node:http";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { createRandom } from "@sdxc/sample";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { SpecError } from "../errors.js";
import type { ExecutionContext } from "../executor.js";
import type { Grants, PermissionSet } from "../permissions.js";
import type { Plugin, ToolContext } from "../plugin.js";
import type { LoadedSuite } from "../sources.js";
import type { ToolArg, Value } from "../values.js";
import type { Workspace } from "../workspace.js";

import { ExpectationError, PermissionDeniedError } from "../errors.js";
import { executeTest } from "../executor.js";
import { parse } from "../parser.js";
import { createRegistry } from "../registry.js";

import { browserBinaryPath, createBrowserPlugin } from "./browser.js";
import { createEnvPlugin } from "./env.js";
import { createUrlPlugin } from "./url.js";

/** Whether the real `agent-browser` CLI is installed; gates the e2e suite. */
const AVAILABLE = browserBinaryPath() !== null;

/** What a page handler reads off an incoming request. */
interface PageRequest {
	/** The request path, without host or query. */
	path: string;
	/** The `cookie` header, empty when the request carried none. */
	cookie: string;
	/** The `user-agent` header, empty when the request carried none. */
	userAgent: string;
}

/** What a page handler answers with: a rendered page, or a redirect. */
interface PageResponse {
	/** The status to send; defaults to 200, or 302 when `location` is set. */
	status?: number;
	/** The HTML body. */
	html?: string;
	/** Where to redirect, which suppresses the body. */
	location?: string;
}

/** A running page server and how to stop it. */
interface PageServer {
	/** The scheme, host and port, with no trailing slash. */
	origin: string;
	/**
	 * Stop serving; closes any live socket first, since the browser keeps
	 * connections open, which plain `close()` alone would wait on.
	 */
	stop(): undefined;
}

/**
 * Serve one page over an ephemeral port on 127.0.0.1, resolving once the port
 * is known so the returned origin is immediately navigable. Each request is
 * answered from its own path and headers, so assertions read the server's view.
 *
 * @param render - Answers each request from its path and headers.
 * @returns The running server's origin and its stop function.
 */
async function servePage(render: (request: PageRequest) => PageResponse): Promise<PageServer> {
	let server = createServer((request, response) => {
		let url = new URL(request.url ?? "/", "http://127.0.0.1");
		let answer = render({
			path: url.pathname,
			cookie: request.headers.cookie ?? "",
			userAgent: request.headers["user-agent"] ?? "",
		});
		if (answer.location !== undefined) {
			response.writeHead(answer.status ?? 302, { location: answer.location });
			response.end();
			return;
		}
		response.writeHead(answer.status ?? 200, { "content-type": "text/html" });
		response.end(answer.html ?? "");
	});
	let port = await new Promise<number>((settle) => {
		server.listen(0, "127.0.0.1", () => {
			let address = server.address();
			settle(typeof address === "object" && address !== null ? address.port : 0);
		});
	});
	return {
		origin: `http://127.0.0.1:${port}`,
		stop() {
			server.closeAllConnections();
			server.close();
			return undefined;
		},
	};
}

/** The static page the end-to-end tests drive, served in-process. */
const PAGE_HTML = `<!doctype html>
<html>
	<head><title>Login</title></head>
	<body>
		<h1>Sign in</h1>
		<h3>Details</h3>
		<div role="heading" aria-level="4">Aria section</div>
		<form>
			<label for="email">Email</label>
			<input id="email" type="text" name="email" />
			<label><input id="remember" type="checkbox" /> Remember me</label>
			<button type="button" id="go">Sign in</button>
		</form>
		<p id="status">Not signed in</p>
		<script>
			document.getElementById("go").addEventListener("click", function () {
				var email = document.getElementById("email").value;
				document.getElementById("status").textContent = "Signed in as " + email;
			});
		</script>
	</body>
</html>`;

/** Wrap a runtime value as a positional value argument. */
function value(data: Value): ToolArg {
	return { kind: "value", value: data };
}

/** Wrap a bare identifier as a word argument. */
function word(name: string): ToolArg {
	return { kind: "word", word: name };
}

/** A permission set that grants everything. */
function allowAll(): PermissionSet {
	return {
		checkRun: () => success(undefined),
		checkNet: () => success(undefined),
		checkEnv: () => success(undefined),
		checkHostFs: () => success(undefined),
		grantedEnvNames: () => [],
	};
}

/** A permission set that denies net, recording each host/port it was asked about. */
function denyNet(calls: { host: string; port: number | undefined }[]): PermissionSet {
	return {
		...allowAll(),
		checkNet: (host, port) => {
			calls.push({ host, port });
			return failure(new PermissionDeniedError("net", host, `spec run --allow-net=${host}`));
		},
	};
}

/** A workspace stub over a fixed root; only its basename (the session) is read. */
function stubWorkspace(root: string): Workspace {
	return {
		root,
		resolve: (path: string): Result<string, SpecError> => success(path),
		cleanup: async () => undefined,
	};
}

/** Build a tool context from a permission set (defaults to allow-all). */
function buildContext(
	permissions: PermissionSet = allowAll(),
	root = "/tmp/spec-browser-unit",
): ToolContext {
	return {
		workspace: stubWorkspace(root),
		permissions,
		random: createRandom("test"),
		now: new Date("2026-01-01T00:00:00.000Z"),
	};
}

/** Unwrap a failed result into its error, failing the test on success. */
function unwrapError(result: Result<Value, SpecError>): SpecError {
	if (!isFailure(result)) {
		throw new Error(`expected a failure, got ${JSON.stringify(result.data)}`);
	}
	return result.error;
}

/** Narrow to the success data or fail the test with the error's message. */
function expectSuccess(result: Result<Value, SpecError>): Value {
	if (isFailure(result)) throw new Error(`Expected success, got: ${result.error.message}`);
	return result.data;
}

describe(createBrowserPlugin.name, () => {
	let plugin = createBrowserPlugin();

	test("describes the accessibility-first tool set, every tool requiring net", () => {
		expect(plugin.namespace).toBe("browser");
		let tools = plugin.describe();
		expect(tools.map((tool) => tool.name)).toEqual([
			"open",
			"navigate",
			"cookie",
			"ua",
			"click",
			"fill",
			"check",
			"press",
			"click_selector",
			"heading",
			"link",
			"button",
			"text",
			"checkbox",
			"url",
			"title",
		]);
		for (let tool of tools) expect(tool.requires).toBe("net");
	});

	test("open, navigate and the interactions are actions; the observers are observable", () => {
		let byName = new Map(plugin.describe().map((tool) => [tool.name, tool.kind]));
		for (let action of [
			"open",
			"navigate",
			"cookie",
			"ua",
			"click",
			"fill",
			"check",
			"press",
			"click_selector",
		]) {
			expect(byName.get(action)).toBe("action");
		}
		for (let observable of ["heading", "link", "button", "text", "checkbox", "url", "title"]) {
			expect(byName.get(observable)).toBe("observable");
		}
	});

	test("declares the click/fill/checkbox parameter shapes", () => {
		let tools = new Map(plugin.describe().map((tool) => [tool.name, tool]));
		expect(tools.get("click")?.params.map((param) => [param.name, param.kind])).toEqual([
			["role", "word"],
			["name", "value"],
		]);
		expect(tools.get("fill")?.params.map((param) => [param.name, param.kind])).toEqual([
			["role", "word"],
			["name", "value"],
			["with", "word"],
			["value", "value"],
		]);
		expect(tools.get("checkbox")?.params.map((param) => [param.name, param.kind])).toEqual([
			["name", "value"],
			["state", "word"],
		]);
		expect(tools.get("url")?.params.map((param) => param.required)).toEqual([false]);
		expect(
			tools.get("heading")?.params.map((param) => [param.name, param.kind, param.required]),
		).toEqual([
			["name", "value", true],
			["level", "word", false],
			["number", "value", false],
		]);
	});

	/** The denial lands after the URL parses and before any process spawns. */
	test("a denied net grant fails browser.open before agent-browser is spawned", async () => {
		let calls: { host: string; port: number | undefined }[] = [];
		let result = await plugin.call(
			"open",
			[value("https://example.com/app")],
			buildContext(denyNet(calls)),
		);
		let error = unwrapError(result);
		expect(error).toBeInstanceOf(PermissionDeniedError);
		expect(error.code).toBe("permission-denied");
		expect(error.remedy).toContain("--allow-net");
		expect(calls).toEqual([{ host: "example.com", port: 443 }]);
	});

	test("a relative URL is a tool error naming the environments gap", async () => {
		let error = unwrapError(await plugin.call("open", [value("/login")], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("/login");
		expect(error.message).toContain("absolute");
		expect(error.message).toContain("docs/adr/spec/ADR-008");
	});

	test("a non-http scheme is a tool error", async () => {
		let error = unwrapError(
			await plugin.call("navigate", [value("ftp://files.example.com/x")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("http(s)");
	});

	test("click rejects a role that is not a bare word", async () => {
		let error = unwrapError(
			await plugin.call("click", [value("button"), value("Sign in")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("bare word");
	});

	test("fill rejects a wrong separator word", async () => {
		let error = unwrapError(
			await plugin.call(
				"fill",
				[word("textbox"), value("Email"), word("using"), value("x")],
				buildContext(),
			),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('does not understand the word "using"');
		expect(error.message).toContain("with");
	});

	test("checkbox rejects a wrong state word", async () => {
		let error = unwrapError(
			await plugin.call("checkbox", [value("Remember me"), word("unchecked")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('does not understand the word "unchecked"');
		expect(error.message).toContain("checked");
	});

	test("cookie declares an optional `for <url>` clause", () => {
		let tools = new Map(plugin.describe().map((tool) => [tool.name, tool]));
		expect(
			tools.get("cookie")?.params.map((param) => [param.name, param.kind, param.required]),
		).toEqual([
			["name", "value", true],
			["value", "value", true],
			["for", "word", false],
			["url", "value", false],
		]);
	});

	test("a denied net grant fails browser.cookie's `for` URL before any spawn", async () => {
		let calls: { host: string; port: number | undefined }[] = [];
		let result = await plugin.call(
			"cookie",
			[value("session"), value("abc123"), word("for"), value("https://app.example.com/")],
			buildContext(denyNet(calls)),
		);
		let error = unwrapError(result);
		expect(error).toBeInstanceOf(PermissionDeniedError);
		expect(calls).toEqual([{ host: "app.example.com", port: 443 }]);
	});

	test("cookie rejects a partial `for` clause", async () => {
		let error = unwrapError(
			await plugin.call("cookie", [value("session"), value("abc"), word("for")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("`for");
	});

	test("cookie rejects a wrong clause word", async () => {
		let error = unwrapError(
			await plugin.call(
				"cookie",
				[value("session"), value("abc"), word("on"), value("https://app.example.com/")],
				buildContext(),
			),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('does not understand the word "on"');
		expect(error.message).toContain("for");
	});

	test("cookie rejects a relative `for` URL", async () => {
		let error = unwrapError(
			await plugin.call(
				"cookie",
				[value("session"), value("abc"), word("for"), value("/app")],
				buildContext(),
			),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("absolute");
	});

	test("ua rejects a bare word where the User-Agent goes", async () => {
		let error = unwrapError(await plugin.call("ua", [word("spec")], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("string");
	});

	test("heading rejects a wrong level word", async () => {
		let error = unwrapError(
			await plugin.call("heading", [value("Reports"), word("rank"), value(3)], buildContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('does not understand the word "rank"');
		expect(error.message).toContain("level");
	});

	test("heading rejects a level that is not a whole number", async () => {
		for (let bad of [value("3"), value(0), value(2.5)]) {
			let error = unwrapError(
				await plugin.call("heading", [value("Reports"), word("level"), bad], buildContext()),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("whole heading level");
		}
	});

	test("heading rejects a dangling `level` clause", async () => {
		let error = unwrapError(
			await plugin.call("heading", [value("Reports"), word("level")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("`level");
	});

	test("title refuses more than one argument", async () => {
		let error = unwrapError(await plugin.call("title", [value("a"), value("b")], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("at most one argument");
	});

	test("url refuses more than one argument", async () => {
		let error = unwrapError(await plugin.call("url", [value("a"), value("b")], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("at most one argument");
	});

	test("an unknown tool is a tool error listing the available tools", async () => {
		let error = unwrapError(await plugin.call("scroll", [], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('browser has no tool named "scroll"');
		expect(error.message).toContain("open, navigate");
	});
});

/**
 * The end-to-end suite drives the accessibility path against a real browser,
 * so the unit suite above (and the whole package) stays green without
 * `agent-browser` installed.
 */
describe("browser end to end", () => {
	let plugin: Plugin;
	let server: PageServer | undefined;
	let baseUrl = "";
	let context: ToolContext;

	beforeAll(async () => {
		plugin = createBrowserPlugin();
		server = await servePage(() => ({ html: PAGE_HTML }));
		baseUrl = `${server.origin}/`;
		context = buildContext(allowAll(), "/tmp/spec-browser-e2e-session");
	});

	afterAll(async () => {
		if (plugin.dispose !== undefined) await plugin.dispose();
		server?.stop();
	});

	test.skipIf(!AVAILABLE)(
		"drives open, fill, click and observers through the a11y tree",
		async () => {
			expectSuccess(await plugin.call("open", [value(baseUrl)], context));

			expect(expectSuccess(await plugin.call("heading", [value("Sign in")], context))).toBe(true);
			expect(expectSuccess(await plugin.call("button", [value("Sign in")], context))).toBe(true);

			let absent = unwrapError(await plugin.call("heading", [value("Dashboard")], context));
			expect(absent).toBeInstanceOf(ExpectationError);
			expect(absent.code).toBe("expectation-failed");

			expectSuccess(
				await plugin.call(
					"fill",
					[word("textbox"), value("Email"), word("with"), value("ada@example.com")],
					context,
				),
			);
			expectSuccess(await plugin.call("click", [word("button"), value("Sign in")], context));
			expect(
				expectSuccess(await plugin.call("text", [value("Signed in as ada@example.com")], context)),
			).toBe(true);
		},
	);

	test.skipIf(!AVAILABLE)("checks a checkbox and asserts its state", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		let before = unwrapError(
			await plugin.call("checkbox", [value("Remember me"), word("checked")], context),
		);
		expect(before).toBeInstanceOf(ExpectationError);

		expectSuccess(await plugin.call("check", [word("checkbox"), value("Remember me")], context));
		expect(
			expectSuccess(
				await plugin.call("checkbox", [value("Remember me"), word("checked")], context),
			),
		).toBe(true);
	});

	/**
	 * A `role="heading"` element with `aria-level` reaches the accessibility
	 * tree the same way an `<h4>` element does.
	 */
	test.skipIf(!AVAILABLE)("matches a heading by level, HTML or aria", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));
		expect(
			expectSuccess(
				await plugin.call("heading", [value("Details"), word("level"), value(3)], context),
			),
		).toBe(true);
		expect(
			expectSuccess(
				await plugin.call("heading", [value("Aria section"), word("level"), value(4)], context),
			),
		).toBe(true);

		let wrongLevel = unwrapError(
			await plugin.call("heading", [value("Details"), word("level"), value(2)], context),
		);
		expect(wrongLevel).toBeInstanceOf(ExpectationError);
		expect(wrongLevel.message).toContain("not at level 2");

		let absent = unwrapError(
			await plugin.call("heading", [value("Nowhere"), word("level"), value(3)], context),
		);
		expect(absent).toBeInstanceOf(ExpectationError);
		expect(absent.message).toContain("no heading named");
	});

	test.skipIf(!AVAILABLE)("observes and asserts the page title", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));
		expect(expectSuccess(await plugin.call("title", [], context))).toBe("Login");
		expect(expectSuccess(await plugin.call("title", [value("Login")], context))).toBe(true);
		let mismatch = unwrapError(await plugin.call("title", [value("Dashboard")], context));
		expect(mismatch).toBeInstanceOf(ExpectationError);
		expect(mismatch.code).toBe("expectation-failed");
	});

	test.skipIf(!AVAILABLE)("observes and asserts the current URL", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));
		expect(expectSuccess(await plugin.call("url", [], context))).toBe(baseUrl);
		expect(expectSuccess(await plugin.call("url", [value(baseUrl)], context))).toBe(true);
		let mismatch = unwrapError(await plugin.call("url", [value("http://127.0.0.1:1/")], context));
		expect(mismatch).toBeInstanceOf(ExpectationError);
		expect(mismatch.code).toBe("expectation-failed");
	});
});

/**
 * Parse a single-test `.spec` source and execute it through the real runtime
 * path, so a bare-path `let`/`return` right-hand side resolves zero-arg
 * tools exactly as production code does.
 */
async function runSpec(
	source: string,
	plugins: Plugin[],
	root: string,
): Promise<Result<undefined, SpecError>> {
	let parsed = parse({ path: "e2e.spec", text: source });
	if (isFailure(parsed)) throw new Error(`expected the spec to parse: ${parsed.error.message}`);
	let file = parsed.data;
	let test0 = file.tests[0];
	if (test0 === undefined) throw new Error("expected the spec to contain a test");
	let suite: LoadedSuite = { files: [file], commands: new Map(), fixtures: new Map() };
	let uses = file.uses.map((entry) => entry.namespace);
	let grants: Grants = {
		run: { mode: "denied" },
		net: { mode: "all" },
		env: { mode: "all" },
		hostFs: { mode: "denied" },
	};
	let context: ExecutionContext = {
		registry: createRegistry(plugins, suite),
		workspace: stubWorkspace(root),
		permissions: allowAll(),
		random: createRandom("test"),
		now: new Date("2026-01-01T00:00:00.000Z"),
		uses,
		usesFor: () => uses,
		grants,
	};
	return executeTest(test0, context);
}

/**
 * A cookie or User-Agent set before the first navigation must reach the
 * server on the very next request — the only reason `browser.cookie` and
 * `browser.ua` exist.
 */
describe("browser session setup against a real browser", () => {
	let plugin: Plugin;
	let server: PageServer | undefined;
	let baseUrl = "";
	let context: ToolContext;

	beforeAll(async () => {
		plugin = createBrowserPlugin();
		server = await servePage((request) => {
			let cookie = /session=([^;]*)/.exec(request.cookie);
			let seen = cookie?.[1] ?? "none";
			let agent = request.userAgent === "" ? "none" : request.userAgent;
			return {
				html: `<!doctype html><html><body><p>Session: ${seen}</p><p>Agent: ${agent}</p></body></html>`,
			};
		});
		baseUrl = `${server.origin}/`;
		context = buildContext(allowAll(), "/tmp/spec-browser-cookie-session");
	});

	afterAll(async () => {
		if (plugin.dispose !== undefined) await plugin.dispose();
		server?.stop();
	});

	test.skipIf(!AVAILABLE)("a cookie set with `for` reaches the first request", async () => {
		expectSuccess(
			await plugin.call(
				"cookie",
				[value("session"), value("seeded-token"), word("for"), value(baseUrl)],
				context,
			),
		);
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));
		expect(
			expectSuccess(await plugin.call("text", [value("Session: seeded-token")], context)),
		).toBe(true);
	});

	test.skipIf(!AVAILABLE)("browser.ua sends the User-Agent the spec asked for", async () => {
		expectSuccess(await plugin.call("ua", [value("spec-runner/1.0")], context));
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));
		expect(
			expectSuccess(await plugin.call("text", [value("Agent: spec-runner/1.0")], context)),
		).toBe(true);
	});

	test.skipIf(!AVAILABLE)("without `for`, the cookie lands on the open page", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));
		expectSuccess(await plugin.call("cookie", [value("session"), value("later-token")], context));
		expectSuccess(await plugin.call("navigate", [value(baseUrl)], context));
		expect(expectSuccess(await plugin.call("text", [value("Session: later-token")], context))).toBe(
			true,
		);
	});
});

/**
 * The session token lives in the environment; `env.get` names it, and
 * `browser.cookie` seeds it before the first navigation, so the protected
 * page renders for the request.
 */
describe("a session seeded from the environment", () => {
	let browserPlugin: Plugin;
	let envPlugin: Plugin;
	let server: PageServer | undefined;
	let baseUrl = "";

	beforeAll(async () => {
		browserPlugin = createBrowserPlugin();
		envPlugin = createEnvPlugin();
		server = await servePage((request) => {
			let cookie = /session=([^;]*)/.exec(request.cookie);
			if (request.path === "/app" && cookie?.[1] !== "s3cret") {
				return { status: 302, location: "/login" };
			}
			let heading = request.path === "/app" ? "Dashboard" : "Sign in";
			return { html: `<!doctype html><html><body><h1>${heading}</h1></body></html>` };
		});
		baseUrl = server.origin;
		process.env.SPEC_E2E_SESSION = "s3cret";
	});

	afterAll(async () => {
		if (browserPlugin.dispose !== undefined) await browserPlugin.dispose();
		server?.stop();
		delete process.env.SPEC_E2E_SESSION;
	});

	/**
	 * The token reaches `browser.cookie` through a boxed reference: a bare
	 * binding in tool-argument position is a symbolic word (ADR-002), so it
	 * is wrapped in an object first — the same pattern `browser.url` uses.
	 */
	test.skipIf(!AVAILABLE)("the seeded cookie keeps the browser on /app", async () => {
		let source = [
			"use browser",
			"use env",
			"",
			'test "the session cookie admits the app" {',
			"	given {",
			'		let token = env.get "SPEC_E2E_SESSION"',
			"		let jar = { session: token }",
			`		browser.cookie "session" jar.session for "${baseUrl}/app"`,
			"	}",
			"	when {",
			`		browser.open "${baseUrl}/app"`,
			"	}",
			"	then {",
			"		# Without the cookie this would have redirected to /login.",
			`		expect browser.url "${baseUrl}/app"`,
			'		expect browser.heading "Dashboard"',
			"	}",
			"}",
			"",
		].join("\n");
		let outcome = await runSpec(
			source,
			[browserPlugin, envPlugin],
			"/tmp/spec-browser-cookie-env-session",
		);
		if (isFailure(outcome)) throw new Error(`expected the spec to pass: ${outcome.error.message}`);
	});
});

/**
 * `let current = browser.url` must capture the current URL as a value, so
 * the authorization_code chain — land on `?code=…`, then read the code — is
 * expressible.
 */
describe("browser.url captured through the executor", () => {
	let browserPlugin: Plugin;
	let urlPlugin: Plugin;
	let server: PageServer | undefined;
	let baseUrl = "";

	/**
	 * Any path returns the page, so navigating to a URL with a query string
	 * leaves the session's current URL carrying that query string verbatim.
	 */
	beforeAll(async () => {
		browserPlugin = createBrowserPlugin();
		urlPlugin = createUrlPlugin();
		server = await servePage(() => ({ html: PAGE_HTML }));
		baseUrl = `${server.origin}/`;
	});

	afterAll(async () => {
		if (browserPlugin.dispose !== undefined) await browserPlugin.dispose();
		server?.stop();
	});

	test.skipIf(!AVAILABLE)(
		"`let current = browser.url` captures the landing URL and url.query reads its code",
		async () => {
			let landing = `${baseUrl}callback?code=abc123&state=xyz`;
			let source = [
				"use browser",
				"use url",
				"",
				'test "capture the browser url" {',
				"	given {",
				`		browser.open "${landing}"`,
				"	}",
				"	when {",
				"		let current = browser.url",
				"		let box = { url: current }",
				'		let code = url.query box.url "code"',
				"	}",
				"	then {",
				`		expect current "${landing}"`,
				'		expect code "abc123"',
				"	}",
				"}",
				"",
			].join("\n");
			let outcome = await runSpec(
				source,
				[browserPlugin, urlPlugin],
				"/tmp/spec-browser-url-capture-session",
			);
			if (isFailure(outcome))
				throw new Error(`expected the spec to pass: ${outcome.error.message}`);
		},
	);
});
