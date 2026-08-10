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

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { SpecError } from "../errors";
import type { ExecutionContext } from "../executor";
import type { LoadedSuite } from "../loader";
import type { Grants, PermissionSet } from "../permissions";
import type { Plugin, ToolContext } from "../plugin";
import type { ToolArg, Value } from "../values";
import type { Workspace } from "../workspace";

import { ExpectationError, PermissionDeniedError } from "../errors";
import { executeTest } from "../executor";
import { parse } from "../parser";
import { createRegistry } from "../registry";

import { createBrowserPlugin } from "./browser";
import { createUrlPlugin } from "./url";

/** Whether the real `agent-browser` CLI is installed; gates the e2e suite. */
const AVAILABLE = Bun.which("agent-browser") !== null;

/** The static page the end-to-end tests drive, served in-process. */
const PAGE_HTML = `<!doctype html>
<html>
	<head><title>Login</title></head>
	<body>
		<h1>Sign in</h1>
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
	return { workspace: stubWorkspace(root), permissions };
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
		]);
		for (let tool of tools) expect(tool.requires).toBe("net");
	});

	test("open, navigate and the interactions are actions; the observers are observable", () => {
		let byName = new Map(plugin.describe().map((tool) => [tool.name, tool.kind]));
		for (let action of ["open", "navigate", "click", "fill", "check", "press", "click_selector"]) {
			expect(byName.get(action)).toBe("action");
		}
		for (let observable of ["heading", "link", "button", "text", "checkbox", "url"]) {
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
	});

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
		// The denial lands after the URL parses and before any process spawns.
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

// The end-to-end suite proves the accessibility path against a real browser.
// It is skipped wholesale when `agent-browser` is not installed, so the unit
// suite above (and the whole package) stays green without the CLI present.
describe("browser end to end", () => {
	let plugin: Plugin;
	let server: ReturnType<typeof Bun.serve> | undefined;
	let baseUrl = "";
	let context: ToolContext;

	beforeAll(() => {
		plugin = createBrowserPlugin();
		server = Bun.serve({
			port: 0,
			hostname: "127.0.0.1",
			fetch: () => new Response(PAGE_HTML, { headers: { "content-type": "text/html" } }),
		});
		baseUrl = `http://127.0.0.1:${server.port}/`;
		// A real temp-dir-shaped root, so the derived session is unique.
		context = buildContext(allowAll(), "/tmp/spec-browser-e2e-session");
	});

	afterAll(async () => {
		if (plugin.dispose !== undefined) await plugin.dispose();
		server?.stop(true);
	});

	test.skipIf(!AVAILABLE)(
		"drives open, fill, click and observers through the a11y tree",
		async () => {
			expectSuccess(await plugin.call("open", [value(baseUrl)], context));

			// Existence observers read the accessibility tree by role and name.
			expect(expectSuccess(await plugin.call("heading", [value("Sign in")], context))).toBe(true);
			expect(expectSuccess(await plugin.call("button", [value("Sign in")], context))).toBe(true);

			// A missing element fails as an expectation, carrying expected/observed.
			let absent = unwrapError(await plugin.call("heading", [value("Dashboard")], context));
			expect(absent).toBeInstanceOf(ExpectationError);
			expect(absent.code).toBe("expectation-failed");

			// Fill a field by its label, click a button by its name, read the result.
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

		// Unchecked to start: the state assertion fails as an expectation.
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
 * Parse a single-test `.spec` source, build a registry over the given plugins,
 * and execute the test — the real runtime path, so a bare-path `let`/`return`
 * right-hand side goes through the same zero-arg-tool resolution production code
 * uses. Net is granted so the coarse gate lets the browser tools through; the
 * permission set allows every scoped check for the loopback host.
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
		env: { mode: "denied" },
		hostFs: { mode: "denied" },
	};
	let context: ExecutionContext = {
		registry: createRegistry(plugins, suite),
		workspace: stubWorkspace(root),
		permissions: allowAll(),
		uses,
		usesFor: () => uses,
		grants,
	};
	return executeTest(test0, context);
}

// End to end through the executor: `let current = browser.url` must capture the
// current URL as a value, so the authorization_code chain (land on ?code=…,
// read the code) is expressible. Skipped wholesale without `agent-browser`.
describe("browser.url captured through the executor", () => {
	let browserPlugin: Plugin;
	let urlPlugin: Plugin;
	let server: ReturnType<typeof Bun.serve> | undefined;
	let baseUrl = "";

	beforeAll(() => {
		browserPlugin = createBrowserPlugin();
		urlPlugin = createUrlPlugin();
		// Any path returns the page, so navigating to a URL with a query string
		// leaves the session's current URL carrying that query string verbatim.
		server = Bun.serve({
			port: 0,
			hostname: "127.0.0.1",
			fetch: () => new Response(PAGE_HTML, { headers: { "content-type": "text/html" } }),
		});
		baseUrl = `http://127.0.0.1:${server.port}/`;
	});

	afterAll(async () => {
		if (browserPlugin.dispose !== undefined) await browserPlugin.dispose();
		server?.stop(true);
	});

	test.skipIf(!AVAILABLE)(
		"`let current = browser.url` captures the landing URL and url.query reads its code",
		async () => {
			let landing = `${baseUrl}callback?code=abc123&state=xyz`;
			// `current` is a scalar binding; a bare identifier in tool-argument
			// position is a symbolic word (ADR-002), so it is boxed to reach
			// url.query through a dotted reference — the documented v1 pattern.
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
