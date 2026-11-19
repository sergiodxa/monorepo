/**
 * `createI18n`, the translator every entry point builds on: it resolves a dotted key through
 * every RFC 4647 Lookup truncation of the locale, then of the fallback, and formats the hit
 * as a MessageFormat 2 message compiled once per language and key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MessageParams, MessagePart } from "@sdxc/messageformat";

import { MessageFormat } from "@sdxc/messageformat";

import { lookupFallbacks } from "./parser.js";

/** A bundle of MessageFormat 2 messages for one language, nested by dotted key segment. */
export interface Messages {
	[key: string]: string | Messages;
}

/**
 * Augmented by an app to declare its fallback language's bundle once, which types the keys and
 * values of every translator the package hands out: `ctx.intl`, `createTranslator`, `intl()`,
 * `Trans`. Without it, every translator takes any key and any values.
 *
 * @example declare module "@sdxc/i18n" { interface I18nTypes { messages: typeof en } }
 */
// oxlint-disable-next-line typescript/no-empty-object-type -- the seam apps augment
export interface I18nTypes {}

/** The bundle an app declared through {@link I18nTypes}, or the untyped {@link Messages}. */
export type AppMessages = I18nTypes extends { messages: infer R } ? R : Messages;

/**
 * The shape another language's bundle must have to stand beside the fallback `R`: every key
 * `R` has and no other, each a string, so a missing or stale key fails to compile while the
 * text stays free to differ.
 *
 * @template R - The fallback language's bundle.
 * @example export default { cart: { empty: "Tu carrito está vacío" } } satisfies LocaleMessages<typeof en>;
 */
export type LocaleMessages<R> = {
	readonly [K in keyof R]: R[K] extends string ? string : LocaleMessages<R[K]>;
};

/**
 * The dotted paths to every string leaf of `R`. A bundle with an index signature, such as the
 * untyped {@link Messages}, yields `string`, so any key type-checks.
 *
 * @template R - The bundle the keys are read from.
 */
export type MessageKey<R> = string extends keyof R
	? string
	: { [K in keyof R & string]: LeafKey<K, R[K]> }[keyof R & string];

/**
 * The dotted paths to every subtree of `R`, the prefixes a caller can scope a translator to.
 * A bundle with an index signature yields `string`.
 *
 * @template R - The bundle the prefixes are read from.
 */
export type MessagePrefix<R> = string extends keyof R
	? string
	: {
			[K in keyof R & string]: R[K] extends string ? never : K | `${K}.${MessagePrefix<R[K]>}`;
		}[keyof R & string];

/** The key `K` when `V` is a message, or `K.`-prefixed keys of `V` when it nests more. */
type LeafKey<K extends string, V> = V extends string
	? K
	: V extends object
		? `${K}.${MessageKey<V>}`
		: never;

/** Receives each error a message raises, with the key it was looked up by. */
export type I18nErrorHandler = (error: Error, key: string) => void;

/**
 * The values argument for the message at `K` in `R`: required and typed by the message's
 * variables when its text is a string literal type, absent when it reads none, and any
 * values when the text widens to `string`. A union of keys takes values every message accepts.
 *
 * @template R - The bundle the message is read from.
 * @template K - The message's dotted key.
 */
export type MessageValues<R, K extends string> = ValuesArgument<
	UnionToIntersection<K extends string ? ParamsOf<MessageAt<R, K>> : never>
>;

/**
 * The message or subtree at dotted path `K` in `R`; a union of paths yields the union of what
 * each names, so `MessageKey<MessageAt<R, P>>` is the keys every subtree in `P` shares.
 *
 * @template R - The bundle the path is read from.
 * @template K - The dotted path, to a message or to a subtree.
 * @example type CartKey = MessageKey<MessageAt<typeof en, "cart">>; // "total" | "empty"
 */
export type MessageAt<R, K extends string> = K extends keyof R
	? R[K]
	: K extends `${infer Head}.${infer Tail}`
		? Head extends keyof R
			? MessageAt<R[Head], Tail>
			: never
		: never;

