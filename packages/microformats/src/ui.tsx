/**
 * Writes microformats from `remix/component` templates: typed class names as a mixin that sits
 * in `mix` beside the `css()` mixins, the same names as a `class` string, and a `<time>`
 * that carries an instant with its offset, so a misspelled class is a compile error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, Handle, MixinDescriptor, RemixNode } from "remix/component";

import { createElement, createMixin } from "remix/component";

/**
 * Groups the class-name types under a single import surface.
 */
export namespace MF2UI {
	/** Text properties of `h-entry`. */
	export type EntryText = "name" | "summary" | "author" | "category" | "location" | "rsvp";
	/** URL properties of `h-entry`, the response properties among them. */
	export type EntryUrl =
		| "url"
		| "uid"
		| "photo"
		| "in-reply-to"
		| "like-of"
		| "repost-of"
		| "bookmark-of"
		| "syndication";
	/** Text properties of `h-card`. */
	export type CardText = "name" | "nickname" | "org" | "note" | "locality" | "country-name";
	/** URL properties of `h-card`. */
	export type CardUrl = "url" | "uid" | "photo" | "email";
	/** The roots written out, and the specification's `h-x-` vendor escape. */
	export type Root =
		| "h-entry"
		| "h-card"
		| "h-feed"
		| "h-cite"
		| "h-event"
		| "h-adr"
		| `h-x-${string}`;
	/** A property class, its prefix fixing the kind the vocabulary gives the name. */
	export type Property =
		| `p-${EntryText | CardText}`
		| `u-${EntryUrl | CardUrl}`
		| `dt-${"published" | "updated" | "start" | "end" | "bday"}`
		| `e-${"content" | "note"}`
		| `${"p" | "u" | "dt" | "e"}-x-${string}`;
	/** Any class name {@link mf} and {@link classes} accept. */
	export type ClassName = Root | Property;
}

/**
 * Appends the tokens to the host's `className`, after whatever a `css()` mixin or the
 * host itself put there, since the runtime merges `class` and `className` on render.
 */
const mfMixin = createMixin<Element, [names: MF2UI.ClassName[]], ElementProps>(
	(handle) => (names, props) => {
		let tokens = classes(...names);
		if (tokens === "") return handle.element;
		let current = typeof props.className === "string" ? props.className : "";
		return createElement(handle.element, {
			...props,
			className: current === "" ? tokens : `${current} ${tokens}`,
		});
	},
);

/**
 * A mixin adding microformats class tokens to its host; an unknown name is a type error.
 * It reaches through any component that forwards `mix` to its host element.
 *
 * @example <article mix={[mf("h-entry"), css({ padding: 16 })]}>…</article>
 * @example <Link href={post.url} mix={[mf("u-url", "u-uid")]}>{post.title}</Link>
 */
export function mf(...names: MF2UI.ClassName[]): MixinDescriptor {
	return mfMixin(names) as unknown as MixinDescriptor;
}

/**
 * The same tokens as a `class` string, each once, for markup produced outside a
 * component tree.
 *
 * @example classes("p-author", "h-card") // "p-author h-card"
 */
export function classes(...names: MF2UI.ClassName[]): string {
	return [...new Set(names)].join(" ");
}

/**
 * A `<time>` carrying a `dt-*` class and an ISO `datetime`, so parsers read an instant
 * with its offset. The visible text is the children, or the ISO string when there are none.
 *
 * @example <MicroTime property="dt-published" value={post.publishedAt}>{label}</MicroTime>
 */
export function MicroTime(
	handle: Handle<{
		property: `dt-${string}`;
		value: Date;
		children?: RemixNode;
	}>,
): () => RemixNode {
	return () => {
		let { property, value, children } = handle.props;
		let iso = value.toISOString();
		return (
			<time className={property} datetime={iso}>
				{children ?? iso}
			</time>
		);
	};
}
