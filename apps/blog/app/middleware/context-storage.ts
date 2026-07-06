/**
 * Context-storage middleware for the blog app. Creates an AsyncLocalStorage-
 * backed request context and exports getContext and getRequest accessors, so
 * downstream middleware and helpers can reach the current request and its shared
 * context without threading arguments through every call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContextStorageMiddleware } from "remix-utils/middleware/context-storage";

export const [contextStorageMiddleware, getContext, getRequest] = createContextStorageMiddleware();
