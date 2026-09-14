/**
 * The provider's state machine and the events that drive it: status is read
 * from what a provider announces, never inferred from a lifecycle call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ErrorCode } from "./error.js";
import type { EventMetadata } from "./metadata.js";

/**
 * How reliably the provider behind a client can answer right now. `ERROR` is
 * recoverable and `FATAL` is not, which is what makes an outage readable as an
 * outage rather than as every flag being off.
 */
export type ProviderStatus = "NOT_READY" | "READY" | "ERROR" | "STALE" | "FATAL";

/** The transitions a provider announces, and the configuration change that leaves status alone. */
export type ProviderEvent =
	| "PROVIDER_READY"
	| "PROVIDER_ERROR"
	| "PROVIDER_CONFIGURATION_CHANGED"
	| "PROVIDER_STALE";

/** What a provider emits with an event, before the client names the provider on it. */
export interface ProviderEventDetails {
	flagsChanged?: string[];
	message?: string;
	errorCode?: ErrorCode;
	eventMetadata?: EventMetadata;
}

/** What a handler is given: the provider's own payload, with the provider it came from. */
export interface EventDetails extends ProviderEventDetails {
	providerName: string;
}

/**
 * What runs when an event reaches the client. A handler that throws does not
 * stop the others, so it is free to do its own error handling or none.
 */
export type EventHandler = (details: EventDetails) => void;
