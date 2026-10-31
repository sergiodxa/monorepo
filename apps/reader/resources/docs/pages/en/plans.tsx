/**
 * The plan reference: the comparison table read from the limits that enforce it, how to
 * move up a plan or manage billing, and what a failed payment or a downgrade does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { Callout, UiLabel, UiPath } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import PlansTable from "~/resources/components/marketing/plans-table";
import { H2 } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "compare", text: "Compare plans", level: 2 },
	{ id: "your-plan", text: "See your plan", level: 2 },
	{ id: "change", text: "Change plans", level: 2 },
	{ id: "payments", text: "If a payment fails", level: 2 },
];

/** The plans reference's body. */
export default function Plans(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, locale, t } = handle.props;
		return (
			<>
				<p>
					Every plan reads every feed the same way. They differ in how much they keep and what runs
					for you while you are away.
				</p>

				<H2 id="compare">Compare plans</H2>
				<PlansTable t={t} locale={locale} />

				<H2 id="your-plan">See your plan</H2>
				<p>
					<UiPath items={["Settings", "Your plan"]} /> says which plan you are on, what it keeps,
					and how much of it you use: how many feeds you follow and how many posts you saved.
				</p>

				<H2 id="change">Change plans</H2>
				<p>
					In <UiLabel>Your plan</UiLabel>, press <UiLabel>Move to Paid</UiLabel> or{" "}
					<UiLabel>Move to Premium</UiLabel>. You pay on a secure page hosted by our payment
					provider, then return to Reader on the new plan.
				</p>
				<p>
					To change your card, see invoices or cancel, press <UiLabel>Manage billing</UiLabel>.
				</p>
				<Callout kind="note" label="Note">
					<p>
						A plan change never deletes anything. Moving to a smaller plan pauses what is new while
						you are over its numbers. See{" "}
						<a href={docHref("over-plan-limits")}>I'm over my plan's limits</a>.
					</p>
				</Callout>

				<H2 id="payments">If a payment fails</H2>
				<p>
					Everything stays for {figures.graceDays} days. Update your card through{" "}
					<UiLabel>Manage billing</UiLabel> within that time and nothing changes.
				</p>
			</>
		);
	};
}
