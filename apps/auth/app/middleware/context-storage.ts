import { createContextStorageMiddleware } from "remix-utils/middleware/context-storage";

export const [contextStorageMiddleware, getContext, getRequest] = createContextStorageMiddleware();
