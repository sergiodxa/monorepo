/**
 * The engine's OIDC relying-party surface for the admin panel. The implementation
 * now lives in the shared `@pkg/oidc-client` package; this module re-exports it so
 * the engine's internal consumers (`engine.ts`, the OIDC middleware, the auth
 * controller, the package's public `index.ts`) keep importing from `../oidc`
 * unchanged, while the RP logic stays in one place across the SaaS platform.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { OIDCAuthProfile } from "remix/auth";

import { toAuthProfile as toNormalizedProfile } from "@pkg/oidc-client";

import type { AuthProfile } from "../users/models/user";

export type { OIDCConfig, OIDCMetadata } from "@pkg/oidc-client";
export { createProvider, resolveEndSessionEndpoint } from "@pkg/oidc-client";

/**
 * Maps an OIDC profile to the engine's {@link AuthProfile}. Delegates to
 * `@pkg/oidc-client`; the shared `NormalizedAuthProfile` is structurally identical
 * to {@link AuthProfile}, so this only re-narrows the return type for the engine.
 * @param profile - The raw OIDC profile from `remix/auth`.
 * @returns The engine's {@link AuthProfile}.
 */
export function toAuthProfile(profile: OIDCAuthProfile): AuthProfile {
	return toNormalizedProfile(profile);
}
