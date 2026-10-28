/**
 * Answers `publish_job`: publishes the way the submit form does, the row first and then
 * the confirmation job in the caller's language, and returns the position as Markdown.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { toMarkdown } from "~/app/mcp/postings";
import toolset from "~/app/mcp/tools";

export default createTool(toolset.publishJob, async (ctx) => {
	let posting = await ctx.models.postings.create(ctx.input);
	if (isFailure(posting)) throw new ToolError("The position could not be published.");

	let postingId = posting.data.id;
	await ctx.jobs.enqueue(jobs.sendConfirmation, { postingId, locale: ctx.locale });

	ctx.log.set({ posting: { id: postingId } });

	return toMarkdown(posting.data);
});
