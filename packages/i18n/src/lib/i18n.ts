/**
 * `createI18n`, the translator every entry point builds on: it resolves a dotted key through
 * the locale, its primary subtag, the fallback and the fallback's subtag, and formats the hit
 * as a MessageFormat 2 message compiled once per language and key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MessagePart } from "@sdxc/messageformat";

import { MessageFormat } from "@sdxc/messageformat";

/** A bundle of MessageFormat 2 messages for one language, nested by dotted key segment. */
export interface Messages {
	[key: string]: string | Messages;
}

/**
 * The dotted paths to every string leaf of `R`. A bundle with an index signature, such as the
 * untyped {@link Messages}, yields `string`, so any key type-checks.
 *
 * @template R - The bundle the keys are read from.
 */
export type MessageKey<R> = string extends keyof R
	? string
	: { [K in keyof R & string]: LeafKey<K, R[K]> }[keyof R & string];

/** The key `K` when `V` is a message, or `K.`-prefixed keys of `V` when it nests more. */
type LeafKey<K extends string, V> = V extends string
	? K
	: V extends object
		? `${K}.${MessageKey<V>}`
		: never;

/** Receives each error a message raises, with the key it was looked up by. */
export type I18nErrorHandler = (error: Error, key: string) => void;

/**
 * Formats the message at `key` as plain text; values interpolate raw, so escaping is the
 * renderer's job. A key with no message in any language of the chain returns the key.
 *
 * @template R - The bundle the key union is derived from.
 */
export type Translate<R = Messages> = (
	key: MessageKey<R>,
	values?: Record<string, unknown>,
) => string;

/**
 * Formats the message at `key` to MessageFormat parts, markup included, for a caller that
 * renders markup itself. A missing key yields one text part holding the key.
 *
 * @template R - The bundle the key union is derived from.
 */
export type TranslateParts<R = Messages> = (
	key: MessageKey<R>,
	values?: Record<string, unknown>,
) => MessagePart[];

/**
 * A translator fixed to one language. It holds no mutable state, so one instance serves a
 * whole request. Accept `I18n<any>` to take a translator whatever bundle types its keys.
 *
 * @template R - The fallback language's bundle, which types the keys.
 */
export interface I18n<R = Messages> {
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

	return {
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
}

/**
 * The languages a key resolves through, in order: the locale, its primary subtag, the
 * fallback and the fallback's primary subtag, deduplicated and limited to those with a bundle.
 */
function lookupChain(locale: string, fallback: string, resources: object): string[] {
	let candidates = new Set([locale, primary(locale), fallback, primary(fallback)]);
	return [...candidates].filter((language) => Object.hasOwn(resources, language));
}

/** The primary language subtag, `en` for `en-US`. */
function primary(locale: string) {
	return locale.split("-")[0] ?? locale;
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
	// oxlint-disable-next-line typescript/no-base-to-string -- matches `format`, which writes an unknown value with `String`
	if ("value" in part) return String(part.value ?? "");
	return "";
}

/** The handler used without `onError`: errors are discarded and the fallback text shows. */
function ignoreError() {}
