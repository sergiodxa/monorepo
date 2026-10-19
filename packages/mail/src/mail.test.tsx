/**
 * Tests the email registry through a mailer over the memory transport: declarations named by
 * their path, templates composed from parsed props and the reader's locale, refusals for an
 * unmapped name or bad props, deferred and queued sends, previews and lazy templates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test, vi } from "vitest";

import { MemoryTransport } from "./memory.js";

import type { QueuedEmail } from "./index.js";

import {
	createEmail,
	createMail,
	Email,
	EMAIL_DELIVERY,
	EmailRefusedError,
	email,
	emails,
	isComposedEmail,
	isEmailDeclaration,
	lazy,
	Mailer,
} from "./index.js";

/** Sender identity every test mailer is configured with. */
const SENDER = { email: "no-reply@example.com" };

/** The declarations every test maps, nested to show names follow the path. */
const EMAILS = emails({
	welcome: email({ props: s.object({ name: s.string() }) }),
	teams: {
		invite: email({ props: s.object({ team: s.string(), url: s.string() }) }),
	},
});

/** Copy per language, standing in for an app's message bundles. */
const BUNDLES: Record<string, Record<string, string>> = {
	en: { "invite.subject": "Join {team}", "invite.action": "Accept invite" },
	es: { "invite.subject": "Únete a {team}", "invite.action": "Aceptar invitación" },
};

/** A translator over {@link BUNDLES} that falls back to English, as `createTranslator()` does. */
function translate(language?: string) {
	let locale = language !== undefined && language in BUNDLES ? language : "en";
	return {
		locale,
		t: (key: string, values: Record<string, unknown> = {}) =>
			(BUNDLES[locale]?.[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) =>
				String(values[name]),
			),
	};
}

/** The invite template, reading its copy through the translator it is handed. */
const INVITE = createEmail(EMAILS.teams.invite, {
	subject: ({ team, t }) => t("invite.subject", { team }),
	body: (handle) => () => (
		<Email.Layout lang={handle.props.locale} title={handle.props.team}>
			<Email.Button href={handle.props.url}>{handle.props.t("invite.action")}</Email.Button>
		</Email.Layout>
	),
	headers: () => ({ "X-Kind": "invite" }),
	preview: () => ({ team: "Acme", url: "https://acme.com/join" }),
});

/** The welcome template, with no preview. */
const WELCOME = createEmail(EMAILS.welcome, {
	subject: ({ name }) => `Welcome, ${name}`,
	body: (handle) => () => <p>Hello {handle.props.name}</p>,
	replyTo: () => ({ email: "team@example.com" }),
});

/** A registry with both templates mapped directly, and a mailer over a memory transport. */
function setup(options: { queue?: (delivery: QueuedEmail) => Promise<void> } = {}) {
	let mail = createMail({ translator: translate });
	mail.map(EMAILS.teams.invite, INVITE);
	mail.map(EMAILS.welcome, WELCOME);
	let transport = new MemoryTransport();
	let mailer = new Mailer({ transport, from: SENDER, mail, queue: options.queue });
	return { mail, mailer, transport };
}

describe(emails, () => {
	test("names every email by its path in the tree", () => {
		expect(EMAILS.welcome.name).toBe("welcome");
		expect(EMAILS.teams.invite.name).toBe("teams.invite");
		expect(isEmailDeclaration(EMAILS.teams.invite)).toBe(true);
		expect(isEmailDeclaration({ name: "welcome" })).toBe(false);
	});
});

