/**
 * Context-storage middleware foundation for the app's request pipeline. Instantiates
 * `createContextStorageMiddleware` and exports both the middleware and a `getContext`
 * accessor. Exists as the shared per-request context store that the other middleware
 * (logger, session, drizzle, timing, and more) build on to expose request-scoped values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContextStorageMiddleware } from "remix-utils/middleware/context-storage";

export const [contextStorageMiddleware, getContext] = createContextStorageMiddleware();
