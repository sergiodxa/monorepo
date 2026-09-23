/**
 * The management API's `application/problem+json` responses, built from the
 * `managementProblems` catalog with an `instance` on every one, so a caller always
 * has an occurrence id to quote back in a support request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { managementProblems } from "@sdxc/auth/management-client";

/** The catalog's shape, for naming its builders and their inputs. */
type Catalog = typeof managementProblems;

/** One problem type the management API answers with, by its catalog name. */
export type ManagementProblemName = Exclude<keyof Catalog, "parse" | "is" | "entries">;

/** What a call site supplies for one problem type: the catalog builder's own input. */
export type ManagementProblemInput<Name extends ManagementProblemName> = NonNullable<
	Parameters<Catalog[Name]>[0]
>;

/**
 * Builds the response for one catalog entry. `instance` defaults to a freshly minted id,
 * so every problem response names one whether or not its caller tracked a request id.
 *
 * @param name - The catalog entry naming the failure.
 * @param input - The detail, instance and extensions the entry takes.
 * @param init - Headers to add, such as `Retry-After`.
 * @returns A `Response` whose body and `Content-Type` follow RFC 9457.
 * @example return managementProblem("notFound", { detail: "No such client exists." });
 */
export function managementProblem<Name extends ManagementProblemName>(
	name: Name,
	input?: ManagementProblemInput<Name>,
	init?: ResponseInit,
): Response {
	let builder = managementProblems[name] as (
		input: { detail?: string; instance?: string; extensions?: object },
		init?: ResponseInit,
	) => Response;
	let given = (input ?? {}) as { instance?: string };
	return builder({ ...given, instance: given.instance ?? crypto.randomUUID() }, init);
}
