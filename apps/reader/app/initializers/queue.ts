/**
 * The queue every job is enqueued on and delivered from. A feed's own object enqueues
 * through the dispatcher built on it, and the worker's `queue` entrypoint consumes it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobQueue } from "@sdxc/jobs";

import * as cloudflare from "@sdxc/jobs/cloudflare";
import { env } from "cloudflare:workers";

/** Resolved per call, so importing this module touches no binding. */
export const jobQueue: JobQueue = cloudflare.queue(() => env.QUEUE);
