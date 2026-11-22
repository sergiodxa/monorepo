/**
 * Strata Two's spec sheet: every figure a buyer compares, grouped as a datasheet would group
 * them, in two ruled columns of term and value with tabular figures.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { renderNearView } from "~/resources/views/demos/near-view";

/** One group of the sheet and its rows of term and value. */
interface SpecGroup {
	title: string;
	rows: Array<[term: string, value: string]>;
}

/** The sheet, in the order a datasheet reads: the object, then what is inside, then power. */
const SPECS: SpecGroup[] = [
	{
		title: "Board",
		rows: [
			["Layout", "75%, 84 keys ANSI or 85 keys ISO"],
			["Case", "CNC-milled 6063 aluminium, one piece"],
			["Mount", "Gasket, eight Poron points"],
			["Typing angle", "6.5°"],
			["Size", "327 × 137 × 31 mm"],
			["Front height", "19 mm"],
			["Weight", "1.68 kg built"],
		],
	},
	{
		title: "Keys",
		rows: [
			["Switches", "Strata Silk linear, 45 g · Strata Notch tactile, 55 g"],
			["Sockets", "5-pin hot-swap, south-facing"],
			["Keycaps", "Double-shot PBT, 1.5 mm walls, Cherry profile"],
			["Stabilisers", "Screw-in, factory lubed"],
			["Knob", "Aluminium, 24 detents, press to mute"],
		],
	},
	{
		title: "Connection",
		rows: [
			["Wired", "USB-C, 4,000 Hz polling"],
			["2.4 GHz", "1,000 Hz, receiver stored in the case"],
			["Bluetooth", "5.3, three devices"],
			["Firmware", "QMK, VIA compatible, open source"],
		],
	},
	{
		title: "Power",
		rows: [
			["Battery", "4,000 mAh"],
			["Battery life", "Up to 140 h backlight off, 40 h on"],
			["Charging", "Full in 3 h from USB-C"],
			["Warranty", "Two years, batteries included"],
		],
	},
];

namespace SpecTable {
	export interface Props {
		group: SpecGroup;
	}
}

/**
 * One group: its title over a list of rows, each term and value on one hairline.
 *
 * @param handle Runtime handle carrying the group.
 * @returns The render function producing the group.
 */
function SpecTable(handle: Handle<SpecTable.Props>) {
	return () => {
		let { group } = handle.props;
		return (
			<div>
				<h3
					mix={[
						raw({
							margin: "0 0 0.5rem",
							fontSize: "0.75rem",
							fontWeight: "600",
							letterSpacing: "0.14em",
							textTransform: "uppercase",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					{group.title}
				</h3>
				<dl mix={[raw({ margin: "0", display: "grid" })]}>
					{group.rows.map(([term, value]) => (
						<div
							key={term}
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "minmax(7rem, 2fr) 3fr",
									gap: "1rem",
									paddingBlock: "0.75rem",
									borderBlockStart: "1px solid var(--ui-landing-hairline)",
									fontSize: "0.9375rem",
									lineHeight: "1.4",
									fontVariantNumeric: "tabular-nums",
								}),
							]}
						>
							<dt mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>{term}</dt>
							<dd mix={[raw({ margin: "0", textWrap: "pretty" })]}>{value}</dd>
						</div>
					))}
				</dl>
			</div>
		);
	};
}

/**
 * Renders the band: the header split beside its note, then the groups in two columns.
 *
 * @returns The render function producing the band.
 */
export default function Specs() {
	return () => (
		<LandingSection id="specs" tone="plain" spacing="normal" mix={[renderNearView(757, 1581)]}>
			<LandingHeader
				eyebrow="06 · Tech specs"
				layout="split"
				description="Measured on a production board from batch 02, with Silk switches and the backlight off."
			>
				Every figure, on one sheet
			</LandingHeader>
			<div
				mix={[
					raw({ display: "grid", gap: "2.5rem", paddingBlockStart: "1rem" }),
					at("lg", raw({ gridTemplateColumns: "1fr 1fr", columnGap: "4rem" })),
				]}
			>
				{SPECS.map((group) => (
					<SpecTable key={group.title} group={group} />
				))}
			</div>
		</LandingSection>
	);
}
