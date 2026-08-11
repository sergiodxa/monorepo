/**
 * Discovery and checking for a domain monitor: it turns a domain — plus the names a pasted
 * zone file declares — into the records the monitor watches, and runs the sweep-and-diff one
 * check performs. It sits between the resolver, the zone-file parser and the record table so
 * every entry point that discovers (the API, the create form, a re-import) and every one that
 * checks discovers and checks identically.
 *
 * Nothing here retains the pasted text: callers hand it the parsed records, and what is
 * persisted is those records and the fact that an import happened.
 *
 * The limits every DNS surface quotes live here too, derived from the platform's subrequest
 * ceiling rather than repeated per caller, so a screen that refuses a zone and a job that
 * sweeps one can never be governed by two different numbers.
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
 * Outbound subrequests one Worker invocation may make on the paid plan. Quoted here because
 * every other limit below is derived from it, and because the failure it guards against is a
 * hard one: the 1,001st subrequest throws, mid-sweep, for a domain whose records are almost
 * all fine.
 */
const SUBREQUEST_LIMIT = 1_000;

/**
 * How many of {@link SUBREQUEST_LIMIT} one invocation may spend on DNS queries.
 *
 * The remaining 400 are not slack: the monitor claim, the owner lookup, the queue batch, the
 * ping ingestion and — the part that scales — the several D1 statements each monitor's diff
 * reads and writes all leave through the same counter. Sizing the query budget at the full
 * ceiling would mean a sweep failing on its own bookkeeping rather than on its queries.
 */
export const INVOCATION_QUERY_BUDGET = Math.floor(SUBREQUEST_LIMIT * 0.6);

/**
 * The most names one check of one monitor may sweep: the invocation's whole query budget,
 * expressed in the unit a customer's zone is measured in. 100 names is 600 queries.
 *
 * READ THIS BEFORE MERGING IT WITH {@link MAX_TRACKED_NAMES_PER_MONITOR}. The two are
 * different quantities that are deliberately equal, not one constant written twice:
 *
 * - this one is what a single invocation can *afford* — it comes from the platform's
 *   subrequest ceiling and would change if that ceiling, the reserve, or the number of record
 *   types swept per name changed;
 * - the other is what a monitor may *hold* — it comes from the product's promise that a zone
 *   we accept at import is a zone we can sweep whole on every check.
 *
 * Keeping the second derived from the first is what makes that promise true: an import cap
 * above this would accept zones that are truncated on every single check forever, and one
 * below it would refuse zones we can in fact sweep. If they ever need to diverge, the sweep
 * cap is the ceiling and the import cap must stay under it.
 */
export const MAX_NAMES_PER_CHECK = Math.floor(INVOCATION_QUERY_BUDGET / QUERIES_PER_NAME);

/**
 * Most names one monitor may track, and therefore the most a single import may add.
 *
 * Enforced at import rather than at check time on purpose: a zone that cannot be swept must
 * be refused while the user is still looking at the paste box, not silently truncated months
 * later in a background job. See {@link MAX_NAMES_PER_CHECK} for why it is derived from the
 * sweep cap rather than chosen.
 */
export const MAX_TRACKED_NAMES_PER_MONITOR = MAX_NAMES_PER_CHECK;

/**
 * Names swept at once inside one check. Each one is already {@link QUERIES_PER_NAME} parallel
 * queries, so this sits below the flat sweeps' shared concurrency: the number that matters to
 * a resolver is queries in flight, not names, and a caller may run several checks at once —
 * the product of the two is what has to stay bounded.
 *
 * Workers holds at most six simultaneous outbound connections, so a number above six is
 * pipeline depth rather than parallelism: the excess queues instead of failing, which is what
 * makes overshooting cheap and undershooting expensive.
 */
const NAME_CONCURRENCY = 4;

/** What a sweep of several names amounts to, in the shape the diff and the result row want. */
export interface DnsSweep {
	/** Only the queries that answered. A failed one is absent, never an empty answer. */
	answers: DnsQueryAnswer[];
	queriesFailed: number;
	/**
	 * The slowest single query, not the sum: this feeds a latency chart, not a cost one.
	 *
	 * `null` when not one name was reached at all, because the column is nullable for exactly
	 * that and a zero there would read as an instant answer rather than as no answer.
	 */
	responseTimeMs: number | null;
	/** The first failure's reason, for the result row's `error_message`. */
	errorMessage: string | null;
}

