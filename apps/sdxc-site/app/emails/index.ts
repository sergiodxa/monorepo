/**
 * Every email the site sends, declared with the schema of its props. Importing it costs the
 * schemas alone, so the controller that sends one never loads the template that renders it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { email, emails } from "@sdxc/mail";
import * as s from "remix/data-schema";

export default emails({
	/**
	 * A docs reader's question from the contact form, for the author's inbox. `page` is the
	 * absolute address the reader came from, or empty when they opened the form directly.
	 */
	docsContact: email({
		props: s.object({
			name: s.string(),
			email: s.string(),
			message: s.string(),
			page: s.string(),
		}),
	}),
});
