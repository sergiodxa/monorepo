/**
 * The tools this board offers an agent, declared the way routes are: the name a client
 * calls, the description a model chooses by, and the schema its arguments satisfy. An agent
 * lists or searches, reads one position in full, and publishes one under the form's rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { tool, tools } from "@sdxc/mcp";

/** Registers the board's tools. */
export default tools({
	searchJobs: tool("search_jobs", {
		title: "Search jobs",
		description:
			"Search the board's open positions by title, company or location. Returns the id, title, company, location and salary of each match; read a position in full with get_job.",
		input: s.object({
			query: s.string().pipe(checks.minLength(1), checks.maxLength(100)).meta({
				description: "Words to look for, matched against title, company and location.",
			}),
			limit: s.defaulted(
				s
					.integer()
					.pipe(checks.min(1), checks.max(50))
					.meta({ description: "How many positions to return." }),
				10,
			),
		}),
		annotations: { readOnlyHint: true, openWorldHint: false },
	}),

	listJobs: tool("list_jobs", {
		title: "List jobs",
		description:
			"List the board's open positions, newest first. Returns the id, title, company, location and salary of each; read a position in full with get_job.",
		input: s.object({
			limit: s.defaulted(
				s
					.integer()
					.pipe(checks.min(1), checks.max(100))
					.meta({ description: "How many positions to return." }),
				50,
			),
		}),
		annotations: { readOnlyHint: true, openWorldHint: false },
	}),

	getJob: tool("get_job", {
		title: "Read a job",
		description:
			"Read one position in full as Markdown: title, company, location, salary, description and how to apply. Takes the id search_jobs returns.",
		input: s.object({
			id: s.string().pipe(checks.minLength(1)).meta({ description: "The position's id." }),
		}),
		annotations: { readOnlyHint: true, openWorldHint: false },
	}),

	publishJob: tool("publish_job", {
		title: "Publish a job",
		description:
			"Publish a new position on the board. The contact email receives a confirmation once it is live. Returns the published position as Markdown.",
		input: s.object({
			title: s.string().pipe(checks.minLength(2)).meta({ description: "The role's title." }),
			company: s.string().pipe(checks.minLength(2)).meta({ description: "Who is hiring." }),
			location: s
				.string()
				.pipe(checks.minLength(2))
				.meta({ description: "Where the role is based, or Remote." }),
			salary: s
				.string()
				.pipe(checks.minLength(1))
				.meta({ description: "The pay range, as a reader should see it." }),
			description: s
				.string()
				.pipe(checks.minLength(10))
				.meta({ description: "The role in full, as Markdown." }),
			contact_email: s
				.string()
				.pipe(checks.email())
				.meta({ description: "Where applications and the confirmation go." }),
		}),
		annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
	}),
});
