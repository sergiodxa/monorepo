/**
 * Tests the middleware contract: a mailer on the context configured with the app's
 * sender identity, a transport resolved per request when a factory is given, and a
 * deferred queue that flushes only after the handler returned, logging failures
 * instead of throwing them at a request whose response is already decided.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { RequestContext } from "remix/router";

import type { MailLogger } from "./middleware";

import { MemoryTransport } from "./memory";
import mail from "./middleware";

import { Mailer } from "./index";

/** Sender identity the middleware is registered with. */
const SENDER = { email: "no-reply@example.com", name: "Example" };

/** Reply-to identity used to check that registration reaches every message. */
const REPLY_TO = { email: "hello@example.com" };

/** Builds a request context, the object a middleware receives and mutates. */
function createContext(): RequestContext {
	return new RequestContext(new Request("https://example.com/invites"));
}

/** Collects the events a middleware logs, standing in for the app's request logger. */
function createLogger() {
	let events: { event: string; payload?: Record<string, unknown> }[] = [];
	let logger: MailLogger = {
		error(event, payload) {
			events.push({ event, payload });
		},
	};
	return { logger, events };
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

	test("logs a failed deferred send through the logger the options supply", async () => {
		let { logger, events } = createLogger();
		let middleware = mail({
			transport: new MemoryTransport(),
			from: SENDER,
			logger: () => logger,
		});
		let context = createContext();

		let response = await middleware(context, async () => {
			context.email.later({ to: [], subject: "Invalid", text: "Hi" });
			return new Response("ok");
		});

		expect(response.status).toBe(200);
		expect(events).toHaveLength(1);
		expect(events[0]?.event).toBe("mail.send_failed");
		expect(events[0]?.payload?.error).toContain("recipient");
	});

	test("falls back to the logger the app installed on the context", async () => {
		let { logger, events } = createLogger();
		let middleware = mail({ transport: new MemoryTransport(), from: SENDER });
		let context = Object.assign(createContext(), { logger });

		await middleware(context, async () => {
			context.email.later({ to: [], subject: "Invalid", text: "Hi" });
			return new Response("ok");
		});

		expect(events).toHaveLength(1);
	});

	test("drops a deferred failure when no logger is available, rather than throwing", async () => {
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
