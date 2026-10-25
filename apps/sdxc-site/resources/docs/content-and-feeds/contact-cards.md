---
title: Offer and import contact cards
description: Describe people as RFC 9553 JSContact Cards, serve them as vCard downloads, read uploaded vCards back, and localize a card for each reader.
section:
    title: Content & feeds
    order: 8
order: 37
lastUpdated: 2026-10-24
outcomes:
    - "How to build a JSContact Card with `@sdxc/jscontact` and serve it as a vCard download"
    - "How to import uploaded vCard and jCard contacts as JSContact Cards"
    - "Why a Card converted to vCard and back comes out unchanged, localizations included"
---

A team page earns a "Save contact" button: one tap and a visitor's phone holds the person's
name, role, email and photo. That button downloads a vCard, the format every address book
reads, and the same format arrives the other way when someone uploads the contacts they
exported from their phone. vCard is line-based text with escaping, folding and parameters
that differ between versions; [JSContact](https://www.rfc-editor.org/rfc/rfc9553) is the same
data as a JSON object you build, store and validate like any other. This guide writes each
team member as a JSContact Card, serves it as a `.vcf` download in the reader's language, and
imports uploaded vCards as Cards.

[`@sdxc/jscontact`](/api/jscontact) validates Cards, and its `./vcard` entry converts them to
and from vCard 4.0 and jCard. [`@sdxc/http`](/api/http) names the download, and fallible calls
return a [`@sdxc/result`](/api/result).

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

A Card is plain JSON: `@type` and `version` are required, and everything else is a property
named for what it holds. Each map of objects (`emails`, `titles`, `links`) is keyed by an Id
you choose, which is how one entry points at another, as the title here names its
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

`uid` is optional at version 2.0, and a stable one lets an address book that imports the card
twice update the contact instead of adding a second. `localizations` holds a PatchObject per
language: its keys are JSON Pointers into the Card without the leading `/`, so the Spanish
version replaces only the role.

A Card that arrives from somewhere else goes through `parse` first, as
`parse(await ctx.request.text())`. It reads JSON text or an already-parsed value and checks it
against RFC 9553, including the case of registered names. A failure is a `JSContactParseError`
whose `issues` each name a `path` and a `message`.
Properties the model does not name, vendor extensions included, are kept, so a parsed Card
writes back unchanged with `stringify`.

## Serve the card as a vCard download

`toVCard` turns the Card into a vCard, and `stringifyVCard` writes it with CRLF line endings
and lines folded at 75 octets, as RFC 6350 requires. Serve it with `VCARD_MEDIA_TYPE` and a
`Content-Disposition` naming the file:

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

Without `?lang`, the download carries every language: each localization becomes a `LANGUAGE`
alternative of its property, tied to the original by `ALTID`, and an address book shows the
one matching its settings. `localize` instead applies one language's patch and answers a Card
in that language alone, for a reader whose address book shows only the first. A tag the Card
has no localization for answers the Card unchanged, matched case-insensitively.

Link the button straight at the route, `<a href={routes.team.card.href({ slug })}>`, so it
works with no script. The conversion writes what a vCard property cannot carry into a `JSPROP`
line and keeps each map key in `PROP-ID`, which is why the next section reads the same Card
back.

For a client that speaks JSON, such as a JMAP address book, answer `stringify(card)` with the
package's `MEDIA_TYPE`, `application/jscontact+json;version=2.0`.

## Import uploaded vCards

A contacts export is usually one file holding many vCards. `parseVCard` reads all of them,
versions 3.0 and 4.0 alike, and `fromVCard` turns each into a Card:

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

`Contacts` is your own model, storing `stringify(card)` in a text column. A structural failure,
such as a line outside `BEGIN:VCARD`, is a `VCardParseError` whose message names the line, so
show it as it is. An empty file is zero cards rather than a failure.

<warning>
A vCard from someone else's address book is untrusted input. `PHOTO` and `URL` values arrive as
whatever URI the file holds, `data:` and `javascript:` included, so check the scheme before you
render one as a link or an image, and fetch a remote photo only as
[Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) describes.
</warning>

Each map entry gets the key the vCard's `PROP-ID` named, or one derived from the property
(`EMAIL-1`, `PHONE-1`) when the file has none. A property with no JSContact counterpart is kept
in the Card's `vCardProps`, so exporting the contact again writes it back. A Card with a `uid`
is worth upserting on it, so a second import of the same export updates rows.

jCard, the JSON form of vCard, reads through the same path: `readJCard(value)` answers a
`Result` holding the vCard, ready for `fromVCard`. That is the shape of an RDAP entity's
`vcardArray`, and `writeJCard(toVCard(card))` writes it.

## Test the round trip

The promise worth pinning is that the download and the import agree: a member's Card written
as vCard text and read back is the same Card, Spanish role included:

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

`FN` is the formatted name address books display; the conversion derives it from the name
components and marks it `DERIVED` so reading the file back keeps the components as the source.

## Where to go next

- [Draw QR codes](/docs/building-remix-apps/qr-codes): encode the vCard text in a code a phone
  camera saves as a contact, for a badge or a printed card.
- [JMAP](/docs/data-and-background-work/jmap): the protocol that syncs these Cards between a
  contacts server and its clients.
- [`@sdxc/jscontact`](/api/jscontact): every property of the model and the conversion rules
  from RFC 9555.
