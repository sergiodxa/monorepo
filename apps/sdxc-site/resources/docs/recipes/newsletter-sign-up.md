---
title: Add a newsletter sign-up
description: Subscribe readers to a newsletter platform, credit each one to the campaign that brought them, and keep bots off the form.
section:
    title: Recipes
    order: 1.7
order: 8
lastUpdated: 2026-10-25
outcomes:
    - "What guides build a newsletter sign-up, and in what order to follow them"
    - "How each reader reaches the list with the campaign that brought them"
    - "Why a honeypot and a per-address budget fit a one-field sign-up box"
---

By the end of this recipe your site has a sign-up box that adds readers to Buttondown or Kit,
each credited to the campaign, referrer and landing page that first brought them. A honeypot and
a per-address budget keep bots from filling your list with addresses nobody owns.

## Remember where visitors land

A reader's campaign is recorded on the page views before they subscribe, so the cookie that
holds it comes first. Follow
[Keep the first and last touch](/docs/data-and-background-work/attribution#keep-the-first-and-last-touch)
for the signed cookie and the `attribution()` middleware.

## Subscribe readers

Follow [Run a newsletter list](/docs/data-and-background-work/newsletter). Its router already
installs `attribution()` from the previous step, and its action hands the reader's touch to the
platform with `toCampaign`, so the campaign arrives with every new subscriber.

## Guard the sign-up

A form with one email field gives a spam score nothing to read, so the honeypot and the budget
are the layers that fit. Follow
[Set a trap no person fills](/docs/identity-and-security/protect-forms#set-a-trap-no-person-fills)
and [Budget each address](/docs/identity-and-security/protect-forms#budget-each-address), then
mount `trap` on both `subscribe` routes and `callerBudget("subscribe", 5)` on its action, as
[Mount the guards on the route](/docs/identity-and-security/protect-forms#mount-the-guards-on-the-route)
does. `renderSubscribe` issues the honeypot fields into the form, and the action answers
`isFailure(ctx.honeypotOutcome)` with "Send it again." before it validates.

## Test it

Test each stage as its guide does:
[Test against the memory list](/docs/data-and-background-work/newsletter#test-against-the-memory-list)
checks who reached the list, and
[Test the guards](/docs/identity-and-security/protect-forms#test-the-guards) posts a signed
honeypot token through the router.

## Where to go next

- [Receive and send webhooks](/docs/identity-and-security/webhooks) — the signatures and
  replay store behind the confirmation webhook.
- [Charge for your app](/docs/data-and-background-work/billing) — the same touches credited on
  a checkout.
- [`@sdxc/newsletter`](/api/newsletter) — the Kit provider's options and every error code.
