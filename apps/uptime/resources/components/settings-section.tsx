/**
 * The section-heading-plus-bordered-card composition every settings-style page
 * is built from: a titled section holding cards, each a rounded, bordered box
 * split into an optional header, a field region, and a footer action row, so a
 * page of independent groups reads as distinct settings rather than one column.
 *
 * The field region owns the vertical rhythm between its children as a `gap`,
 * since a trailing margin per field is a contract no markup can enforce. `tone`
 * repeats on the card and its header/footer because the border color must be
 * set on each element that draws one — there's no ambient channel to carry it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { hstack, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { m, mi, p } from "@sdxc/u/size";
import { fontSize, weight } from "@sdxc/u/typography";

/**
 * Viewport from which a card may bleed past its column. Below this width the
 * app shell's content padding is only 20px, too narrow for a 6-unit bleed;
 * above it, the padding widens to 48px, which has room.
 */
const CARD_BLEED_FROM = "(min-width: 768px)";

/**
 * Vertical rhythm between two consecutive fields inside a card body, applied
 * once as the body's own `gap`, so individual fields carry no trailing margin
 * of their own — a contract markup can't enforce. Exported for reuse elsewhere.
 */
export const SETTINGS_FIELD_GAP = "28px";

/** Rhythm between switches that read as one group, tighter than the between-fields rhythm. */
export const SETTINGS_SWITCH_GAP = 4;

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
 * A card's field region: evenly padded, and spacing whatever it holds on the
 * {@link SETTINGS_FIELD_GAP} rhythm, applied once as the body's own `gap`
 * rather than as a trailing margin every field would otherwise need to carry.
 */
SettingsSection.Body = function SettingsCardBody(handle: Handle<SettingsSection.BodyProps>) {
	return () => <div mix={[p(6), vstack({ gap: SETTINGS_FIELD_GAP })]}>{handle.props.children}</div>;
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
