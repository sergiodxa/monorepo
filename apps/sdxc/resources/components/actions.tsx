/**
 * The `actions` tag: the one or two places a band sends a reader, drawn as buttons. The
 * destinations and their wording live in the content file, so changing where the page
 * sends someone is an edit to one attribute.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ArrowRightIcon, ArrowUpRightIcon } from "@sdxc/icons";
import { flexWrap, hstack } from "@sdxc/u/layout";
import { LinkButton } from "@sdxc/ui";

import type { MarkdownProps } from "~/resources/components/markdown-props";

namespace Actions {
	/** How loudly the row speaks: the page's main call, or a link out of one section. */
	export type Size = "sm" | "lg";

	export interface Props extends MarkdownProps {
		"cta-href": string;
		"cta-label": string;
		/** The second destination, drawn only when both halves are written. */
		"alt-href"?: string;
		"alt-label"?: string;
		size?: Size;
	}
}

/**
 * Renders the row. A large row leads with a filled button; a small one is a quiet
 * outlined link, the way a section points further without competing with the page's call.
 * A destination on another site carries an arrow pointing out of the page.
 */
export default function Actions(handle: Handle<Actions.Props>) {
	return () => {
		let props = handle.props;
		let size = props.size ?? "lg";
		let hasAlternate = Boolean(props["alt-href"] && props["alt-label"]);

		return (
			<div data-slot="actions" mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
				<LinkButton
					href={props["cta-href"]}
					size={size}
					color={size === "lg" ? "brand" : "neutral"}
					variant={size === "lg" ? "solid" : "outline"}
				>
					{props["cta-label"]}
					<Arrow href={props["cta-href"]} />
				</LinkButton>

				{hasAlternate ? (
					<LinkButton href={props["alt-href"]} size={size} color="neutral" variant="outline">
						{props["alt-label"]}
						{isExternal(props["alt-href"] ?? "") ? <Arrow href={props["alt-href"] ?? ""} /> : null}
					</LinkButton>
				) : null}
			</div>
		);
	};
}

namespace Arrow {
	export interface Props {
		href: string;
	}
}

/** Draws the arrow a destination carries: onward within the site, or out of it. */
function Arrow(handle: Handle<Arrow.Props>) {
	return () =>
		isExternal(handle.props.href) ? (
			<ArrowUpRightIcon size={16} aria-hidden="true" />
		) : (
			<ArrowRightIcon size={16} aria-hidden="true" />
		);
}

/** Whether a destination leaves the site, which is what its arrow tells a reader. */
function isExternal(href: string): boolean {
	return /^https?:\/\//.test(href);
}
