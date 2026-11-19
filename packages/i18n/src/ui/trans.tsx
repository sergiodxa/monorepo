/**
 * Renders a MessageFormat 2 message containing markup (`{#link href=$url}…{/link}`, `{#br/}`)
 * as a `RemixNode` tree, splicing in the `components` entry whose key matches each markup name,
 * with the text between an open and its close as its children and the markup's options as props.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MessageMarkupPart, MessagePart } from "@sdxc/messageformat";
import type { Handle, RemixElement, RemixNode } from "remix/component";

import { createElement } from "remix/component";

import type { AppMessages, I18n, MessageKey, MessageValues } from "../lib/i18n.js";

import { partText } from "../lib/i18n.js";

import { intl } from "./intl-provider.js";

export namespace Trans {
	/**
	 * Props for the message at `K`: `values` is required and typed by the message's variables
	 * when the app declares its bundle, and takes any values when it does not.
	 *
	 * @template K - The message key, inferred from `i18nKey`.
	 */
	export type Props<K extends MessageKey<AppMessages> = MessageKey<AppMessages>> = KeyProps<K> &
		ValuesProp<MessageValues<AppMessages, K>>;

	/** The props every message takes, whatever its variables. */
	export interface KeyProps<K extends string> {
		/**
		 * Translator to format through. Defaults to the nearest ancestor `IntlProvider`'s (via
		 * `intl`); pass one to translate through a different translator.
		 */
		intl?: I18n<any>;
		/**
		 * Message key to look up. Named `i18nKey` because `key` is `remix/component`'s own
		 * reconciliation prop and never reaches `handle.props`.
		 */
		i18nKey: K;
		/**
		 * What each markup name in the message renders as, keyed by that name: an element, which
		 * takes the markup's options as props it does not set itself, or a component, which
		 * receives them as {@link MarkupProps}.
		 */
		components?: Record<string, RemixElement | MarkupComponent>;
	}

	/** What a component in `components` receives for one markup. */
	export interface MarkupProps {
		/** The markup name, so one component can serve several. */
		name: string;
		/**
		 * The open or standalone markup's options: literals as strings, variables as the values
		 * passed for them. The `u:id` option arrives as `id`.
		 */
		options: Record<string, unknown>;
		/** The message content between the open and its close; empty for standalone markup. */
		children?: RemixNode;
	}

	/** A component that renders one markup from its name, options and content. */
	export type MarkupComponent = (handle: Handle<MarkupProps>) => () => RemixNode;

	/** `values` as `t()` takes them: required exactly when the message's arguments are. */
	export type ValuesProp<Values extends unknown[]> = Values extends [values: infer V]
		? { values: V }
		: Values extends [values?: infer V]
			? { values?: V }
			: never;
}

/**
 * Markup with no matching `components` entry renders its children unwrapped and reports an
 * error through the translator's `onError`. A prop the element sets wins over an option of the
 * same name, so the message fills in only what the code leaves open.
 *
 * @example
 * <Trans
 * 	i18nKey="feed.article"
 * 	values={{ title: item.title, url: item.link }}
 * 	components={{ articleLink: <Link /> }}
 * />
 * @example <Trans i18nKey="line.intro" components={{ pause: Pause, speed: Speed }} />
 */
export function Trans<K extends MessageKey<AppMessages>>(handle: Handle<Trans.Props<K>>) {
	return () => {
		let {
			i18nKey,
			values,
			components = {},
		} = handle.props as Trans.KeyProps<K> & {
			values?: Record<string, unknown>;
		};
		let translator: I18n<any> = handle.props.intl ?? intl(handle);
		let parts = translator.parts(i18nKey, values);
		return foldParts(parts, components, (error) => translator.onError(error, i18nKey));
	};
}

/** An open markup element whose children are still being collected. */
interface Frame {
	markup: MessageMarkupPart | undefined;
	children: RemixNode[];
}

/**
 * Prop names an option never sets on a host element: the renderer's own props, raw HTML, and
 * inline event handlers, so a message can only add plain attributes.
 */
