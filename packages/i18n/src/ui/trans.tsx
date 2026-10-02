/**
 * Renders a MessageFormat 2 message containing markup (`{#link}…{/link}`, `{#br/}`) as a
 * `RemixNode` tree, splicing in the `components` element whose key matches each markup name,
 * with the text between an open and its close as that element's children.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MessagePart } from "@sdxc/messageformat";
import type { Handle, RemixElement, RemixNode } from "remix/component";

import { createElement } from "remix/component";

import type { I18n } from "../lib/i18n.js";

import { partText } from "../lib/i18n.js";

import { intl } from "./intl-provider.js";

export namespace Trans {
	export interface Props {
		/**
		 * Translator to format through. Defaults to the nearest ancestor `IntlProvider`'s (via
		 * `intl`); pass one to translate through a different translator.
		 */
		intl?: I18n<any>;
		/**
		 * Message key to look up. Named `i18nKey` because `key` is `remix/component`'s own
		 * reconciliation prop and never reaches `handle.props`.
		 */
		i18nKey: string;
		/** Values for the message's variables. */
		values?: Record<string, unknown>;
		/** Elements spliced in for each markup name in the message, keyed by that name. */
		components?: Record<string, RemixElement>;
	}
}

/**
 * Markup with no matching `components` entry renders its children unwrapped and reports an
 * error through the translator's `onError`.
 *
 * @example
 * <Trans
 * 	i18nKey="feed.article"
 * 	values={{ title: item.title }}
 * 	components={{ articleLink: <Link href={item.link} /> }}
 * />
 */
export function Trans(handle: Handle<Trans.Props>) {
	return () => {
		let { i18nKey, values, components = {} } = handle.props;
		let translator = handle.props.intl ?? intl(handle);
		let parts = translator.parts(i18nKey, values);
		return foldParts(parts, components, (error) => translator.onError(error, i18nKey));
	};
}

/** An open markup element whose children are still being collected. */
interface Frame {
	name: string;
	children: RemixNode[];
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
	components: Record<string, RemixElement>,
	report: (error: Error) => void,
): RemixNode[] {
	let root: Frame = { name: "", children: [] };
	let stack: Frame[] = [root];

	/** Wraps `children` in the component named `name`, or returns them unwrapped with a report. */
	function wrap(name: string, children: RemixNode[]): RemixNode[] {
		let component = Object.hasOwn(components, name) ? components[name] : undefined;
		if (!component) {
			report(new Error(`Trans: no components["${name}"] entry for markup {#${name}}`));
			return children;
		}
		return [createElement(component.type, component.props, ...children)];
	}

	/** Pops the innermost frame and appends it, wrapped, to its parent. */
	function close() {
		let frame = stack.pop();
		let parent = stack.at(-1);
		if (frame && parent) parent.children.push(...wrap(frame.name, frame.children));
	}

	for (let part of parts) {
		let current = stack.at(-1) ?? root;
		if (part.type !== "markup" || !("kind" in part)) {
			let text = partText(part);
			if (text) current.children.push(text);
		} else if (part.kind === "open") {
			stack.push({ name: part.name, children: [] });
		} else if (part.kind === "standalone") {
			current.children.push(...wrap(part.name, []));
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
		if (stack[index]?.name === name) return index;
	}
	return -1;
}
