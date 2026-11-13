/**
 * The finish picker: three anodised finishes as swatch radios beside the board, which
 * recolours as one is chosen. The radios belong to the preorder form, so the choice made
 * here is the finish the order asks for, with no script involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import type { Finish } from "~/resources/views/demos/hardware/finish";

import { FINISH_FIELD, FINISHES, finishInputId } from "~/resources/views/demos/hardware/finish";
import { Keyboard } from "~/resources/views/demos/hardware/keyboard";
import { PREORDER_FORM } from "~/resources/views/demos/hardware/preorder-data";

namespace Finishes {
	export interface Props {
		/** The finish checked when the page loads: the one in the URL, else the first. */
		selected: Finish["value"];
	}
}

/**
 * Renders the band: the board large on the aluminium ground, the swatches under it. Each
 * swatch is a label around a visually hidden radio, so the whole chip is the target and the
 * keyboard moves between finishes with the arrow keys.
 *
 * @param handle Runtime handle carrying the checked finish.
 * @returns The render function producing the band.
 */
export default function Finishes(handle: Handle<Finishes.Props>) {
	return () => (
		<LandingSection id="finishes" tone="plain" spacing="normal" align="center">
			<LandingHeader
				eyebrow="05 · Finishes"
				align="center"
				description="Every case is blasted and anodised in the same shop. The keycaps are moulded to match each one, and the escape key stays orange on all three."
			>
				Three finishes, one price
			</LandingHeader>
			<div
				mix={[
					raw({
						display: "grid",
						gap: "2.5rem",
						justifyItems: "center",
						paddingBlockStart: "1rem",
					}),
				]}
			>
				<div
					mix={[
						raw({
							inlineSize: "min(100%, 60rem)",
							filter: "drop-shadow(0 1.75rem 1.5rem oklch(0.2 0.01 250 / 0.28))",
						}),
					]}
				>
					<Keyboard id="finish" label="Strata Two in the finish you have chosen" />
				</div>
				<fieldset
					mix={[
						raw({
							margin: "0",
							padding: "0",
							border: "0",
							display: "grid",
							gap: "0.5rem",
							inlineSize: "min(100%, 22rem)",
						}),
						at(
							"md",
							raw({ gridTemplateColumns: "repeat(3, 1fr)", inlineSize: "min(100%, 48rem)" }),
						),
					]}
				>
					<legend
						mix={[
							raw({
								position: "absolute",
								inlineSize: "1px",
								blockSize: "1px",
								overflow: "hidden",
								clipPath: "inset(50%)",
								whiteSpace: "nowrap",
							}),
						]}
					>
						Finish
					</legend>
					{FINISHES.map((finish) => (
						<label
							key={finish.value}
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "2.25rem 1fr",
									alignItems: "center",
									columnGap: "0.75rem",
									paddingBlock: "0.75rem",
									paddingInline: "0.875rem",
									borderRadius: "var(--ui-landing-card-radius-outer)",
									backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
									boxShadow: "inset 0 0 0 1px var(--ui-landing-hairline)",
									cursor: "pointer",
									textAlign: "start",
									"&:has(:checked)": {
										boxShadow: "inset 0 0 0 2px var(--ui-neutral-fg-emphasis)",
									},
									"&:has(:focus-visible)": {
										outline: "2px solid var(--ui-color-brand-500)",
										outlineOffset: "3px",
									},
								}),
							]}
						>
							<input
								type="radio"
								id={finishInputId(finish.value)}
								name={FINISH_FIELD}
								value={finish.value}
								form={PREORDER_FORM}
								checked={handle.props.selected === finish.value}
								mix={[raw({ position: "absolute", opacity: "0", pointerEvents: "none" })]}
							/>
							<span
								aria-hidden="true"
								mix={[
									raw({
										gridRow: "span 2",
										inlineSize: "2.25rem",
										blockSize: "2.25rem",
										borderRadius: "9999px",
										background: finish.swatch,
										boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.5), 0 0 0 1px oklch(0 0 0 / 0.15)",
									}),
								]}
							/>
							<span mix={[raw({ fontWeight: "600", fontSize: "0.9375rem" })]}>{finish.name}</span>
							<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
								{finish.process}
							</span>
						</label>
					))}
				</fieldset>
			</div>
		</LandingSection>
	);
}
