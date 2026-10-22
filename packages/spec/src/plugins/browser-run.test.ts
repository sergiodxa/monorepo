/**
 * Tests the Browser Run–backed browser plugin against a fake CDP session: tool
 * routing, navigation grants, element addressing over injected markup, and
 * CDP diagnostics (traces, metrics, one-shot commands).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isFailure, isSuccess, success } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vite-plus/test";

import type { Grants } from "../permissions.js";
import type { ToolContext } from "../plugin.js";
import type { ToolArg } from "../values.js";
import type { Workspace } from "../workspace.js";

import { createPermissionSet, parseGrants } from "../permissions.js";
import { createToolContext } from "../tool-context.js";

import type { BrowserRunBinding, BrowserRunSocket, BrowserRunUpgrade } from "./browser-run-cdp.js";

import { createBrowserRunPlugin } from "./browser-run.js";

/** A tiny WebSocket that answers CDP commands from a script. */
class FakeSocket implements BrowserRunSocket {
	/** Outbound CDP payloads, for assertions. */
	sent: string[] = [];
	/** Page URL the fake session reports. */
	href = "about:blank";
	/** Markup Runtime.evaluate returns for READ_DOCUMENT. */
	markup = "<html><body><h1>Dashboard</h1><button>Sign in</button></body></html>";
	#messageListeners = new Set<(event: { data: string }) => void>();
	#closeListeners = new Set<() => void>();

	accept(): void {
		/** Required by the Browser Run connection protocol. */
	}

	send(data: string): void {
		this.sent.push(data);
		let message = JSON.parse(data) as {
			id: number;
			method: string;
			params?: Record<string, unknown>;
		};
		queueMicrotask(() => {
			this.#reply(message);
		});
	}

	close(): void {
		for (let listener of this.#closeListeners) listener();
	}

	addEventListener(type: "message", listener: (event: { data: string }) => void): void;
	addEventListener(type: "close", listener: () => void): void;
	addEventListener(
		type: "message" | "close",
		listener: ((event: { data: string }) => void) | (() => void),
	): void {
		if (type === "message") {
			this.#messageListeners.add(listener as (event: { data: string }) => void);
			return;
		}
		this.#closeListeners.add(listener as () => void);
	}

	removeEventListener(type: "message", listener: (event: { data: string }) => void): void;
	removeEventListener(type: "close", listener: () => void): void;
	removeEventListener(
		type: "message" | "close",
		listener: ((event: { data: string }) => void) | (() => void),
	): void {
		if (type === "message") {
			this.#messageListeners.delete(listener as (event: { data: string }) => void);
			return;
		}
		this.#closeListeners.delete(listener as () => void);
	}

	/** Answer one CDP command with a success result the plugin understands. */
	#reply(message: { id: number; method: string; params?: Record<string, unknown> }): void {
		let result: unknown = {};
		if (message.method === "Page.navigate") {
			let url = message.params?.url;
			this.href = typeof url === "string" ? url : this.href;
		}
		if (message.method === "Runtime.evaluate") {
			let raw = message.params?.expression;
			let expression = typeof raw === "string" ? raw : "";
			if (expression.includes("setAttribute") && expression.includes("outerHTML")) {
				result = { result: { value: this.markup } };
			} else if (expression.includes("location.href")) {
				result = { result: { value: this.href } };
			} else if (expression.includes("document.title")) {
				result = { result: { value: "App" } };
			} else if (expression.includes("innerText")) {
				result = { result: { value: "Dashboard Sign in" } };
			} else {
				result = { result: { value: true } };
			}
		}
		if (message.method === "Performance.getMetrics") {
			result = {
				metrics: [
					{ name: "Timestamp", value: 1 },
					{ name: "JSHeapUsedSize", value: 1024 },
				],
			};
		}
		let data = JSON.stringify({ id: message.id, result });
		for (let listener of this.#messageListeners) listener({ data });
		if (message.method === "Tracing.start") {
			this.#emit("Tracing.dataCollected", {
				value: [{ name: "test-event", ph: "I", ts: 1 }],
			});
		}
		if (message.method === "Tracing.end") {
			this.#emit("Tracing.tracingComplete", {});
		}
	}

	/** Push one CDP event to every message listener. */
	#emit(method: string, params: Record<string, unknown>): void {
		let data = JSON.stringify({ method, params });
		for (let listener of this.#messageListeners) listener({ data });
	}
}

