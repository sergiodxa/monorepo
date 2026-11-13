/**
 * What Delta's build reads from git and how much of it the Worker carries: the one folder it
 * hosts, its branch, the history cap, the per-file patch cap and the budget the generated
 * documents must fit, shared by the extractor and the screens that report those limits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The repository path whose files Delta hosts, which every display path is relative to. */
export const DELTA_ROOT = "apps/sdxc-site/resources/views/demo-apps/delta/";

/** The one branch Delta's history lives on. */
export const DELTA_BRANCH = "main";

/** How many commits the build keeps; older commits blame names keep their metadata only. */
export const DELTA_HISTORY_LIMIT = 200;

/** A file patch larger than this is kept out of the build and drawn as "Large diff not shown". */
export const DELTA_PATCH_FILE_LIMIT = 64 * 1024;

/** The raw size every generated document may add up to before the build stops. */
export const DELTA_BUDGET_BYTES = 2 * 1024 * 1024;
