/**
 * Daily background job that turns yesterday's recorded infrastructure cost into one
 * Polar event per team, carrying a `_cost` for Polar's Cost Insights (ADR-007 §6).
 * Runs once a day: per-check ingestion would be 179,000+ Polar calls a month per
 * account, far past that resolution. The event's `externalId` (`{team}:{day}`) makes
 * a retried delivery or a re-run of the same day free of duplicate events.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CurrentJobContext } from "@pkg/jobs-next";
import type { IngestEvent } from "@pkg/polar";
import type { Database } from "remix/data-table";

import { createJobHandler } from "@pkg/jobs-next";
import { PolarClient } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { underscore } from "@pkg/strings";
import { inList } from "remix/data-table";

import type { CostQuantities } from "~/app/lib/cost-rates";
import type { DailyTeamCost } from "~/app/services/cost";

import { getYesterdayDateUtc, utcDayBounds } from "~/app/data/monitor-daily-stats";
import Subscription from "~/app/data/subscription";
import jobs from "~/app/jobs";
import {
	BYTES_PER_GB,
	COST_RESOURCES,
	createCostQuantities,
	D1_MEAN_ROW_BYTES,
	KV_MEAN_BYTES_PER_TEAM,
	priceCostQuantities,
	RATE_CARD_VERSION,
} from "~/app/lib/cost-rates";
import { queryAnalytics } from "~/app/services/analytics";
import {
	apportionCost,
	dailyCostQuery,
	OVERFLOW_TEAM_ID,
	PLATFORM_TEAM_ID,
	recordCost,
	toDailyTeamCost,
} from "~/app/services/cost";
import { teams } from "~/database/schema";

/** The Polar event name cost rides on — a name reserved for cost, apart from revenue events. */
const EVENT_NAME = "infra.cost.daily";

/**
 * Decimal places on the reported amount. Nine places of a cent is $1e-11 of resolution,
 * which is far below anything that matters, and keeps a three-figure daily cost clear of
 * Polar's 17-significant-digit ceiling.
 */
const AMOUNT_DECIMALS = 9;

/** Team ids the ledger writes that name no customer and therefore cannot be reported. */
const UNREPORTABLE_TEAM_IDS: readonly string[] = [PLATFORM_TEAM_ID, OVERFLOW_TEAM_ID];

/** One team's day, summed across however many rate cards it was recorded under. */
interface TeamDay {
	quantities: CostQuantities;
	/** Priced total in cents, each rate-card group priced under the card that applies. */
	cents: number;
	/** Every rate card the day's quantities were recorded under, in the order seen. */
	rateCards: string[];
}

export default createJobHandler(jobs.reportCosts, async (ctx) => {
	let polar = getServiceContainer().get(PolarClient);
	let day = getYesterdayDateUtc();

	await recordStorage(ctx);

	let result = await queryAnalytics<Record<string, unknown>>(dailyCostQuery(day));
	if (isFailure(result)) {
		ctx.logger.error("job.report_costs.query_failed", { day, error: result.error.message });
		return ctx.retry({ cause: result.error });
	}

	let byTeam = summariseByTeam(result.data.map(toDailyTeamCost));
	let unattributedCents = 0;

	for (let teamId of UNREPORTABLE_TEAM_IDS) {
		unattributedCents += byTeam.get(teamId)?.cents ?? 0;
		byTeam.delete(teamId);
	}

	let owners = await resolveOwners(ctx.database, [...byTeam.keys()]);
	let timestamp = new Date(utcDayBounds(day).end - 1);
	let events: IngestEvent[] = [];
	let reportedCents = 0;
	let skippedCents = 0;

	for (let [teamId, teamDay] of byTeam) {
		let ownerId = owners.get(teamId);

		if (!ownerId) {
			skippedCents += teamDay.cents;
			ctx.logger.error("job.report_costs.unreportable_team", {
				day,
				teamId,
				cents: teamDay.cents,
			});
			continue;
		}

		reportedCents += teamDay.cents;
		events.push({
			name: EVENT_NAME,
			externalCustomerId: ownerId,
			/** Keyed on team and day and nothing time-dependent, which is what makes a retry free. */
			externalId: `infra_cost:${teamId}:${day}`,
			/** Explicit, so a run that is late by two days still books cost to the day it happened. */
			timestamp,
			cost: { amount: teamDay.cents.toFixed(AMOUNT_DECIMALS), currency: "usd" },
			metadata: toMetadata(teamId, day, teamDay),
		});
	}

	if (events.length > 0 && !(await polar.ingestEventsSafe(events))) {
		ctx.logger.error("job.report_costs.ingest_failed", { day, events: events.length });
		return ctx.retry();
	}

	/**
	 * Logged at error level on purpose: a growing unattributed or skipped figure means
	 * real spend is landing on nobody, the number that would otherwise stay invisible
	 * while per-customer margin quietly stopped adding up.
	 */
	if (unattributedCents > 0 || skippedCents > 0) {
		ctx.logger.error("job.report_costs.unreported", { day, unattributedCents, skippedCents });
	}

	ctx.logger.info("job.report_costs.completed", {
		day,
		teams: byTeam.size,
		events: events.length,
		reportedCents,
	});
});

