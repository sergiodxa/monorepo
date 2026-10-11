/**
 * The queue every job is enqueued on and delivered from. Both the dispatcher and the router's
 * `ctx.jobs` write through it, so a request enqueues without importing the dispatcher and
 * every handler loader behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobQueue } from "@sdxc/jobs";

import * as cloudflare from "@sdxc/jobs/cloudflare";
import { env } from "cloudflare:workers";

/** Resolved per call, so importing this module touches no binding. */
export const jobQueue: JobQueue = cloudflare.queue(() => env.QUEUE);
