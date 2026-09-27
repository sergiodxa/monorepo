/**
 * What the blog's Webmention traffic identifies itself as. Every source it verifies
 * and every endpoint it notifies sees this name, so a publisher can tell who is asking
 * and reach the site behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PROFILE } from "~/config/profile";

/** Sent on every source fetch, discovery and send; names the site it acts for. */
export const USER_AGENT = `sergiodxa.com Webmention (+${PROFILE.canonical.origin})`;
