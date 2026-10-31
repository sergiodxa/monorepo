/**
 * The three plans side by side, every figure read from the limits the reader's own object
 * enforces, so the table can never promise more than a reader gets or less than they have.
 * It shows what each plan keeps and runs; checkout states the price.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { CheckIcon, MinusIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { weight } from "@sdxc/u/typography";
import { Table } from "@sdxc/ui";

import type { Tier } from "~/app/services/entitlement";

import { TIERS, TIER_LIMITS } from "~/app/services/entitlement";
import { formatInterval } from "~/resources/components/marketing/scenes";

/** Which tiers carry each ability the policy grants, in the policy's own order. */
const ABILITY_TIERS: Record<"articles" | "labels" | "agents" | "email", readonly Tier[]> = {
	articles: ["paid", "premium"],
	labels: ["paid", "premium"],
	agents: ["paid", "premium"],
	email: ["premium"],
};

namespace PlansTable {
	export interface Props {
		t: Translate;
		locale: string;
	}
}

/**
 * Renders the plan comparison. Numbers use the request's locale; an ability a plan lacks
 * is a dash with a spoken "not included", so the grid reads the same to every reader.
 */
export default function PlansTable(handle: Handle<PlansTable.Props>) {
	return () => {
		let { locale, t } = handle.props;
		let count = (value: number) => value.toLocaleString(locale);
		let yes = (
			<span mix={[raw({ display: "inline-flex", color: "var(--ui-brand-fg)" })]}>
				<CheckIcon size={16} aria-label={t("landing.plans.included")} />
			</span>
		);
		let no = (
			<span mix={[raw({ display: "inline-flex", color: "var(--ui-neutral-fg-muted)" })]}>
				<MinusIcon size={16} aria-label={t("landing.plans.notIncluded")} />
			</span>
		);

		let rows: { label: string; cells: Record<Tier, unknown> }[] = [
			{
				label: t("landing.plans.rows.feeds"),
				cells: perTier((tier) => count(TIER_LIMITS[tier].feeds)),
			},
			{
				label: t("landing.plans.rows.posts"),
				cells: perTier((tier) => count(TIER_LIMITS[tier].posts)),
			},
			{
				label: t("landing.plans.rows.saved"),
				cells: perTier((tier) => count(TIER_LIMITS[tier].saved)),
			},
			{
				label: t("landing.plans.rows.search"),
				cells: perTier((tier) => {
					let days = TIER_LIMITS[tier].searchWindowDays;
					return days === null ? t("landing.plans.everything") : t("landing.plans.days", { days });
				}),
			},
			{
				label: t("landing.plans.rows.filters"),
				cells: perTier((tier) =>
					TIER_LIMITS[tier].rules === 0 ? no : count(TIER_LIMITS[tier].rules),
				),
			},
			{
				label: t("landing.plans.rows.checks"),
				cells: perTier((tier) => {
					let interval = TIER_LIMITS[tier].checkIntervalMs;
					return interval === null ? no : formatInterval(interval);
				}),
			},
			...(["articles", "labels", "agents", "email"] as const).map((ability) => ({
				label: t(`landing.plans.rows.${ability}`),
				cells: perTier((tier) => (ABILITY_TIERS[ability].includes(tier) ? yes : no)),
			})),
		];

		return (
			<Table.Container>
				<Table aria-label={t("landing.plans.label")}>
					<Table.Header>
						<Table.Row>
							<Table.Column>{t("landing.plans.column")}</Table.Column>
							{TIERS.map((tier) => (
								<Table.Column key={tier}>{t(`settings.plan.names.${tier}`)}</Table.Column>
							))}
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{rows.map((row) => (
							<Table.Row key={row.label}>
								<Table.Cell mix={[weight(500), fg("neutral.emphasis")]}>{row.label}</Table.Cell>
								{TIERS.map((tier) => (
									<Table.Cell key={tier} mix={[raw({ fontVariantNumeric: "tabular-nums" })]}>
										{row.cells[tier] as string}
									</Table.Cell>
								))}
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}

/** One value per tier, computed by `cell`, keyed so a row reads its cells in tier order. */
function perTier<Value>(cell: (tier: Tier) => Value): Record<Tier, Value> {
	return { free: cell("free"), paid: cell("paid"), premium: cell("premium") };
}
