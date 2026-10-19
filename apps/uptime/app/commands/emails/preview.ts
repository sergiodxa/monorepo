/**
 * `emails preview <name>`: renders a declared email from its template's `preview()` props, in
 * the language `--locale` names, and prints it as the print transport shows a sent message, so
 * copy is checked from a terminal without sending anything or starting the dev server.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import commandset from "~/app/commands";
import { mail } from "~/app/initializers/mail";

/** Prints the subject, a blank line and the text part, or the HTML document with `--html`. */
export default createCommand(commandset.emails.preview, async (ctx) => {
	let rendered = await mail.preview(ctx.arguments.name, ctx.flags.locale);
	if (isFailure(rendered)) return rendered;
	if (ctx.flags.html) {
		ctx.stdout(`${rendered.data.html}\n`);
		return success();
	}
	let text = rendered.data.text.endsWith("\n") ? rendered.data.text : `${rendered.data.text}\n`;
	ctx.stdout(`Subject: ${rendered.data.subject}\n\n${text}`);
	return success();
});
