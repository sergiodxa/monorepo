---
title: Offer and import contact cards
description: Describe people as RFC 9553 JSContact Cards, serve them as vCard downloads, read uploaded vCards back, and localize a card for each reader.
section:
    title: Content & feeds
    order: 8
order: 37
lastUpdated: 2026-10-25
outcomes:
    - "How to build a JSContact Card with `@sdxc/jscontact` and serve it as a vCard download"
    - "How to import uploaded vCard and jCard contacts as JSContact Cards"
    - "Why a Card converted to vCard and back comes out unchanged, localizations included"
---

A team page earns a "Save contact" button: one tap and a visitor's phone holds the person's
name, role, email and photo. That button downloads a vCard, the format every address book
reads, and the same format arrives when someone uploads the contacts they exported from their
phone. This guide writes each team member as a [JSContact](https://www.rfc-editor.org/rfc/rfc9553)
Card, the same data as plain JSON, serves it as a `.vcf` download, and imports uploaded vCards
as Cards with [`@sdxc/jscontact`](/api/jscontact).

```bash
npm add @sdxc/http @sdxc/jscontact @sdxc/result remix
```

## Declare the routes

Each member gets a card URL beside their page, and the address book takes uploads:

```typescript {% title="routes/web.ts" %}
import { get, post, route } from "remix/routes";

export default route({
	team: {
		show: get("/team/:slug"),
		card: get("/team/:slug/card.vcf"),
	},
	contacts: {
		index: get("/contacts"),
		import: post("/contacts/import"),
	},
});
```

## Build a Card for a team member

A Card is plain JSON with a required `@type` and `version`. Each map of objects (`emails`,
`titles`, `links`) is keyed by an Id you choose, which is how the title here names its
organization:

```typescript {% title="app/services/team/card.ts" %}
import type { JSContact } from "@sdxc/jscontact";

import type { Member } from "~/app/models/members";

export function memberCard(member: Member, pageUrl: string): JSContact.Card {
	return {
		"@type": "Card",
		version: "2.0",
		kind: "individual",
		uid: `urn:uuid:${member.id}`,
		name: {
			components: [
				{ kind: "given", value: member.givenName },
				{ kind: "surname", value: member.surname },
			],
			isOrdered: true,
		},
		organizations: { org: { name: "Example" } },
		titles: { role: { name: member.role, organizationId: "org" } },
		emails: { work: { address: member.email, contexts: { work: true } } },
		links: { profile: { uri: pageUrl } },
		media: { photo: { kind: "photo", uri: member.photoUrl } },
		localizations: { es: { "titles/role/name": member.roleInSpanish } },
	};
}
```

A stable `uid` lets an address book that imports the card twice update the contact instead of
adding a second. `localizations` holds a patch per language, keyed by JSON Pointers into the
Card, so the Spanish version replaces only the role. A Card that arrives from somewhere else
goes through `parse` first, which checks it against RFC 9553.

## Serve the card as a vCard download

`toVCard` turns the Card into a vCard and `stringifyVCard` writes it. Serve it with
`VCARD_MEDIA_TYPE` and a `Content-Disposition` naming the file:

```typescript {% title="app/http/controllers/team/card.ts" %}
import { attachment } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { localize } from "@sdxc/jscontact";
import { stringifyVCard, toVCard, VCARD_MEDIA_TYPE } from "@sdxc/jscontact/vcard";
import { isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Members } from "~/app/models/members";
import { memberCard } from "~/app/services/team/card";
import routes from "~/routes/web";

export default createAction(routes.team.card, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let member = await Members.findBySlug(ctx.db, slug);
	if (member === null) return notFound("Not Found");

	let pageUrl = new URL(routes.team.show.href({ slug }), ctx.url).href;
	let card = memberCard(member, pageUrl);
	let language = ctx.url.searchParams.get("lang");
	if (language !== null) {
		let localized = localize(card, language);
		if (isSuccess(localized)) card = localized.data;
	}

	return new Response(stringifyVCard(toVCard(card)), {
		headers: {
			"Content-Type": VCARD_MEDIA_TYPE,
			"Content-Disposition": attachment(`${slug}.vcf`),
		},
	});
});
```

Without `?lang`, the download carries every language as `LANGUAGE` alternatives, and an address
book shows the one matching its settings. `localize` applies one language's patch instead, for
an address book that shows only the first. Link the button straight at the route,
`<a href={routes.team.card.href({ slug })}>`, so it works with no script.

## Import uploaded vCards

A contacts export is usually one file holding many vCards. `parseVCard` reads all of them, and
`fromVCard` turns each into a Card:

```typescript {% title="app/http/controllers/contacts/import.ts" %}
import { redirect } from "@sdxc/http/response";
import { badRequest } from "@sdxc/http/response/html";
import { fromVCard, parseVCard } from "@sdxc/jscontact/vcard";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { Contacts } from "~/app/models/contacts";
import routes from "~/routes/web";

export default createAction(routes.contacts.import, async (ctx) => {
	let file = ctx.formData.get("contacts");
	if (!(file instanceof File)) return badRequest("Choose a .vcf file to import.");

	let vcards = parseVCard(await file.text());
	if (isFailure(vcards)) return badRequest(vcards.error.message);

	for (let vcard of vcards.data) {
		await Contacts.save(ctx.db, fromVCard(vcard));
	}

	return redirect(routes.contacts.index.href(), {
		status: redirect.Status.SeeOther,
	});
});
```

`Contacts` is your own model, storing `stringify(card)` in a text column. A structural failure
is a `VCardParseError` whose message names the line, so show it as it is.

> [!WARNING]
> A vCard from someone else's address book is untrusted input. `PHOTO` and `URL` values arrive as
> whatever URI the file holds, `data:` and `javascript:` included, so check the scheme before you
> render one as a link or an image, and fetch a remote photo only as
> [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) describes.

A property with no JSContact counterpart is kept in the Card's `vCardProps`, so exporting the
contact again writes it back. jCard, the JSON form of vCard, reads through `readJCard(value)`
into the same `fromVCard`.

## Test the round trip

Pin that the download and the import agree: a member's Card written as vCard text and read back
is the same Card, Spanish role included:

```typescript {% title="app/services/team/card.test.ts" %}
import {
	fromVCard,
	parseVCard,
	stringifyVCard,
	toVCard,
} from "@sdxc/jscontact/vcard";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { memberCard } from "~/app/services/team/card";

const ADA = {
	id: "0192f1c4-5e6a-7b3c-8d9e-0f1a2b3c4d5e",
	slug: "ada",
	givenName: "Ada",
	surname: "Lovelace",
	email: "ada@example.com",
	role: "Engineer",
	roleInSpanish: "Ingeniera",
	photoUrl: "https://example.com/team/ada.jpg",
};

test("reads the downloaded vCard back as the same Card", () => {
	let card = memberCard(ADA, "https://example.com/team/ada");
	let text = stringifyVCard(toVCard(card));

	expect(text).toContain("FN;DERIVED=TRUE:Ada Lovelace\r\n");
	expect(text).toContain("TITLE;PROP-ID=role;ALTID=1;LANGUAGE=es:Ingeniera\r\n");

	let [vcard] = unwrap(parseVCard(text));
	expect(vcard && fromVCard(vcard)).toEqual(card);
});
```

## Where to go next

- [Draw QR codes](/docs/building-remix-apps/qr-codes): encode the vCard text in a code a phone
  camera saves as a contact, for a badge or a printed card.
- [JMAP](/docs/data-and-background-work/jmap): the protocol that syncs these Cards between a
  contacts server and its clients.
- [`@sdxc/jscontact`](/api/jscontact): every property of the model and the conversion rules
  from RFC 9555.
