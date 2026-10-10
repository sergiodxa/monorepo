/**
 * The board's models bound outside a request, with a factory for postings, so a test seeds
 * rows through the same model the app writes with. Publishing a posting mails nobody from the
 * model itself, so a seeded posting is stored and nothing else happens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createFactories, defineFactory } from "@sdxc/data-model/testing";

import { models } from "~/app/models";
import { Postings } from "~/app/models/posting";

/** A complete posting, the fields both the form and `publish_job` require. */
export const PostingFactory = defineFactory(Postings, {
	title: "Senior Remix Engineer",
	company: "Acme",
	location: "Remote",
	salary: "$150k – $180k",
	description: "We build things with Remix v3.",
	contact_email: "hiring@acme.test",
});

/**
 * Binds the models to `db` and builds the factories that write through them.
 *
 * @param db The database the test drives the app against.
 */
export async function bindModels(db: Database) {
	let bound = models.bind({ db });
	return { models: bound, factories: createFactories(bound, { seed: 1 }) };
}
