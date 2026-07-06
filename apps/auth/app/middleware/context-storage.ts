/**
 * Context-storage middleware for the auth app. Sets up AsyncLocalStorage-backed
 * request context and exports the middleware plus `getContext`/`getRequest`
 * accessors, letting any module reach the current request context without
 * passing it explicitly through the call chain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContextStorageMiddleware } from "remix-utils/middleware/context-storage";

export const [contextStorageMiddleware, getContext, getRequest] = createContextStorageMiddleware();