/** Build a Browser Run binding that hands out {@link FakeSocket} sessions. */
function fakeBrowser(socket: FakeSocket): BrowserRunBinding {
	let sessionId = "session-1";
	let webSocket = {
		async fetch(_input: string, _init?: RequestInit): Promise<BrowserRunUpgrade> {
			return { webSocket: socket };
		},
	};
	return {
		async launch() {
			return {
				sessionId,
				webSocket,
				targets: [{ id: "page-1", type: "page" }],
			};
		},
		async connectSession(id, options) {
			expect(id).toBe(sessionId);
			expect(options?.targetId).toBe("page-1");
			return { sessionId, webSocket };
		},
		async closeSession(id) {
			expect(id).toBe(sessionId);
			socket.close();
		},
	};
}

/** Tool context with net granted for the named hosts, and an optional workspace. */
function contextFor(...hostsAndRoot: string[]): ToolContext {
	let root = hostsAndRoot.find((entry) => entry.startsWith("/"));
	let hosts = hostsAndRoot.filter((entry) => entry !== root);
	let workspace: Workspace | undefined =
		root === undefined
			? undefined
			: {
					root,
					resolve(path) {
						return success(join(root, path));
					},
					async cleanup() {
						return undefined;
					},
				};
	return createToolContext({
		permissions: createPermissionSet(allowNet(...hosts)),
		workspace,
	});
}

function allowNet(...hosts: string[]): Grants {
	let parsed = parseGrants([`--allow-net=${hosts.join(",")}`]);
	if (isFailure(parsed)) throw new Error(parsed.error.message);
	return parsed.data.grants;
}

function value(text: string): ToolArg {
	return { kind: "value", value: text };
}

function word(name: string): ToolArg {
	return { kind: "word", word: name };
}

