/**
 * Every background job the board runs, declared in one map: the payload each carries and
 * the schedule it is enqueued on. Importing this costs the schemas alone, so a controller
 * enqueues without pulling any handler's dependencies into the request path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

/** What one confirmation message carries: the posting to describe and the language to write in. */
const SendConfirmationSchema = s.object({ postingId: s.string(), locale: s.string() });

/** The confirmation one `sendConfirmation` message asks for. */
export type SendConfirmationInput = s.InferOutput<typeof SendConfirmationSchema>;

export default jobs({
	/** Mails the poster once their position is live, off the request that published it. */
	sendConfirmation: job({ input: SendConfirmationSchema }),

	/** The nightly sweep that closes postings the board has carried long enough. */
	expirePostings: job({ cron: "0 3 * * *" }),
});
