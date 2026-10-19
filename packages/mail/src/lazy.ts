/**
 * Marks an email template as a module imported on first use, so a Worker starts without the
 * body of every email it can send and the first send of one pays for its import once per
 * isolate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Brands a loader so `map()` can tell it from a template it holds directly. */
const LAZY = Symbol.for("@sdxc/mail.lazy");

/** A template that arrives as the default export of a module imported on demand. */
export interface Lazy<Target> {
	readonly [LAZY]: true;
	/** Imports the module; `Mail` calls it once per isolate and shares the result. */
	readonly load: () => Promise<{ default: Target }>;
}

/**
 * Wraps a dynamic import so `map()` defers it to the first send of that email.
 *
 * @param load A function returning the module's `import()`; the module default-exports what `createEmail()` returns.
 * @returns A binding `mail.map()` accepts wherever it takes a template.
 * @example mail.map(emails.welcome, lazy(() => import("~/app/emails/welcome")));
 */
export function lazy<Target>(load: () => Promise<{ default: Target }>): Lazy<Target> {
	return { [LAZY]: true, load };
}

/** Reports whether a `map()` argument was wrapped by {@link lazy}. */
export function isLazy(value: unknown): value is Lazy<unknown> {
	return typeof value === "object" && value !== null && LAZY in value;
}
