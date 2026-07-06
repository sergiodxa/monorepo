/**
 * Vanity redirect route for /projects/:project that forwards to the matching
 * open-source repository on GitHub. It maps a small allowlist of known project
 * slugs to their URLs and falls back to the home page for unknown or missing
 * projects, giving each project a stable short link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect, redirectDocument } from "react-router";
import invariant from "tiny-invariant";

import type { Route } from "./+types/route";

const PROJECTS = {
	"remix-auth": "https://github.com/sergiodxa/remix-auth",
	"remix-i18next": "https://github.com/sergiodxa/remix-i18next",
	"remix-utils": "https://github.com/sergiodxa/remix-utils",
};

export async function loader({ params }: Route.LoaderArgs) {
	try {
		let { project } = params;

		invariant(project, "The project is required");
		invariant(Object.keys(PROJECTS).includes(project), `The project "${project}" is not supported`);

		return redirectDocument(PROJECTS[project as keyof typeof PROJECTS]);
	} catch {
		return redirect("/");
	}
}
