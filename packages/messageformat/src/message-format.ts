/**
 * `MessageFormat`, a ponyfill of the TC39 `Intl.MessageFormat` proposal: a message is parsed
 * and validated once at construction, then formatted to a string or to parts any number of
 * times, with MessageFormat 2 fallbacks standing in for whatever fails to resolve.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";

import type { Declaration, Expression, Markup, MessageData, Pattern } from "./data-model.js";
import type { DefaultFunction, FunctionContext } from "./functions.js";
import type {
	Direction,
	MessageBidiIsolationPart,
	MessageFunction,
	MessageMarkupPart,
	MessagePart,
	MessageValue,
} from "./values.js";

import { localeDirection } from "./direction.js";
import { MessageError } from "./errors.js";
import { DEFAULT_FUNCTIONS } from "./functions.js";
import { parse } from "./parse.js";
import { validate } from "./validate.js";
import { fallbackValue, isFallback, unknownValue } from "./values.js";

/** Options for the {@link MessageFormat} constructor. */
export interface MessageFormatOptions {
	/**
	 * `compatibility` wraps placeholders whose direction may differ from the message's in
	 * Unicode isolate controls; `none` leaves output untouched.
	 * @default "compatibility"
	 */
	bidiIsolation?: "compatibility" | "none";
	/** The message's base direction. @default the direction of the first locale's script */
	dir?: Direction;
	/** Custom functions by name (`"ns:name"` included); they take precedence over the defaults. */
	functions?: Record<string, MessageFunction>;
	/** @default "best fit" */
	localeMatcher?: "best fit" | "lookup";
}

/** The options a {@link MessageFormat} settled on. */
export interface ResolvedMessageFormatOptions {
	bidiIsolation: "compatibility" | "none";
	dir: Direction;
	/** The custom functions passed to the constructor. */
	functions: Record<string, MessageFunction>;
	localeMatcher: "best fit" | "lookup";
}

/** Receives each error found while formatting; the output uses a fallback in its place. */
export type MessageErrorHandler = (error: Error) => void;

/** The Unicode isolate controls. */
const LRI = "\u2066";
const RLI = "\u2067";
const FSI = "\u2068";
const PDI = "\u2069";

/** A resolved value together with the `u:` options applied to its expression. */
interface Resolved {
	value: MessageValue;
	/** Set by `u:dir`: the value is isolated even when its direction matches the message. */
	isolate: boolean;
	id: string | undefined;
}

/** What a variable resolves to: a resolved value, an external value, or nothing. */
type Bound = { kind: "value"; resolved: Resolved } | { kind: "raw"; value: unknown } | undefined;

/** Per-call state: the input values, lazily evaluated declarations and the error sink. */
interface Scope {
	values: Record<string, unknown>;
	locals: Map<string, Bound>;
	onError: MessageErrorHandler;
}

/**
 * A compiled MessageFormat 2 message for a locale. Instances are immutable, so one can be
 * shared across requests. The constructor throws a {@link MessageError} on a syntax or data
 * model error, as the proposal specifies; use `parse` to check a message without throwing.
 *
 * @example new MessageFormat("en", "{$count :number} new posts").format({ count: 1200 }); // "1,200 new posts"
 */
export class MessageFormat {
	readonly #locales: string[];
	readonly #message: MessageData;
	readonly #declarations: Map<string, Declaration>;
	readonly #options: ResolvedMessageFormatOptions;

