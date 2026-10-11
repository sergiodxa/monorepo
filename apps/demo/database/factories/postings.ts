/**
 * The posting factory a test seeds the board with. Rows go through the same model the app
 * writes with, and publishing mails nobody from the model itself, so a seeded posting is
 * stored and nothing else happens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defineFactory } from "@sdxc/data-model/testing";

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
