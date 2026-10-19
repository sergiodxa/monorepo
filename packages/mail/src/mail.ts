/**
 * `createMail()`: the app's email registry. It maps every declared email onto its template and
 * composes one from its props and the reader's locale, so a send, a queued delivery and a
 * preview all render the same way, wherever the mailer that sends it runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { RemixElement } from "remix/component";

import { failure, isFailure, success, wrap } from "@sdxc/result";
import { createElement } from "remix/component";
import * as s from "remix/data-schema";

import type { AnyEmailDeclaration, EmailPropsInput, EmailPropsOutput } from "./emails.js";
import type { Lazy } from "./lazy.js";
import type { RenderedEmail } from "./render.js";
import type { AnyEmailTemplate, EmailLocale, EmailTemplate, EmailTranslate } from "./template.js";
import type { Address, CalendarPart, Email, MailingList, Unsubscribe } from "./types.js";

import { isEmailDeclaration } from "./emails.js";
import { EmailRefusedError, MailError } from "./errors.js";
import { isLazy } from "./lazy.js";
import { render } from "./render.js";

/**
 * Who one declared email goes to, in which language, and the props it is built from. Every
 * field is plain JSON, so the same delivery is sent now or handed to a queue.
 *
 * @template Props - The props as a caller writes them.
 */
export interface EmailDelivery<Props = unknown> {
	/** Recipients; a bare string is the mailbox alone. */
	to: string | Address | Address[];
	/** The reader's language, handed to the translator; omitted means the translator's fallback. */
	locale?: string;
	props: Props;
	/** Sender for this delivery in place of the mailer's. */
	from?: Address;
	cc?: Address | Address[];
	bcc?: Address | Address[];
	/** Reply-to for this delivery, in place of the template's and the mailer's. */
	replyTo?: Address | Address[];
	/** Headers merged over the template's and the mailer's. */
	headers?: Record<string, string>;
}

/** The delivery a caller writes for one declared email, typed from its schema. */
export type DeliveryFor<Declaration> = EmailDelivery<EmailPropsInput<Declaration>>;

/** A delivery addressed to a declared email by name, as it travels through a queue. */
export interface QueuedEmail extends EmailDelivery {
	/** The declared email's name (`teams.invite`). */
	email: string;
}

/** The props and the language a render needs, which a preview supplies without a recipient. */
export type RenderInput<Props = unknown> = Pick<EmailDelivery<Props>, "locale" | "props">;

/** A rendered email: its subject beside both body parts, as a preview or a test reads it. */
export interface RenderedDeclaredEmail extends RenderedEmail {
	subject: string;
}

/**
 * An email composed from a declaration, carrying the parsed props and the locale it rendered
 * in, so a test finds a sent message by the email it came from and asserts on what the caller
 * passed.
 *
 * @template Props - The props as the email's schema parsed them.
 */
export interface ComposedEmail<Props = unknown> extends Email {
	readonly declaration: AnyEmailDeclaration;
	readonly props: Props;
	readonly locale: string;
}

/** Binds the reader's language to a translator; `createTranslator()` from `@sdxc/i18n` returns one. */
export type EmailTranslator = (locale?: string) => { locale: string; t: EmailTranslate };

/** Configuration for the app's email registry. */
export interface MailOptions {
	/**
	 * Binds each delivery's locale to the translator its template receives. Without one, a
	 * template's `t()` returns the key it was given and `locale` is the delivery's or `en`.
	 */
	translator?: EmailTranslator;
}

/** A mailbox as it travels through a queue. */
const ADDRESS = s.object({ email: s.string(), name: s.optional(s.string()) });

/** One or several mailboxes, or a bare address string, as {@link EmailDelivery} accepts them. */
const ADDRESSES = s.union([s.string(), ADDRESS, s.array(ADDRESS)]);

