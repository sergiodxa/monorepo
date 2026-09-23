/**
 * The `hero` tag: the opening panel, holding the thesis, the supporting line, the two
 * actions, and the install line written inside it. The actions come from the content
 * file rather than from the view, so changing where the page sends a reader first is
 * an edit to one markdown attribute.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, maxIs, p } from "@sdxc/u/size";
import { LinkButton } from "@sdxc/ui";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import { blocksUseGap } from "~/resources/components/block-flow";

namespace Hero {
	export interface Props extends MarkdownProps {
		/** Where the primary action goes. */
		"cta-href": string;
		"cta-label": string;
		/** The secondary action, drawn only when both halves are written. */
		"alt-href"?: string;
		"alt-label"?: string;
	}
}

/** Renders the opening panel. */
export default function Hero(handle: Handle<Hero.Props>) {
	return () => {
		let props = handle.props;
		let hasAlternate = Boolean(props["alt-href"] && props["alt-label"]);

		return (
			<section mix={[vstack({ align: "center" }), is("100%")]}>
				<div
					mix={[
						vstack({ gap: 8 }),
						is("100%"),
						maxIs("64rem"),
						p(16, 5, 12, 5),
						media("(min-width: 48rem)", p(24, 5, 16, 5)),
					]}
				>
					<div mix={[vstack({ gap: 5 }), blocksUseGap(), maxIs("44rem")]}>{props.children}</div>

					<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
						<LinkButton href={props["cta-href"]} size="lg" color="brand">
							{props["cta-label"]}
						</LinkButton>
						{hasAlternate ? (
							<LinkButton href={props["alt-href"]} size="lg" color="neutral" variant="outline">
								{props["alt-label"]}
							</LinkButton>
						) : null}
					</div>
				</div>
			</section>
		);
	};
}
