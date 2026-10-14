/**
 * A thin CDP client over a Cloudflare Browser Run session: acquire, connect a
 * page target, send commands, and evaluate page-side scripts. The browser
 * plugin talks only through this surface so the tool layer stays free of
 * WebSocket plumbing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";

import { ToolError } from "../errors.js";

/**
 * A Workers WebSocket after an Upgrade: the platform's `accept()` must run
 * before send/receive. Typed apart from the DOM `WebSocket` so this package
 * typechecks under a Node lib that has no `accept`.
 */
export interface BrowserRunSocket {
	/** Admit the upgraded connection on the Worker side. */
	accept(): void;
	send(data: string): void;
	close(): void;
	addEventListener(type: "message", listener: (event: { data: string }) => void): void;
	addEventListener(type: "close", listener: () => void): void;
	removeEventListener(type: "message", listener: (event: { data: string }) => void): void;
	removeEventListener(type: "close", listener: () => void): void;
}

/**
 * What `webSocket.fetch` returns after an Upgrade: a Workers `Response` carrying
 * the accepted socket. Typed here so the client does not depend on Workers'
 * `Response.webSocket` being visible in every tsconfig that checks this package.
 */
export interface BrowserRunUpgrade {
	/** The CDP WebSocket, when the upgrade succeeded. */
	webSocket?: BrowserRunSocket | null;
}

/** What a Browser Run binding must expose for this client to open a session. */
export interface BrowserRunBinding {
	/**
	 * Acquire a session and return a WebSocket capability. Pass `targets: true`
	 * so the first page can be selected without a second round trip.
	 */
	launch(options?: {
		keepAlive?: number;
		targets?: boolean;
		guardrails?: { allowedDomains?: string[] };
	}): Promise<{
		sessionId: string;
		webSocket: { fetch(input: string, init?: RequestInit): Promise<BrowserRunUpgrade> };
		targets?: readonly { id: string; type: string }[];
	}>;
	/** Connect to an existing session, optionally pinned to one target. */
	connectSession(
		sessionId: string,
		options?: { targetId?: string },
	): Promise<{
		sessionId: string;
		webSocket: { fetch(input: string, init?: RequestInit): Promise<BrowserRunUpgrade> };
	}>;
	/** Close a session so billed browser time stops with the run. */
	closeSession(sessionId: string): Promise<unknown>;
}

/** One in-flight CDP command waiting on its matching response id. */
interface PendingCommand {
	resolve: (result: unknown) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

/**
 * A connected page session. Call {@link CdpSession.open} once per run and
 * {@link CdpSession.close} from the plugin's `dispose`.
 */
export class CdpSession {
	/** The Browser Run session id, needed to close the session. */
	readonly sessionId: string;
	#socket: BrowserRunSocket;
	#browser: BrowserRunBinding;
	#nextId = 0;
	#pending = new Map<number, PendingCommand>();
	#closed = false;

