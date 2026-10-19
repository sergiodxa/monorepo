/**
 * Every email the reader sends, declared with the schema of its props. Importing it costs the
 * schemas alone, so the object that notifies a reader loads only the template it renders.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { email, emails } from "@sdxc/mail";
import * as s from "remix/data-schema";

export default emails({
	/** The summary a scheduled check found, on the email channel. */
	notification: email({
		props: s.object({
			posts: s.number(),
			feeds: s.number(),
			titles: s.array(s.string()),
			/** The reader's own queue, absolute against the app's address. */
			url: s.string(),
			/** The signed link out of the channel, or `null` where none could be signed. */
			unsubscribeUrl: s.nullable(s.string()),
		}),
	}),
});
