/**
 * What an app tests its federation with: in-memory implementations of every store the
 * package calls, and the conformance suites that hold the app's own stores to the same
 * contracts, so tests and production run against one set of rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	FollowerStoreConformanceOptions,
	KeyProviderConformanceOptions,
	LocalObjectsConformanceOptions,
	SeenActivitiesConformanceOptions,
} from "./conformance.js";
export type { MemorySeenActivitiesOptions } from "./memory.js";

export {
	followerStoreConformance,
	keyProviderConformance,
	localObjectsConformance,
	seenActivitiesConformance,
} from "./conformance.js";
export {
	MemoryFollowerStore,
	MemoryKeyProvider,
	MemoryLocalObjects,
	MemorySeenActivities,
} from "./memory.js";
