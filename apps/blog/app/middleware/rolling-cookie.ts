/**
 * Rolling-cookie middleware for the blog app. Wraps remix-utils' rolling cookie
 * helper with the shared session cookie so the cookie's expiration is refreshed
 * on each response, keeping active sessions alive without re-authentication.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRollingCookieMiddleware } from "remix-utils/middleware/rolling-cookie";

import { cookie } from "./session";

export const [rollingCookieMiddleware] = createRollingCookieMiddleware({ cookie });
