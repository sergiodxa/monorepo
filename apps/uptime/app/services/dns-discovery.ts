/**
 * Discovery and checking for a domain monitor: turns a domain and any zone-file names into
 * the records it watches, and runs the sweep-and-diff every check performs. Sits between
 * the resolver, the zone-file parser and the record table so every entry point that
 * discovers or checks does so identically.
 *
 * What survives an import is the parsed records themselves and the fact that an import
 * happened. The DNS limits every surface quotes live here too, derived from the platform's
 * subrequest ceiling, so a screen that refuses a zone and a job that sweeps one share one
 * number.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import type {
	DnsQueryAnswer,
	DnsRecordCounts,
	DnsRecordDiff,
	DnsRecordImport,
} from "~/app/data/dns-monitor-record";
import type { DnsCheckStatus } from "~/app/services/dns-check";
import type { ZoneFileRecord } from "~/app/services/zone-file";

import DnsMonitor from "~/app/data/dns-monitor";
import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { normalizeDnsName } from "~/app/lib/dns-record-value";
import { QUERIES_PER_NAME, sweepDnsName } from "~/app/services/dns-check";

/**
 * Outbound subrequests one Worker invocation may make on the paid plan. Every limit below is
 * derived from this one, because the failure it guards against is unforgiving: the 1,001st
 * subrequest throws mid-sweep, on a domain whose records are almost all fine.
 */
const SUBREQUEST_LIMIT = 1_000;

/**
 * How many of {@link SUBREQUEST_LIMIT} one invocation may spend on DNS queries; the
 * remaining budget covers the monitor claim, owner lookup, queue batch, ping ingestion and
 * each monitor's own D1 statements — sized so a sweep's failures trace to its queries.
 */
export const INVOCATION_QUERY_BUDGET = Math.floor(SUBREQUEST_LIMIT * 0.6);

/**
 * The most names one check of one monitor may sweep, from the invocation's whole query
 * budget. Equal to {@link MAX_TRACKED_NAMES_PER_MONITOR} on purpose — this is what an
 * invocation can afford, and if the two ever diverge, this value is the ceiling.
 */
export const MAX_NAMES_PER_CHECK = Math.floor(INVOCATION_QUERY_BUDGET / QUERIES_PER_NAME);

/**
 * Most names one monitor may track, and therefore the most a single import may add. Enforced
 * at import, while the user is still at the paste box, so a zone too large to sweep is
 * refused before it is ever stored.
 *
 * @see MAX_NAMES_PER_CHECK for why this value is derived from the sweep cap.
 */
export const MAX_TRACKED_NAMES_PER_MONITOR = MAX_NAMES_PER_CHECK;

/**
 * Names swept at once inside one check. Each name is already {@link QUERIES_PER_NAME}
 * parallel queries, and several checks may run at once, so this stays under the six
 * simultaneous outbound connections Workers grants — a higher value only adds queuing depth.
 */
const NAME_CONCURRENCY = 4;

/** What a sweep of several names amounts to, in the shape the diff and the result row want. */
export interface DnsSweep {
	/**
	 * Only the queries that answered — an empty answer means no records of that type; a
	 * failed query is simply absent from the list.
	 */
	answers: DnsQueryAnswer[];
	queriesFailed: number;
	/**
	 * The slowest single query, for a latency chart. `null` marks a sweep that reached no
	 * name at all, keeping a genuine zero-latency answer distinguishable as its own value.
	 */
	responseTimeMs: number | null;
	/** The first failure's reason, for the result row's `error_message`. */
	errorMessage: string | null;
}

/** What one import added, and what the sweep behind it cost. */
export interface DnsDiscovery {
	/** Names swept, which is the set every later check will query. */
	names: string[];
	/** Records new to the monitor; a re-import usually contributes zero, and the count says so. */
	imported: number;
	queriesFailed: number;
}

