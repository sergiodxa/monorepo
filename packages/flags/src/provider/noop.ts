/**
 * The provider an API instance evaluates through before one is set and after
 * shutdown: every resolver answers with the default value it was handed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import type { ResolutionDetails } from "../core/details.js";

import { resolved } from "./details.js";

/**
 * Answers every evaluation with the default value it was given, saying so with
 * `reason: "DEFAULT"`. Registering nothing is therefore a working instance
 * rather than a broken one, which is what keeps startup from being an outage.
 */
export class NoopProvider {
	readonly metadata = { name: "No-op Provider" };

	resolveBoolean(_key: string, defaultValue: boolean): ResolutionDetails<boolean> {
		return resolved(defaultValue, { reason: "DEFAULT" });
	}

	resolveString(_key: string, defaultValue: string): ResolutionDetails<string> {
		return resolved(defaultValue, { reason: "DEFAULT" });
	}

	resolveNumber(_key: string, defaultValue: number): ResolutionDetails<number> {
		return resolved(defaultValue, { reason: "DEFAULT" });
	}

	resolveObject(_key: string, defaultValue: JSONValue): ResolutionDetails<JSONValue> {
		return resolved(defaultValue, { reason: "DEFAULT" });
	}
}