/** The values a message's text reads; text that is not a string reads any values. */
type ParamsOf<Text> = Text extends string ? MessageParams<Text> : Record<string, unknown>;

/** One object type every member of a union is assignable to. */
type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (
	value: infer I,
) => void
	? I
	: never;

/** The rest parameters taking `P`: optional when it has no named keys, forbidden keys when empty. */
type ValuesArgument<P> = [keyof P] extends [never]
	? [values?: Record<string, never>]
	: string extends keyof P
		? [values?: P]
		: [values: P];

/**
 * Formats the message at `key` as plain text; values interpolate raw, so escaping is the
 * renderer's job. A key with no message in any language of the chain returns the key.
 * With a typed bundle, `values` is typed by the message's text; see {@link MessageValues}.
 *
 * @template R - The bundle the key union and values are derived from; the app's declared one by default.
 */
export type Translate<R = AppMessages> = string extends keyof R
	? (key: string, values?: Record<string, unknown>) => string
	: <K extends MessageKey<R>>(key: K, ...values: MessageValues<R, K>) => string;

/**
 * Formats the message at `key` to MessageFormat parts, markup included, for a caller that
 * renders markup itself. A missing key yields one text part holding the key.
 *
 * @template R - The bundle the key union and values are derived from; the app's declared one by default.
 */
export type TranslateParts<R = AppMessages> = string extends keyof R
	? (key: string, values?: Record<string, unknown>) => MessagePart[]
	: <K extends MessageKey<R>>(key: K, ...values: MessageValues<R, K>) => MessagePart[];

/**
 * A translator fixed to one language. It holds no mutable state, so one instance serves a
 * whole request. Accept `I18n<any>` to take a translator whatever bundle types its keys.
 *
 * @template R - The fallback language's bundle, which types the keys; the app's declared one by default.
 */
export interface I18n<R = AppMessages> {
	/** The requested language; copy comes from the first language of its chain with the key. */
	readonly locale: string;
	t: Translate<R>;
	/** Parts for callers that render markup, such as `Trans`. */
	parts: TranslateParts<R>;
	/** Where message and rendering errors go; `Trans` reports unmatched markup here too. */
	onError: I18nErrorHandler;
}

/**
 * Options for {@link createI18n}.
 *
 * @template Resources - Bundles keyed by language.
 * @template Fallback - The fallback language, whose bundle types the keys.
 */
export interface I18nOptions<
	Resources extends Readonly<Record<string, Messages>> = Readonly<Record<string, Messages>>,
	Fallback extends keyof Resources & string = keyof Resources & string,
> {
	locale: string;
	/** The language whose bundle answers every key the locale's bundles lack. */
	fallbackLanguage: Fallback;
	/** Bundles keyed by language. Keep one object per app: compiled messages are cached on it. */
	resources: Resources;
	/** Receives syntax and formatting errors; without it errors are discarded. */
	onError?: I18nErrorHandler;
}

/** A compiled message, or the error its source raised, so a broken message compiles once. */
type Compiled = MessageFormat | Error;

/**
 * Compiled messages per resources object, keyed by language and key. Weakly held, so bundles
 * from different apps or tests never share entries and a dropped bundle frees its cache.
 */
const COMPILED = new WeakMap<object, Map<string, Compiled>>();

/**
 * Creates a translator for `locale`. It is synchronous and cheap, because messages compile on
 * first use and stay cached for every later translator over the same resources. Keys are typed
 * by the fallback language's bundle.
 *
 * @param options - Locale, fallback, bundles and error handler; see {@link I18nOptions}.
 * @returns The translator, fixed to `locale`.
 * @example let { t } = createI18n({ locale: "es-MX", fallbackLanguage: "en", resources: { en, es } });
 */
export function createI18n<
	Resources extends Readonly<Record<string, Messages>>,
	Fallback extends keyof Resources & string,
