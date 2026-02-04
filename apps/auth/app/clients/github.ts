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