/**
 * The input of the job that delivers queued email: `job({ input: EMAIL_DELIVERY })`. The props
 * pass through untouched here, since the declared email's own schema parses them on delivery.
 */
export const EMAIL_DELIVERY: StandardSchemaV1<QueuedEmail, QueuedEmail> = s.object({
	email: s.string(),
	to: ADDRESSES,
	locale: s.optional(s.string()),
	props: s.any(),
	from: s.optional(ADDRESS),
	cc: s.optional(ADDRESSES),
	bcc: s.optional(ADDRESSES),
	replyTo: s.optional(ADDRESSES),
	headers: s.optional(s.record(s.string(), s.string())),
}) as StandardSchemaV1<QueuedEmail, QueuedEmail>;

/** What `t` does for an app that configured no translator: hands back the key. */
function untranslated(key: string): string {
	return key;
}

/**
 * The app's email registry: every declared email mapped onto its template. It holds no
 * transport, so the same instance serves the Worker's mailers and a command run on Bun; a
 * mailer configured with it as `mail` sends, defers and queues declared emails.
 */
export class Mail {
	/** The translator every composed email receives. */
	#options: MailOptions;

	/** Declared emails by name, each with the loader that resolves its template once. */
	#mapped = new Map<
		string,
		{ declaration: AnyEmailDeclaration; template: () => Promise<AnyEmailTemplate> }
	>();

	/**
	 * Creates the instance; {@link createMail} is the usual way to call it.
	 *
	 * @param options - The translator; see {@link MailOptions}.
	 */
	constructor(options: MailOptions = {}) {
		this.#options = options;
	}

