/**
 * Tests the job mail middleware through a real `@sdxc/jobs` dispatcher over a memory queue: a
 * job reads its mailer as `ctx.email`, deferred sends leave once the handler returns, and a
 * declared email queued by one mailer is delivered by the job that receives it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobDispatcherContext } from "@sdxc/jobs";

import { createJobDispatcher, createJobHandler, job, jobs } from "@sdxc/jobs";
import * as memory from "@sdxc/jobs/memory";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, expectTypeOf, test } from "vitest";

import mailer, { CurrentMailer } from "./jobs.js";
import { Mailer } from "./mailer.js";
import { MemoryTransport } from "./memory.js";

import {
	createEmail,
	createMail,
	EMAIL_DELIVERY,
	EmailRefusedError,
	email,
	emails,
} from "./index.js";

/** Sender identity every mailer here sends with. */
const SENDER = { email: "no-reply@example.com" };

/** The one declared email the tests send. */
const EMAILS = emails({ welcome: email({ props: s.object({ name: s.string() }) }) });

/** The jobs the dispatcher runs: one that sends on its own, and the generic delivery job. */
const JOBS = jobs({ greet: job(), email: job({ input: EMAIL_DELIVERY }) });

/** A registry with the welcome email mapped. */
function registry() {
	let mail = createMail();
	mail.map(
		EMAILS.welcome,
		createEmail(EMAILS.welcome, {
			subject: ({ name }) => `Welcome, ${name}`,
			body: (handle) => () => <p>Hello {handle.props.name}</p>,
		}),
	);
	return mail;
}

describe(mailer, () => {
	test("publishes a mailer under the CurrentMailer key and flushes it after the handler", async () => {
		let transport = new MemoryTransport();
		let seen: Mailer[] = [];
		let dispatcher = createJobDispatcher({
			middleware: [mailer({ transport, from: SENDER, mail: registry() })] as const,
		});
		dispatcher.map(JOBS.greet, async () => ({
			default: createJobHandler(JOBS.greet, (ctx) => {
				seen.push(ctx.require(CurrentMailer));
				ctx
					.require(CurrentMailer)
					.later(EMAILS.welcome, { to: "ada@example.com", props: { name: "Ada" } });
				expect(transport.messages).toHaveLength(0);
			}),
		}));

		await dispatcher.deliver({ id: "m1", attempts: 1, body: { job: "greet" } });

		expect(seen).toHaveLength(1);
		expect(transport.last?.subject).toBe("Welcome, Ada");
	});

	test("delivers a queued email through the job that receives it", async () => {
		let transport = new MemoryTransport();
		let queue = memory.queue();
		let mail = registry();
		let dispatcher = createJobDispatcher({
			queue,
			middleware: [mailer({ transport, from: SENDER, mail })] as const,
		});
		dispatcher.map(JOBS.email, async () => ({
			default: createJobHandler(JOBS.email, async (ctx) => {
				let sent = await ctx.require(CurrentMailer).deliver(ctx.input);
				if (isFailure(sent) && sent.error instanceof EmailRefusedError)
					ctx.exit(sent.error.message);
				if (isFailure(sent)) ctx.retry({ cause: sent.error });
			}),
		}));
		let route = new Mailer({
			transport,
			from: SENDER,
			mail,
			queue: (delivery) => dispatcher.enqueue(JOBS.email, delivery),
		});

		await route.queue(EMAILS.welcome, { to: "ada@example.com", props: { name: "Ada" } });
		expect(transport.messages).toHaveLength(0);
		await queue.drain((delivery) => dispatcher.deliver(delivery));

		expect(transport.last?.subject).toBe("Welcome, Ada");
		expect(queue.messages).toHaveLength(0);
	});

	test("types ctx.email on the context a dispatcher derives from its middleware", () => {
		let dispatcher = createJobDispatcher({
			middleware: [mailer({ transport: new MemoryTransport(), from: SENDER })] as const,
		});

		expectTypeOf<JobDispatcherContext<typeof dispatcher>["email"]>().toEqualTypeOf<Mailer>();
	});
});
