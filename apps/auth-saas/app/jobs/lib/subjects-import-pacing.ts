/**
 * The subject import job's own pacing numbers, broken out of the job itself so a
 * test can substitute a tighter cap and force an early stop mid-file without
 * touching the numbers production runs under, the same way a test elsewhere in
 * this app substitutes one collaborator to drive a path production traffic would
 * take many requests to reach.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Rows sent to one `importSubjects` call, matching the object's own transaction-sized batch. */
export const BATCH_SIZE = 200;

/**
 * How long one tick spends moving rows before it stops and leaves the rest for the
 * next tick. Cloudflare Workers bill and cap CPU time, not wall-clock time spent
 * `await`ing an RPC or an R2 read, so a tick can spend real seconds here without
 * approaching that ceiling — twenty seconds leaves comfortable headroom under the
 * dispatcher's own five-minute job timeout while still finishing well inside the
 * minute before the next cron trigger fires.
 */
export const TICK_TIME_BUDGET_MS = 20_000;

/**
 * How many batches one run may spend from a single tick's budget, so one tenant's
 * very large import cannot spend the whole tick and starve every other tenant's
 * own active run of a turn. Twenty-five batches is five thousand rows — generous
 * for a single tenant's own turn, and small next to the time budget above, which
 * is expected to be what actually ends most ticks first.
 */
export const MAX_BATCHES_PER_RUN_PER_TICK = 25;

/**
 * How long a single `importSubjects` call may take before it counts as a sign the
 * object is under load. A clean 200-row batch is a few hundred sequential
 * statements against one object's own SQLite storage, so two seconds is already
 * generous slack before treating it as a load signal.
 */
export const BACKPRESSURE_THRESHOLD_MS = 2_000;

/** How long this job waits before its next batch once backpressure is observed. */
export const BACKPRESSURE_DELAY_MS = 1_000;
