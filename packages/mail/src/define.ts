/**
 * `defineEmail()`: an email declared as its props, a subject and a body component, from
 * which the package builds the class the mailer sends. Every email built this way is its own
 * class, so a test still finds a sent message with `instanceof`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixElement, RemixNode } from "remix/component";

import { createElement } from "remix/component";

import type { Address, CalendarPart, Email, MailingList, Unsubscribe } from "./types.js";

/**
 * What an email says and looks like, written once per kind of email. Every member reads the
 * props one instance was built with, so the subject and the body never disagree.
 *
 * @template Props - The data one email is built from, already translated for its reader.
 */
export interface EmailDefinition<Props extends object> {
	/** Subject line, already in the reader's language. */
	subject(props: Props): string;
	/** Body component, rendered by the mailer into the HTML and plain-text parts. */
	body: (handle: Handle<Props>) => () => RemixNode;
	/** Per-email reply-to; the mailer's configuration supplies the default. */
	replyTo?(props: Props): Address | Address[] | undefined;
	/** Per-email headers, merged over the mailer's configured headers. */
	headers?(props: Props): Record<string, string> | undefined;
	/** One-click unsubscribe for optional mail, built per reader since its URL names them. */
	unsubscribe?(props: Props): Unsubscribe | undefined;
	/** List the email belongs to, written as `List-Id`. */
	list?(props: Props): MailingList | undefined;
	/** A calendar object, such as an invitation, sent alongside the rendered body. */
	calendar?(props: Props): CalendarPart | undefined;
}

/**
 * One email built by a {@link defineEmail} class, ready for `send()` or `later()`.
 *
 * @template Props - The data the email was built from.
 */
export interface DefinedEmail<Props extends object> extends Email {
	/** Recipients, normalized to addresses from whatever form the constructor received. */
	readonly to: Address | Address[];
	/** The data the email was built from, so a test can assert on what a caller passed. */
	readonly props: Props;
}

/**
 * The class `defineEmail()` returns. A bare string recipient is the mailbox alone, the
 * common case of mailing the address a record holds.
 *
 * @template Props - The data one email is built from.
 */
export interface EmailClass<Props extends object> {
	new (to: string | Address | Address[], props: Props): DefinedEmail<Props>;
}

/**
 * Builds an email class from its subject and body, so an email is its props and its markup.
 *
 * @param definition - The subject, the body component and any per-email delivery options.
 * @returns A class constructed with the recipient and the props, sendable by any mailer.
 * @example export const WelcomeEmail = defineEmail<WelcomeEmail.Props>({ subject: (props) => props.heading, body: WelcomeBody });
 * @example await mailer.send(new WelcomeEmail("ada@example.com", { heading: "Welcome" }));
 */
export function defineEmail<Props extends object>(
	definition: EmailDefinition<Props>,
): EmailClass<Props> {
	return class implements DefinedEmail<Props> {
		readonly to: Address | Address[];
		readonly props: Props;

		constructor(to: string | Address | Address[], props: Props) {
			this.to = typeof to === "string" ? { email: to } : to;
			this.props = props;
		}

		get subject(): string {
			return definition.subject(this.props);
		}

		get replyTo(): Address | Address[] | undefined {
			return definition.replyTo?.(this.props);
		}

		get headers(): Record<string, string> | undefined {
			return definition.headers?.(this.props);
		}

		get unsubscribe(): Unsubscribe | undefined {
			return definition.unsubscribe?.(this.props);
		}

		get list(): MailingList | undefined {
			return definition.list?.(this.props);
		}

		get calendar(): CalendarPart | undefined {
			return definition.calendar?.(this.props);
		}

		body(): RemixElement {
			return createElement(definition.body, this.props);
		}
	};
}
