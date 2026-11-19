/**
 * Who is coming: a field that opens a panel with adults and children, each a number with step
 * buttons. The numbers are form fields, so the party submits with the search or booking either
 * way; with script the step buttons work and the field's summary follows them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { NumberField, Popover } from "@sdxc/ui";
import {
	NUMBER_FIELD_STEP_DOWN_COMMAND,
	NUMBER_FIELD_STEP_UP_COMMAND,
	stepper,
} from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

namespace GuestsField {
	export interface Props {
		/** A prefix for the field's element ids, unique on the page. */
		id: string;
		adults: number;
		/** Children aged 2 to 12, who count as guests. */
		kids: number;
		/** The most guests the stay sleeps; sixteen for a search. */
		max?: number;
		/** Draws the field as a booking card's bordered row rather than a bar segment. */
		boxed?: boolean;
	}
}

/** The party in words, as the field's summary reads it. */
function partyText(adults: number, children: number): string {
	let guests = adults + children;
	return `${guests} ${guests === 1 ? "guest" : "guests"}`;
}

/**
 * The guests field and its panel. Each count stays within one adult and the stay's size, so
 * a party the stay can't take never leaves the field.
 */
export const GuestsField = clientEntry(
	import.meta.url,
	function GuestsField(handle: Handle<GuestsField.Props>) {
		let adults = handle.props.adults;
		let children = handle.props.kids;
		let seen = `${handle.props.adults}|${handle.props.kids}`;

		/** Takes the server's party when a swap redraws the field with a new one. */
		function follow() {
			let next = `${handle.props.adults}|${handle.props.kids}`;
			if (next === seen) return;
			seen = next;
			adults = handle.props.adults;
			children = handle.props.kids;
		}

		/** Reads one count back from its field after a step or a typed value. */
		function read(kind: "adults" | "children", event: Event) {
			if (!(event.currentTarget instanceof HTMLInputElement)) return;
			let value = Number(event.currentTarget.value);
			if (!Number.isFinite(value)) return;
			if (kind === "adults") adults = value;
			else children = value;
			void handle.update();
		}

		return () => {
			follow();
			let { boxed = false, id, max = 16 } = handle.props;
			let rows = [
				{
					kind: "adults" as const,
					label: "Adults",
					hint: "Ages 13 or above",
					value: adults,
					min: 1,
					cap: max - children,
				},
				{
					kind: "children" as const,
					label: "Children",
					hint: "Ages 2 to 12",
					value: children,
					min: 0,
					cap: max - adults,
				},
			];
			return (
				<div mix={[raw({ position: "relative", minInlineSize: "0", display: "grid" })]}>
					<button
						type="button"
						popovertarget={`${id}-panel`}
						mix={[
							raw({
								display: "grid",
								alignContent: "center",
								gap: "0.125rem",
								minInlineSize: "0",
								paddingInline: boxed ? "0.875rem" : "1.25rem",
								paddingBlock: boxed ? "0.625rem" : "0.5rem",
								border: "0",
								borderRadius: boxed ? "0" : "999px",
								background: "transparent",
								color: "var(--ui-neutral-fg-emphasis)",
								textAlign: "start",
								font: "inherit",
								cursor: "pointer",
							}),
							when(
								"&:hover",
								raw({
									backgroundColor: boxed
										? "var(--ui-neutral-bg-tint)"
										: "var(--ui-neutral-bg-tint-hover)",
								}),
							),
							when(
								"&:focus-visible",
								raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
							),
						]}
					>
						<span mix={[raw({ fontSize: "0.75rem", fontWeight: "700", letterSpacing: "0.02em" })]}>
							Who
						</span>
						<span
							data-guests-summary=""
							mix={[
								raw({
									fontSize: "0.875rem",
									color: "var(--ui-neutral-fg-muted)",
									whiteSpace: "nowrap",
								}),
							]}
						>
							{partyText(adults, children)}
						</span>
					</button>
					<Popover
						id={`${id}-panel`}
						placement="bottom-end"
						aria-label="Guests"
						mix={[
							raw({
								inlineSize: "min(22rem, calc(100vw - 1rem))",
								padding: "0.5rem 1.25rem",
								borderRadius: "1.25rem",
							}),
						]}
					>
						{rows.map((row, index) => (
							<div
								mix={[
									raw({
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: "1rem",
										paddingBlock: "1rem",
										borderBlockStart: index === 0 ? "0" : "1px solid var(--ui-neutral-border)",
									}),
								]}
							>
								<label
									htmlFor={`${id}-${row.kind}`}
									mix={[raw({ display: "grid", gap: "0.125rem" })]}
								>
									<span mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}>
										{row.label}
									</span>
									<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
										{row.hint}
									</span>
								</label>
								<NumberField mix={[raw({ inlineSize: "8.5rem", flexShrink: "0" })]}>
									<NumberField.Group mix={[stepper()]}>
										<NumberField.DecrementButton
											aria-label={`One ${row.kind === "adults" ? "adult" : "child"} fewer`}
											command={NUMBER_FIELD_STEP_DOWN_COMMAND}
											commandfor={`${id}-${row.kind}`}
										/>
										<NumberField.Input
											id={`${id}-${row.kind}`}
											name={row.kind}
											min={row.min}
											max={Math.max(row.min, row.cap)}
											step={1}
											value={String(row.value)}
											mix={[
												on<HTMLInputElement, "input">("input", (event) => read(row.kind, event)),
											]}
										/>
										<NumberField.IncrementButton
											aria-label={`One ${row.kind === "adults" ? "adult" : "child"} more`}
											command={NUMBER_FIELD_STEP_UP_COMMAND}
											commandfor={`${id}-${row.kind}`}
										/>
									</NumberField.Group>
								</NumberField>
							</div>
						))}
						{max < 16 ? (
							<p
								mix={[
									raw({
										margin: "0 0 0.75rem",
										fontSize: "0.8125rem",
										color: "var(--ui-neutral-fg-muted)",
									}),
								]}
							>
								This stay sleeps up to {max}.
							</p>
						) : null}
					</Popover>
				</div>
			);
		};
	},
);
