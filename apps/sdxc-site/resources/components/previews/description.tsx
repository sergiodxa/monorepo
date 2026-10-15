/**
 * Live preview island for `Description`. It is the `<p>` a control points
 * `aria-describedby` at, so what it is worth showing is a description doing work: the plan
 * picker's supporting copy is the one place the consequence of the choice is spelled out,
 * and the island swaps it as the selection changes while the element — and the id the
 * select describes itself with — stays put.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Description, Input, Label, Select } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** The plans the picker offers, in the order it lists them. */
const PLANS = [
	{ id: "starter", label: "Starter" },
	{ id: "team", label: "Team" },
	{ id: "enterprise", label: "Enterprise" },
];

/** What each plan commits the workspace to, which is the copy the description carries. */
const PLAN_NOTES: Record<string, string> = {
	starter: "Up to 3 editors, 1 GB of storage, community support.",
	team: "Unlimited editors, 100 GB of storage, and a 1-business-day response.",
	enterprise: "Everything in Team, plus SSO, audit logs, and a named contact.",
};

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const DESCRIPTION_CODE = `let plan = "team";

function choosePlan(event: Event) {
	plan = (event.target as HTMLSelectElement).value;
	void handle.update();
}

<>
	{/* A native select's own change event bubbles, so the field's wrapper is where the
	    island listens; the select stays plain markup. */}
	<div mix={[on<HTMLDivElement, "change">("change", choosePlan)]}>
		<Label htmlFor="plan">Plan</Label>
		<Select id="plan" name="plan" aria-describedby="plan-note">
			{PLANS.map((option) => (
				<Select.Option key={option.id} value={option.id} selected={option.id === plan}>
					{option.label}
				</Select.Option>
			))}
		</Select>
		<Description id="plan-note">{PLAN_NOTES[plan]}</Description>
	</div>

	<Label htmlFor="billingEmail">Billing email</Label>
	<Input
		id="billingEmail"
		name="billingEmail"
		type="email"
		defaultValue="billing@acme.com"
		aria-describedby="billingEmail-note"
	/>
	<Description id="billingEmail-note">
		Invoices and renewal notices go here, not to the workspace owner.
	</Description>
</>`;

/** Two described fields, hydrated so the plan's description answers the plan. */
export const DescriptionPreview = clientEntry(
	import.meta.url,
	function DescriptionPreview(handle: Handle) {
		let plan = "team";

		/** Keeps the chosen plan so its consequence can be spelled out beneath the select. */
		function choosePlan(event: Event) {
			plan = (event.target as HTMLSelectElement).value;
			void handle.update();
		}

		return () => (
			<div mix={[vstack({ gap: 5, align: "stretch" }), is("22rem")]}>
				{/* A native select's own change event bubbles, so the field's wrapper is where the
				    island listens; the select stays plain markup. */}
				<div
					mix={[
						vstack({ gap: 2, align: "stretch" }),
						on<HTMLDivElement, "change">("change", choosePlan),
					]}
				>
					<Label htmlFor="preview-description-plan">Plan</Label>
					<Select
						id="preview-description-plan"
						name="plan"
						aria-describedby="preview-description-plan-note"
					>
						{PLANS.map((option) => (
							<Select.Option key={option.id} value={option.id} selected={option.id === plan}>
								{option.label}
							</Select.Option>
						))}
					</Select>
					<Description id="preview-description-plan-note">{PLAN_NOTES[plan]}</Description>
				</div>

				<div mix={[vstack({ gap: 2, align: "stretch" })]}>
					<Label htmlFor="preview-description-billing">Billing email</Label>
					<Input
						id="preview-description-billing"
						name="billingEmail"
						type="email"
						defaultValue="billing@acme.com"
						aria-describedby="preview-description-billing-note"
					/>
					<Description id="preview-description-billing-note">
						Invoices and renewal notices go here, not to the workspace owner.
					</Description>
				</div>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: DESCRIPTION_CODE, render: () => <DescriptionPreview /> };
