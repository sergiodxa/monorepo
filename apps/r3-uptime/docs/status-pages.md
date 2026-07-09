# Status Pages

## Purpose

Status pages provide a public or controlled-facing view of service health so users can check system status without contacting the team directly.

## What Users Configure

- Name
- Slug
- Title
- Description
- Logo
- Public or private visibility
- Whether to show an overall status banner
- Which services are included on the page
- The order of included services

## How It Works

1. The user creates a status page.
2. The user selects which monitored services appear on that page.
3. The page computes an overall status from the included items.
4. Visitors can open the page by its slug when the page is public.

## Supported Content

The feature is centered on showing:

- HTTP monitors
- DNS monitors
- TCP monitors
- Cron job monitors

SSL monitors are not attachable: the underlying `ssl_monitors` table has no rows in
production (SSL status is tracked inline on `monitors` instead — see
`docs/ssl-monitoring.md`), so a picker for it would always be empty.

## Page-Level Status Model

- `operational`
- `degraded`
- `down`

Included services contribute their own states to the overall page status.

## Service Presentation Rules

- HTTP monitors should display their current status and recent history.
- Cron jobs should display their current state, schedule, and last successful activity.
- Empty status pages should still exist and render a clear empty state.

## Visibility Model

- `public`: visitors can view the page directly by slug
- `private`: the page exists for internal or controlled access only — it has no
  public route at all; `/status/:slug` 404s for it. Management (viewing/editing its
  configuration) still happens through the team's admin pages.

## Visible Outputs

- Page title and description
- Logo
- Optional overall status banner
- Included service list
- Status badges
- Last updated time
- Empty state when no services are attached

## Defaults and Limits

- Status pages are public by default.
- The overall status banner is enabled by default.
- If the user does not provide a title, the page name should be usable as the title.
- Slugs should be URL-safe and human-readable.

## Important Behavior Notes

- Status pages are communication features, not raw dashboards.
- They should present stable, understandable service names and states to end users.
- Curating attached services always replaces the full set for a page (delete then
  re-add in the submitted order) rather than diffing — there's no separate reorder
  action; resubmitting the form is how reordering happens.
- The overall status is majority-based: it only reads "down" when more than half of
  the attached, non-unknown services are down or degraded, and "degraded" when any
  are — not "any failure means the whole page is down."
