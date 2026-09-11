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

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { createRandom } from "@sdxc/sample";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { Base } from "../bases.js";
import type { SpecError } from "../errors.js";
import type { ExecutionContext } from "../executor.js";
import type { Grants, PermissionSet } from "../permissions.js";
import type { Plugin, ToolContext } from "../plugin.js";
import type { LoadedSuite } from "../sources.js";
import type { ToolArg, Value, ValueObject } from "../values.js";
import type { Workspace } from "../workspace.js";

import { createArtifactStore } from "../artifacts.js";
import { createBaseSet } from "../bases.js";
import { ExpectationError, PermissionDeniedError } from "../errors.js";
import { executeTest } from "../executor.js";
import { parse } from "../parser.js";
import { createRegistry } from "../registry.js";
import { createToolContext } from "../tool-context.js";

import { browserBinaryPath, createBrowserPlugin } from "./browser.js";
import { createEnvPlugin } from "./env.js";
import { createHttpPlugin } from "./http.js";
import { createUrlPlugin } from "./url.js";

/** Whether the real `agent-browser` CLI is installed; gates the e2e suite. */
const AVAILABLE = browserBinaryPath() !== null;

/** What a page handler reads off an incoming request. */
interface PageRequest {
	/** The request path, without host or query. */
	path: string;
	/** The request method, uppercased. */
	method: string;
	/** The request body, empty when the request carried none. */
	body: string;
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
	/** Extra response headers; an array value sends the header repeatedly. */
	headers?: Record<string, string | string[]>;
	/** The content type to send; defaults to text/html. */
	contentType?: string;
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
		let chunks: Buffer[] = [];
		request.on("data", (chunk: Buffer) => void chunks.push(chunk));
		request.on("end", () => {
			let answer = render({
				path: url.pathname,
				method: request.method ?? "GET",
				body: Buffer.concat(chunks).toString("utf8"),
				cookie: request.headers.cookie ?? "",
				userAgent: request.headers["user-agent"] ?? "",
			});
			if (answer.location !== undefined) {
				response.writeHead(answer.status ?? 302, { location: answer.location });
				response.end();
				return;
			}
			response.writeHead(answer.status ?? 200, {
				"content-type": answer.contentType ?? "text/html",
				...answer.headers,
			});
			response.end(answer.html ?? "");
		});
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
		checkDb: () => success(undefined),
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
	bases: Base[] = [],
): ToolContext {
	return createToolContext({
		workspace: stubWorkspace(root),
		permissions,
		bases: createBaseSet(bases),
	});
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
			"reload",
			"set_cookie",
			"viewport",
			"scroll",
			"ua",
			"click",
			"fill",
			"type",
			"check",
			"uncheck",
			"select",
			"press",
			"click_selector",
			"fetch.get",
			"fetch.post",
			"fetch.put",
			"fetch.patch",
			"fetch.delete",
			"cookie",
			"response_header",
			"response_status",
			"element",
			"heading",
			"link",
			"button",
			"text",
			"checkbox",
			"cell",
			"definition",
			"url",
			"path",
			"query",
			"fragment",
			"title",
		]);
		for (let tool of tools) expect(tool.requires).toBe("net");
	});

	test("navigation, session setup and the interactions are actions", () => {
		let byName = new Map(plugin.describe().map((tool) => [tool.name, tool.kind]));
		for (let action of [
			"open",
			"navigate",
			"reload",
			"set_cookie",
			"viewport",
			"scroll",
			"ua",
			"click",
			"fill",
			"type",
			"check",
			"uncheck",
			"select",
			"press",
			"click_selector",
			"fetch.get",
			"fetch.post",
		]) {
			expect(byName.get(action)).toBe("action");
		}
		for (let observable of [
			"cookie",
			"response_header",
			"response_status",
			"element",
			"heading",
			"link",
			"button",
			"text",
			"checkbox",
			"cell",
			"definition",
			"url",
			"path",
			"query",
			"fragment",
			"title",
		]) {
			expect(byName.get(observable)).toBe("observable");
		}
	});

	/**
	 * A descriptor is an action or an observable and never both, which is why
	 * writing a cookie and reading one cannot share a name.
	 */
	test("cookie reads and set_cookie writes", () => {
		let byName = new Map(plugin.describe().map((tool) => [tool.name, tool]));
		expect(byName.get("cookie")?.kind).toBe("observable");
		expect(byName.get("set_cookie")?.kind).toBe("action");
		expect(byName.get("cookie")?.params.map((param) => param.name)).toEqual([
			"name",
			"expected",
			"containing",
			"exactly",
			"exists",
		]);
	});

	test("every fetch tool mirrors the http option grammar verbatim", () => {
		let tools = new Map(plugin.describe().map((tool) => [tool.name, tool]));
		let http = createHttpPlugin();
		let reference = http.describe().find((tool) => tool.name === "post");
		expect(tools.get("fetch.post")?.params).toEqual(reference?.params);
	});

	/**
	 * A role is an open set, so the executor reads it as a word only where the
	 * descriptor puts a *required* word — which is why every lookup opens with
	 * one. Every other word of the vocabulary is declared by its own spelling.
	 */
	test("every element tool opens with a required role word", () => {
		let tools = new Map(plugin.describe().map((tool) => [tool.name, tool]));
		for (let name of ["click", "fill", "type", "check", "uncheck", "select", "element"]) {
			expect([
				name,
				tools.get(name)?.params[0]?.kind,
				tools.get(name)?.params[0]?.required,
			]).toEqual([name, "word", true]);
		}
		expect(
			tools
				.get("scroll")
				?.params.slice(0, 2)
				.map((param) => [param.kind, param.required]),
		).toEqual([
			["word", true],
			["word", true],
		]);
	});

	/** An undeclared vocabulary word reaches a tool as an unknown name (ADR §2). */
	test("the element tools declare every word the vocabulary spells", () => {
		let tools = new Map(plugin.describe().map((tool) => [tool.name, tool]));
		let declared = (name: string) =>
			new Set(
				(tools.get(name)?.params ?? [])
					.filter((param) => param.kind === "word")
					.map((param) => param.name),
			);
		for (let word of [
			"field",
			"containing",
			"first",
			"nth",
			"last",
			"row",
			"column",
			"including",
			"header",
			"exists",
			"count",
			"value",
			"attribute",
			"enabled",
			"disabled",
			"in_viewport",
		]) {
			expect([word, declared("element").has(word)]).toEqual([word, true]);
			expect([word, declared("click").has(word)]).toEqual([word, true]);
		}
		expect(declared("fill").has("with")).toBe(true);
		expect(declared("heading").has("level")).toBe(true);
		expect(declared("checkbox").has("checked")).toBe(true);
		for (let word of ["containing", "exactly", "exists"]) {
			expect([word, declared("text").has(word)]).toEqual([word, true]);
			expect([word, declared("cookie").has(word)]).toEqual([word, true]);
		}
		for (let word of ["of", "document", "data"]) {
			expect([word, declared("response_status").has(word)]).toEqual([word, true]);
		}
	});

	test("the URL observables take an optional value and the assertion words", () => {
		let tools = new Map(plugin.describe().map((tool) => [tool.name, tool]));
		expect(tools.get("url")?.params.map((param) => param.required)).toEqual([
			false,
			false,
			false,
			false,
		]);
		expect(tools.get("path")?.params[0]?.required).toBe(false);
		expect(tools.get("query")?.params[0]?.required).toBe(true);
		expect(tools.get("fragment")?.params[0]?.required).toBe(true);
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

	test("a relative target with no base configured names the config", async () => {
		let error = unwrapError(await plugin.call("open", [value("/login")], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("No base is configured");
		expect(error.message).toContain("spec/config.jsonc");
	});

	test("a target that is neither absolute nor rooted suggests the slash", async () => {
		let error = unwrapError(await plugin.call("open", [value("login")], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('"/login"');
	});

	test("several bases and no `on` is a tool error listing the names", async () => {
		let bases: Base[] = [
			{ name: "web", url: "https://web.test" },
			{ name: "work", url: "https://work.test" },
		];
		let error = unwrapError(
			await plugin.call("open", [value("/dashboard")], buildContext(allowAll(), undefined, bases)),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('on "web"');
		expect(error.message).toContain('"web", "work"');
	});

	/** The grant a denial suggests is only copy-pasteable when it names the resolved host. */
	test("the net check keys on the resolved host, not the written target", async () => {
		let calls: { host: string; port: number | undefined }[] = [];
		let error = unwrapError(
			await plugin.call(
				"open",
				[value("/dashboard"), word("on"), value("work")],
				buildContext(denyNet(calls), undefined, [
					{ name: "web", url: "https://web.test" },
					{ name: "work", url: "http://work.test:4020" },
				]),
			),
		);
		expect(error).toBeInstanceOf(PermissionDeniedError);
		expect(error.remedy).toContain("work.test");
		expect(calls).toEqual([{ host: "work.test", port: 4020 }]);
	});

	test("open rejects a wrong base-selection word", async () => {
		let error = unwrapError(
			await plugin.call("open", [value("/x"), word("against"), value("web")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('does not understand the word "against"');
		expect(error.message).toContain("on");
	});

	test("a non-http scheme is a tool error", async () => {
		let error = unwrapError(
			await plugin.call("navigate", [value("ftp://files.example.com/x")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("http(s)");
	});

	test("reload takes no arguments", async () => {
		let error = unwrapError(await plugin.call("reload", [value("now")], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("no arguments");
	});

	test("viewport rejects an unknown name and a lone number", async () => {
		let unknown = unwrapError(await plugin.call("viewport", [word("huge")], buildContext()));
		expect(unknown.code).toBe("tool-error");
		expect(unknown.message).toContain("xs, sm, md, lg, xl, 2xl");
		let lonely = unwrapError(await plugin.call("viewport", [value(1280)], buildContext()));
		expect(lonely.code).toBe("tool-error");
		expect(lonely.message).toContain("height");
	});

	test("scroll rejects a wrong separator word and a non-numeric offset", async () => {
		let separator = unwrapError(
			await plugin.call("scroll", [word("until"), value(500)], buildContext()),
		);
		expect(separator.code).toBe("tool-error");
		expect(separator.message).toContain('does not understand the word "until"');
		let offset = unwrapError(
			await plugin.call("scroll", [word("to"), value("500")], buildContext()),
		);
		expect(offset.code).toBe("tool-error");
		expect(offset.message).toContain("whole number");
	});

	test("the response observables reject a wrong response kind", async () => {
		let kind = unwrapError(
			await plugin.call("response_status", [word("of"), word("image")], buildContext()),
		);
		expect(kind.code).toBe("tool-error");
		expect(kind.message).toContain('does not understand the word "image"');
		expect(kind.message).toContain("document, data");
	});

	/** The fetch verbs share `http`'s grammar, so they share its diagnostics. */
	test("fetch.get refuses a body and fetch.post names unknown option words", async () => {
		let body = unwrapError(
			await plugin.call(
				"fetch.get",
				[value("https://api.test/x"), value({ a: 1 })],
				buildContext(),
			),
		);
		expect(body.code).toBe("tool-error");
		expect(body.message).toContain("GET");
		let unknown = unwrapError(
			await plugin.call("fetch.post", [value("https://api.test/x"), word("query")], buildContext()),
		);
		expect(unknown.code).toBe("tool-error");
		expect(unknown.message).toContain("on, headers, form, json, text, bearer, basic");
	});

	test("a denied net grant fails fetch.post before agent-browser is spawned", async () => {
		let calls: { host: string; port: number | undefined }[] = [];
		let error = unwrapError(
			await plugin.call(
				"fetch.post",
				[value("/seed"), word("json"), value({ a: 1 })],
				buildContext(denyNet(calls), undefined, [{ name: "web", url: "https://api.test" }]),
			),
		);
		expect(error).toBeInstanceOf(PermissionDeniedError);
		expect(calls).toEqual([{ host: "api.test", port: 443 }]);
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
		expect(error.message).toContain('does not take the word "using"');
		expect(error.message).toContain("`with`");
	});

	test("checkbox rejects a word that is neither a predicate nor `checked`", async () => {
		let error = unwrapError(
			await plugin.call("checkbox", [value("Remember me"), word("unchecked")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('does not understand the word "unchecked"');
		expect(error.message).toContain("in_viewport");
	});

	test("set_cookie declares an optional `for <url>` clause", () => {
		let tools = new Map(plugin.describe().map((tool) => [tool.name, tool]));
		expect(
			tools.get("set_cookie")?.params.map((param) => [param.name, param.kind, param.required]),
		).toEqual([
			["name", "value", true],
			["value", "value", true],
			["for", "word", false],
			["url", "value", false],
		]);
	});

	test("a denied net grant fails set_cookie's `for` URL before any spawn", async () => {
		let calls: { host: string; port: number | undefined }[] = [];
		let result = await plugin.call(
			"set_cookie",
			[value("session"), value("abc123"), word("for"), value("https://app.example.com/")],
			buildContext(denyNet(calls)),
		);
		let error = unwrapError(result);
		expect(error).toBeInstanceOf(PermissionDeniedError);
		expect(calls).toEqual([{ host: "app.example.com", port: 443 }]);
	});

	test("set_cookie rejects a partial `for` clause", async () => {
		let error = unwrapError(
			await plugin.call(
				"set_cookie",
				[value("session"), value("abc"), word("for")],
				buildContext(),
			),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("`for");
	});

	test("set_cookie rejects a wrong clause word", async () => {
		let error = unwrapError(
			await plugin.call(
				"set_cookie",
				[value("session"), value("abc"), word("on"), value("https://app.example.com/")],
				buildContext(),
			),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('does not understand the word "on"');
		expect(error.message).toContain("for");
	});

	test("set_cookie's `for` URL resolves against a configured base", async () => {
		let calls: { host: string; port: number | undefined }[] = [];
		let error = unwrapError(
			await plugin.call(
				"set_cookie",
				[value("session"), value("abc"), word("for"), value("/app")],
				buildContext(denyNet(calls), undefined, [{ name: "web", url: "https://app.example.com" }]),
			),
		);
		expect(error).toBeInstanceOf(PermissionDeniedError);
		expect(calls).toEqual([{ host: "app.example.com", port: 443 }]);
	});

	test("cookie rejects more than a name and an expected value", async () => {
		let error = unwrapError(
			await plugin.call("cookie", [value("session"), value("a"), value("b")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("does not take an extra argument");
	});

	test("ua rejects a bare word where the User-Agent goes", async () => {
		let error = unwrapError(await plugin.call("ua", [word("spec")], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("string");
	});

	test("heading rejects a word that is neither a predicate nor `level`", async () => {
		let error = unwrapError(
			await plugin.call("heading", [value("Reports"), word("rank"), value(3)], buildContext()),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('does not understand the word "rank"');
		expect(error.message).toContain("in_viewport");
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
		expect(error.message).toContain("whole heading level");
	});

	test("title and url refuse a second expected value", async () => {
		for (let tool of ["title", "url", "path"]) {
			let error = unwrapError(await plugin.call(tool, [value("a"), value("b")], buildContext()));
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("does not take an extra argument");
		}
	});

	/** A tag name addresses markup; the vocabulary addresses what a person perceives. */
	test("a tag name where a role belongs names the role that tag exposes", async () => {
		let error = unwrapError(
			await plugin.call(
				"fill",
				[word("textarea"), value("Bio"), word("with"), value("x")],
				buildContext(),
			),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("addresses roles, not tag names");
		expect(error.message).toContain("`textbox`");
	});

	test("an ordinal and a count cannot be written together", async () => {
		let error = unwrapError(
			await plugin.call(
				"element",
				[word("link"), value("Profile"), word("first"), word("count"), value(2)],
				buildContext(),
			),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("drop the ordinal");
	});

	test("an unknown tool is a tool error listing the available tools", async () => {
		let error = unwrapError(await plugin.call("swipe", [], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('browser has no tool named "swipe"');
		expect(error.message).toContain("open, navigate");
	});

	test("an unknown fetch verb falls through to the unknown-tool error", async () => {
		let error = unwrapError(await plugin.call("fetch.head", [value("/x")], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('browser has no tool named "fetch.head"');
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

			expect(expectSuccess(await plugin.call("heading", [value("Sign in")], context))).toBe(
				"Sign in",
			);
			expect(expectSuccess(await plugin.call("button", [value("Sign in")], context))).toBe(
				"Sign in",
			);

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
		expect(absent.message).toContain('browser.heading found a heading named "Nowhere" nowhere');
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
	bases: Base[] = [],
): Promise<Result<undefined, SpecError>> {
	let parsed = parse({ path: "e2e.spec", text: source });
	if (isFailure(parsed)) throw new Error(`expected the spec to parse: ${parsed.error.message}`);
	let file = parsed.data;
	let test0 = file.tests[0];
	if (test0 === undefined) throw new Error("expected the spec to contain a test");
	let suite: LoadedSuite = { files: [file], commands: new Map() };
	let uses = file.uses.map((entry) => entry.namespace);
	let grants: Grants = {
		run: { mode: "denied" },
		net: { mode: "all" },
		env: { mode: "all" },
		hostFs: { mode: "denied" },
		db: { mode: "denied" },
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
		bases: createBaseSet(bases),
	};
	return executeTest(test0, context);
}

/**
 * A cookie or User-Agent set before the first navigation must reach the
 * server on the very next request — the only reason `browser.set_cookie` and
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
				"set_cookie",
				[value("session"), value("seeded-token"), word("for"), value(baseUrl)],
				context,
			),
		);
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));
		expect(
			expectSuccess(await plugin.call("text", [value("Session: seeded-token")], context)),
		).toBe(true);
	});

	/** The jar answers, so an `HttpOnly` cookie reads the same as any other. */
	test.skipIf(!AVAILABLE)("browser.cookie reads back what set_cookie wrote", async () => {
		expectSuccess(
			await plugin.call(
				"set_cookie",
				[value("session"), value("readable-token"), word("for"), value(baseUrl)],
				context,
			),
		);
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));
		expect(expectSuccess(await plugin.call("cookie", [value("session")], context))).toBe(
			"readable-token",
		);
		expect(
			expectSuccess(
				await plugin.call("cookie", [value("session"), value("readable-token")], context),
			),
		).toBe(true);
		expect(
			expectSuccess(await plugin.call("cookie", [value("absent"), word("exists")], context)),
		).toBe(false);
		let missing = unwrapError(await plugin.call("cookie", [value("absent")], context));
		expect(missing).toBeInstanceOf(ExpectationError);
		expect(missing.message).toContain("Present: session");
		let mismatch = unwrapError(
			await plugin.call("cookie", [value("session"), value("other")], context),
		);
		expect(mismatch).toBeInstanceOf(ExpectationError);
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
		expectSuccess(
			await plugin.call("set_cookie", [value("session"), value("later-token")], context),
		);
		expectSuccess(await plugin.call("navigate", [value(baseUrl)], context));
		expect(expectSuccess(await plugin.call("text", [value("Session: later-token")], context))).toBe(
			true,
		);
	});
});

/**
 * The session token lives in the environment; `env.get` names it, and
 * `browser.set_cookie` seeds it before the first navigation, so the protected
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
	 * The token reaches `browser.set_cookie` through a boxed reference: a bare
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
			`		browser.set_cookie "session" jar.session for "${baseUrl}/app"`,
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

/**
 * The page the session suite drives: it renders the viewport width and the
 * scroll offset into its own text, so `viewport` and `scroll` are checked
 * through the page rather than through the CLI that drove them.
 */
const SESSION_PAGE = `<!doctype html>
<html><head><title>Session</title></head><body>
	<h1>Dashboard</h1>
	<p id="metrics"></p>
	<div style="height:3000px">tall</div>
	<button type="button" id="menu">Menu</button>
	<script>
		function metrics() {
			document.getElementById("metrics").textContent =
				"w=" + window.innerWidth + " y=" + Math.round(window.scrollY);
		}
		metrics();
		window.addEventListener("resize", metrics);
		window.addEventListener("scroll", metrics);
		fetch("/data.json").then(function (response) { return response.json(); });
	</script>
</body></html>`;

/** Narrow a value to an object, failing the test otherwise. */
function asObject(data: Value): ValueObject {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		throw new Error(`expected an object value, got ${JSON.stringify(data)}`);
	}
	return data;
}

/**
 * The navigation and session surface of ADR-018 §8 against a real browser: a
 * base-relative `open`, `reload`, the response observables over the session's
 * own responses, `fetch.*` inside the session, `viewport`, and `scroll`.
 */
describe("browser navigation and session against a real browser", () => {
	let plugin: Plugin;
	let server: PageServer | undefined;
	let origin = "";
	let context: ToolContext;
	let seeded: string[] = [];
	let loads = 0;

	beforeAll(async () => {
		plugin = createBrowserPlugin();
		server = await servePage((request): PageResponse => {
			if (request.path === "/data.json") {
				return {
					status: 201,
					contentType: "application/json",
					headers: { "x-kind": "rows" },
					html: JSON.stringify({ ok: true }),
				};
			}
			if (request.path === "/seed") {
				seeded.push(`${request.method} ${request.body} cookie=${request.cookie}`);
				return { status: 202, contentType: "application/json", html: '{"seeded":true}' };
			}
			if (request.path !== "/dashboard") return { status: 404, html: "" };
			loads += 1;
			return { headers: { "x-page": ["dashboard", "secondary"] }, html: SESSION_PAGE };
		});
		origin = server.origin;
		context = createToolContext({
			workspace: stubWorkspace("/tmp/spec-browser-session-e2e"),
			permissions: allowAll(),
			bases: createBaseSet([{ name: "web", url: origin }]),
		});
	});

	afterAll(async () => {
		if (plugin.dispose !== undefined) await plugin.dispose();
		server?.stop();
	});

	test.skipIf(!AVAILABLE)("a relative target opens against the configured base", async () => {
		expectSuccess(await plugin.call("open", [value("/dashboard")], context));
		expect(expectSuccess(await plugin.call("url", [value(`${origin}/dashboard`)], context))).toBe(
			true,
		);
		expect(expectSuccess(await plugin.call("heading", [value("Dashboard")], context))).toBe(
			"Dashboard",
		);
	});

	test.skipIf(!AVAILABLE)("reload returns once the document has loaded again", async () => {
		expectSuccess(
			await plugin.call("open", [value("/dashboard"), word("on"), value("web")], context),
		);
		let served = loads;
		expectSuccess(await plugin.call("reload", [], context));
		expect(loads).toBe(served + 1);
		expect(expectSuccess(await plugin.call("heading", [value("Dashboard")], context))).toBe(
			"Dashboard",
		);
	});

	/**
	 * A framework navigation issues both a document and a data response, and
	 * the assertions are about each separately.
	 */
	test.skipIf(!AVAILABLE)("the response observables separate document from data", async () => {
		expectSuccess(await plugin.call("open", [value("/dashboard")], context));
		expect(expectSuccess(await plugin.call("response_status", [], context))).toBe(200);
		expect(
			expectSuccess(await plugin.call("response_status", [word("of"), word("data")], context)),
		).toBe(201);
		expect(expectSuccess(await plugin.call("response_status", [value(200)], context))).toBe(true);
		expect(expectSuccess(await plugin.call("response_header", [value("x-page")], context))).toEqual(
			["dashboard", "secondary"],
		);
		expect(
			expectSuccess(
				await plugin.call("response_header", [value("x-kind"), word("of"), word("data")], context),
			),
		).toEqual(["rows"]);
		expect(
			expectSuccess(
				await plugin.call("response_header", [value("x-absent"), word("exists")], context),
			),
		).toBe(false);
		expect(
			expectSuccess(
				await plugin.call(
					"response_header",
					[value("x-page"), word("containing"), value("second")],
					context,
				),
			),
		).toBe(true);
	});

	test.skipIf(!AVAILABLE)(
		"a fetch runs inside the session and never becomes the response read",
		async () => {
			seeded = [];
			expectSuccess(await plugin.call("open", [value("/dashboard")], context));
			expectSuccess(
				await plugin.call(
					"set_cookie",
					[value("session"), value("in-session"), word("for"), value(`${origin}/`)],
					context,
				),
			);
			let response = asObject(
				expectSuccess(
					await plugin.call(
						"fetch.post",
						[value("/seed"), word("json"), value({ name: "Ada" })],
						context,
					),
				),
			);
			expect(response.status).toBe(202);
			expect(asObject(response.json ?? null).seeded).toBe(true);
			expect(seeded[0]).toContain('POST {"name":"Ada"}');
			expect(seeded[0]).toContain("session=in-session");
			expect(
				expectSuccess(await plugin.call("response_status", [word("of"), word("data")], context)),
			).toBe(201);
		},
	);

	test.skipIf(!AVAILABLE)("viewport applies immediately, by size and by name", async () => {
		expectSuccess(await plugin.call("open", [value("/dashboard")], context));
		expectSuccess(await plugin.call("viewport", [value(1280), value(800)], context));
		expect(expectSuccess(await plugin.call("text", [value("w=1280")], context))).toBe(true);
		expectSuccess(await plugin.call("viewport", [word("xs")], context));
		expect(expectSuccess(await plugin.call("text", [value("w=390")], context))).toBe(true);
		expectSuccess(await plugin.call("viewport", [value("2xl")], context));
		expect(expectSuccess(await plugin.call("text", [value("w=1536")], context))).toBe(true);
	});

	test.skipIf(!AVAILABLE)("scroll takes an absolute offset and an element", async () => {
		expectSuccess(await plugin.call("open", [value("/dashboard")], context));
		expectSuccess(await plugin.call("viewport", [value(1024), value(768)], context));
		expectSuccess(await plugin.call("scroll", [word("to"), value(900)], context));
		expect(expectSuccess(await plugin.call("text", [value("y=900")], context))).toBe(true);
		expectSuccess(await plugin.call("scroll", [word("to"), value(0)], context));
		expect(expectSuccess(await plugin.call("text", [value("y=0")], context))).toBe(true);
		expectSuccess(
			await plugin.call("scroll", [word("to"), word("button"), value("Menu")], context),
		);
		let offset = unwrapError(await plugin.call("text", [value("y=0")], context));
		expect(offset).toBeInstanceOf(ExpectationError);
	});
});

/**
 * A role is an open set, so the executor only reads a bare word as a symbol
 * where the descriptor puts a required word — which both `scroll` shapes and
 * `on "…"` depend on. These run through the real resolution path, not the
 * plugin's `call` seam, so a descriptor that misdeclares a word is caught here.
 */
describe("browser words resolve through the executor", () => {
	let plugin: Plugin;
	let server: PageServer | undefined;
	let origin = "";

	beforeAll(async () => {
		plugin = createBrowserPlugin();
		server = await servePage((): PageResponse => ({ html: SESSION_PAGE }));
		origin = server.origin;
	});

	afterAll(async () => {
		if (plugin.dispose !== undefined) await plugin.dispose();
		server?.stop();
	});

	test.skipIf(!AVAILABLE)("`on`, an offset and a role each read as a symbol", async () => {
		let source = [
			"use browser",
			"",
			'test "the browser words resolve" {',
			"	given {",
			`		browser.open "/dashboard" on "web"`,
			"	}",
			"	when {",
			"		browser.viewport 1024 768",
			"		browser.scroll to 900",
			'		browser.scroll to button "Menu"',
			"	}",
			"	then {",
			`		expect browser.url "${origin}/dashboard"`,
			'		expect browser.heading "Dashboard"',
			"	}",
			"}",
			"",
		].join("\n");
		let outcome = await runSpec(source, [plugin], "/tmp/spec-browser-words-session", [
			{ name: "web", url: origin },
		]);
		if (isFailure(outcome)) throw new Error(`expected the spec to pass: ${outcome.error.message}`);
	});
});

/**
 * The page the vocabulary suite addresses: two links sharing a name so an
 * ambiguity is real, a radio group sharing one `name` attribute, a table, a
 * definition list, a range input, and content far enough down that
 * `in_viewport` has something to say.
 */
const VOCABULARY_PAGE = `<!doctype html>
<html><head><title>Vocabulary</title></head><body>
	<h1>Members</h1>
	<nav><a href="/profile">Profile</a></nav>
	<form>
		<label for="email">Email</label>
		<input id="email" name="email" type="text" value="pre" />
		<label for="bio">Bio</label><textarea id="bio" name="bio"></textarea>
		<label><input type="radio" name="tip" value="annual" /> Annual</label>
		<label><input type="radio" name="tip" value="monthly" checked /> Monthly</label>
		<label for="amount">Amount</label>
		<input id="amount" name="amount" type="range" min="0" max="100" step="1" value="50" />
		<button type="button" id="go" data-kind="primary">Save</button>
		<button type="button" disabled>Archive</button>
		<label><input id="remember" type="checkbox" checked /> Remember me</label>
		<div role="switch" aria-checked="false" tabindex="0">Dark mode</div>
		<ul role="menu"><li role="menuitem">Settings</li></ul>
		<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Logo" />
	</form>
	<table>
		<thead><tr><th>Name</th><th>Total</th></tr></thead>
		<tbody><tr><td>Ada</td><td>42</td></tr><tr><td>Bob</td><td>7</td></tr></tbody>
	</table>
	<dl><dt>Total</dt><dd>49</dd></dl>
	<div style="height:3000px"></div>
	<p>Slider is <span id="shown">50</span>, input ran <span id="inputs">0</span>, change ran <span id="changes">0</span></p>
	<footer><a href="/profile">Profile</a></footer>
	<script>
		var slider = document.getElementById("amount");
		slider.addEventListener("input", function () {
			document.getElementById("shown").textContent = slider.value;
			document.getElementById("inputs").textContent =
				Number(document.getElementById("inputs").textContent) + 1;
		});
		slider.addEventListener("change", function () {
			document.getElementById("changes").textContent =
				Number(document.getElementById("changes").textContent) + 1;
		});
	</script>
</body></html>`;

/**
 * ADR-018 §9 against a real browser. The vocabulary is the kind of thing a
 * stub happily lies about, so every rule here is held against a live page:
 * exact names, ambiguity as an error, field addressing, the predicates, and
 * the roles and structural reads the accessibility snapshot alone cannot see.
 */
describe("the addressing vocabulary against a real browser", () => {
	let plugin: Plugin;
	let server: PageServer | undefined;
	let baseUrl = "";
	let context: ToolContext;

	beforeAll(async () => {
		plugin = createBrowserPlugin();
		server = await servePage(() => ({ html: VOCABULARY_PAGE }));
		baseUrl = `${server.origin}/`;
		context = buildContext(allowAll(), "/tmp/spec-browser-vocabulary-session");
	});

	afterAll(async () => {
		if (plugin.dispose !== undefined) await plugin.dispose();
		server?.stop();
	});

	/**
	 * First-match-wins is the failure this replaces: a nav link and a footer
	 * link share a name, and asserting on the wrong one gives no signal.
	 */
	test.skipIf(!AVAILABLE)("two matches are an error until an ordinal chooses one", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		let ambiguous = unwrapError(await plugin.call("link", [value("Profile")], context));
		expect(ambiguous.code).toBe("tool-error");
		expect(ambiguous.message).toContain("matched 2 elements");
		expect(ambiguous.message).toContain("#1");
		expect(ambiguous.message).toContain("#2");
		expect(ambiguous.remedy).toContain("`first`");

		expect(
			expectSuccess(await plugin.call("link", [value("Profile"), word("first")], context)),
		).toBe("Profile");
		expect(
			expectSuccess(await plugin.call("link", [value("Profile"), word("last")], context)),
		).toBe("Profile");
		expect(
			expectSuccess(await plugin.call("link", [value("Profile"), word("nth"), value(2)], context)),
		).toBe("Profile");
		expect(
			expectSuccess(
				await plugin.call("link", [value("Profile"), word("count"), value(2)], context),
			),
		).toBe(true);

		/** Two of a thing is still a presence, so an absence assertion sees it. */
		expect(
			expectSuccess(await plugin.call("link", [value("Profile"), word("exists")], context)),
		).toBe(true);
	});

	test.skipIf(!AVAILABLE)("a role name matches whole, `containing` matches a part", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		let partial = unwrapError(await plugin.call("button", [value("Sav")], context));
		expect(partial).toBeInstanceOf(ExpectationError);
		expect(
			expectSuccess(await plugin.call("button", [word("containing"), value("Sav")], context)),
		).toBe("Save");
	});

	/** Same role wrong name, then same name wrong role: the whole diagnosis. */
	test.skipIf(!AVAILABLE)("a miss names what the page held instead", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		let wrongName = unwrapError(await plugin.call("button", [value("Delete")], context));
		expect(wrongName.message).toContain("Present under the same lookup");
		expect(wrongName.message).toContain('"Save"');
		expect(wrongName.hint).toContain(baseUrl);

		let wrongRole = unwrapError(
			await plugin.call("element", [word("button"), value("Members")], context),
		);
		expect(wrongRole.message).toContain("That name is carried by");
		expect(wrongRole.message).toContain("heading");
	});

	test.skipIf(!AVAILABLE)("a field is addressed by its name attribute", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		expect(
			expectSuccess(
				await plugin.call(
					"element",
					[word("field"), value("email"), word("value"), value("pre")],
					context,
				),
			),
		).toBe(true);

		let group = unwrapError(await plugin.call("element", [word("field"), value("tip")], context));
		expect(group.message).toContain("matched 2 elements");

		expectSuccess(
			await plugin.call(
				"click",
				[word("field"), value("tip"), word("value"), value("annual")],
				context,
			),
		);
		expect(
			expectSuccess(
				await plugin.call(
					"element",
					[word("radio"), value("Annual"), word("attribute"), value("checked"), value("")],
					context,
				),
			),
		).toBe(true);
	});

	test.skipIf(!AVAILABLE)("the predicates answer over the live page", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		expect(
			expectSuccess(await plugin.call("button", [value("Save"), word("enabled")], context)),
		).toBe(true);
		expect(
			expectSuccess(await plugin.call("button", [value("Archive"), word("disabled")], context)),
		).toBe(true);
		let wrongState = unwrapError(
			await plugin.call("button", [value("Archive"), word("enabled")], context),
		);
		expect(wrongState).toBeInstanceOf(ExpectationError);
		expect(
			expectSuccess(
				await plugin.call(
					"button",
					[value("Save"), word("attribute"), value("data-kind"), value("primary")],
					context,
				),
			),
		).toBe(true);
	});

	/** The one predicate a parsed document refuses and a live page must answer. */
	test.skipIf(!AVAILABLE)("in_viewport follows the scroll position", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));
		expectSuccess(await plugin.call("viewport", [value(1024), value(768)], context));
		expectSuccess(await plugin.call("scroll", [word("to"), value(0)], context));

		expect(
			expectSuccess(
				await plugin.call(
					"element",
					[word("heading"), value("Members"), word("in_viewport")],
					context,
				),
			),
		).toBe(true);
		let below = unwrapError(
			await plugin.call("element", [word("contentinfo"), word("in_viewport")], context),
		);
		expect(below).toBeInstanceOf(ExpectationError);
		expect(below.message).toContain("not scrolled into view");

		expectSuccess(await plugin.call("scroll", [word("to"), word("contentinfo")], context));
		expect(
			expectSuccess(
				await plugin.call("element", [word("contentinfo"), word("in_viewport")], context),
			),
		).toBe(true);
	});

	/**
	 * A `<textarea>` is a textbox, an `<img>` is an image, and a menu item and
	 * a switch are roles a spec addresses by name like any other.
	 */
	test.skipIf(!AVAILABLE)("the roles the vocabulary added are addressable", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		expect(
			expectSuccess(await plugin.call("element", [word("menuitem"), value("Settings")], context)),
		).toBe("Settings");
		expect(
			expectSuccess(
				await plugin.call("element", [word("switch"), value("Dark mode"), word("exists")], context),
			),
		).toBe(true);
		expect(
			expectSuccess(
				await plugin.call("element", [word("image"), value("Logo"), word("exists")], context),
			),
		).toBe(true);
		expectSuccess(
			await plugin.call(
				"fill",
				[word("textbox"), value("Bio"), word("with"), value("hello")],
				context,
			),
		);
		expect(
			expectSuccess(
				await plugin.call(
					"element",
					[word("textbox"), value("Bio"), word("value"), value("hello")],
					context,
				),
			),
		).toBe(true);
	});

	test.skipIf(!AVAILABLE)("cell and definition read the structures they name", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		expect(
			expectSuccess(
				await plugin.call("cell", [word("row"), value(1), word("column"), value(2)], context),
			),
		).toBe("42");
		expect(
			expectSuccess(
				await plugin.call("cell", [word("row"), value(2), word("column"), value(1)], context),
			),
		).toBe("Bob");
		expect(
			expectSuccess(
				await plugin.call(
					"cell",
					[word("row"), value(1), word("column"), value(2), word("including"), word("header")],
					context,
				),
			),
		).toBe("Total");
		expect(expectSuccess(await plugin.call("definition", [value("Total")], context))).toBe("49");
	});

	test.skipIf(!AVAILABLE)("fill replaces a value and type appends keystrokes", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		expectSuccess(
			await plugin.call(
				"fill",
				[word("textbox"), value("Email"), word("with"), value("ada@")],
				context,
			),
		);
		expectSuccess(
			await plugin.call(
				"type",
				[word("textbox"), value("Email"), word("with"), value("example.com")],
				context,
			),
		);
		expect(
			expectSuccess(
				await plugin.call(
					"element",
					[word("textbox"), value("Email"), word("value"), value("ada@example.com")],
					context,
				),
			),
		).toBe(true);
	});

	test.skipIf(!AVAILABLE)("check and uncheck move a box in both directions", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		expect(
			expectSuccess(
				await plugin.call("checkbox", [value("Remember me"), word("checked")], context),
			),
		).toBe(true);
		expectSuccess(await plugin.call("uncheck", [word("checkbox"), value("Remember me")], context));
		let cleared = unwrapError(
			await plugin.call("checkbox", [value("Remember me"), word("checked")], context),
		);
		expect(cleared).toBeInstanceOf(ExpectationError);
		expectSuccess(await plugin.call("check", [word("checkbox"), value("Remember me")], context));
		expect(
			expectSuccess(
				await plugin.call("checkbox", [value("Remember me"), word("checked")], context),
			),
		).toBe(true);
	});

	/**
	 * ADR-018 §9 names this the browser milestone's definition of done: the
	 * platform's `input` and `change` events must both fire, or every
	 * assertion downstream of a slider reads a value the page never saw. The
	 * CLI's own `fill` reports success and moves nothing, so the value goes in
	 * through the prototype setter and both events are dispatched.
	 */
	test.skipIf(!AVAILABLE)("fill moves a range input and fires input and change", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		expectSuccess(
			await plugin.call(
				"fill",
				[word("field"), value("amount"), word("with"), value("75")],
				context,
			),
		);
		expect(
			expectSuccess(
				await plugin.call("element", [word("slider"), word("value"), value("75")], context),
			),
		).toBe(true);
		expect(expectSuccess(await plugin.call("text", [value("Slider is 75")], context))).toBe(true);
		expect(expectSuccess(await plugin.call("text", [value("input ran 1")], context))).toBe(true);
		expect(expectSuccess(await plugin.call("text", [value("change ran 1")], context))).toBe(true);

		expectSuccess(
			await plugin.call(
				"fill",
				[word("field"), value("amount"), word("with"), value("20")],
				context,
			),
		);
		expect(expectSuccess(await plugin.call("text", [value("Slider is 20")], context))).toBe(true);
		expect(expectSuccess(await plugin.call("text", [value("change ran 2")], context))).toBe(true);
	});
});

/**
 * ADR-018 §11's URL observables, so `eventually` waits on a navigation
 * without a `let`, and its failure diagnostics, which are part of the browser
 * milestone rather than a follow-up.
 */
describe("URL observables and failure diagnostics against a real browser", () => {
	let plugin: Plugin;
	let server: PageServer | undefined;
	let origin = "";
	let context: ToolContext;

	beforeAll(async () => {
		plugin = createBrowserPlugin();
		server = await servePage(() => ({ html: PAGE_HTML }));
		origin = server.origin;
		context = buildContext(allowAll(), "/tmp/spec-browser-url-observables");
	});

	afterAll(async () => {
		if (plugin.dispose !== undefined) await plugin.dispose();
		server?.stop();
	});

	test.skipIf(!AVAILABLE)("path, query and fragment read the current location", async () => {
		let landing = `${origin}/donate/share?step=share&next=%2Fdonate#access_token=abc&state=xyz`;
		expectSuccess(await plugin.call("open", [value(landing)], context));

		expect(expectSuccess(await plugin.call("path", [], context))).toBe("/donate/share");
		expect(expectSuccess(await plugin.call("path", [value("/donate/share")], context))).toBe(true);
		expect(expectSuccess(await plugin.call("query", [value("step")], context))).toBe("share");
		expect(
			expectSuccess(await plugin.call("query", [value("step"), value("share")], context)),
		).toBe(true);
		expect(expectSuccess(await plugin.call("fragment", [value("access_token")], context))).toBe(
			"abc",
		);

		/** An absent parameter is an error, with `exists` for a deliberate absence. */
		let absent = unwrapError(await plugin.call("query", [value("code")], context));
		expect(absent).toBeInstanceOf(ExpectationError);
		expect(absent.message).toContain("Present: step, next");
		expect(
			expectSuccess(await plugin.call("query", [value("code"), word("exists")], context)),
		).toBe(false);
	});

	/**
	 * A run with `--artifacts=<dir>` leaves the picture and the tree behind, on
	 * the error's own `artifacts` array, which the reporter prints.
	 */
	test.skipIf(!AVAILABLE)("a failed lookup writes a screenshot and a tree dump", async () => {
		let directory = await mkdtemp(join(tmpdir(), "spec-browser-artifacts-"));
		let recording = createToolContext({
			workspace: stubWorkspace("/tmp/spec-browser-url-observables"),
			permissions: allowAll(),
			bases: createBaseSet([]),
			artifacts: createArtifactStore(directory),
		});
		expectSuccess(await plugin.call("open", [value(`${origin}/`)], recording));

		let error = unwrapError(await plugin.call("button", [value("Nowhere")], recording));
		expect(error.hint).toContain(origin);
		expect(error.artifacts?.length).toBe(2);
		let written = (error.artifacts ?? []).join(" ");
		expect(written).toContain(".png");
		expect(written).toContain(".txt");
		let tree = await readFile(
			(error.artifacts ?? []).filter((path) => path.endsWith(".txt"))[0] ?? "",
			"utf8",
		);
		expect(tree).toContain('button "Sign in"');
		await rm(directory, { recursive: true, force: true });
	});

	/** Without an artifacts directory a failure keeps its text and writes nothing. */
	test.skipIf(!AVAILABLE)("a run without --artifacts writes none", async () => {
		expectSuccess(await plugin.call("open", [value(`${origin}/`)], context));
		let error = unwrapError(await plugin.call("button", [value("Nowhere")], context));
		expect(error.artifacts).toBeUndefined();
		expect(error.hint).toContain(origin);
	});
});

/**
 * ADR-018 §8 spells the request verbs `browser.fetch.post`, and after
 * `use browser` the bare form is `fetch.post`. Both go through the real
 * resolution path, which is the only thing that proves the spelling resolves.
 */
describe("the fetch verbs resolve under the ADR's spelling", () => {
	let plugin: Plugin;
	let server: PageServer | undefined;
	let origin = "";
	let seeded: string[] = [];

	beforeAll(async () => {
		plugin = createBrowserPlugin();
		server = await servePage((request): PageResponse => {
			if (request.path === "/seed") {
				seeded.push(`${request.method} ${request.body}`);
				return { status: 202, contentType: "application/json", html: '{"seeded":true}' };
			}
			return { html: PAGE_HTML };
		});
		origin = server.origin;
	});

	afterAll(async () => {
		if (plugin.dispose !== undefined) await plugin.dispose();
		server?.stop();
	});

	test.skipIf(!AVAILABLE)("the qualified and the bare spellings both dispatch", async () => {
		seeded = [];
		let source = [
			"use browser",
			"",
			'test "the fetch verbs are spelled with a dot" {',
			"	given {",
			`		browser.open "/" on "web"`,
			"	}",
			"	when {",
			'		browser.fetch.post "/seed" json { name: "Ada" }',
			'		fetch.post "/seed" json { name: "Bob" }',
			"	}",
			"	then {",
			'		expect browser.heading "Sign in"',
			"	}",
			"}",
			"",
		].join("\n");
		let outcome = await runSpec(source, [plugin], "/tmp/spec-browser-fetch-spelling", [
			{ name: "web", url: origin },
		]);
		if (isFailure(outcome)) throw new Error(`expected the spec to pass: ${outcome.error.message}`);
		expect(seeded).toEqual(['POST {"name":"Ada"}', 'POST {"name":"Bob"}']);
	});

	/**
	 * `expect not <observable>` over the vocabulary's `exists`: the assertion a
	 * sign-out test is made of, written without a `let`.
	 */
	test.skipIf(!AVAILABLE)("expect not reads an absence through the vocabulary", async () => {
		let source = [
			"use browser",
			"",
			'test "an absence is expressible" {',
			"	given {",
			`		browser.open "/" on "web"`,
			"	}",
			"	then {",
			'		expect not browser.cookie "session" exists',
			'		expect not browser.button "Sign out" exists',
			'		expect browser.button "Sign in" exists',
			"	}",
			"}",
			"",
		].join("\n");
		let outcome = await runSpec(source, [plugin], "/tmp/spec-browser-absence", [
			{ name: "web", url: origin },
		]);
		if (isFailure(outcome)) throw new Error(`expected the spec to pass: ${outcome.error.message}`);
	});
});

/**
 * The page the dropdown and modal suite addresses: a `<select>` whose options
 * read as a person reads them, two controls sharing one `name` attribute so a
 * write has a group to narrow, an open `<dialog>` that a button closes, a
 * `<dialog>` that was never opened, and a `div` carrying the role instead.
 */
const FORM_PAGE = `<!doctype html>
<html><head><title>Checkout</title></head><body>
	<h1>Checkout</h1>
	<label for="country">Country</label>
	<select id="country" name="country">
		<option value="">Pick one</option>
		<option value="uy">Uruguay</option>
		<option value="ar">Argentina</option>
	</select>
	<p id="chosen">chose nothing</p>
	<label>Annual <input name="cadence" value="annual" /></label>
	<label>Monthly <input name="cadence" value="monthly" /></label>
	<dialog open aria-label="Confirm">
		<p>Delete this?</p>
		<button type="button" id="dismiss">Never mind</button>
	</dialog>
	<dialog aria-label="Receipt"><p>Thanks</p></dialog>
	<div role="dialog" aria-modal="true" aria-label="Welcome"><p>Hi there</p></div>
	<script>
		document.getElementById("country").addEventListener("change", function (event) {
			document.getElementById("chosen").textContent = "chose " + event.target.value;
		});
		document.getElementById("dismiss").addEventListener("click", function () {
			document.querySelector('dialog[aria-label="Confirm"]').close();
		});
	</script>
</body></html>`;

/**
 * ADR-018 §9's last Open Question, held against a real browser: choosing in a
 * dropdown, and addressing a modal by the `dialog` role. Both are the kind of
 * claim a stub grants for free, so every case here drives the live page.
 */
describe("dropdowns and modals against a real browser", () => {
	let plugin: Plugin;
	let server: PageServer | undefined;
	let baseUrl = "";
	let context: ToolContext;

	beforeAll(async () => {
		plugin = createBrowserPlugin();
		server = await servePage(() => ({ html: FORM_PAGE }));
		baseUrl = `${server.origin}/`;
		context = buildContext(allowAll(), "/tmp/spec-browser-forms-session");
	});

	afterAll(async () => {
		if (plugin.dispose !== undefined) await plugin.dispose();
		server?.stop();
	});

	test.skipIf(!AVAILABLE)("select chooses the option a person reads in the list", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		expectSuccess(
			await plugin.call(
				"select",
				[word("combobox"), value("Country"), word("with"), value("Uruguay")],
				context,
			),
		);
		expect(expectSuccess(await plugin.call("text", [value("chose uy")], context))).toBe(true);
		expect(
			expectSuccess(
				await plugin.call(
					"element",
					[word("field"), value("country"), word("value"), value("uy")],
					context,
				),
			),
		).toBe(true);

		/** The same control reached by its `name` attribute, as any write is. */
		expectSuccess(
			await plugin.call(
				"select",
				[word("field"), value("country"), word("with"), value("Argentina")],
				context,
			),
		);
		expect(expectSuccess(await plugin.call("text", [value("chose ar")], context))).toBe(true);
	});

	test.skipIf(!AVAILABLE)("an option that is not in the list names the ones that are", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		let missing = unwrapError(
			await plugin.call(
				"select",
				[word("combobox"), value("Country"), word("with"), value("Narnia")],
				context,
			),
		);
		expect(missing).toBeInstanceOf(ExpectationError);
		expect(missing.message).toContain("Narnia");
		expect(missing.message).toContain("Uruguay");
		expect(missing.message).toContain("Argentina");
	});

	/**
	 * A dropdown's options are addressable whether or not the list is popped
	 * open, which is what a person reading the form perceives.
	 */
	test.skipIf(!AVAILABLE)("the options of a closed dropdown are still addressable", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		expect(
			expectSuccess(await plugin.call("element", [word("option"), value("Uruguay")], context)),
		).toBe("Uruguay");
		expect(
			expectSuccess(
				await plugin.call("element", [word("option"), word("count"), value(3)], context),
			),
		).toBe(true);
	});

	/** §9 makes `value` addressing, so the form that writes into a control keeps it. */
	test.skipIf(!AVAILABLE)(
		"value narrows a field group for a write, not only for an assertion",
		async () => {
			expectSuccess(await plugin.call("open", [value(baseUrl)], context));

			expectSuccess(
				await plugin.call(
					"fill",
					[
						word("field"),
						value("cadence"),
						word("value"),
						value("annual"),
						word("with"),
						value(12),
					],
					context,
				),
			);
			expect(
				expectSuccess(
					await plugin.call(
						"element",
						[word("field"), value("cadence"), word("value"), value("12")],
						context,
					),
				),
			).toBe(true);
			expect(
				expectSuccess(
					await plugin.call(
						"element",
						[word("field"), value("cadence"), word("value"), value("monthly")],
						context,
					),
				),
			).toBe(true);
		},
	);

	/**
	 * `dialog` needs no feature: roles are an open set, and both a native
	 * `<dialog>` and the `aria-modal` div a component library renders carry it.
	 */
	test.skipIf(!AVAILABLE)("the dialog role addresses a modal, however it is built", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		expect(
			expectSuccess(
				await plugin.call("element", [word("dialog"), value("Confirm"), word("exists")], context),
			),
		).toBe(true);
		expect(
			expectSuccess(
				await plugin.call("element", [word("dialog"), value("Welcome"), word("exists")], context),
			),
		).toBe(true);
		expect(
			expectSuccess(await plugin.call("element", [word("dialog"), value("Welcome")], context)),
		).toBe("Hi there");

		/** A dialog the page never opened renders nothing, so it is nowhere. */
		expect(
			expectSuccess(
				await plugin.call("element", [word("dialog"), value("Receipt"), word("exists")], context),
			),
		).toBe(false);
	});

	test.skipIf(!AVAILABLE)("a dismissed modal is gone from the page", async () => {
		expectSuccess(await plugin.call("open", [value(baseUrl)], context));

		expectSuccess(await plugin.call("click", [word("button"), value("Never mind")], context));
		expect(
			expectSuccess(
				await plugin.call("element", [word("dialog"), value("Confirm"), word("exists")], context),
			),
		).toBe(false);
	});

	/** Narrowing is the one clause an action shares with an assertion. */
	test("a predicate in a write is refused before a browser is asked for", async () => {
		let refused = unwrapError(
			await plugin.call(
				"fill",
				[word("textbox"), value("Email"), word("enabled"), word("with"), value("a@b.c")],
				buildContext(),
			),
		);
		expect(refused.code).toBe("tool-error");
		expect(refused.message).toContain("browser.fill");
		expect(refused.message).toContain("takes no `enabled` predicate");
	});
});
