/**
 * Every background job the app runs, declared in one map: the payload each carries and the
 * schedule it is enqueued on. Importing it costs the schemas alone, so a controller enqueues
 * a job without loading the handler that runs it.
 */

import { jobs } from "sdxc/jobs";

/** The app's jobs; `sdxc make job <name>` declares one here and maps its handler. */
export default jobs({});
