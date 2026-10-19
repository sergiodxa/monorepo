/**
 * Every email the board sends, declared with the schema of its props. Importing it costs the
 * schemas alone, so the job that mails a poster loads only the template it renders.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { email, emails } from "@sdxc/mail";
import * as s from "remix/data-schema";

export default emails({
	/** The confirmation a poster receives once their position is live. */
	postingPublished: email({ props: s.object({ title: s.string(), company: s.string() }) }),
});
