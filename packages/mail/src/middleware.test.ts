/**
 * Tests the middleware contract: a mailer on the context configured with the app's
 * sender identity, a transport resolved per request when a factory is given, and a
 * deferred queue that flushes only after the handler returned, recording each outcome
 * on the invocation's log to leave a request's already-decided response intact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Log } from "@sdxc/logger";
import { RequestContext } from "remix/router";
import { describe, expect, test } from "vitest";

import { MemoryTransport } from "./memory.js";
import mail from "./middleware.js";

import { Mailer } from "./index.js";

const SENDER = { email: "no-reply@example.com", name: "Example" };

/** Reply-to identity used to check that registration reaches every message. */
const REPLY_TO = { email: "hello@example.com" };

/** Builds a request context, the object a middleware receives and mutates. */
function createContext(): RequestContext {
	return new RequestContext(new Request("https://example.com/invites"));
}

/** Runs `fn` inside an invocation's log and returns the record it emitted. */
async function recorded(fn: () => unknown): Promise<Record<string, unknown>> {
	let records: Record<string, unknown>[] = [];
	let log = new Log({ kind: "request", sink: (record) => void records.push(record) });
	await log.run(fn);
	return records[0] ?? {};
}

describe("mail middleware", () => {
	test("publishes a mailer on the context configured with the app's identity", async () => {
		let transport = new MemoryTransport();
		let middleware = mail({ transport, from: SENDER, replyTo: REPLY_TO });
		let context = createContext();

		await middleware(context, async () => {
			expect(context.email).toBeInstanceOf(Mailer);
			await context.email.send({ to: { email: "a@example.com" }, subject: "Hi", text: "Hi" });
			return new Response("ok");
		});

		expect(transport.last?.from).toEqual(SENDER);
		expect(transport.last?.replyTo).toEqual([REPLY_TO]);
	});

	test("returns the handler's response untouched", async () => {
		let middleware = mail({ transport: new MemoryTransport(), from: SENDER });

		let response = await middleware(createContext(), async () => new Response("handler body"));

		expect(await response.text()).toBe("handler body");
	});

	test("resolves a transport factory once per request, with the request context", async () => {
		let transport = new MemoryTransport();
		let contexts: RequestContext[] = [];
		let middleware = mail({
			transport: (context) => {
				contexts.push(context);
				return transport;
			},
			from: SENDER,
		});
		let context = createContext();

		await middleware(context, async () => {
			await context.email.send({ to: { email: "a@example.com" }, subject: "Hi", text: "Hi" });
			return new Response("ok");
		});

		expect(contexts).toEqual([context]);
		expect(transport.messages).toHaveLength(1);
	});

	test("holds a deferred message until the handler returned, then sends it", async () => {
		let transport = new MemoryTransport();
		let middleware = mail({ transport, from: SENDER });
		let context = createContext();

		await middleware(context, async () => {
			context.email.later({ to: { email: "a@example.com" }, subject: "Deferred", text: "Hi" });
			expect(transport.messages).toHaveLength(0);
			return new Response("ok");
		});

		expect(transport.last?.subject).toBe("Deferred");
	});

	test("flushes deferred messages even when the handler throws", async () => {
		let transport = new MemoryTransport();
		let middleware = mail({ transport, from: SENDER });
		let context = createContext();

		let handler = async () => {
			context.email.later({ to: { email: "a@example.com" }, subject: "Deferred", text: "Hi" });
			throw new Error("handler failed");
		};

		let caught: unknown;
		try {
			await middleware(context, handler);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(Error);
		expect(transport.messages).toHaveLength(1);
	});

	test("records a delivered deferred message on the invocation's log", async () => {
		let middleware = mail({ transport: new MemoryTransport(), from: SENDER });
		let context = createContext();

		let record = await recorded(() =>
			middleware(context, async () => {
				context.email.later({ to: { email: "a@example.com" }, subject: "Deferred", text: "Hi" });
				return new Response("ok");
			}),
		);

		expect(record).toMatchObject({ "mail.sent": true, outcome: "ok" });
		expect(record.notes).toEqual([
			expect.objectContaining({ level: "info", name: "mail.sent", message_id: expect.any(String) }),
		]);
	});

	test("warns about a failed deferred send without failing the request", async () => {
		let middleware = mail({ transport: new MemoryTransport(), from: SENDER });
		let context = createContext();
		let response: Response | undefined;

		let record = await recorded(async () => {
			response = await middleware(context, async () => {
				context.email.later({ to: [], subject: "Invalid", text: "Hi" });
				return new Response("ok");
			});
		});

		expect(response?.status).toBe(200);
		expect(record.outcome).toBe("degraded");
		expect(record.notes).toEqual([
			expect.objectContaining({
				level: "warn",
				name: "mail.send_failed",
				error: expect.stringContaining("recipient"),
			}),
		]);
	});

	test("drops a deferred failure when no log is current, rather than throwing", async () => {
		let middleware = mail({ transport: new MemoryTransport(), from: SENDER });
		let context = createContext();

		let response = await middleware(context, async () => {
			context.email.later({ to: [], subject: "Invalid", text: "Hi" });
			return new Response("ok");
		});

		expect(response.status).toBe(200);
	});

	test("gives each request its own queue, so one cannot flush another's mail", async () => {
		let transport = new MemoryTransport();
		let middleware = mail({ transport, from: SENDER });
		let first = createContext();
		let second = createContext();

		await middleware(first, async () => {
			first.email.later({ to: { email: "a@example.com" }, subject: "First", text: "Hi" });
			return new Response("ok");
		});

		await middleware(second, async () => {
			expect(second.email.pending).toBe(0);
			second.email.later({ to: { email: "b@example.com" }, subject: "Second", text: "Hi" });
			return new Response("ok");
		});

		expect(transport.messages.map((message) => message.subject)).toEqual(["First", "Second"]);
	});
});