/**
 * The names one check of one monitor sweeps, and what had to be left out to get there. Kept
 * separate from running so a budget-constrained caller — the scheduled sweep, spending one
 * invocation's allowance across every monitor it claimed — can size the work before committing.
 */
export interface DnsCheckPlan {
	/** What to sweep, already capped at {@link MAX_NAMES_PER_CHECK}. */
	names: string[];
	/** How many names the monitor tracks, which is `0` for one nobody has imported into. */
	tracked: number;
	/** Names dropped by the cap. Zero unless a monitor grew past what an import may add. */
	overflow: number;
}

/** What one completed check produced, beyond the record rows it moved. */
export interface DnsCheckRun {
	/** The history row's id — the idempotency key a ping is billed under. */
	resultId: string;
	status: DnsCheckStatus;
	/** `null` when no query answered; the analytics dataset spells that as `0` itself. */
	responseTimeMs: number | null;
	counts: DnsRecordCounts;
	queriesFailed: number;
	/**
	 * What the check classified, which is what an alert quotes. Computed fresh inside this
	 * invocation and handed back with the run, since reading the records back later shows
	 * only today's outstanding state.
	 */
	diff: DnsRecordDiff;
}

/**
 * The names a monitor covers: its apex, plus every owner a zone file declared.
 *
 * Without a zone file this is one name, which is the whole honest limit of the feature — DNS
 * refuses to enumerate a zone, so a name nobody told us about is invisible to us.
 */
export function discoveryNames(
	domain: string,
	zoneRecords: readonly ZoneFileRecord[] = [],
): string[] {
	return [...new Set([normalizeDnsName(domain), ...zoneRecords.map((record) => record.name)])];
}

/**
 * Sweeps every supported record type at each name, bounded to stay inside one invocation's
 * subrequest budget. A name whose sweep throws counts its full set of queries as failed, so
 * a resolver outage reads as an unanswered sweep, distinct from vanished records.
 */
export async function sweepNames(names: readonly string[]): Promise<DnsSweep> {
	let answers: DnsQueryAnswer[] = [];
	let queriesFailed = 0;
	let responseTimeMs: number | null = null;
	let errorMessage: string | null = null;

	let settled = await mapWithConcurrency([...names], sweepDnsName, NAME_CONCURRENCY);

	for (let outcome of settled) {
		if (!outcome.ok) {
			queriesFailed += QUERIES_PER_NAME;
			errorMessage ??=
				outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
			continue;
		}

		queriesFailed += outcome.value.queriesFailed;
		responseTimeMs = Math.max(responseTimeMs ?? 0, outcome.value.responseTimeMs);

		for (let query of outcome.value.outcomes) {
			/**
			 * Skipped so the diff can tell a resolver hiccup apart from vanished records — a
			 * `(name, type)` with no answer is left exactly as it was found.
			 */
			if (query.errorMessage !== null) {
				errorMessage ??= query.errorMessage;
				continue;
			}

			answers.push({
				name: query.name,
				record_type: query.recordType,
				values: query.values,
			});
		}
	}

	return { answers, queriesFailed, responseTimeMs, errorMessage };
}

/**
 * Discovers a monitor's records: what `names` resolves to is stored watched, and what the
 * zone file declared without a matching answer is stored as an unwatched finding —
 * high-signal once at import (ADR-026 §8), ordinary on a proxied zone forever after.
 *
 * @see DnsMonitorRecord.importMany for why a record the user already declined stays declined
 * on a re-import.
 */