	/**
	 * @param locales A BCP 47 tag or a list of them; the runtime default when omitted.
	 * @param source MessageFormat 2 source, or a data model object.
	 * @param options Bidi isolation, base direction and custom functions.
	 * @throws {MessageError} When the source has a syntax or data model error.
	 */
	constructor(
		locales: string | string[] | undefined,
		source: MessageData | string,
		options: MessageFormatOptions = {},
	) {
		let requested = Intl.getCanonicalLocales(locales);
		this.#locales =
			requested.length > 0 ? requested : [new Intl.NumberFormat().resolvedOptions().locale];
		let result = typeof source === "string" ? parse(source) : validate(structuredClone(source));
		if (isFailure(result)) throw result.error;
		this.#message = result.data;
		this.#declarations = new Map(result.data.declarations.map((item) => [item.name, item]));
		this.#options = Object.freeze({
			bidiIsolation: options.bidiIsolation ?? "compatibility",
			dir: options.dir ?? localeDirection(this.#locales[0] ?? "und"),
			functions: Object.freeze({ ...options.functions }),
			localeMatcher: options.localeMatcher ?? "best fit",
		});
	}

	/**
	 * Formats the message to a string. Markup formats as nothing, and a placeholder that
	 * fails formats as `{source}`, such as `{$name}`, after the error reaches `onError`.
	 *
	 * @param values Values for the message's external variables.
	 * @param onError Receives each error; without it errors are discarded and only the fallback shows.
	 */
	format(values?: Record<string, unknown>, onError?: MessageErrorHandler): string {
		let output = "";
		for (let part of this.#resolve(values, onError)) {
			if (part.kind === "text") output += part.value;
			else if (part.kind === "value") {
				let text: string;
				let dir = part.resolved.value.dir;
				try {
					let value = part.resolved.value.toString?.();
					if (typeof value !== "string") throw notFormattable(part.resolved.value.source);
					text = value;
				} catch (error) {
					part.scope.onError(asMessageError(error, part.resolved.value.source));
					text = `{${part.resolved.value.source}}`;
					dir = "auto";
				}
				let [start, end] = this.#isolation(dir, part.resolved.isolate);
				output += start + text + end;
			}
		}
		return output;
	}

	/**
	 * Formats the message to parts: text, one part per placeholder wrapped in
	 * `bidiIsolation` parts when needed, and `markup` parts for the caller to render.
	 *
	 * @param values Values for the message's external variables.
	 * @param onError Receives each error; without it errors are discarded and only the fallback shows.
	 */
	formatToParts(values?: Record<string, unknown>, onError?: MessageErrorHandler): MessagePart[] {
		let parts: MessagePart[] = [];
		for (let part of this.#resolve(values, onError)) {
			if (part.kind === "text") parts.push({ type: "text", value: part.value });
			else if (part.kind === "markup") parts.push(part.part);
			else {
				let { value, isolate, id } = part.resolved;
				let dir = value.dir;
				let produced: MessagePart[];
				try {
					let result = value.toParts?.();
					if (!Array.isArray(result)) throw notFormattable(value.source);
					produced = result.map((item) => decoratePart(item, id, isolate ? dir : undefined));
				} catch (error) {
					part.scope.onError(asMessageError(error, value.source));
					produced = [{ type: "fallback", source: value.source }];
					dir = "auto";
				}
				let [start, end] = this.#isolation(dir, isolate);
				if (start) parts.push({ type: "bidiIsolation", value: start } as MessageBidiIsolationPart);
				parts.push(...produced);
				if (end) parts.push({ type: "bidiIsolation", value: end } as MessageBidiIsolationPart);
			}
		}
		return parts;
	}

	/** The options this instance settled on. */
	resolvedOptions(): ResolvedMessageFormatOptions {
		return { ...this.#options };
	}

	/**
	 * Selects the pattern and resolves each of its elements, in order.
	 *
	 * @yields Text, resolved markup parts, and resolved placeholder values with their scope.
	 */
	*#resolve(values: Record<string, unknown> = {}, onError?: MessageErrorHandler) {
		let scope: Scope = { values, locals: new Map(), onError: onError ?? ignoreError };
		for (let element of this.#select(scope)) {
			if (typeof element === "string") yield { kind: "text" as const, value: element };
			else if (element.type === "markup") {
				yield { kind: "markup" as const, part: this.#markup(element, scope) };
			} else {
				yield { kind: "value" as const, resolved: this.#placeholder(element, scope), scope };
			}
		}
	}

	/** Pattern selection: the best variant whose keys each match their selector or are `*`. */
	#select(scope: Scope): Pattern {
		let message = this.#message;
		if (message.type === "message") return message.pattern;
		let matches = message.selectors.map((selector, index) => {
			let keys = new Set<string>();
			for (let variant of message.variants) {
				let key = variant.keys[index];
				if (key && key.type !== "*") keys.add(key.value.normalize("NFC"));
			}
			return this.#selectKeys(selector.name, [...keys], scope);
		});
		let best: number[] | undefined;
		let bestPattern: Pattern = [];
		for (let variant of message.variants) {
			let ranks: number[] = [];
			let matched = variant.keys.every((key, index) => {
				if (key.type === "*") {
					ranks.push(Number.POSITIVE_INFINITY);
					return true;
				}
				let rank = matches[index]?.indexOf(key.value.normalize("NFC")) ?? -1;
				ranks.push(rank);
				return rank >= 0;
			});
			if (!matched) continue;
			if (!best || isBetter(ranks, best)) {
				best = ranks;
				bestPattern = variant.value;
			}
		}
		return bestPattern;
	}

	/** The selector's matching keys, best first; empty after reporting a bad selector. */
	#selectKeys(name: string, keys: string[], scope: Scope): string[] {
		let bound = this.#variable(name, scope);
		let value = bound?.kind === "value" ? bound.resolved.value : undefined;
		let selected = value && !isFallback(value) ? trySelectKeys(value, keys) : undefined;
		if (selected) return selected;
		scope.onError(
			new MessageError("bad-selector", `\`$${name}\` does not support selection`, {
				source: `$${name}`,
			}),
		);
		return [];
	}

	/** Resolves a placeholder expression to a formattable value. */
	#placeholder(expression: Expression, scope: Scope): Resolved {
		if (expression.function) return this.#call(expression, scope);
		let arg = expression.arg;
		if (arg?.type === "literal") {
			return this.#call(expression, scope, "string");
		}
		let source = `$${arg?.name ?? ""}`;
		let bound = arg ? this.#variable(arg.name, scope) : undefined;
		if (bound?.kind === "value") {
			if (isFallback(bound.resolved.value)) return plain(fallbackValue(source));
			return bound.resolved;
		}
		if (bound === undefined) return plain(fallbackValue(source));
		let raw = bound.value;
		if (typeof raw === "number" || typeof raw === "bigint" || raw instanceof Number) {
			return this.#call(expression, scope, "number");
		}
		if (typeof raw === "string" || raw instanceof String) {
			return this.#call(expression, scope, "string");
		}
		return plain(unknownValue(source, this.#locales[0] ?? "und", raw));
	}

	/**
	 * Resolves a variable: a declaration is evaluated on first use and cached, so each
	 * expression runs at most once per call; anything else is looked up in the input values.
	 */
	#variable(name: string, scope: Scope): Bound {
		if (scope.locals.has(name)) return scope.locals.get(name);
		let declaration = this.#declarations.get(name);
		if (!declaration) return lookup(name, scope);
		let bound: Bound;
		if (declaration.type === "input") {
			bound = lookup(name, scope);
			if (declaration.value.function) {
				scope.locals.set(name, bound);
				bound = { kind: "value", resolved: this.#call(declaration.value, scope) };
			}
			if (bound === undefined) {
				bound = { kind: "value", resolved: plain(fallbackValue(`$${name}`)) };
			}
		} else if (declaration.value.function) {
			bound = { kind: "value", resolved: this.#call(declaration.value, scope) };
		} else if (declaration.value.arg?.type === "literal") {
			bound = { kind: "raw", value: declaration.value.arg.value };
		} else {
			bound = this.#variable(declaration.value.arg?.name ?? "", scope) ?? {
				kind: "value",
				resolved: plain(fallbackValue(`$${declaration.value.arg?.name ?? name}`)),
			};
		}
		scope.locals.set(name, bound);
		return bound;
	}

	/**
	 * Function resolution: resolves the operand and options, calls the function (the
	 * expression's own, or `fallbackName` for an unannotated placeholder) and applies the
	 * `u:dir` and `u:id` options. Any failure reports an error and yields a fallback.
	 */
	#call(expression: Expression, scope: Scope, fallbackName?: string): Resolved {
		let arg = expression.arg;
		let name = expression.function?.name ?? fallbackName ?? "string";
		let source =
			arg?.type === "literal"
				? `|${arg.value.replaceAll("\\", "\\\\").replaceAll("|", "\\|")}|`
				: arg
					? `$${arg.name}`
					: `:${name}`;
		let input: unknown;
		if (arg?.type === "literal") input = arg.value;
		else if (arg) input = this.#operand(arg.name, scope);

		let custom = this.#options.functions;
		let fn: MessageFunction | DefaultFunction | undefined = Object.hasOwn(custom, name)
			? custom[name]
			: Object.hasOwn(DEFAULT_FUNCTIONS, name)
				? DEFAULT_FUNCTIONS[name]
				: undefined;
		if (!fn) {
			scope.onError(
				new MessageError("unknown-function", `Unknown function \`:${name}\``, { source }),
			);
			return plain(fallbackValue(source));
		}

		let { options, literalKeys } = this.#resolveOptions(expression.function?.options, scope);
		let dir: Direction | undefined;
		let id: string | undefined;
		if ("u:dir" in options) {
			let value = String(options["u:dir"]);
			if (value === "ltr" || value === "rtl" || value === "auto") dir = value;
			else if (value !== "inherit") {
				scope.onError(new MessageError("bad-option", "Invalid `u:dir`", { source }));
			}
			delete options["u:dir"];
		}
		if ("u:id" in options) {
			id = String(unwrap(options["u:id"]));
			delete options["u:id"];
		}

		let context: FunctionContext = {
			locales: [...this.#locales],
			dir: this.#options.dir,
			source,
			literalOptionKeys: literalKeys,
			onError: (error) => scope.onError(error),
		};
		let value: unknown;
		try {
			value = (fn as DefaultFunction)(context, options, ...(arg ? [input] : []));
		} catch (error) {
			scope.onError(asMessageError(error, source));
			return plain(fallbackValue(source));
		}
		if (typeof value !== "object" || value === null) {
			scope.onError(new MessageError("function-error", "Function returned no value", { source }));
			return plain(fallbackValue(source));
		}
		let result = value as MessageValue;
		if (dir) result = Object.create(result, { dir: { value: dir, enumerable: true } });
		return { value: result, isolate: dir !== undefined, id };
	}

	/** A variable as a function operand: a declaration's resolved value, or the external value. */
	#operand(name: string, scope: Scope): unknown {
		let bound = this.#variable(name, scope);
		if (bound === undefined) return undefined;
		return bound.kind === "value" ? bound.resolved.value : bound.value;
	}

	/**
	 * Option resolution: literals as strings, variables as their resolved or external value.
	 * An option whose variable fails to resolve is left out.
	 */
	#resolveOptions(source: Record<string, { type: string }> | undefined, scope: Scope) {
		let options: Record<string, unknown> = {};
		let literalKeys = new Set<string>();
		for (let [name, value] of Object.entries(source ?? {})) {
			let option = value as { type: "literal"; value: string } | { type: "variable"; name: string };
			if (option.type === "literal") {
				options[name] = option.value;
				literalKeys.add(name);
				continue;
			}
			let bound = this.#variable(option.name, scope);
			if (bound === undefined) continue;
			if (bound.kind === "raw") options[name] = bound.value;
			else if (!isFallback(bound.resolved.value)) options[name] = bound.resolved.value;
		}
		return { options, literalKeys };
	}

	/** Markup resolution: always succeeds, dropping `u:dir` with an error and moving `u:id` out. */
	#markup(markup: Markup, scope: Scope): MessageMarkupPart {
		let source =
			markup.kind === "close"
				? `/${markup.name}`
				: markup.kind === "open"
					? `#${markup.name}`
					: `#${markup.name}/`;
		let { options } = this.#resolveOptions(markup.options, scope);
		let part: MessageMarkupPart = { type: "markup", kind: markup.kind, source, name: markup.name };
		if ("u:dir" in options) {
			scope.onError(new MessageError("bad-option", "`u:dir` is not allowed on markup", { source }));
			delete options["u:dir"];
		}
		if ("u:id" in options) {
			part.id = String(unwrap(options["u:id"]));
			delete options["u:id"];
		}
		let entries = Object.entries(options).map(([name, value]) => [name, unwrap(value)]);
		if (entries.length > 0) part.options = Object.fromEntries(entries);
		return part;
	}

	/** The isolate controls to put around a placeholder of direction `dir`. */
	#isolation(
		dir: Direction,
		isolate: boolean,
	): [MessageBidiIsolationPart["value"] | "", "" | typeof PDI] {
		if (this.#options.bidiIsolation === "none") return ["", ""];
		if (!isolate && dir !== "auto" && dir === this.#options.dir) return ["", ""];
		if (dir === "ltr") return [LRI, PDI];
		if (dir === "rtl") return [RLI, PDI];
		return [FSI, PDI];
	}
}

/** Whether one variant's key ranks beat another's, comparing the first selector first. */
function isBetter(ranks: number[], best: number[]) {
	for (let index = 0; index < ranks.length; index++) {
		let a = ranks[index] ?? 0;
		let b = best[index] ?? 0;
		if (a !== b) return a < b;
	}
	return false;
}

/** Looks up an external value, reporting an unresolved variable when it is missing. */
function lookup(name: string, scope: Scope): Bound {
	let values = scope.values;
	if (Object.hasOwn(values, name)) return { kind: "raw", value: values[name] };
	for (let key of Object.keys(values)) {
		if (key.normalize("NFC") === name) return { kind: "raw", value: values[key] };
	}
	scope.onError(
		new MessageError("unresolved-variable", `Variable \`$${name}\` has no value`, {
			source: `$${name}`,
		}),
	);
	return undefined;
}

/**
 * Calls a value's `selectKeys`, keeping only keys that were offered; `undefined` when the
 * value cannot select or its `selectKeys` throws, which the caller reports as a bad selector.
 */
function trySelectKeys(value: MessageValue, keys: string[]) {
	if (typeof value.selectKeys !== "function") return undefined;
	try {
		let selected = value.selectKeys(keys);
		return Array.isArray(selected) ? selected.filter((key) => keys.includes(key)) : undefined;
	} catch {
		return undefined;
	}
}

/** A resolved value without `u:` options. */
function plain(value: MessageValue): Resolved {
	return { value, isolate: false, id: undefined };
}

/** An option value as markup parts expose it: a resolved value's `valueOf()`, anything else as is. */
function unwrap(value: unknown) {
	if (typeof value === "object" && value !== null && "valueOf" in value) {
		let valueOf = (value as { valueOf: unknown }).valueOf;
		if (typeof valueOf === "function") return valueOf.call(value);
	}
	return value;
}

/** Adds `id` and an explicit `dir` to a placeholder's parts, leaving text parts alone. */
function decoratePart(part: MessagePart, id: string | undefined, dir: Direction | undefined) {
	if (part.type === "text" || part.type === "bidiIsolation") return part;
	if (id === undefined && (dir === undefined || dir === "auto")) return part;
	let decorated: Record<string, unknown> = { ...part };
	if (id !== undefined) decorated.id = id;
	if (dir !== undefined && dir !== "auto") decorated.dir = dir;
	return decorated as unknown as MessagePart;
}

/** The error for a value that cannot be formatted. */
function notFormattable(source: string) {
	return new MessageError("not-formattable", "Value cannot be formatted", { source });
}

/** Keeps a {@link MessageError} as thrown and wraps anything else as a `function-error`. */
function asMessageError(error: unknown, source: string) {
	if (error instanceof MessageError) return error;
	let message = error instanceof Error ? error.message : String(error);
	return new MessageError("function-error", message, { source, cause: error });
}

/**
 * The handler used without `onError`: the fallback text is the only report, so formatting
 * stays silent and free of any logging dependency in every runtime, the browser included.
 */
function ignoreError() {}