	/** Every mapped email, in the order it was mapped, for a preview list or a check to walk. */
	get mapped(): AnyEmailDeclaration[] {
		return [...this.#mapped.values()].map((entry) => entry.declaration);
	}

	/**
	 * Maps a declared email onto its template, held directly or loaded through `lazy()` on the
	 * email's first send.
	 *
	 * @param email - The declared email.
	 * @param template - What `createEmail()` returned for it, or the module that default-exports it.
	 * @throws When the email is already mapped, or the template was written for another email.
	 * @example mail.map(emails.welcome, lazy(() => import("~/app/emails/welcome")));
	 */
	map<Schema extends StandardSchemaV1>(
		email: AnyEmailDeclaration & { props: Schema },
		template: EmailTemplate<Schema> | Lazy<EmailTemplate<Schema>>,
	): void {
		if (this.#mapped.has(email.name)) throw new Error(`Email "${email.name}" is already mapped`);
		this.#mapped.set(email.name, { declaration: email, template: resolver(email, template) });
	}

	/**
	 * Builds the email a delivery describes: the props parsed by the declared schema, the
	 * locale bound to the translator, and every template member read from both.
	 *
	 * @param email - The declared email, or its name as a queued delivery carries it.
	 * @param delivery - The recipient, the locale and the props.
	 * @returns The email, or an `EmailRefusedError` for an unmapped name or props the schema refuses.
	 */
	async compose<Declaration extends AnyEmailDeclaration>(
		email: Declaration | string,
		delivery: EmailDelivery,
	): Promise<Result<ComposedEmail<EmailPropsOutput<Declaration>>, MailError>> {
		let loaded = await this.#load(email);
		if (isFailure(loaded)) return loaded;
		let { declaration, template } = loaded.data;

		let props = await parse(declaration, delivery.props);
		if (isFailure(props)) return props;

		let language = this.#translate(delivery.locale);
		let input = { ...(props.data as object), ...language };
		let composed = wrap(() => build(declaration, template, delivery, props.data, input));
		if (isFailure(composed)) {
			return failure(
				new MailError(`Failed to compose the "${declaration.name}" email.`, {
					cause: composed.error,
				}),
			);
		}
		return success(composed.data as ComposedEmail<EmailPropsOutput<Declaration>>);
	}

	/**
	 * Renders a declared email without sending it, for a preview or a test asserting on copy.
	 *
	 * @param email - The declared email.
	 * @param input - The props and the locale to render with.
	 * @returns The subject and both body parts.
	 * @example let { subject, text } = unwrap(await mail.render(emails.welcome, { locale: "es", props }));
	 */
	async render<Declaration extends AnyEmailDeclaration>(
		email: Declaration,
		input: RenderInput<EmailPropsInput<Declaration>>,
	): Promise<Result<RenderedDeclaredEmail, MailError>> {
		let composed = await this.compose(email, { ...input, to: [] });
		if (isFailure(composed)) return composed;
		let rendered = await wrap(() => render(composed.data.body()));
		if (isFailure(rendered)) {
			return failure(new MailError("Failed to render the email body.", { cause: rendered.error }));
		}
		return success({ subject: composed.data.subject, ...rendered.data });
	}

	/**
	 * Renders a declared email with its template's `preview()` props.
	 *
	 * @param email - The declared email, or its name as a preview URL carries it.
	 * @param locale - The language to render in; omitted means the translator's fallback.
	 * @returns The rendered email, or a `MailError` when the template has no `preview()`.
	 */
	async preview(
		email: AnyEmailDeclaration | string,
		locale?: string,
	): Promise<Result<RenderedDeclaredEmail, MailError>> {
		let loaded = await this.#load(email);
		if (isFailure(loaded)) return loaded;
		let { declaration, template } = loaded.data;
		if (template.preview === undefined) {
			return failure(new MailError(`The "${declaration.name}" email has no preview.`));
		}
		let props = wrap(() => template.preview?.());
		if (isFailure(props)) {
			return failure(
				new MailError(`The "${declaration.name}" preview threw.`, { cause: props.error }),
			);
		}
		return await this.render(declaration, { locale, props: props.data });
	}

	/**
	 * Reports whether the template mapped for an email has a `preview()`, loading it without
	 * rendering, so a preview list marks the emails it cannot show.
	 *
	 * @param email - The declared email, or its name.
	 * @returns `false` for an unmapped email or a template that failed to load, too.
	 */
	async hasPreview(email: AnyEmailDeclaration | string): Promise<boolean> {
		let loaded = await this.#load(email);
		return !isFailure(loaded) && loaded.data.template.preview !== undefined;
	}

	/**
	 * Parses props with the declared schema without rendering anything, which is how a mailer
	 * refuses a queued delivery where its caller wrote it.
	 *
	 * @param email - The declared email.
	 * @param props - The props as the caller wrote them.
	 * @returns The parsed props, or an `EmailRefusedError` naming every issue.
	 */
	async validate<Declaration extends AnyEmailDeclaration>(
		email: Declaration,
		props: unknown,
	): Promise<Result<EmailPropsOutput<Declaration>, MailError>> {
		return (await parse(email, props)) as Result<EmailPropsOutput<Declaration>, MailError>;
	}

	/** Resolves a declaration or a name to the mapped declaration and its loaded template. */
	async #load(
		email: AnyEmailDeclaration | string,
	): Promise<Result<{ declaration: AnyEmailDeclaration; template: AnyEmailTemplate }, MailError>> {
		let name = isEmailDeclaration(email) ? email.name : email;
		let entry = this.#mapped.get(name);
		if (entry === undefined) {
			return failure(new EmailRefusedError(`No template is mapped for the "${name}" email.`));
		}
		let template = await wrap(() => entry.template());
		if (isFailure(template)) {
			return failure(
				new MailError(`Failed to load the "${name}" email's template.`, {
					cause: template.error,
				}),
			);
		}
		return success({ declaration: entry.declaration, template: template.data });
	}

	/** The reader's language and translator, or the key-returning stand-in without a translator. */
	#translate(locale: string | undefined): EmailLocale {
		let translator = this.#options.translator;
		if (translator !== undefined) return translator(locale);
		return { locale: locale ?? "en", t: untranslated as EmailTranslate };
	}
}

