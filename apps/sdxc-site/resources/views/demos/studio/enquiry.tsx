/**
 * Quoin's "start a project" band: the calendar that shows when the next project can start
 * beside a short brief form with budget ranges. The form is checked by the browser's own
 * constraints and posts to the site's example endpoint, so it works with no script at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { Button, Input, Select, TextArea } from "@sdxc/ui";
import { LandingSection } from "@sdxc/ui/landing";
import { landingCtaChrome, landingLead } from "@sdxc/ui/styles";

import { renderNearView } from "~/resources/views/demos/near-view";
import StudioAvailability from "~/resources/views/demos/studio/availability";
import StudioField from "~/resources/views/demos/studio/field";
import {
	BAND,
	caption,
	chapter,
	pageGrid,
	RULE,
	runningHead,
	span,
} from "~/resources/views/demos/studio/grid";
import { DIDONE } from "~/resources/views/demos/studio/type";

/** The budget ranges a brief picks from, in euros excluding VAT. */
const BUDGETS = [
	{ value: "40-80", label: "€40–80k", note: "A focused release" },
	{ value: "80-150", label: "€80–150k", note: "Most first projects" },
	{ value: "150-300", label: "€150–300k", note: "A product, end to end" },
	{ value: "300+", label: "Over €300k", note: "Several teams" },
];

/** The starts a brief can ask for, from the first open month. */
const STARTS = ["March 2027", "April 2027", "May or June 2027", "Later in 2027"];

/** Where the form posts: the site's example endpoint, which returns the reader to this page. */
const ACTION = "/examples/studio/enquiry";

/**
 * Renders the claim and calendar in the first five columns and the form in the last six,
 * one over the other on a phone.
 *
 * @returns The render function producing the band.
 */
export default function StudioEnquiry() {
	return () => (
		<LandingSection id="start" ruled mix={[renderNearView(1100, 1900)]}>
			<div mix={[pageGrid(), raw({ rowGap: "3rem" })]}>
				<p mix={[runningHead()]}>
					<span>06 — Start a project</span>
					<span>Two slots a month</span>
				</p>
				<div mix={[span("1 / 6"), raw({ display: "grid", gap: "2rem", alignContent: "start" })]}>
					<h2 mix={[chapter()]}>
						Booking from <i>March</i>
					</h2>
					<p mix={[landingLead(), raw({ margin: "0" })]}>
						We run two projects at a time. One slot opens in March, the other in June. Send a short
						brief and <strong>Lieve or Tomás replies within two working days</strong>.
					</p>
					<StudioAvailability />
				</div>
				<form
					method="post"
					action={ACTION}
					data-slot="studio-enquiry"
					mix={[span("7 / -1"), form()]}
				>
					<div mix={[pair()]}>
						<StudioField htmlFor="enquiry-name" label="Your name" hint="Tell us who to reply to.">
							<Input id="enquiry-name" name="name" autoComplete="name" required />
						</StudioField>
						<StudioField
							htmlFor="enquiry-email"
							label="Email"
							hint="Enter an email address, like you@company.com."
						>
							<Input id="enquiry-email" name="email" type="email" autoComplete="email" required />
						</StudioField>
					</div>
					<StudioField htmlFor="enquiry-org" label="Organisation" aside="Optional">
						<Input id="enquiry-org" name="organisation" autoComplete="organization" />
					</StudioField>
					<fieldset
						data-slot="studio-field"
						mix={[
							raw({
								margin: "0",
								padding: "0",
								border: "0",
								minInlineSize: "0",
								display: "grid",
								gap: "0.75rem",
							}),
						]}
					>
						<legend
							mix={[
								raw({
									padding: "0",
									marginBlockEnd: "0.75rem",
									fontWeight: "500",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							Budget
						</legend>
						<div
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
									gap: "0.5rem",
								}),
							]}
						>
							{BUDGETS.map((budget, index) => (
								<label key={budget.value} mix={[tile()]}>
									<input
										type="radio"
										name="budget"
										value={budget.value}
										required={index === 0}
										mix={[hiddenInput()]}
									/>
									<span mix={[raw({ fontFamily: DIDONE, fontSize: "1.5rem", lineHeight: "1.1" })]}>
										{budget.label}
									</span>
									<span mix={[caption(), raw({ color: "inherit", opacity: "0.75" })]}>
										{budget.note}
									</span>
								</label>
							))}
						</div>
						<span
							data-slot="studio-hint"
							mix={[
								raw({ display: "none", fontSize: "0.875rem", color: "var(--ui-danger-fg)" }),
								when(":is(fieldset:has(:user-invalid)) &", raw({ display: "block" })),
							]}
						>
							Pick the range closest to what you have set aside.
						</span>
					</fieldset>
					<StudioField
						htmlFor="enquiry-start"
						label="When would you like to start?"
						hint="Choose a month, or later in 2027."
					>
						<Select id="enquiry-start" name="start" required>
							<Select.Option value="">Choose a start</Select.Option>
							{STARTS.map((start) => (
								<Select.Option key={start} value={start}>
									{start}
								</Select.Option>
							))}
						</Select>
					</StudioField>
					<StudioField
						htmlFor="enquiry-brief"
						label="What should it change?"
						aside="40+ characters"
						hint="A sentence or two is enough: who uses it, and what should be different after."
					>
						<TextArea
							id="enquiry-brief"
							name="brief"
							rows={5}
							minLength={40}
							required
							placeholder="Who uses it today, and what should be different after."
						/>
					</StudioField>
					<div
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								alignItems: "center",
								gap: "1rem 1.5rem",
								paddingBlockStart: "0.5rem",
							}),
						]}
					>
						<Button type="submit" color="brand" mix={[landingCtaChrome()]}>
							Send the brief
						</Button>
						<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
							Read by the two founders, and nobody else.
						</span>
					</div>
				</form>
			</div>
		</LandingSection>
	);
}

/** The form's column: fields stacked on a 2rem rhythm under a rule. */
function form() {
	return raw({
		display: "grid",
		gap: "1.75rem",
		alignContent: "start",
		paddingBlockStart: "1.5rem",
		borderBlockStart: RULE,
	});
}

/** Two short fields side by side from `md`, stacked below it. */
function pair() {
	return [
		raw({ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "1.75rem" }),
		at("md", BAND, raw({ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: "1rem" })),
	];
}

/**
 * A budget tile: a ruled box with the range in the Didone, filled with the ink when chosen
 * and ringed in the brand while focused, its radio kept for the keyboard and the form.
 */
function tile() {
	return [
		raw({
			position: "relative",
			display: "grid",
			gap: "0.375rem",
			padding: "0.875rem 1rem",
			cursor: "pointer",
			color: "var(--ui-neutral-fg-emphasis)",
			boxShadow: "inset 0 0 0 1px var(--ui-neutral-border-strong)",
		}),
		when(
			"&:has(:checked)",
			raw({ backgroundColor: "var(--ui-neutral-fg-emphasis)", color: "var(--ui-bg)" }),
		),
		when(
			"&:has(:focus-visible)",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
		),
		when(
			":is(fieldset:has(:user-invalid)) &",
			raw({ boxShadow: "inset 0 0 0 1px var(--ui-danger-fg)" }),
		),
	];
}

/** The radio itself, out of sight but in the tab order and the form's validation. */
function hiddenInput() {
	return raw({
		position: "absolute",
		inset: "0",
		margin: "0",
		opacity: "0",
		cursor: "pointer",
	});
}
