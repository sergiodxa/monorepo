/**
 * The blog's ActivityPub identity: its one actor and the endpoints and collections under
 * it, all on the canonical origin so ids stay the same whichever host served a request
 * and whether a request or a job builds them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PROFILE } from "~/config/profile";

/** The one actor the blog hosts, which every post is attributed to and every follow targets. */
export const ACTOR_ID = `${PROFILE.canonical.origin}/activitypub/actor`;

/** Personal and shared inbox at once, because one actor receives everything the blog gets. */
export const INBOX_ID = `${PROFILE.canonical.origin}/activitypub/inbox`;

/** The actor's posts as `Create` activities, which a server reads to backfill a new follow. */
export const OUTBOX_ID = `${PROFILE.canonical.origin}/activitypub/outbox`;

/** Addressed in every post's `cc`, which is what makes it public and on followers' timelines. */
export const FOLLOWERS_ID = `${PROFILE.canonical.origin}/activitypub/followers`;

/** Always empty: the blog follows nobody. */
export const FOLLOWING_ID = `${PROFILE.canonical.origin}/activitypub/following`;

/**
 * Sent on every actor fetch and every delivery, naming the site it acts for, since some
 * instances refuse a request that carries no `User-Agent`.
 */
export const ACTIVITYPUB_USER_AGENT = `sergiodxa.com ActivityPub (+${PROFILE.canonical.origin})`;
