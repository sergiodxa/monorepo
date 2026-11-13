/**
 * Strata Two beside Strata One, row by row, with each row marked by which board it favours,
 * including the two rows the older board still wins, and a line saying who should buy it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { PREORDER } from "~/resources/views/demos/hardware/preorder-data";
import { renderNearView } from "~/resources/views/demos/near-view";

/** One row: what is compared, each board's value, and which board the row favours. */
interface Row {
	label: string;
	one: string;
	two: string;
	favours: "one" | "two" | "same";
}

/** The rows, the ones that changed most first. */
const ROWS: Row[] = [
	{ label: "Mount", one: "Tray, screwed", two: "Gasket, eight points", favours: "two" },
	{ label: "Case", one: "Two pieces, top screws", two: "One block", favours: "two" },
	{ label: "Wired polling", one: "1,000 Hz", two: "4,000 Hz", favours: "two" },
	{ label: "Wireless", one: "Bluetooth 5.0", two: "Bluetooth 5.3 + 2.4 GHz", favours: "two" },
	{ label: "Battery life", one: "Up to 80 h", two: "Up to 140 h", favours: "two" },
	{ label: "Knob", one: "—", two: "Aluminium, press to mute", favours: "two" },
	{ label: "Hot-swap", one: "5-pin", two: "5-pin", favours: "same" },
	{ label: "Keycaps", one: "Double-shot PBT", two: "Double-shot PBT", favours: "same" },
	{ label: "Weight", one: "1.42 kg", two: "1.68 kg", favours: "one" },
	{ label: "Price", one: PREORDER.previousPrice, two: PREORDER.price, favours: "one" },
];

/** The words a screen reader hears for each row's verdict. */
const VERDICT: Record<Row["favours"], string> = {
	one: "Strata One is better here",
	two: "Strata Two is better here",
	same: "The same on both",
};

/**
 * Renders the band: a three-column table with Strata Two's column lit, a dot beside the
 * value of whichever board a row favours, and the honest recommendation under it.
 *
 * @returns The render function producing the band.
 */
export default function Compare() {
	return () => (
		<LandingSection id="compare" tone="plain" spacing="normal" mix={[renderNearView(900, 1074)]}>
			<LandingHeader
				eyebrow="08 · Compared"
				description="What changed since Strata One, and the two rows where the first board is still the better buy."
			>
				Strata Two against Strata One
			</LandingHeader>
			<div mix={[raw({ overflowX: "auto", paddingBlockStart: "1rem" })]}>
				<table
					mix={[
						raw({
							inlineSize: "100%",
							minInlineSize: "20rem",
							borderCollapse: "collapse",
							fontSize: "0.9375rem",
							fontVariantNumeric: "tabular-nums",
							"& th, & td": {
								paddingBlock: "0.875rem",
								paddingInline: "0.75rem",
								textAlign: "start",
								verticalAlign: "top",
								borderBlockStart: "1px solid var(--ui-landing-hairline)",
							},
							"& thead th": {
								borderBlockStart: "0",
								paddingBlockEnd: "1rem",
								verticalAlign: "bottom",
							},
							"& tbody th": {
								fontWeight: "400",
								color: "var(--ui-neutral-fg-muted)",
								paddingInlineStart: "0",
							},
							"& [data-col=two]": {
								backgroundColor:
									"color-mix(in oklch, var(--ui-neutral-fg-emphasis) 5%, transparent)",
								fontWeight: "550",
							},
							"& thead [data-col=two]": {
								borderStartStartRadius: "10px",
								borderStartEndRadius: "10px",
							},
							"& tbody tr:last-child [data-col=two]": {
								borderEndStartRadius: "10px",
								borderEndEndRadius: "10px",
							},
						}),
					]}
				>
					<thead>
						<tr>
							<th scope="col" mix={[raw({ inlineSize: "30%" })]}>
								<span mix={[raw({ position: "absolute", clipPath: "inset(50%)" })]}>Compared</span>
							</th>
							<th scope="col">
								<span mix={[raw({ display: "block", fontWeight: "600" })]}>Strata One</span>
								<span
									mix={[
										raw({
											fontSize: "0.8125rem",
											fontWeight: "400",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									2024
								</span>
							</th>
							<th scope="col" data-col="two">
								<span mix={[raw({ display: "block", fontWeight: "600" })]}>Strata Two</span>
								<span
									mix={[
										raw({
											fontSize: "0.8125rem",
											fontWeight: "400",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									Batch {PREORDER.batch}
								</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{ROWS.map((row) => (
							<tr key={row.label}>
								<th scope="row">{row.label}</th>
								<td>
									{row.one}
									{row.favours === "one" ? <Favoured label={VERDICT.one} /> : null}
								</td>
								<td data-col="two">
									{row.two}
									{row.favours === "two" ? <Favoured label={VERDICT.two} /> : null}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<p
				mix={[
					raw({
						margin: "1.5rem 0 0",
						maxInlineSize: "44rem",
						fontSize: "0.9375rem",
						lineHeight: "1.5",
						color: "var(--ui-neutral-fg)",
						textWrap: "pretty",
					}),
				]}
			>
				<strong mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
					Carry yours every day?
				</strong>{" "}
				Strata One is 260 g lighter and stays on sale at {PREORDER.previousPrice}. Two is the board
				for a desk it never leaves.
			</p>
		</LandingSection>
	);
}

/**
 * The dot beside the value a row favours, named for screen readers.
 *
 * @param handle Runtime handle carrying the spoken verdict.
 * @returns The render function producing the dot.
 */
function Favoured(handle: Handle<{ label: string }>) {
	return () => (
		<span
			role="img"
			aria-label={handle.props.label}
			mix={[
				raw({
					display: "inline-block",
					inlineSize: "0.4375rem",
					blockSize: "0.4375rem",
					marginInlineStart: "0.5rem",
					verticalAlign: "0.1em",
					borderRadius: "9999px",
					backgroundColor: "var(--ui-color-brand-500)",
				}),
			]}
		/>
	);
}