const RESERVED_HOST_PROPS = new Set(["children", "key", "mix", "innerHTML", "srcDoc", "srcdoc"]);

/**
 * A markup's options as `MarkupProps.options` carries them, with `u:id` folded in as `id`.
 *
 * @param markup - An open or standalone markup part.
 * @returns A fresh record the caller may hand to a component.
 */
function markupOptions(markup: MessageMarkupPart): Record<string, unknown> {
	let options: Record<string, unknown> = { ...markup.options };
	if (markup.id !== undefined) options.id = markup.id;
	return options;
}

/**
 * Merges a markup's options into an element's props. The element's own props win; a host
 * element takes strings, numbers and booleans as they are, anything else as its string, and
 * never a reserved or `on*` name; a component element takes every option's value as it is.
 *
 * @param element - The `components` entry.
 * @param options - The markup's options.
 * @returns The props to render the element with.
 */
function mergeOptions(element: RemixElement, options: Record<string, unknown>) {
	let host = typeof element.type === "string";
	let props: Record<string, unknown> = {};
	for (let [name, value] of Object.entries(options)) {
		if (value === null || value === undefined || Object.hasOwn(element.props, name)) continue;
		if (!host) props[name] = value;
		else if (RESERVED_HOST_PROPS.has(name) || /^on/i.test(name)) continue;
		else props[name] = attributeValue(value);
	}
	return { ...props, ...element.props };
}

/**
 * A value as a host attribute takes it: strings, numbers and booleans as they are, so `false`
 * omits a boolean attribute, and anything else through its own `toString()`.
 */
function attributeValue(value: unknown): string | number | boolean {
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return value;
	}
	let object: { toString(): string } = Object(value);
	return object.toString();
}

/**
 * Folds flat parts into a tree: an open part starts a frame, its close wraps the frame's
 * children in the matching component, and a standalone part renders the component with no
 * children. A close with no open is dropped, and frames still open at the end close there.
 *
 * @param parts - Parts from `I18n#parts`.
 * @param components - Elements by markup name.
 * @param report - Receives an error per markup name with no component.
 * @returns The rendered nodes.
 */
function foldParts(
	parts: MessagePart[],
	components: Record<string, RemixElement | Trans.MarkupComponent>,
	report: (error: Error) => void,
): RemixNode[] {
	let root: Frame = { markup: undefined, children: [] };
	let stack: Frame[] = [root];

	/**
	 * Wraps `children` in the entry for the markup's name, passing it the markup's options, or
	 * returns them unwrapped with a report.
	 */
	function wrap(markup: MessageMarkupPart, children: RemixNode[]): RemixNode[] {
		let { name } = markup;
		let entry = Object.hasOwn(components, name) ? components[name] : undefined;
		if (!entry) {
			report(new Error(`Trans: no components["${name}"] entry for markup {#${name}}`));
			return children;
		}
		let options = markupOptions(markup);
		if (typeof entry === "function") return [createElement(entry, { name, options }, ...children)];
		return [createElement(entry.type, mergeOptions(entry, options), ...children)];
	}

	/** Pops the innermost frame and appends it, wrapped, to its parent. */
	function close() {
		let frame = stack.pop();
		let parent = stack.at(-1);
		if (frame?.markup && parent) parent.children.push(...wrap(frame.markup, frame.children));
	}

	for (let part of parts) {
		let current = stack.at(-1) ?? root;
		if (part.type !== "markup" || !("kind" in part)) {
			let text = partText(part);
			if (text) current.children.push(text);
		} else if (part.kind === "open") {
			stack.push({ markup: part, children: [] });
		} else if (part.kind === "standalone") {
			current.children.push(...wrap(part, []));
		} else {
			let index = openFrame(stack, part.name);
			while (index > 0 && stack.length > index) close();
		}
	}

	while (stack.length > 1) close();
	return root.children;
}

/** The index of the innermost open frame named `name`, or `-1` when none is open. */
function openFrame(stack: Frame[], name: string) {
	for (let index = stack.length - 1; index > 0; index--) {
		if (stack[index]?.markup?.name === name) return index;
	}
	return -1;
}
