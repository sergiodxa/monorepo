/**
 * The section-heading-plus-bordered-card composition every settings-style page in
 * this app is built from: a titled (optionally described) `<section>` holding one
 * or more cards, each card a rounded, bordered box split into an optional header,
 * a field region, and a footer action row. It exists so a page made of several
 * independently-submittable groups reads as distinct settings groups instead of
 * one undifferentiated column of inputs, without every such page re-deriving the
 * same geometry inline.
 *
 * `tone` is repeated on the card and its header/footer rather than inferred from
 * the section, because the border color has to be set on each element that draws
 * a border and there is no ambient channel to carry it: a destructive group needs
 * its divider lines in the danger color too, not only its outer frame.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { border, borderEdge, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { hstack, vstack } from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { media } from "@pkg/u/responsive";
import { m, mi, p } from "@pkg/u/size";
import { fontSize, weight } from "@pkg/u/typography";

/**
 * Viewport from which a card is allowed to bleed past the column it sits in.
 *
 * The app shell pads its content area by 20px below this width and 48px from it up, so a
 * card reaching a further 6 spacing units out each side only has room above the threshold —
 * below it the card would overflow the viewport and the page would scroll sideways.
 */
const CARD_BLEED_FROM = "(min-width: 768px)";

namespace SettingsSection {
	/** The semantic color a group's frame and divider lines are drawn in. */
	export type Tone = "neutral" | "danger";

	export interface Props {
		/** Anchor target, so a link elsewhere can deep-link to this group. */
		id?: string;
		title: string;
		/** One-line explanation of what the group configures. */
		description?: string;
		/** Defaults to `"neutral"`; `"danger"` colors the heading destructively. */
		tone?: Tone;
		children: RemixNode;
	}

	export interface CardProps {
		tone?: Tone;
		children: RemixNode;
	}

	export interface HeaderProps {
		title: string;
		description?: string;
		tone?: Tone;
	}

	export interface BodyProps {
		children: RemixNode;
	}

	export interface FooterProps {
		tone?: Tone;
		children: RemixNode;
	}
}

/** A titled group of settings: heading, optional description, then its cards stacked below. */
export default function SettingsSection(handle: Handle<SettingsSection.Props>) {
	return () => {
		let { id, title, description, tone = "neutral", children } = handle.props;

		return (
			<section id={id} mix={[vstack({ gap: 6 })]}>
				<div mix={[vstack({ gap: 1 })]}>
					<h2 mix={[m(0), fontSize("xl"), weight("semibold"), tone === "danger" && fg("danger")]}>
						{title}
					</h2>
					{description && <p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>{description}</p>}
				</div>
				{children}
			</section>
		);
	};
}

/** The bordered box a group's contents live in, pulled out to line its copy up with the heading above. */
SettingsSection.Card = function SettingsCard(handle: Handle<SettingsSection.CardProps>) {
	return () => {
		let { tone = "neutral", children } = handle.props;

		return (
			<div
				mix={[
					rounded("xl"),
					border({ color: tone, width: 1 }),
					overflow(),
					media(CARD_BLEED_FROM, mi(-6)),
				]}
			>
				{children}
			</div>
		);
	};
};

/** A card's own title and supporting copy, divided from the fields below it. */
SettingsSection.Header = function SettingsCardHeader(handle: Handle<SettingsSection.HeaderProps>) {
	return () => {
		let { title, description, tone = "neutral" } = handle.props;

		return (
			<div mix={[p(5, 6), borderEdge("block-end", { color: tone, width: 1 })]}>
				<h3
					mix={[
						m(0, 0, 1, 0),
						fontSize("base"),
						weight("semibold"),
						tone === "danger" && fg("danger"),
					]}
				>
					{title}
				</h3>
				{description && (
					<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>{description}</p>
				)}
			</div>
		);
	};
};

/**
 * A card's field region. It carries no block-end padding on purpose: every field
 * wrapper in this app already ends in its own trailing margin, so padding here too
 * would stack the two into a gap far larger than the footer rhythm every other card
 * follows.
 */
SettingsSection.Body = function SettingsCardBody(handle: Handle<SettingsSection.BodyProps>) {
	return () => <div mix={[p(6, 6, 0, 6)]}>{handle.props.children}</div>;
};

/** A card's action row: the submit (and any cancel) control for the form that card holds. */
SettingsSection.Footer = function SettingsCardFooter(handle: Handle<SettingsSection.FooterProps>) {
	return () => {
		let { tone = "neutral", children } = handle.props;

		return (
			<div
				mix={[
					p(4, 6),
					borderEdge("block-start", { color: tone, width: 1 }),
					hstack({ gap: 2, align: "center", justify: "end" }),
				]}
			>
				{children}
			</div>
		);
	};
};
