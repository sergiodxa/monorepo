/**
 * The three name-carrying structures the surface passes around: what a provider
 * says about itself, what a client says about itself, and what a provider
 * attaches to a resolved flag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Arbitrary properties a provider attaches to a flag it resolved, such as the
 * `contextId`, `flagSetId` and `version` an observability integration reads. A
 * client passes through what arrives and invents nothing.
 */
export type FlagMetadata = Record<string, string | number | boolean>;

/** Arbitrary properties an event carries beyond the fields the specification names. */
export type EventMetadata = Record<string, string | number | boolean>;

/** How a provider identifies itself, in events, in telemetry and in hook context. */
export interface ProviderMetadata {
	readonly name: string;
}

/**
 * How a client identifies itself. The domain is the one it was created under,
 * and is absent on a client bound to the default provider.
 */
export interface ClientMetadata {
	readonly domain?: string;
}
