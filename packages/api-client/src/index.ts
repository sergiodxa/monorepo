/**
 * Base class for clients of a remote HTTP API.
 *
 * One origin, path-relative verb methods, and a single place to attach what every call
 * needs, so a client of some service is a subclass with its own methods.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { APIClientInit } from "./api-client";

export { APIClient } from "./api-client";
