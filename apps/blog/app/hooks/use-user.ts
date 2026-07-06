/**
 * useUser hook for the blog app. Reads the current user from the root route's
 * loader data via useRouteLoaderData, returning the user object or null when no
 * one is signed in. It gives components a simple, typed way to access the
 * authenticated user without re-fetching.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { useRouteLoaderData } from "react-router";

import type { loader } from "~/root";

export function useUser() {
	return useRouteLoaderData<typeof loader>("root")?.user ?? null;
}