>(options: I18nOptions<Resources, Fallback>): I18n<Resources[Fallback]> {
	let { locale, fallbackLanguage, resources } = options;
	let onError = options.onError ?? ignoreError;
	let chain = lookupChain(locale, fallbackLanguage, resources);

	/** The compiled message for `key`, or `undefined` after reporting a broken or missing one. */
	function message(key: string): MessageFormat | undefined {
		let compiled = compile(resources, chain, key);
		if (compiled instanceof Error) {
			onError(compiled, key);
			return undefined;
		}
		return compiled;
	}

	let i18n: I18n<Messages> = {
		locale,
		onError,
		t(key, values) {
			let report = (error: Error) => onError(error, key);
			return message(key)?.format(values, report) ?? key;
		},
		parts(key, values) {
			let report = (error: Error) => onError(error, key);
			return message(key)?.formatToParts(values, report) ?? [{ type: "text", value: key }];
		},
	};
	return i18n as I18n<Resources[Fallback]>;
}

/**
 * Types a translator over the bundle the app declared through {@link I18nTypes}. The resources
 * a host was configured with are the app's own bundles, so their keys are the declared ones.
 *
 * @param i18n - A translator built over bundles typed as {@link Messages}.
 * @returns The same translator, typed by the app's bundle.
 */
export function declaredI18n(i18n: I18n<Messages>): I18n {
	return i18n as unknown as I18n;
}

/**
 * The bundles a key resolves through, in order: each Lookup truncation of the locale
 * (`zh-Hant-TW`, `zh-Hant`, `zh`), then of the fallback, matched to bundle names
 * case-insensitively, deduplicated and limited to those with a bundle.
 */
function lookupChain(locale: string, fallback: string, resources: object): string[] {
	let bundles = new Map(Object.keys(resources).map((name) => [name.toLowerCase(), name]));
	let chain = new Set<string>();
	for (let candidate of [...lookupFallbacks(locale), ...lookupFallbacks(fallback)]) {
		let bundle = bundles.get(candidate.toLowerCase());
		if (bundle !== undefined) chain.add(bundle);
	}
	return [...chain];
}

/**
 * Finds the first string leaf at `key` along `chain` and compiles it for the language it was
 * found in, reusing the cached result. Answers `undefined` when no language has the key.
 */
function compile(resources: object, chain: string[], key: string): Compiled | undefined {
	let cache = COMPILED.get(resources);
	if (!cache) {
		cache = new Map();
		COMPILED.set(resources, cache);
	}

	for (let language of chain) {
		let source = lookup((resources as Record<string, unknown>)[language], key);
		if (source === undefined) continue;

		let cacheKey = `${language}\u0000${key}`;
		let compiled = cache.get(cacheKey);
		if (!compiled) {
			try {
				compiled = new MessageFormat(language, source, { bidiIsolation: "none" });
			} catch (error) {
				compiled = error instanceof Error ? error : new Error(String(error));
			}
			cache.set(cacheKey, compiled);
		}
		return compiled;
	}

	return undefined;
}

/** Walks the dotted `key` through nested objects; only a string leaf counts as a hit. */
function lookup(bundle: unknown, key: string): string | undefined {
	let node = bundle;
	for (let segment of key.split(".")) {
		if (typeof node !== "object" || node === null || !Object.hasOwn(node, segment)) {
			return undefined;
		}
		node = (node as Record<string, unknown>)[segment];
	}
	return typeof node === "string" ? node : undefined;
}

/**
 * The text a part contributes to plain output, matching `MessageFormat#format`: markup adds
 * nothing and a failed placeholder shows as `{source}`.
 *
 * @param part - One part from `formatToParts`.
 * @returns Its text.
 */
export function partText(part: MessagePart): string {
	if (part.type === "markup") return "";
	if (part.type === "fallback" && "source" in part) return `{${part.source}}`;
	if ("parts" in part && Array.isArray(part.parts)) {
		return part.parts.map((item: { value: unknown }) => String(item.value)).join("");
	}
	if ("value" in part) {
		let value: unknown = part.value ?? "";
		return String(value);
	}
	return "";
}

/** The handler used without `onError`: errors are discarded and the fallback text shows. */
function ignoreError() {}