describe(createBrowserRunPlugin.name, () => {
	let plugin = createBrowserRunPlugin({ browser: fakeBrowser(new FakeSocket()) });

	afterEach(async () => {
		await plugin.dispose?.();
		plugin = createBrowserRunPlugin({ browser: fakeBrowser(new FakeSocket()) });
	});

	test("describes the browser namespace tools a hosted flow can call", () => {
		let names = plugin.describe().map((tool) => tool.name);
		expect(names).toContain("open");
		expect(names).toContain("click");
		expect(names).toContain("fill");
		expect(names).toContain("heading");
		expect(names).toContain("path");
	});

	test("opens a page, then asserts on its heading", async () => {
		let socket = new FakeSocket();
		socket.markup = "<html><body><h1>Dashboard</h1></body></html>";
		plugin = createBrowserRunPlugin({ browser: fakeBrowser(socket) });
		let context = contextFor("app.example.test");

		let opened = await plugin.call("open", [value("https://app.example.test/home")], context);
		if (isFailure(opened)) throw new Error(opened.error.message);
		expect(socket.href).toBe("https://app.example.test/home");

		let heading = await plugin.call("heading", [value("Dashboard")], context);
		if (isFailure(heading)) throw new Error(heading.error.message);
	});

	test("refuses a host the net grant does not cover before navigating", async () => {
		let context = contextFor("app.example.test");
		let refused = await plugin.call("open", [value("https://evil.test/login")], context);
		expect(isFailure(refused)).toBe(true);
		if (isFailure(refused)) {
			expect(refused.error.message).toMatch(/evil\.test|allow-net|net/i);
		}
	});

	test("fills a textbox and clicks a button", async () => {
		let socket = new FakeSocket();
		socket.markup = [
			"<html><body>",
			'<label>Email<input type="text" name="email"></label>',
			"<button>Sign in</button>",
			"</body></html>",
		].join("");
		plugin = createBrowserRunPlugin({ browser: fakeBrowser(socket) });
		let context = contextFor("app.example.test");

		await plugin.call("open", [value("https://app.example.test/login")], context);
		let filled = await plugin.call(
			"fill",
			[word("textbox"), value("Email"), word("with"), value("monitor@example.test")],
			context,
		);
		if (isFailure(filled)) throw new Error(filled.error.message);

		let clicked = await plugin.call("click", [word("button"), value("Sign in")], context);
		if (isFailure(clicked)) throw new Error(clicked.error.message);
	});

	test("dispose closes the Browser Run session", async () => {
		let socket = new FakeSocket();
		let closed = false;
		let browser = fakeBrowser(socket);
		let original = browser.closeSession.bind(browser);
		browser.closeSession = async (id) => {
			closed = true;
			return await original(id);
		};
		plugin = createBrowserRunPlugin({ browser });
		let context = contextFor("app.example.test");
		await plugin.call("open", [value("https://app.example.test/")], context);
		await plugin.dispose?.();
		expect(closed).toBe(true);
	});

	test("trace.start / trace.stop write chrome://tracing JSON into the workspace", async () => {
		let socket = new FakeSocket();
		plugin = createBrowserRunPlugin({ browser: fakeBrowser(socket) });
		let root = await mkdtemp(join(tmpdir(), "spec-browser-run-trace-"));
		let context = contextFor("app.example.test", root);
		try {
			await plugin.call("open", [value("https://app.example.test/")], context);
			let started = await plugin.call("trace.start", [], context);
			if (isFailure(started)) throw new Error(started.error.message);
			let stopped = await plugin.call("trace.stop", [value("flow.json")], context);
			if (isFailure(stopped)) throw new Error(stopped.error.message);
			expect(stopped.data).toEqual({ path: "flow.json", event_count: 1 });
			let written = JSON.parse(await readFile(join(root, "flow.json"), "utf8")) as unknown[];
			expect(written).toEqual([{ name: "test-event", ph: "I", ts: 1 }]);
			expect(socket.sent.some((line) => line.includes('"Tracing.start"'))).toBe(true);
			expect(socket.sent.some((line) => line.includes('"Tracing.end"'))).toBe(true);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("metrics returns Performance.getMetrics as a flat object", async () => {
		let socket = new FakeSocket();
		plugin = createBrowserRunPlugin({ browser: fakeBrowser(socket) });
		let context = contextFor("app.example.test");
		await plugin.call("open", [value("https://app.example.test/")], context);
		let collected = await plugin.call("metrics", [], context);
		if (isFailure(collected)) throw new Error(collected.error.message);
		expect(collected.data).toEqual({ Timestamp: 1, JSHeapUsedSize: 1024 });
	});

	test("cdp sends a Domain.method and returns its result", async () => {
		let socket = new FakeSocket();
		plugin = createBrowserRunPlugin({ browser: fakeBrowser(socket) });
		let context = contextFor("app.example.test");
		await plugin.call("open", [value("https://app.example.test/")], context);
		let result = await plugin.call("cdp", [value("Performance.getMetrics")], context);
		if (isFailure(result)) throw new Error(result.error.message);
		expect(result.data).toEqual({
			metrics: [
				{ name: "Timestamp", value: 1 },
				{ name: "JSHeapUsedSize", value: 1024 },
			],
		});
	});

	test("trace.stop without start fails with a clear message", async () => {
		plugin = createBrowserRunPlugin({ browser: fakeBrowser(new FakeSocket()) });
		let root = await mkdtemp(join(tmpdir(), "spec-browser-run-trace-miss-"));
		let context = contextFor("app.example.test", root);
		try {
			await plugin.call("open", [value("https://app.example.test/")], context);
			let stopped = await plugin.call("trace.stop", [], context);
			expect(isFailure(stopped)).toBe(true);
			if (isFailure(stopped)) {
				expect(stopped.error.message).toContain("trace.start");
			}
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test("trace.stop writes through the artifact store when the workspace has no filesystem", async () => {
		let socket = new FakeSocket();
		plugin = createBrowserRunPlugin({ browser: fakeBrowser(socket) });
		let written = new Map<string, string>();
		let context = createToolContext({
			permissions: createPermissionSet(allowNet("app.example.test")),
			artifacts: {
				directory: "r2",
				async write(name, contents) {
					written.set(
						name,
						typeof contents === "string" ? contents : new TextDecoder().decode(contents),
					);
					return name;
				},
			},
		});
		await plugin.call("open", [value("https://app.example.test/")], context);
		let started = await plugin.call("trace.start", [], context);
		expect(isSuccess(started)).toBe(true);
		let stopped = await plugin.call("trace.stop", [value("flow.json")], context);
		if (isFailure(stopped)) throw new Error(stopped.error.message);
		expect(stopped.data).toEqual({ path: "flow.json", event_count: 1 });
		expect(JSON.parse(written.get("flow.json") ?? "null")).toEqual([
			{ name: "test-event", ph: "I", ts: 1 },
		]);
	});
});
