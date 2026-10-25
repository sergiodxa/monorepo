---
title: Add profile pictures
description: Let people upload a PNG or paste an image URL for their profile picture, fetch the URL safely in a background job, and draw a placeholder for everyone else.
section:
    title: Recipes
    order: 1.7
order: 11
lastUpdated: 2026-10-25
outcomes:
    - "What guides build profile pictures, and in what order to follow them"
    - "How a pasted URL goes through the same checks as an uploaded file"
    - "When a copied image keeps the account's old picture"
---

At the end of this recipe every account has a profile picture: a square PNG the person uploaded,
one copied from a URL they pasted, or an identicon drawn from their id. Both sources pass the
same size and format checks before anything is stored.

```bash
npm add @sdxc/jobs @sdxc/outbound @sdxc/png @sdxc/result
```

## Accept an upload and draw a placeholder

Uploads and placeholders cover every account before any URL is involved, and the checks they
write are the ones a copied image goes through. Follow
[Accept PNG avatars and draw placeholders](/docs/building-remix-apps/png-avatars) for
`readAvatar`, `cropSquare`, `avatars()` and the route that serves either picture.

## Refuse a bad URL where it is pasted

A URL that can never be fetched is refused while the person is still on the form. Check it as
[Refuse the URL at the endpoint](/docs/identity-and-security/fetch-untrusted-urls#refuse-the-url-at-the-endpoint)
shows, then enqueue an `avatars.copy` job with `userId` and the checked `url`, declared as
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) describes.

## Copy the image in a job

The job follows the URL under one deadline and a byte cap, as
[Follow and read it under one deadline](/docs/identity-and-security/fetch-untrusted-urls#follow-and-read-it-under-one-deadline)
explains, then hands the bytes to the upload's own checks:

```typescript {% title="app/jobs/avatars/copy.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { follow, readBytes, release } from "@sdxc/outbound";
import { encode } from "@sdxc/png";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { avatars } from "~/app/models/avatars";
import { cropSquare } from "~/app/services/avatars/crop-square";
import { readAvatar } from "~/app/services/avatars/read-avatar";

const MAX_BYTES = 2 * 1024 * 1024;

export default createJobHandler(jobs.avatars.copy, async (ctx) => {
	let followed = await follow(ctx.input.url, {
		headers: { accept: "image/png" },
		timeout: "10 seconds",
		maxRedirects: 5,
		ports: "default",
	});
	if (isFailure(followed)) {
		if (followed.error.retryable) return ctx.retry({ cause: followed.error });
		return ctx.exit(followed.error.code);
	}

	let { response } = followed.data;
	if (!response.ok) {
		release(response.body);
		return ctx.exit(`The image answered ${response.status}`);
	}

	let body = await readBytes(response, { maxBytes: MAX_BYTES });
	if (isFailure(body)) return ctx.exit(body.error.code);

	let image = await readAvatar(new File([body.data.data.slice()], "avatar.png"));
	if (isFailure(image)) return ctx.exit(image.error.code);

	let bytes = await encode(cropSquare(image.data));
	let key = `avatars/${ctx.input.userId}.png`;
	await avatars().set(key, new File([bytes.slice()], key, { type: "image/png" }));
});
```

A URL that fails any check ends the job, and the account keeps the picture it had.

## Test it

Test each stage as its guide does:
[Test on pixels](/docs/building-remix-apps/png-avatars#test-on-pixels) decodes what
was stored and checks its pixels, and
[Test it with MSW](/docs/identity-and-security/fetch-untrusted-urls#test-it-with-msw) answers the
pasted URL without a network.

## Where to go next

- [Draw social card images](/docs/building-remix-apps/social-card-images) — drawing on a canvas
  that encodes to PNG.
- [Check where the name points](/docs/identity-and-security/fetch-untrusted-urls#check-where-the-name-points)
  — resolving each hop over DNS before the job requests it.
- [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers) — serving
  pictures without reading the bucket on every request.
