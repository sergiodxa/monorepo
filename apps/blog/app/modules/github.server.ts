import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/core";
import { type Result, failure, success } from "@pkg/result";
import { z } from "zod";

import { logger } from "~/middleware/logger";

export class GitHub {
	private octokit: Octokit;

	constructor(appId: string, privateKey: string) {
		this.octokit = new Octokit({
			auth: { appId, privateKey, installationId: 44808893 },
			authStrategy: createAppAuth,
		});
	}

	async fetchMarkdownFile(
		filename: string,
	): Promise<Result<{ content: string; createdAt: string | null | undefined }, GitHubError>> {
		let path = filename.startsWith("content/") ? filename : `content/${filename}`;

		try {
			let response = await this.octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
				owner: "sergiodxa",
				repo: "sergiodxa.com",
				path,
			});

			if (Array.isArray(response.data)) return failure(new GitHubError("Not a file"));
			if (response.data.type !== "file") return failure(new GitHubError("Not a file"));

			let createdAt = await this.fetchFileFirstCommitDate(path);

			logger.info("github_file_fetched", { path });
			return success({ content: atob(response.data.content), createdAt });
		} catch (error) {
			if (error instanceof Error && error.name === "HttpError" && error.message === "Not Found") {
				logger.info("github_file_not_found", { path });
				return failure(new GitHubError(path));
			}

			logger.error("github_api_error", {
				path,
				error: error instanceof Error ? error.message : "Unknown error",
			});
			throw error;
		}
	}

	async listMarkdownFiles(path: string): Promise<Result<string[], GitHubError>> {
		try {
			let response = await this.octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
				owner: "sergiodxa",
				repo: "sergiodxa.com",
				path: `content/${path}`,
			});

			if (!Array.isArray(response.data)) return failure(new GitHubError("Not a folder"));

			let files: string[] = [];
			for (let item of response.data) {
				if (item.type !== "file") return failure(new GitHubError("Not a file"));
				files.push(item.path);
			}
			return success(files);
		} catch (error) {
			if (error instanceof Error && error.name === "HttpError" && error.message === "Not Found") {
				return failure(new GitHubError(path));
			}

			throw error;
		}
	}

	async fetchFileFirstCommitDate(path: string) {
		try {
			// Fetch commits for the file
			let response = await this.octokit.request("GET /repos/{owner}/{repo}/commits", {
				owner: "sergiodxa",
				repo: "sergiodxa.com",
				path,
			});

			// The commits are in reverse chronological order
			let commits = response.data;

			// The date of the first commit is the creation date of the file
			return commits.at(-1)?.commit.author?.date;
		} catch {
			return null;
		}
	}

	async sponsors() {
		let result = await this.octokit.graphql(gql`
			query {
				node(id: "MDQ6VXNlcjEzMTIwMTg=") {
					... on User {
						sponsorshipsAsMaintainer(first: 100) {
							nodes {
								sponsorEntity {
									... on User {
										id
										name
										login
										avatarUrl
										url
									}
									... on Organization {
										id
										name
										login
										avatarUrl
										url
									}
								}
							}
						}
					}
				}
			}
		`);

		let parsed = z
			.object({
				node: z.object({
					sponsorshipsAsMaintainer: z.object({
						nodes: z
							.object({
								sponsorEntity: z.union([
									z.object({
										id: z.string(),
										name: z.string().nullable(),
										login: z.string(),
										avatarUrl: z.string(),
										url: z.string(),
									}),
									z.object({
										id: z.string(),
										name: z.string(),
										login: z.string(),
										avatarUrl: z.string(),
										url: z.string(),
									}),
								]),
							})
							.array(),
					}),
				}),
			})
			.safeParse(result);

		if (!parsed.success) {
			logger.error("github_sponsors_parse_failed");
			return failure(new GitHubError("Failed to parse sponsors response"));
		}
		logger.info("github_sponsors_fetched", {
			count: parsed.data.node.sponsorshipsAsMaintainer.nodes.length,
		});
		return success(parsed.data);
	}

	async isSponsoringMe(id: string): Promise<Result<boolean, GitHubError>> {
		let result = await this.octokit.graphql(gql`query {
	node(id: "${id}") {
		... on Sponsorable {
			isSponsoringViewer
		}
	}
}`);

		let parsed = z
			.object({ node: z.object({ isSponsoringViewer: z.boolean() }) })
			.safeParse(result);
		if (!parsed.success) {
			logger.error("github_sponsoring_parse_failed", { id });
			return failure(new GitHubError("Failed to parse sponsoring status"));
		}
		logger.info("github_sponsoring_check", {
			id,
			isSponsoring: parsed.data.node.isSponsoringViewer,
		});
		return success(parsed.data.node.isSponsoringViewer);
	}

	async fetchUserProfile(accessToken: string): Promise<
		Result<
			{
				node_id: string;
				email: string;
				login: string;
				name: string;
				avatar_url: string;
			},
			GitHubError
		>
	> {
		let response = await fetch("https://api.github.com/user", {
			headers: {
				Accept: "application/vnd.github.v3+json",
				Authorization: `token ${accessToken}`,
				"User-Agent": "Remix Auth",
			},
		});

		let json = await response.json();
		let parsed = z
			.object({
				node_id: z.string(),
				email: z.string().email(),
				login: z.string(),
				name: z.string(),
				avatar_url: z.string().url(),
			})
			.safeParse(json);

		if (!parsed.success) {
			logger.error("github_profile_parse_failed");
			return failure(new GitHubError("Failed to parse user profile"));
		}
		logger.info("github_profile_fetch_success", { login: parsed.data.login });
		return success(parsed.data);
	}
}

export class GitHubError extends Error {
	override name = "GitHubError";
}

const gql = String.raw;