describe("Mailer with a mail registry", () => {
	test("sends a declared email translated into the delivery's locale", async () => {
		let { mailer, transport } = setup();

		let sent = await mailer.send(EMAILS.teams.invite, {
			to: "ada@example.com",
			locale: "es",
			props: { team: "Acme", url: "https://acme.com/join" },
		});

		expect(isSuccess(sent)).toBe(true);
		expect(transport.last?.to).toEqual([{ email: "ada@example.com" }]);
		expect(transport.last?.subject).toBe("Únete a Acme");
		expect(transport.last?.html).toContain('lang="es"');
		expect(transport.last?.html).toContain("Aceptar invitación");
		expect(transport.last?.headers["X-Kind"]).toBe("invite");
	});

	test("records the declaration and parsed props on the sent message", async () => {
		let { mailer, transport } = setup();

		await mailer.send(EMAILS.welcome, { to: "ada@example.com", props: { name: "Ada" } });

		let message = transport.find((sent) => isComposedEmail(sent.email, EMAILS.welcome));
		expect(message).toBeDefined();
		expect(isComposedEmail(message?.email, EMAILS.teams.invite)).toBe(false);
		if (isComposedEmail(message?.email, EMAILS.welcome)) {
			expect(message.email.props).toEqual({ name: "Ada" });
			expect(message.email.locale).toBe("en");
		}
	});

	test("applies the delivery's sender, copies, reply-to and headers", async () => {
		let { mailer, transport } = setup();

		await mailer.send(EMAILS.welcome, {
			to: "ada@example.com",
			props: { name: "Ada" },
			from: { email: "hello@example.com" },
			cc: { email: "grace@example.com" },
			replyTo: { email: "support@example.com" },
			headers: { "X-Trace": "1" },
		});

		expect(transport.last?.from).toEqual({ email: "hello@example.com" });
		expect(transport.last?.cc).toEqual([{ email: "grace@example.com" }]);
		expect(transport.last?.replyTo).toEqual([{ email: "support@example.com" }]);
		expect(transport.last?.headers["X-Trace"]).toBe("1");
	});

	test("keeps the template's reply-to when the delivery sets none", async () => {
		let { mailer, transport } = setup();

		await mailer.send(EMAILS.welcome, { to: "ada@example.com", props: { name: "Ada" } });

		expect(transport.last?.replyTo).toEqual([{ email: "team@example.com" }]);
	});

	test("refuses props the declared schema rejects, sending nothing", async () => {
		let { mailer, transport } = setup();

		let sent = await mailer.send(EMAILS.welcome, {
			to: "ada@example.com",
			props: { name: 1 } as unknown as { name: string },
		});

		expect(isFailure(sent) && sent.error).toBeInstanceOf(EmailRefusedError);
		expect(isFailure(sent) && sent.error.message).toContain('"welcome"');
		expect(transport.messages).toHaveLength(0);
	});

	test("refuses an email no template is mapped for", async () => {
		let mail = createMail();
		let mailer = new Mailer({ transport: new MemoryTransport(), from: SENDER, mail });

		let sent = await mailer.send(EMAILS.welcome, { to: "ada@example.com", props: { name: "Ada" } });

		expect(isFailure(sent) && sent.error).toBeInstanceOf(EmailRefusedError);
	});

	test("fails a declared email on a mailer without a registry", async () => {
		let mailer = new Mailer({ transport: new MemoryTransport(), from: SENDER });

		let sent = await mailer.send(EMAILS.welcome, { to: "ada@example.com", props: { name: "Ada" } });

		expect(isFailure(sent)).toBe(true);
	});

	test("returns the key from t() when no translator is configured", async () => {
		let mail = createMail();
		mail.map(EMAILS.teams.invite, INVITE);
		let transport = new MemoryTransport();
		let mailer = new Mailer({ transport, from: SENDER, mail });

		await mailer.send(EMAILS.teams.invite, {
			to: "ada@example.com",
			props: { team: "Acme", url: "https://acme.com" },
		});

		expect(transport.last?.subject).toBe("invite.subject");
	});

	test("sends a deferred declared email when the mailer flushes", async () => {
		let { mailer, transport } = setup();

		mailer.later(EMAILS.welcome, { to: "ada@example.com", props: { name: "Ada" } });
		expect(transport.messages).toHaveLength(0);

		let results = await mailer.flush();

		expect(results.every(isSuccess)).toBe(true);
		expect(transport.last?.subject).toBe("Welcome, Ada");
	});
});

