/**
 * Social proof as a sentence: customer marks set inline in a large, muted line of prose,
 * such as "Trusted by [Acme], [Globex] and 2,000 teams". A short logo list reads as a
 * claim this way, and takes one or two lines on a phone instead of a grid of rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { combine, raw } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

/** Container the sentence's type step reads. */
const CONTAINER = "ui-logo-sentence";

/**
 * Prop types for {@link LogoSentence}.
 */
export namespace LogoSentence {
	/**
	 * Props accepted by {@link LogoSentence}.
	 */
	export interface Props extends TagProps<"p"> {
		/**
		 * Text with `<img>` or inline-SVG marks between the words. Each mark sits on the
		 * text's baseline at 0.8em (times its `--logo-scale`) in the heading ink. Keep a
		 * mark and its trailing comma in one `nowrap` span so a line never opens on it.
		 */
		children: RemixNode;
	}
}

/**
 * Sets its children as one centered, balanced line of prose: 1.25rem on a phone and
 * 1.75rem from the `lg` container, weight 500 in the muted ink, with each mark scaled
 * to the type so the line keeps an even rhythm.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the sentence's markup.
 * @example
 * <LogoSentence>
 * 	Trusted by <img src={acme} alt="Acme" />, <img src={globex} alt="Globex" /> and 2,000 teams.
 * </LogoSentence>
 */
export function LogoSentence(handle: Handle<LogoSentence.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div mix={[container(CONTAINER), raw({ inlineSize: "100%" })]}>
				<p {...rest} data-slot="logo-sentence" mix={[sentence(), mix]}>
					{children}
				</p>
			</div>
		);
	};
}

/** The sentence's type and the inline sizing of its marks. */
function sentence() {
	return combine([
		raw({
			maxInlineSize: "44rem",
			marginInline: "auto",
			marginBlock: "0",
			fontSize: "1.25rem",
			lineHeight: "1.6",
			fontWeight: "500",
			letterSpacing: "-0.01em",
			textAlign: "center",
			textWrap: "balance",
			color: "var(--ui-neutral-fg-muted)",
		}),
		at("lg", CONTAINER, raw({ fontSize: "1.75rem" })),
		when(
			"& :is(img, svg)",
			raw({
				display: "inline",
				blockSize: "calc(0.8em * var(--logo-scale, 1))",
				inlineSize: "auto",
				verticalAlign: "-0.1em",
				marginInline: "0.1em",
				color: "var(--ui-neutral-fg-emphasis)",
			}),
		),
	]);
}
