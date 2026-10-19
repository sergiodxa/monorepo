/**
 * `createEmail()`: what one declared email says and looks like, written in its own module and
 * mapped onto the registry. Every member reads the parsed props together with the reader's
 * locale and its translator, so copy is translated when the email renders.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Handle, RemixNode } from "remix/component";

import type { EmailDeclaration } from "./emails.js";
import type { Address, CalendarPart, MailingList, Unsubscribe } from "./types.js";

/**
 * Augmented by an app to type the translator its templates receive, so `t()` checks message
 * keys against the app's bundles.
 *
 * @example declare module "@sdxc/mail" { interface MailTypes { translate: Translate } }
 */
// oxlint-disable-next-line typescript/no-empty-object-type -- the seam apps augment
export interface MailTypes {}

/** The translator a template calls: the app's, or one keyed by any string until it declares its own. */
export type EmailTranslate = MailTypes extends { translate: infer Translate }
	? Translate
	: (key: string, values?: Record<string, unknown>) => string;

/** The language an email renders in, and the translator bound to it. */
export interface EmailLocale {
	/** The language the translator resolved, which the layout's `lang` should carry. */
	locale: string;
	t: EmailTranslate;
}

/**
 * What every member of a template receives: the parsed props with `locale` and `t` beside
 * them, so a body reads `handle.props.team` and `handle.props.t` from one object.
 *
 * @template Props - The props as the email's schema parses them.
 */
export type EmailInput<Props> = Props & EmailLocale;

/**
 * What one declared email says and looks like.
 *
 * @template Props - The props as the email's schema parses them.
 * @template Input - The props as a caller writes them, which `preview()` returns.
 */
export interface EmailTemplateOptions<Props, Input = Props> {
	/** Subject line, translated for the reader. */
	subject(input: EmailInput<Props>): string;
	/** Body component, rendered by the mailer into the HTML and plain-text parts. */
	body: (handle: Handle<EmailInput<Props>>) => () => RemixNode;
	/** Per-email reply-to; the mailer's configuration supplies the default. */
	replyTo?(input: EmailInput<Props>): Address | Address[] | undefined;
	/** Per-email headers, merged over the mailer's configured headers. */
	headers?(input: EmailInput<Props>): Record<string, string> | undefined;
	/** One-click unsubscribe for optional mail, built per reader since its URL names them. */
	unsubscribe?(input: EmailInput<Props>): Unsubscribe | undefined;
	/** List the email belongs to, written as `List-Id`. */
	list?(input: EmailInput<Props>): MailingList | undefined;
	/** A calendar object, such as an invitation, sent alongside the rendered body. */
	calendar?(input: EmailInput<Props>): CalendarPart | undefined;
	/**
	 * Sample props that show the email in a preview. Only previews read it, so an email
	 * without one still sends; its props pass through the schema like any caller's.
	 */
	preview?(): Input;
}

/**
 * A template paired with the email it was written for, which `map()` checks.
 *
 * @template Schema - The schema of the email's props.
 */
export interface EmailTemplate<
	Schema extends StandardSchemaV1 = StandardSchemaV1,
> extends EmailTemplateOptions<
	StandardSchemaV1.InferOutput<Schema>,
	StandardSchemaV1.InferInput<Schema>
> {
	readonly email: EmailDeclaration<Schema>;
}

/** A template whatever its props, for the places that hold any of them. */
// oxlint-disable-next-line typescript/no-explicit-any -- templates vary by schema
export type AnyEmailTemplate = EmailTemplate<any>;

/**
 * Pairs a template with its declared email; passing the declaration is what types the props
 * every member reads.
 *
 * @param email - The email this template renders, from the app's `emails()` map.
 * @param options - The subject, the body component and any per-email delivery options.
 * @returns The template, which the module default-exports for `mail.map()` to load.
 * @example export default createEmail(emails.welcome, { subject: ({ name, t }) => t("emails.welcome.subject", { name }), body: WelcomeBody });
 */
export function createEmail<Schema extends StandardSchemaV1>(
	email: EmailDeclaration<Schema>,
	options: EmailTemplateOptions<
		StandardSchemaV1.InferOutput<Schema>,
		StandardSchemaV1.InferInput<Schema>
	>,
): EmailTemplate<Schema> {
	return { ...options, email };
}
