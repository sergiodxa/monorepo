---
title: Publish a status page
description: Give your customers one public address that shows whether your services are up, so they stop asking support.
section:
  title: Guides
  order: 2
order: 3
lastUpdated: 2026-10-31
next: ["/docs/guides/schedule-maintenance", "/docs/concepts/status-pages"]
keywords: ["public status", "status site", "incident page", "share uptime", "customers"]
---

A status page shows the current status and 90-day history of the monitors and cron jobs you pick, at `https://uptime.sergiodxa.com/status/<slug>`.

<mockup area="status-page" caption="A public status page" />

<steps>
<step id="open-the-form" title="Open the form">

Open <ui>Status Pages</ui> in the sidebar and click <ui>Create Status Page</ui>.

</step>
<step id="brand-it" title="Brand it">

Under **Branding**:

- <ui>Internal Name</ui> is how the page is listed for your team.
- <ui>URL Slug</ui> becomes the end of the address, so `acme` publishes `/status/acme`. Slugs are unique across Uptime; if yours is taken, pick another.
- <ui>Public Title</ui> is the heading your visitors see.
- <ui>Description</ui> and <ui>Logo URL</ui> are optional.

</step>
<step id="decide-who-can-see-it" title="Decide who can see it">

Under **Visibility**, both switches start on:

- <ui>Public</ui> publishes the page at its address. Turn it off to take the page offline without deleting it.
- <ui>Show Overall Status</ui> adds a banner summarising every service on the page.

</step>
<step id="pick-the-services" title="Pick the services">

Under **Services**, tick the monitors in <ui>Monitors to Include</ui> and the jobs in <ui>Cron Jobs to Include</ui>. HTTP, DNS, TCP and flow monitors share one list.

Click <ui>Create Status Page</ui>.

</step>
<step id="open-it" title="Open it">

In the <ui>Status Pages</ui> list, click the page's `/status/<slug>` link in the **URL** column. Share that address with your customers.

</step>
</steps>

Maintenance windows with <ui>Show on status page</ui> turned on appear on every status page that shows a service they cover, and each page publishes a calendar of them readers can subscribe to. See [Schedule maintenance](/docs/guides/schedule-maintenance).

<faq>
<question title="Can I make a page only my team can see?">

No. A page with <ui>Public</ui> turned off isn't reachable by anyone, your team included. Use it to prepare a page before launch.

</question>
<question title="How do I change or remove a page?">

Click <ui>Edit Page</ui> on its row in <ui>Status Pages</ui>, change what you need and click <ui>Save Changes</ui>. To remove it, use <ui>Delete Page</ui> in the page's **Danger zone**; deleting takes its address offline for good.

</question>
</faq>
