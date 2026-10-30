/**
 * The label above a marketing headline, shared by band headers, the hero and the
 * announcement chip so every label on a page draws from one set of looks. Given an
 * `href` it renders a link with a trailing arrow that nudges on hover.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ArrowRightIcon } from "@sdxc/icons";

import type { MarketingEyebrowVariant } from "../styles/marketing.js";

import { eyebrow } from "../styles/marketing.js";

/**
 * Prop types for {@link Eyebrow}.
 */
export namespace Eyebrow {
	/**
	 * Props accepted by {@link Eyebrow}.
	 */
	export interface Props {
		/** Which look the label draws. */
		variant: MarketingEyebrowVariant | "special";
		/** Turns the label into a link with a trailing arrow. */
		href?: string;
		/** Index a `numbered` label leads with, such as `"01"`. */
		index?: RemixNode;
		/** The `data-slot` the label carries, for hosts that name it after themselves. */
		slot?: string;
		/** Extra styling, applied after the eyebrow look. */
		mix?: TagProps<"span">["mix"];
		/** The label. */
		children: RemixNode;
	}
}

/**
 * Renders the label as a `span`, or as an `a` ending in an arrow when `href` is set.
 *
 * @param handle Runtime handle carrying the label's props.
 * @returns The render function producing the label.
 */
export function Eyebrow(handle: Handle<Eyebrow.Props>) {
	return () => {
		let { children, href, index, mix, slot, variant } = handle.props;
		let resolvedSlot = slot ?? "eyebrow";
		let content = (
			<>
				{index !== undefined ? <span data-slot="eyebrow-index">{index}</span> : null}
				{children}
				{href ? <ArrowRightIcon aria-hidden="true" data-slot="eyebrow-arrow" /> : null}
			</>
		);

		if (href) {
			return (
				<a
					href={href}
					data-slot={resolvedSlot}
					data-variant={variant}
					mix={[eyebrow(), mix as TagProps<"a">["mix"]]}
				>
					{content}
				</a>
			);
		}

		return (
			<span data-slot={resolvedSlot} data-variant={variant} mix={[eyebrow(), mix]}>
				{content}
			</span>
		);
	};
}
