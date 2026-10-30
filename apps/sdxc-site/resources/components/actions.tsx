/**
 * The `actions` tag: the one or two places a band sends a reader, drawn as buttons. The
 * destinations and their wording live in the content file, so changing where the page
 * sends someone is an edit to one attribute. Layout comes from {@link CtaGroup}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowRightIcon, ArrowUpRightIcon } from "@sdxc/icons";
import { CtaGroup, LinkButton } from "@sdxc/ui";
import { marketingCtaChrome } from "@sdxc/ui/styles";

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
		let isMain = (props.size ?? "lg") === "lg";
		let hasAlternate = Boolean(props["alt-href"] && props["alt-label"]);

		return (
			<CtaGroup data-slot="actions" size={isMain ? "md" : "sm"} stack={isMain ? "phone" : "never"}>
				<LinkButton
					href={props["cta-href"]}
					color={isMain ? "brand" : "neutral"}
					variant={isMain ? "solid" : "outline"}
					mix={[isMain ? marketingCtaChrome() : []]}
				>
					{props["cta-label"]}
					<Arrow href={props["cta-href"]} />
				</LinkButton>

				{hasAlternate ? (
					<LinkButton
						href={props["alt-href"]}
						color="neutral"
						variant={isMain ? "surface" : "outline"}
						mix={[isMain ? marketingCtaChrome() : []]}
					>
						{props["alt-label"]}
						{isExternal(props["alt-href"] ?? "") ? <Arrow href={props["alt-href"] ?? ""} /> : null}
					</LinkButton>
				) : null}
			</CtaGroup>
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