/**
 * Creates the app's email registry.
 *
 * @param options - The translator; see {@link MailOptions}.
 * @returns The instance an initializer maps every declared email onto.
 * @example export const mail = createMail({ translator: translate });
 */
export function createMail(options: MailOptions = {}): Mail {
	return new Mail(options);
}

/**
 * A function resolving a binding to its template, importing a lazy one at most once per
 * isolate. A failed import is dropped, so the next send retries it.
 */
function resolver(
	email: AnyEmailDeclaration,
	template: AnyEmailTemplate | Lazy<AnyEmailTemplate>,
): () => Promise<AnyEmailTemplate> {
	if (!isLazy(template)) {
		check(email, template);
		return () => Promise.resolve(template);
	}

	let loading: Promise<AnyEmailTemplate> | undefined;
	return () => {
		loading ??= template.load().then(
			(module) => check(email, module.default),
			(error: unknown) => {
				loading = undefined;
				throw error;
			},
		);
		return loading;
	};
}

/**
 * Confirms a template renders the email it is mapped onto, so a module mapped under the wrong
 * name fails on its first load instead of sending the wrong copy.
 */
function check(email: AnyEmailDeclaration, template: AnyEmailTemplate): AnyEmailTemplate {
	if (template.email.name !== email.name) {
		throw new Error(
			`The template mapped for "${email.name}" was written for "${template.email.name}"`,
		);
	}
	return template;
}

/** Parses props with the declared schema, refusing them with every issue's message. */
async function parse(
	email: AnyEmailDeclaration,
	props: unknown,
): Promise<Result<unknown, MailError>> {
	let result = await (email.props as StandardSchemaV1)["~standard"].validate(props);
	if (result.issues === undefined) return success(result.value);
	let issues = result.issues.map((issue) => {
		let path = issue.path?.map((key) => (typeof key === "object" ? key.key : key)).join(".");
		return path ? `${path}: ${issue.message}` : issue.message;
	});
	return failure(
		new EmailRefusedError(`Invalid props for the "${email.name}" email: ${issues.join("; ")}`),
	);
}

/** The email one template reads from `input`, with the delivery's reply-to and headers on top. */
function build(
	declaration: AnyEmailDeclaration,
	template: AnyEmailTemplate,
	delivery: EmailDelivery,
	props: unknown,
	input: object & EmailLocale,
): ComposedEmail {
	let headers = template.headers?.(input);
	return {
		declaration,
		props,
		locale: input.locale,
		to: typeof delivery.to === "string" ? { email: delivery.to } : delivery.to,
		subject: template.subject(input),
		replyTo: delivery.replyTo ?? template.replyTo?.(input),
		headers: delivery.headers ? { ...headers, ...delivery.headers } : headers,
		unsubscribe: template.unsubscribe?.(input) as Unsubscribe | undefined,
		list: template.list?.(input) as MailingList | undefined,
		calendar: template.calendar?.(input) as CalendarPart | undefined,
		body: (): RemixElement => createElement(template.body, input),
	};
}

/**
 * Reports whether an email was composed from a declaration, and from which one when given,
 * which is how a test picks a sent message out of a memory transport.
 *
 * @param email - The `email` a normalized message carries.
 * @param declaration - The declared email it must come from.
 * @returns `true` for an email `Mail.compose()` built, from `declaration` when one is given.
 * @example transport.find((message) => isComposedEmail(message.email, emails.welcome));
 */
export function isComposedEmail<Declaration extends AnyEmailDeclaration>(
	email: Email | undefined,
	declaration?: Declaration,
): email is ComposedEmail<EmailPropsOutput<Declaration>> {
	if (email === undefined || !("declaration" in email)) return false;
	let composed = email as ComposedEmail;
	return declaration === undefined || composed.declaration.name === declaration.name;
}
