/**
 * The ActivityPub inbox, personal and shared at once. The federation verifies each POSTed
 * activity's HTTP signature while the sender waits, so a `401` tells it to retry with the
 * other signature scheme, and queues what verified for the `activityPub.process` job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import routes from "~/routes/web";

import { federate } from "./activitypub";

/**
 * Answers `202` once an activity verified and is queued, `503` when the queue refused it,
 * and the refusing check's `4xx` otherwise: wrong media type, a body past 100 KB, a blocked
 * host, or a signature that is missing, stale or does not verify against the sender's key.
 */
export default createAction(routes.activityPub.inbox, federate);
