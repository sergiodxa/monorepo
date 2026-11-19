/**
 * Where the reader is in a flow spread over several pages, such as payee, amount and review:
 * a numbered row of steps joined by a line, done steps checked and linkable back, the current
 * one marked for assistive tech. On a narrow screen only the current step keeps its name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { CheckIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { atQuery } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

/** Prop types for {@link StepIndicator} and {@link StepIndicator.Step}. */
export namespace StepIndicator {
	/** Where a step stands: behind the reader, where they are, or still ahead. */
	export type State = "complete" | "current" | "upcoming";

	/** Props accepted by {@link StepIndicator}. */
	export interface Props extends TagProps<"nav"> {
		/** The landmark's name, such as "Transfer steps". */
		label: string;
		/** {@link StepIndicator.Step}s in order. */
		children: RemixNode;
	}

	/** Props accepted by {@link StepIndicator.Step}. */
	export interface StepProps extends Omit<TagProps<"li">, "children"> {
		/** The step's place in the flow, from 1. */
		number: number;
		state: State;
		/** The address of a done step, so the reader can go back and change it. */
		href?: string;
		/** The step's name. */
		children: RemixNode;
	}
}

/**
 * Renders the row of steps as an ordered list in a `nav`, so a screen reader announces how
 * many steps there are and which one is current.
 *
 * @example
 * <StepIndicator label="Transfer steps">
 * 	<StepIndicator.Step number={1} state="complete" href="/transfer">Payee</StepIndicator.Step>
 * 	<StepIndicator.Step number={2} state="current">Amount</StepIndicator.Step>
 * 	<StepIndicator.Step number={3} state="upcoming">Review</StepIndicator.Step>
 * </StepIndicator>
 */
export function StepIndicator(handle: Handle<StepIndicator.Props>) {
	return () => {
		let { label, children, mix, ...rest } = handle.props;
		return (
			<nav
				aria-label={label}
				{...rest}
				data-slot="step-indicator"
				mix={mergeMix([raw({ containerType: "inline-size" })], mix)}
			>
				<ol
					mix={raw({
						listStyle: "none",
						margin: "0",
						padding: "0",
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
					})}
				>
					{children}
				</ol>
			</nav>
		);
	};
}

/**
 * Renders one step: its number (a check once done) in a circle, then its name, with a line
 * leading in from the step before. A done step with `href` is a link back to it.
 */
StepIndicator.Step = function StepIndicatorStep(handle: Handle<StepIndicator.StepProps>) {
	return () => {
		let { number, state, href, children, mix, ...rest } = handle.props;
		let marker = (
			<span
				data-slot="step-indicator-marker"
				aria-hidden="true"
				mix={raw({
					display: "grid",
					placeItems: "center",
					flex: "none",
					inlineSize: "1.5rem",
					blockSize: "1.5rem",
					borderRadius: "999px",
					fontSize: "0.75rem",
					fontWeight: "600",
					border: "1.5px solid currentcolor",
				})}
			>
				{state === "complete" ? <CheckIcon size={14} strokeWidth={3} /> : number}
			</span>
		);
		let name = (
			<span
				data-slot="step-indicator-label"
				mix={[
					text("sm"),
					raw({ whiteSpace: "nowrap" }),
					when("[data-state='current'] &", weight("semibold")),
				]}
			>
				{children}
			</span>
		);
		let content = (
			<>
				{marker}
				{name}
			</>
		);
		return (
			<li
				{...rest}
				data-slot="step-indicator-step"
				data-state={state}
				aria-current={state === "current" ? "step" : undefined}
				mix={mergeMix(
					[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							color: "var(--ui-neutral-fg-muted, GrayText)",
						}),
						/** A line leads into every step after the first, filled once the reader passes it. */
						when(
							"&:not(:first-child)::before",
							raw({
								content: "''",
								display: "block",
								inlineSize: "clamp(0.75rem, 6cqi, 3rem)",
								blockSize: "1.5px",
								borderRadius: "1px",
								backgroundColor: "currentcolor",
								opacity: "0.4",
							}),
						),
						when(
							"&[data-state='complete'], &[data-state='current']",
							raw({ color: "var(--ui-brand-fg, LinkText)" }),
						),
						when(
							"&[data-state='complete'] [data-slot='step-indicator-marker'], &[data-state='current'] [data-slot='step-indicator-marker']",
							raw({
								backgroundColor: "var(--ui-brand-solid, LinkText)",
								borderColor: "var(--ui-brand-solid, LinkText)",
								color: "var(--ui-brand-fg-on-solid, white)",
							}),
						),
						when("&[data-state='current']", raw({ color: "var(--ui-fg, CanvasText)" })),
						/** Under 24rem a non-current step keeps only its numbered circle. */
						atQuery(
							"(max-width: 24rem)",
							when(
								"&:not([data-state='current']) [data-slot='step-indicator-label']",
								visuallyHidden(),
							),
						),
					],
					mix,
				)}
			>
				{href !== undefined && state === "complete" ? (
					<a
						href={href}
						mix={raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.5rem",
							color: "inherit",
							textDecorationLine: "none",
						})}
					>
						{content}
					</a>
				) : (
					content
				)}
			</li>
		);
	};
};