/** What one import added, and what the sweep behind it cost. */
export interface DnsDiscovery {
	/** Names swept, which is the set every later check will query. */
	names: string[];
	/** Records that were not already tracked. A re-import mostly adds nothing, and says so. */
	imported: number;
	queriesFailed: number;
}

/**
 * The names one check of one monitor sweeps, and what had to be left out to get there.
 *
 * Planning is separate from running because a caller with a query budget of its own — the
 * scheduled sweep, which spends one invocation's allowance across every monitor it claimed —
 * has to know the size of the work before it commits to it, and has to be able to sweep only
 * part of it. Everything else runs the whole plan.
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
	 * What the check classified, which is what an alert quotes. It travels with the run
	 * because only this invocation holds it: the diff is computed here and never persisted,
	 * so anything reconstructed later reports what is outstanding rather than what changed.
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
 * Sweeps every supported record type at each name, bounded so one call stays inside a single
 * invocation's subrequest budget.
 *
 * A name whose sweep threw counts its whole set of queries as failed rather than as answered
 * with nothing: the two mean opposite things, and reporting the second would tell a customer
 * every record at that name had vanished because we could not reach a resolver.
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
			 * A failed query is OMITTED from what the diff sees, never handed over with an empty
			 * `values`. The two mean opposite things: empty is "there is nothing of this type
			 * here", a failure is "we did not find out", and diffing the second would tell a
			 * customer every record at that name vanished because a resolver had a bad minute.
			 * The diff leaves a `(name, type)` it was given no answer for exactly as it found it.
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
 * Discovers a monitor's records: sweeps `names`, stores everything that resolved as watched,
 * and stores everything the zone file declared but the resolver did not answer as a finding
 * that is *not* watched.
 *
 * That second half is ADR-026 §8. A declared record that does not resolve is high-signal at
 * import — a stale delegation, a change that never published, a typo between the console and
 * the file — and worthless as a standing alert, because the file is pasted once and every
 * legitimate change after it widens a divergence nobody wants emailed about. It is also the
 * common case rather than the exceptional one on a proxied zone, where the customer's records
 * genuinely are not in public DNS.
 *
 * Importing never overwrites `is_enabled` on a record already tracked (see
 * `DnsMonitorRecord.importMany`), so a re-import cannot silently re-enable something the user
 * declined.
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
 * Works out what one check of a monitor would sweep, without sweeping anything.
 *
 * The apex is always included, even when no record of it is stored: it is the one name we
 * know without being told, and a monitor whose records were all declined must still be able
 * to discover something appearing there.
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
 * Runs one check over exactly the names it is handed: sweeps them, classifies the answers
 * against the stored baseline, writes the record-level effects and the history row.
 *
 * The single place a check is performed. Every entry point — the scheduled sweep, "Check
 * now", anything later — goes through here, so a monitor cannot behave one way on the hour
 * and another way when a customer presses the button. A caller that could not afford the
 * whole plan reports the shortfall as `unsweptNames` rather than shortening the plan
 * silently: names nobody looked at are queries that did not answer, like any other, and that
 * is what keeps a budget cut-off reading as a partial check instead of as missing records.
 *
 * The monitor's status is `error` when any query failed, `changed` when any watched record is
 * missing or edited or any record is new, and `ok` otherwise — the same three words every
 * other DNS surface already reads, so nothing downstream has to learn a new one. `error`
 * outranks `changed` because an unanswered query means the diff is incomplete, and reporting
 * "everything is fine except these three findings" from a partial answer is the one thing a
 * sweep must never do.
 *
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
	 * The diff is applied before the caller hears anything back, and that order is
	 * load-bearing: an alert carries ids and statuses only, and its consumer reads the
	 * findings back off these rows. A message enqueued ahead of the write could be delivered
	 * against a baseline that has not moved yet.
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
		 * Only a resolver's own words, never ours: a check cut short by a caller's query
		 * budget has `queries_failed` to say so, and inventing a sentence for it here would
		 * put untranslated English on a customer's screen from a job that has no request, no
		 * locale and no way to get one.
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
