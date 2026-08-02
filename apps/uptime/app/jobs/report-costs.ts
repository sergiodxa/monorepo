/**
 * Daily background job that turns yesterday's recorded infrastructure cost into one Polar
 * event per team, carrying a `_cost` for Polar's Cost Insights (ADR-007 §6). It is the
 * reporting half of the cost ledger: the ledger measures operations as they happen, this
 * prices a day of them and hands the figure to the system that already knows what every
 * customer pays.
 *
 * Daily, not per check: per-check ingestion would be 179,000+ Polar calls a month for a
 * single account and Cost Insights can do nothing with the extra resolution. Idempotent by
 * construction: the event's `externalId` is `{team}:{day}`, which Polar deduplicates on, so
 * a retried delivery or a re-run of the same day creates no second event and this job needs
 * no "reported" flag in D1.
 *
 * It also carries the one quantity nothing else can observe — stored bytes — by estimating
 * each team's share of D1 storage from its retained result rows and recording it on its own
 * ledger. That lands the estimate in the dataset for the day this job runs rather than the
 * day it reports, so storage is reported a day later than the operations it accompanies;
 * for a quantity that moves by a fraction of a percent a day, that beats keeping a second
 * path into the dataset with a different notion of when a day is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IngestEvent } from "@pkg/polar";

import { Job } from "@pkg/jobs";
import { PolarClient } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { underscore } from "@pkg/strings";
import { Database, inList } from "remix/data-table";

import type { CostQuantities } from "~/app/lib/cost-rates";
import type { DailyTeamCost } from "~/app/services/cost";

import { getYesterdayDateUtc, utcDayBounds } from "~/app/data/monitor-daily-stats";
import Subscription from "~/app/data/subscription";
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

/** The Polar event name cost rides on — its own name, never a revenue-bearing one. */
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

export class ReportCostsJob extends Job {
	/** The "Report Infrastructure Costs" cron monitor this job reports itself to when it completes. */
	static override monitorId = "ddf291cc-5fd5-4ab7-b016-dea824399990";

	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let polar = getServiceContainer().get(PolarClient);
		let day = getYesterdayDateUtc();

		await this.recordStorage(db);

		let result = await queryAnalytics<Record<string, unknown>>(dailyCostQuery(day));
		if (isFailure(result)) {
			this.logger.error("job.report_costs.query_failed", { day, error: result.error.message });
			throw new Job.RetryError("Could not read the cost dataset", { cause: result.error });
		}

		let byTeam = summariseByTeam(result.data.map(toDailyTeamCost));
		let unattributedCents = 0;

		for (let teamId of UNREPORTABLE_TEAM_IDS) {
			unattributedCents += byTeam.get(teamId)?.cents ?? 0;
			byTeam.delete(teamId);
		}

		let owners = await this.resolveOwners(db, [...byTeam.keys()]);
		let timestamp = new Date(utcDayBounds(day).end - 1);
		let events: IngestEvent[] = [];
		let reportedCents = 0;
		let skippedCents = 0;

		for (let [teamId, teamDay] of byTeam) {
			let ownerId = owners.get(teamId);

			if (!ownerId) {
				skippedCents += teamDay.cents;
				this.logger.error("job.report_costs.unreportable_team", {
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
			this.logger.error("job.report_costs.ingest_failed", { day, events: events.length });
			throw new Job.RetryError("Polar rejected the cost events");
		}

		/**
		 * The two totals that are not reported are logged at error level on purpose. Neither
		 * is a failure of this job — but a growing unattributed or skipped figure means real
		 * spend is landing on nobody, which is exactly the number that would otherwise stay
		 * invisible while per-customer margin quietly stopped adding up.
		 */
		if (unattributedCents > 0 || skippedCents > 0) {
			this.logger.error("job.report_costs.unreported", { day, unattributedCents, skippedCents });
		}

		this.logger.info("job.report_costs.completed", {
			day,
			teams: byTeam.size,
			events: events.length,
			reportedCents,
		});
	}

	/**
	 * Estimates how much stored data each team is responsible for and records it on this
	 * job's own ledger, apportioned by that same estimate — so each team ends up charged for
	 * its own bytes.
	 *
	 * Storage is modelled, not measured: nothing reports a per-team byte count, so this is
	 * retained result rows × a mean row size. KV rides the same weights rather than being
	 * split evenly, which is wrong by roughly 1e-8 cents a day and not worth a second
	 * apportionment to fix.
	 */
	private async recordStorage(db: Database): Promise<void> {
		let result = await db.exec(
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

		this.logger.info("job.report_costs.storage_estimated", { teams: gbByTeam.size, d1Gb });
	}

	/**
	 * Maps each team to the owner whose Polar customer its cost is reported against, leaving
	 * out any team whose owner Polar has never heard of.
	 *
	 * The subscription projection is the signal: a row exists for every owner billing has
	 * ever touched, so an owner absent from it has no Polar customer to attach an event to
	 * and one event naming a customer Polar cannot resolve would reject the whole batch. A
	 * *lapsed* owner is still reported — they still cost money, and their customer record
	 * still exists.
	 */
	private async resolveOwners(db: Database, teamIds: string[]): Promise<Map<string, string>> {
		if (teamIds.length === 0) return new Map();

		let rows = await db.findMany(teams, { where: inList("id", teamIds) });
		let known = new Set((await Subscription.listAll(db)).map((row) => row.external_customer_id));

		let owners = new Map<string, string>();
		for (let row of rows) {
			if (known.has(row.owner_id)) owners.set(row.id, row.owner_id);
		}
		return owners;
	}
}

/**
 * Collapses the query's rows — one per team per rate card — into one entry per team.
 *
 * A group recorded under the current rate card is priced from its quantities, which is why
 * the dataset stores quantities at all: a rate correction re-prices the whole window. A
 * group recorded under an older card keeps the total it was priced at, because a price
 * change must not retroactively restate history.
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
 * The event metadata for one team's day: the drivers behind the amount, so Polar's own
 * dashboard can answer *why* a customer cost what they cost without a second system.
 *
 * Quantity keys are the rate card's resource names in `snake_case`, derived rather than
 * listed, so adding a resource adds it here too. Per-resource money is deliberately absent:
 * it is the quantity times a rate this event already names.
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