/**
 * Estimates each team's stored bytes as retained result rows × a mean row size, since
 * nothing reports a real per-team byte count, and apportions this job's own ledger by
 * that estimate. KV rides the same weights, off by roughly 1e-8 cents a day.
 */
async function recordStorage(ctx: CurrentJobContext): Promise<void> {
	let result = await ctx.database.exec(
		`SELECT team_id AS teamId, COUNT(*) AS count
			   FROM (SELECT m.team_id
			           FROM monitor_results r JOIN monitors m ON m.id = r.monitor_id
			         UNION ALL
			         SELECT m.team_id
			           FROM dns_monitor_results r JOIN dns_monitors m ON m.id = r.dns_monitor_id
			         UNION ALL
			         SELECT m.team_id
			           FROM tcp_monitor_results r JOIN tcp_monitors m ON m.id = r.tcp_monitor_id
			         UNION ALL
			         SELECT m.team_id
			           FROM cron_job_pings p JOIN cron_job_monitors m ON m.id = p.cron_job_monitor_id)
			  GROUP BY team_id`,
	);

	let rows = (result.rows ?? []) as unknown as { teamId: string; count: number }[];
	let gbByTeam = new Map(
		rows.map((row) => [row.teamId, (Number(row.count) * D1_MEAN_ROW_BYTES) / BYTES_PER_GB]),
	);

	let d1Gb = 0;
	for (let gb of gbByTeam.values()) d1Gb += gb;

	recordCost("d1StorageGbDay", d1Gb);
	recordCost("kvStorageGbDay", (gbByTeam.size * KV_MEAN_BYTES_PER_TEAM) / BYTES_PER_GB);
	apportionCost(gbByTeam);

	ctx.logger.info("job.report_costs.storage_estimated", { teams: gbByTeam.size, d1Gb });
}

/**
 * Maps each team to the owner its cost reports against, using the subscription
 * projection as the source of truth — a row exists for every owner billing has
 * touched, and one event naming a customer Polar cannot resolve rejects the batch.
 */
async function resolveOwners(db: Database, teamIds: string[]): Promise<Map<string, string>> {
	if (teamIds.length === 0) return new Map();

	let rows = await db.findMany(teams, { where: inList("id", teamIds) });
	let known = new Set((await Subscription.listAll(db)).map((row) => row.external_customer_id));

	let owners = new Map<string, string>();
	for (let row of rows) {
		if (known.has(row.owner_id)) owners.set(row.id, row.owner_id);
	}
	return owners;
}

/**
 * Collapses the query's rows — one per team per rate card — into one entry per team.
 * A current-rate-card group is re-priced from its stored quantities, so a rate
 * correction can re-price the whole retained window without touching older totals.
 *
 * @param rows - Every row the daily query returned.
 * @returns One summed {@link TeamDay} per team id.
 */
function summariseByTeam(rows: DailyTeamCost[]): Map<string, TeamDay> {
	let byTeam = new Map<string, TeamDay>();

	for (let row of rows) {
		let teamDay = byTeam.get(row.teamId);
		if (!teamDay) {
			teamDay = { quantities: createCostQuantities(), cents: 0, rateCards: [] };
			byTeam.set(row.teamId, teamDay);
		}

		for (let resource of COST_RESOURCES) teamDay.quantities[resource] += row.quantities[resource];
		teamDay.cents +=
			row.rateCard === RATE_CARD_VERSION ? priceCostQuantities(row.quantities) : row.reportedCents;
		if (!teamDay.rateCards.includes(row.rateCard)) teamDay.rateCards.push(row.rateCard);
	}

	return byTeam;
}

/**
 * The event metadata for one team's day — the drivers behind the amount, so Polar's
 * own dashboard can answer *why* a customer cost what they cost. Quantity keys derive
 * from the rate card's resource names, so a new resource is covered automatically.
 *
 * @param teamId - The team the day belongs to.
 * @param day - The reported UTC day, `YYYY-MM-DD`.
 * @param teamDay - The team's summed quantities and priced total.
 * @returns Flat metadata for the ingested event.
 */
function toMetadata(
	teamId: string,
	day: string,
	teamDay: TeamDay,
): Record<string, string | number | boolean> {
	let metadata: Record<string, string | number | boolean> = {
		team_id: teamId,
		day,
		rate_card: teamDay.rateCards.join(","),
	};

	for (let resource of COST_RESOURCES) {
		metadata[underscore(resource)] = teamDay.quantities[resource];
	}

	return metadata;
}