export async function importDiscovery(
	db: Database,
	monitorId: string,
	names: readonly string[],
	zoneRecords: readonly ZoneFileRecord[] = [],
	now: number = Date.now(),
): Promise<DnsDiscovery> {
	let sweep = await sweepNames(names);

	let imports: DnsRecordImport[] = [];
	let resolved = new Set<string>();

	for (let answer of sweep.answers) {
		for (let value of answer.values) {
			let identity = `${answer.name} ${answer.record_type} ${value}`;
			if (resolved.has(identity)) continue;
			resolved.add(identity);

			imports.push({
				name: answer.name,
				record_type: answer.record_type,
				value,
				source: "resolver",
				is_enabled: true,
				status: "ok",
				last_seen_at: now,
			});
		}
	}

	for (let record of zoneRecords) {
		if (resolved.has(`${record.name} ${record.type} ${record.value}`)) continue;

		imports.push({
			name: record.name,
			record_type: record.type,
			value: record.value,
			source: "zone_file",
			is_enabled: false,
			status: "missing",
			last_seen_at: null,
		});
	}

	let imported = await DnsMonitorRecord.importMany(db, monitorId, imports, now);

	return { names: [...names], imported, queriesFailed: sweep.queriesFailed };
}

/**
 * Works out what one check of a monitor would sweep, purely as a plan. The apex is always
 * included, even with no record of it stored yet: it is the one name a monitor knows without
 * being told, so a domain whose records were all declined can still surface something new.
 */
export async function planDnsCheck(
	db: Database,
	monitorId: string,
	domain: string,
): Promise<DnsCheckPlan> {
	let tracked = await DnsMonitorRecord.listNames(db, monitorId);
	let names = [...new Set(discoveryNames(domain, []).concat(tracked))];

	return {
		names: names.slice(0, MAX_NAMES_PER_CHECK),
		tracked: tracked.length,
		overflow: Math.max(0, names.length - MAX_NAMES_PER_CHECK),
	};
}

/**
 * Runs one check over exactly the names it is handed, writing both the record effects and
 * the history row. The single place a check runs, so the scheduled sweep and "Check now"
 * always agree, with `error` outranking `changed` since an incomplete diff reads as incomplete.
 *
 * @param unsweptNames Names the caller's budget left uncovered; counted as failed queries so
 * a budget cut-off stays legible as a partial check.
 * @returns The history row's id and what the check counted, which is everything a caller
 * needs to meter, report and alert on it.
 */
export async function recordDnsCheck(
	db: Database,
	monitorId: string,
	names: readonly string[],
	unsweptNames = 0,
): Promise<DnsCheckRun> {
	let sweep = await sweepNames(names);
	let queriesFailed = sweep.queriesFailed + unsweptNames * QUERIES_PER_NAME;

	/**
	 * Applied before the caller hears anything back: an alert carries only ids and statuses,
	 * and its consumer reads the findings back off these rows, so the write must land before
	 * any message referencing it is enqueued.
	 */
	let diff = await DnsMonitorRecord.diff(db, monitorId, sweep.answers);
	await DnsMonitorRecord.applyDiff(db, monitorId, diff);

	let counts = DnsMonitorRecord.summarize(diff);
	let status: DnsCheckStatus = "ok";
	if (queriesFailed > 0) status = "error";
	else if (counts.recordsChanged + counts.recordsMissing + counts.recordsNew > 0) {
		status = "changed";
	}

	let resultId = await DnsMonitor.recordCheckResult(db, monitorId, {
		status,
		responseTimeMs: sweep.responseTimeMs,
		/**
		 * A resolver's own words only: `queries_failed` already reports when a caller's budget
		 * cut a check short, and this job has no request, no locale, and no way to translate a
		 * sentence of its own.
		 */
		errorMessage: status === "error" ? sweep.errorMessage : null,
		queriesFailed,
		...counts,
	});

	return {
		resultId,
		status,
		responseTimeMs: sweep.responseTimeMs,
		counts,
		queriesFailed,
		diff,
	};
}

/**
 * Runs one whole check of a monitor: what an on-demand check does, and what the scheduled
 * sweep does for every monitor it has the budget for.
 */
export async function runDnsCheck(
	db: Database,
	monitorId: string,
	domain: string,
): Promise<DnsCheckRun> {
	let plan = await planDnsCheck(db, monitorId, domain);
	return await recordDnsCheck(db, monitorId, plan.names, plan.overflow);
}