	private constructor(sessionId: string, socket: BrowserRunSocket, browser: BrowserRunBinding) {
		this.sessionId = sessionId;
		this.#socket = socket;
		this.#browser = browser;
		this.#socket.addEventListener("message", (event) => {
			this.#onMessage(typeof event.data === "string" ? event.data : "");
		});
		this.#socket.addEventListener("close", () => {
			this.#rejectAll(new Error("CDP connection closed before the command completed"));
		});
	}

	/**
	 * Open a Browser Run session pinned to a page target and enable the domains
	 * the plugin needs for navigation and evaluation.
	 */
	static async open(
		browser: BrowserRunBinding,
		options: { keepAliveMs?: number; allowedDomains?: readonly string[] } = {},
	): Promise<Result<CdpSession, SpecError>> {
		try {
			let connection = await browser.launch({
				keepAlive: options.keepAliveMs ?? 60_000,
				targets: true,
				guardrails:
					options.allowedDomains !== undefined && options.allowedDomains.length > 0
						? { allowedDomains: [...options.allowedDomains] }
						: undefined,
			});
			let page = connection.targets?.find((target) => target.type === "page");
			if (page !== undefined) {
				connection = await browser.connectSession(connection.sessionId, {
					targetId: page.id,
				});
			}
			let response = await connection.webSocket.fetch("https://browser-binding.invalid", {
				headers: { Upgrade: "websocket" },
			});
			let socket = response.webSocket;
			if (socket === null || socket === undefined) {
				await browser.closeSession(connection.sessionId);
				return failure(new ToolError("Browser Run did not return a WebSocket for the session"));
			}
			socket.accept();
			let session = new CdpSession(connection.sessionId, socket, browser);
			await session.send("Page.enable");
			await session.send("Runtime.enable");
			await session.send("DOM.enable");
			return success(session);
		} catch (error) {
			return failure(
				new ToolError(`browser could not open a Browser Run session: ${describeError(error)}`),
			);
		}
	}

	/** Navigate to a URL and wait until the document has finished loading. */
	async navigate(url: string): Promise<Result<null, SpecError>> {
		try {
			await this.send("Page.navigate", { url });
			await this.send("Runtime.evaluate", {
				expression: LOAD_WAIT,
				awaitPromise: true,
				returnByValue: true,
			});
			return success(null);
		} catch (error) {
			return failure(new ToolError(`browser.open failed: ${describeError(error)}`));
		}
	}

	/** Reload the current page and wait for the load event. */
	async reload(): Promise<Result<null, SpecError>> {
		try {
			await this.send("Page.reload", { ignoreCache: false });
			await this.send("Runtime.evaluate", {
				expression: LOAD_WAIT,
				awaitPromise: true,
				returnByValue: true,
			});
			return success(null);
		} catch (error) {
			return failure(new ToolError(`browser.reload failed: ${describeError(error)}`));
		}
	}

	/**
	 * Evaluate a page-side expression and return its value. Expressions that
	 * return a Promise are awaited when `awaitPromise` is true.
	 */
	async evaluate(expression: string): Promise<Result<unknown, SpecError>> {
		try {
			let result = (await this.send("Runtime.evaluate", {
				expression,
				awaitPromise: true,
				returnByValue: true,
			})) as {
				result?: { value?: unknown; type?: string; description?: string };
				exceptionDetails?: { text?: string };
			};
			if (result.exceptionDetails !== undefined) {
				return failure(
					new ToolError(
						`browser evaluation failed: ${result.exceptionDetails.text ?? "script threw"}`,
					),
				);
			}
			return success(result.result?.value);
		} catch (error) {
			return failure(new ToolError(`browser evaluation failed: ${describeError(error)}`));
		}
	}

	/** Read the current page URL. */
	async currentUrl(): Promise<Result<string, SpecError>> {
		let evaluated = await this.evaluate("location.href");
		if (isFailure(evaluated)) return evaluated;
		return success(typeof evaluated.data === "string" ? evaluated.data : "");
	}

	/** Read the document title. */
	async title(): Promise<Result<string, SpecError>> {
		let evaluated = await this.evaluate("document.title");
		if (isFailure(evaluated)) return evaluated;
		return success(typeof evaluated.data === "string" ? evaluated.data : "");
	}

	/** Press a key at the current focus. */
	async press(key: string): Promise<Result<null, SpecError>> {
		try {
			await this.send("Input.dispatchKeyEvent", { type: "keyDown", key });
			await this.send("Input.dispatchKeyEvent", { type: "keyUp", key });
			return success(null);
		} catch (error) {
			return failure(new ToolError(`browser.press failed: ${describeError(error)}`));
		}
	}

	/** Best-effort teardown: close the socket and the Browser Run session. */
	async close(): Promise<void> {
		if (this.#closed) return;
		this.#closed = true;
		this.#rejectAll(new Error("browser session closed"));
		try {
			this.#socket.close();
		} catch {
			/** Already closed. */
		}
		try {
			await this.#browser.closeSession(this.sessionId);
		} catch {
			/** A failed close must never fail a run. */
		}
	}

	/** Send one CDP command and wait for its result. */
	async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
		if (this.#closed) throw new Error("browser session is closed");
		let id = ++this.#nextId;
		return await new Promise((resolve, reject) => {
			let timer = setTimeout(() => {
				this.#pending.delete(id);
				reject(new Error(`CDP command "${method}" timed out`));
			}, 30_000);
			this.#pending.set(id, { resolve, reject, timer });
			try {
				this.#socket.send(JSON.stringify({ id, method, params }));
			} catch (error) {
				clearTimeout(timer);
				this.#pending.delete(id);
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}

	/** Dispatch one JSON message from the socket onto a pending command. */
	#onMessage(raw: string): void {
		if (raw === "") return;
		let message: { id?: number; result?: unknown; error?: { message?: string } };
		try {
			message = JSON.parse(raw) as typeof message;
		} catch {
			return;
		}
		if (typeof message.id !== "number") return;
		let pending = this.#pending.get(message.id);
		if (pending === undefined) return;
		clearTimeout(pending.timer);
		this.#pending.delete(message.id);
		if (message.error !== undefined) {
			pending.reject(new Error(message.error.message ?? "CDP command failed"));
			return;
		}
		pending.resolve(message.result);
	}

	/** Fail every in-flight command, used when the socket closes. */
	#rejectAll(error: Error): void {
		for (let [, pending] of this.#pending) {
			clearTimeout(pending.timer);
			pending.reject(error);
		}
		this.#pending.clear();
	}
}

/**
 * Wait until the document has finished loading, so a navigate returns only
 * after scripts that run on load have had a chance to paint.
 */
const LOAD_WAIT = [
	"new Promise((resolve) => {",
	'	if (document.readyState === "complete") resolve(true);',
	'	else window.addEventListener("load", () => resolve(true), { once: true });',
	"})",
].join("\n");

/** Render an unknown thrown value as a one-line message. */
function describeError(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
