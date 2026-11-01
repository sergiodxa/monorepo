/**
 * The pieces several Pulse screens share: a ruled panel with its own heading and actions, the
 * row of links that previews a region's loading and failed states, and the number formats
 * every figure is written in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { minIs, p, pb, pi } from "@sdxc/u/size";
import { font, text, textTransform, tracking, weight } from "@sdxc/u/typography";

import { LOCALE } from "./data";

/** Writes a share as a percentage with two decimals ("99.82%"). */
export const PERCENT = new Intl.NumberFormat(LOCALE, {
	style: "percent",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

/** Writes a duration in milliseconds ("212 ms"). */
export const MILLISECONDS = new Intl.NumberFormat(LOCALE, {
	style: "unit",
	unit: "millisecond",
	maximumFractionDigits: 0,
});

/** Writes a plain count ("3"). */
export const COUNT = new Intl.NumberFormat(LOCALE);

namespace Panel {
	export interface Props {
		/** The panel's `h2`, which also names the region. */
		title: RemixNode;
		description?: RemixNode;
		actions?: RemixNode;
		/** Lets the body run to the panel's edges, as a table does. */
		flush?: boolean;
		id?: string;
		children: RemixNode;
	}
}

/**
 * A region of a screen inside a 1px ruled box with its heading row, so a dense page reads as
 * a few labelled instruments rather than one long column.
 */
export function Panel(handle: Handle<Panel.Props>) {
	return () => {
		let { title, description, actions, flush = false, id, children } = handle.props;
		let headingId = id === undefined ? undefined : `${id}-title`;
		return (
			<section
				id={id}
				aria-labelledby={headingId}
				mix={[
					vstack({ gap: 0, align: "stretch" }),
					minIs(0),
					border({ width: 1, color: "neutral.border" }),
					bg("neutral.bg"),
					raw({ borderRadius: "var(--ui-radius-lg)", overflow: "clip" }),
				]}
			>
				<header
					mix={[
						hstack({ gap: 3, align: "center", justify: "between" }),
						flexWrap("wrap"),
						pi(4),
						pb(3),
						raw({ borderBlockEnd: "1px solid var(--ui-neutral-border)" }),
					]}
				>
					<div mix={[vstack({ gap: 0.5, align: "start" }), minIs(0)]}>
						<h2
							id={headingId}
							mix={[
								raw({ margin: "0" }),
								font("mono"),
								text("xs"),
								weight("semibold"),
								textTransform("uppercase"),
								tracking("wide"),
								fg("neutral.emphasis"),
							]}
						>
							{title}
						</h2>
						{description === undefined ? null : (
							<p mix={[raw({ margin: "0" }), text("sm"), fg("neutral.muted")]}>{description}</p>
						)}
					</div>
					{actions === undefined ? null : (
						<div mix={[hstack({ gap: 2, align: "center" }), flexWrap("wrap")]}>{actions}</div>
					)}
				</header>
				<div mix={flush ? [minIs(0)] : [p(4), minIs(0)]}>{children}</div>
			</section>
		);
	};
}

namespace StateLinks {
	export interface Props {
		label: string;
		links: { href: string; label: string; current: boolean }[];
	}
}

/**
 * The quiet "Preview states" row a demo screen ends with, so a visitor can see the region
 * load and fail without breaking anything; the current state is marked for assistive tech.
 */
export function StateLinks(handle: Handle<StateLinks.Props>) {
	return () => {
		let { label, links } = handle.props;
		return (
			<nav
				aria-label={label}
				mix={[hstack({ gap: 3, align: "center" }), flexWrap("wrap"), text("xs"), font("mono")]}
			>
				<span mix={[fg("neutral.muted")]}>{label}</span>
				{links.map((link) => (
					<a
						key={link.href}
						href={link.href}
						aria-current={link.current ? "page" : undefined}
						mix={[
							fg(link.current ? "brand" : "neutral.muted"),
							raw({ textUnderlineOffset: "0.2em" }),
							link.current ? weight("semibold") : [],
						]}
					>
						{link.label}
					</a>
				))}
			</nav>
		);
	};
}
