/**
 * One "Start here" card on the docs hub: the guide's section, title and summary, closed by
 * a call to read it. Cards sharing a row stretch to the tallest, and the call sits on the
 * card's bottom edge, so every call in a row lines up whatever the summaries' lengths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowRightIcon } from "@sdxc/icons";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";

namespace DocsStartCard {
	export interface Props {
		href: string;
		section: string;
		title: string;
		description: string;
		/** The call closing the card ("Read the guide"). */
		cta: string;
	}
}

/** Renders the whole card as one link to the guide. */
export default function DocsStartCard(handle: Handle<DocsStartCard.Props>) {
	return () => {
		let { cta, description, href, section, title } = handle.props;

		return (
			<a
				href={href}
				data-rmx-prefetch="intent"
				mix={[
					vstack({ gap: 2 }),
					p(5),
					rounded("lg"),
					border({ color: "neutral.border", width: 1, style: "solid" }),
					bg("neutral.bg-tint"),
					transition("border-color"),
					hover(border("brand.border")),
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
				]}
			>
				<span mix={[text("xs"), font("mono"), fg("neutral.muted")]}>{section}</span>
				<span mix={[text("base"), weight("semibold"), fg("neutral.emphasis")]}>{title}</span>
				<span mix={[text("sm"), fg("neutral")]}>{description}</span>
				<span
					data-slot="docs-start-cta"
					mix={[
						hstack({ gap: 1, align: "center" }),
						raw({ marginBlockStart: "auto", paddingBlockStart: "0.25rem" }),
						text("sm"),
						weight("medium"),
						fg("brand"),
					]}
				>
					{cta}
					<ArrowRightIcon size={14} aria-hidden="true" />
				</span>
			</a>
		);
	};
}
