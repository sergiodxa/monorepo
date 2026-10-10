/**
 * What the board's model callbacks read as properties. Every binding supplies these, so a
 * callback that mails or enqueues in the visitor's language never sees an undefined locale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type {} from "@sdxc/data-model";

declare module "@sdxc/data-model" {
	interface ModelContext {
		/** The language the invocation answers in, which the confirmation email is written in. */
		locale: string;
	}
}

export {};
