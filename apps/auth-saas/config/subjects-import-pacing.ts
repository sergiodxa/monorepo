/**
 * The subject import job's own pacing numbers, broken out of the job itself so a
 * test can substitute a tighter cap and force an early stop mid-file without
 * touching the numbers production runs under, the same way a test elsewhere in
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Rows sent to one `importSubjects` call, matching the object's own transaction-sized batch. */
export const BATCH_SIZE = 200;

/**
 * How long one tick spends moving rows before it stops and leaves the rest for the
 * next tick. Cloudflare Workers bill and cap CPU time, not wall-clock time spent
 * `await`ing an RPC or an R2 read, so a tick can spend real seconds here without a
 */
export const TICK_TIME_BUDGET_MS = 20_000;

/**
 * How many batches one run may spend from a single tick's budget, so one tenant's
 * very large import cannot spend the whole tick and starve every other tenant's
 * own active run of a turn.
 */
export const MAX_BATCHES_PER_RUN_PER_TICK = 25;

/**
 * How long a single `importSubjects` call may take before it counts as a sign the
 * object is under load.
 */
export const BACKPRESSURE_THRESHOLD_MS = 2_000;

/** How long this job waits before its next batch once backpressure is observed. */
export const BACKPRESSURE_DELAY_MS = 1_000;
