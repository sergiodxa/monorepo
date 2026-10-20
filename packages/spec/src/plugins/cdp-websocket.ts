/**
 * One-shot CDP over a standard WebSocket URL — used by the `agent-browser`
 * backend after `get cdp-url`, so `browser.cdp` and `browser.metrics` reach
 * the same session the CLI already drives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";

import { ToolError } from "../errors.js";

/** Send one CDP command on a fresh WebSocket and close when the reply arrives. */
export async function sendCdpCommand(
	url: string,
	method: string,
	params: Record<string, unknown> = {},
	timeoutMs = 30_000,
): Promise<Result<unknown, SpecError>> {
	return await withCdpConnection(url, timeoutMs, async (send) => await send(method, params));
}

/**
 * Open a CDP WebSocket, run a sequence of commands on the same connection,
 * then close. Needed when a domain must be enabled before its read command.
 */
export async function withCdpConnection<T>(
	url: string,
	timeoutMs: number,
	run: (send: (method: string, params?: Record<string, unknown>) => Promise<unknown>) => Promise<T>,
): Promise<Result<T, SpecError>> {
	let socket: WebSocket;
	try {
		socket = new WebSocket(url);
	} catch (error) {
		return failure(
			new ToolError(`browser could not open a CDP WebSocket: ${describeError(error)}`),
		);
	}

	let nextId = 0;
	let pending = new Map<
		number,
		{ resolve: (result: unknown) => void; reject: (error: Error) => void }
	>();

	let opened = new Promise<void>((resolve, reject) => {
		let timer = setTimeout(() => {
			reject(new Error("CDP WebSocket open timed out"));
		}, timeoutMs);
		socket.addEventListener("open", () => {
			clearTimeout(timer);
			resolve();
		});
		socket.addEventListener("error", () => {
			clearTimeout(timer);
			reject(new Error("CDP WebSocket failed to open"));
		});
	});

	socket.addEventListener("message", (event) => {
		let raw = typeof event.data === "string" ? event.data : "";
		if (raw === "") return;
		let message: { id?: number; result?: unknown; error?: { message?: string } };
		try {
			message = JSON.parse(raw) as typeof message;
		} catch {
			return;
		}
		if (typeof message.id !== "number") return;
		let waiter = pending.get(message.id);
		if (waiter === undefined) return;
		pending.delete(message.id);
		if (message.error !== undefined) {
			waiter.reject(new Error(message.error.message ?? "CDP command failed"));
			return;
		}
		waiter.resolve(message.result);
	});

	try {
		await opened;
		let send = async (method: string, params: Record<string, unknown> = {}): Promise<unknown> => {
			let id = ++nextId;
			return await new Promise((resolve, reject) => {
				let timer = setTimeout(() => {
					pending.delete(id);
					reject(new Error(`CDP command "${method}" timed out`));
				}, timeoutMs);
				pending.set(id, {
					resolve: (result) => {
						clearTimeout(timer);
						resolve(result);
					},
					reject: (error) => {
						clearTimeout(timer);
						reject(error);
					},
				});
				try {
					socket.send(JSON.stringify({ id, method, params }));
				} catch (error) {
					clearTimeout(timer);
					pending.delete(id);
					reject(error instanceof Error ? error : new Error(String(error)));
				}
			});
		};
		let value = await run(send);
		return success(value);
	} catch (error) {
		return failure(new ToolError(`browser CDP call failed: ${describeError(error)}`));
	} finally {
		for (let [, waiter] of pending) {
			waiter.reject(new Error("CDP connection closed"));
		}
		pending.clear();
		try {
			socket.close();
		} catch {
			/** Already closed. */
		}
	}
}

/** Render an unknown thrown value as a one-line message. */
function describeError(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
