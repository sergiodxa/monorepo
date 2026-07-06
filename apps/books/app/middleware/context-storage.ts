/**
 * Sets up the context-storage middleware and its getContext/getRequest accessors,
 * establishing the AsyncLocalStorage-backed store that lets any code in a request
 * reach the current router context and Request without explicit prop drilling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContextStorageMiddleware } from "remix-utils/middleware/context-storage";

export const [contextStorageMiddleware, getContext, getRequest] = createContextStorageMiddleware();
