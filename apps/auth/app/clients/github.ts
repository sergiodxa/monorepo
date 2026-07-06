/**
 * GitHub API client for the auth app. Wraps Octokit to fetch the authenticated
 * user's profile from a GitHub OAuth access token and exposes the resulting
 * user type, so the GitHub login strategy can resolve account details.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Octokit } from "@octokit/core";

export class GitHub {
	static async user(accessToken: string) {
		let octokit = new Octokit({ auth: accessToken });
		let response = await octokit.request("GET /user", {
			headers: { "user-agent": "Remix Auth" },
		});

		return response.data;
	}
}

export namespace GitHub {
	export type User = Awaited<ReturnType<typeof GitHub.user>>;
}