describe("Mailer.queue", () => {
	test("hands the validated delivery to the queue, addressed by the email's name", async () => {
		let queue = vi.fn(async (_delivery: QueuedEmail) => {});
		let { mailer, transport } = setup({ queue });

		let queued = await mailer.queue(EMAILS.teams.invite, {
			to: "ada@example.com",
			locale: "es",
			props: { team: "Acme", url: "https://acme.com" },
		});

		expect(isSuccess(queued)).toBe(true);
		expect(queue).toHaveBeenCalledWith({
			email: "teams.invite",
			to: "ada@example.com",
			locale: "es",
			props: { team: "Acme", url: "https://acme.com" },
		});
		expect(transport.messages).toHaveLength(0);
	});

	test("refuses bad props before anything reaches the queue", async () => {
		let queue = vi.fn(async (_delivery: QueuedEmail) => {});
		let { mailer } = setup({ queue });

		let queued = await mailer.queue(EMAILS.welcome, {
			to: "ada@example.com",
			props: {} as { name: string },
		});

		expect(isFailure(queued) && queued.error).toBeInstanceOf(EmailRefusedError);
		expect(queue).not.toHaveBeenCalled();
	});

	test("fails without a configured queue", async () => {
		let { mailer } = setup();

		let queued = await mailer.queue(EMAILS.welcome, {
			to: "ada@example.com",
			props: { name: "A" },
		});

		expect(isFailure(queued)).toBe(true);
	});

	test("reports a queue that throws as a failure", async () => {
		let { mailer } = setup({ queue: () => Promise.reject(new Error("queue down")) });

		let queued = await mailer.queue(EMAILS.welcome, {
			to: "ada@example.com",
			props: { name: "A" },
		});

		expect(isFailure(queued) && queued.error.cause).toEqual(new Error("queue down"));
	});

	test("delivers what the queue received, after it round-trips through the job schema", async () => {
		let received: unknown[] = [];
		let { mailer, transport } = setup({ queue: async (delivery) => void received.push(delivery) });

		await mailer.queue(EMAILS.teams.invite, {
			to: [{ email: "ada@example.com", name: "Ada" }],
			locale: "es",
			props: { team: "Acme", url: "https://acme.com" },
		});
		let input = await EMAIL_DELIVERY["~standard"].validate(JSON.parse(JSON.stringify(received[0])));
		if (input.issues !== undefined) throw new Error("The delivery failed its schema");

		let sent = await mailer.deliver(input.value);

		expect(isSuccess(sent)).toBe(true);
		expect(transport.last?.subject).toBe("Únete a Acme");
		expect(transport.last?.to).toEqual([{ email: "ada@example.com", name: "Ada" }]);
	});

	test("refuses a delivery naming an email no template is mapped for", async () => {
		let { mailer } = setup();

		let sent = await mailer.deliver({ email: "missing", to: "ada@example.com", props: {} });

		expect(isFailure(sent) && sent.error).toBeInstanceOf(EmailRefusedError);
	});
});

describe("Mail", () => {
	test("lists every mapped email in the order it was mapped", () => {
		let { mail } = setup();

		expect(mail.mapped.map((declared) => declared.name)).toEqual(["teams.invite", "welcome"]);
	});

	test("throws when an email is mapped twice", () => {
		let { mail } = setup();

		expect(() => mail.map(EMAILS.welcome, WELCOME)).toThrow('"welcome" is already mapped');
	});

	test("throws when a template is mapped onto another email", () => {
		let mail = createMail();

		expect(() => mail.map(EMAILS.teams.invite, WELCOME as unknown as typeof INVITE)).toThrow(
			'written for "welcome"',
		);
	});

	test("imports a lazy template once, on its first send", async () => {
		let load = vi.fn(async () => ({ default: WELCOME }));
		let mail = createMail();
		mail.map(EMAILS.welcome, lazy(load));
		let mailer = new Mailer({ transport: new MemoryTransport(), from: SENDER, mail });

		expect(load).not.toHaveBeenCalled();
		await mailer.send(EMAILS.welcome, { to: "ada@example.com", props: { name: "Ada" } });
		await mailer.send(EMAILS.welcome, { to: "ada@example.com", props: { name: "Grace" } });

		expect(load).toHaveBeenCalledTimes(1);
	});

	test("retries a lazy template whose import failed", async () => {
		let load = vi
			.fn<() => Promise<{ default: typeof WELCOME }>>()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue({ default: WELCOME });
		let mail = createMail();
		mail.map(EMAILS.welcome, lazy(load));
		let mailer = new Mailer({ transport: new MemoryTransport(), from: SENDER, mail });

		let first = await mailer.send(EMAILS.welcome, { to: "ada@example.com", props: { name: "A" } });
		let second = await mailer.send(EMAILS.welcome, { to: "ada@example.com", props: { name: "A" } });

		expect(isFailure(first)).toBe(true);
		expect(isSuccess(second)).toBe(true);
	});

	test("renders a declared email without sending it", async () => {
		let { mail } = setup();

		let rendered = unwrap(
			await mail.render(EMAILS.teams.invite, {
				locale: "es",
				props: { team: "Acme", url: "https://acme.com/join" },
			}),
		);

		expect(rendered.subject).toBe("Únete a Acme");
		expect(rendered.html).toContain('href="https://acme.com/join"');
		expect(rendered.text).toContain("Aceptar invitación");
	});

	test("renders a preview from the template's preview props", async () => {
		let { mail } = setup();

		let rendered = unwrap(await mail.preview("teams.invite", "en"));

		expect(rendered.subject).toBe("Join Acme");
	});

	test("fails a preview for an email without one", async () => {
		let { mail } = setup();

		let rendered = await mail.preview(EMAILS.welcome);

		expect(isFailure(rendered) && rendered.error.message).toContain("has no preview");
	});

	test("reports which mapped templates have a preview", async () => {
		let { mail } = setup();

		expect(await mail.hasPreview(EMAILS.teams.invite)).toBe(true);
		expect(await mail.hasPreview("welcome")).toBe(false);
		expect(await mail.hasPreview("billing.receipt")).toBe(false);
	});
});
