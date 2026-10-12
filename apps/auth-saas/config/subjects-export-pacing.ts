/**
 * The subject export job's own pacing numbers, broken out of the job itself so a
 * test can substitute a tighter cap and force an early stop mid-directory without
 * touching the numbers production runs under, the same way `subjects-import-pacing.ts`
 * does for the import side.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Subjects read in one `exportSubjectPage` call. Kept below the import side's own
 * 200-row batch: a page assembles several other tables' worth of state per subject
 * — identifiers, attributes, role assignments, a password lookup, a passkey list, a
 * TOTP check and an API key list — where an import row is a handful of sequential
 * writes, so the same wall-clock budget affords fewer subjects per call.
 */
export const PAGE_SIZE = 100;

/**
 * How long one tick spends paging subjects before it stops and leaves the rest for
 * the next tick. The same reasoning as the import job's own budget: Cloudflare
 * Workers bill and cap CPU time, not wall-clock time spent `await`ing an RPC or an
 * R2 write, so a tick can spend real seconds here without approaching that ceiling.
 */
export const TICK_TIME_BUDGET_MS = 20_000;

/**
 * How many pages one run may spend from a single tick's budget, so one tenant's
 * very large export cannot spend the whole tick and starve every other tenant's
 * own active run of a turn. Ten pages is a thousand subjects — smaller than the
 * import side's five-thousand-row cap, matching this job's own smaller page size
 * and heavier per-subject read cost.
 */
export const MAX_PAGES_PER_RUN_PER_TICK = 10;

/**
 * How long a single `exportSubjectPage` call may take before it counts as a sign
 * the object is under load. Reading several tables per subject is comparable in
 * cost to the import side's batch of sequential writes, so the same two-second
 * threshold applies.
 */
export const BACKPRESSURE_THRESHOLD_MS = 2_000;

/** How long this job waits before its next page once backpressure is observed. */
export const BACKPRESSURE_DELAY_MS = 1_000;
