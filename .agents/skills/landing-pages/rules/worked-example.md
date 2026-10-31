---
title: Worked Example
impact: HIGH
tags: [planning, example, story, visuals, art-direction]
---

# Worked Example

This is the thinking a session does before writing JSX, for a made-up product. Follow the same steps for
yours: the story, a band table with the exact moment each visual shows, a check of the device column, and
the art direction as tokens. Most of the page's quality is decided here; the build afterwards is mostly
filling in a plan.

## Why

- **Planning exposes the weak bands while they are cheap.** A row whose "moment" cell you cannot fill is
  a band that would have shipped as text and icons.
- **The table is the review.** Reading the device column top to bottom shows repetition and gaps at a
  glance, before anything renders.

## The product

**Restorepoint**: nightly Postgres backups that restore each copy into a scratch database and compare it
with production, so a team knows a backup works before they need it. A real product with no customers to
quote yet.

## 1. The story

Write it as plain text first. Each proof becomes a band.

```text
Promise   Backups you have already restored
Lead      Restorepoint copies your Postgres database every night, restores the copy into a scratch
          database and compares row counts, so the morning you need it you already know it works.
          (strong: "restores the copy into a scratch database")
Proofs    1. Every backup is restore-tested, nightly
          2. Recover to the second before the mistake
          3. Set up with one connection string
          4. The details a DBA asks about (encryption keys, retention, regions, alerts, audit log)
          5. Limits stated as figures
Action    Connect a database · secondary: Read how drills work
Objections Does a drill load production? Where do copies live? What if a drill fails at 3 a.m.?
```

The first draft of the promise was "Reliable, secure Postgres backups". It fails the swap test: every
backup tool can say it. "Backups you have already restored" names the one thing only this product does.

## 2. The band table

One row per band: the claim, the device, and the exact moment the visual shows. Then the copy.

| # | Band | Claim | Device | The moment shown |
| --- | --- | --- | --- | --- |
| 1 | Hero | Backups you have already restored | `ProductFrame`, the backups screen | Seven nights of backups, each with a drill result; last night's drill **failed** on `events` (rows 1,204,311 vs 1,204,388) with "Retrying with WAL replay" under it |
| 2 | Figures | Limits, honestly | `StatStrip size="display"` | 35 days retained · 6 regions · 2 TB per database · 04:00 drills, all read from `config/plans.ts` |
| 3 | 01 / Drills | Every backup is restore-tested | `FlowDiagram` | 02:00 trigger → snapshot → upload to `eu-west` → restore into scratch → compare 212 tables → "Verified in 3 m 41 s" |
| 4 | 02 / Point in time | Recover to the second before the mistake | split + custom scene | A timeline of WAL segments with a red tick at 14:32:07 (`DROP TABLE invoices`) and the restore point pinned at 14:32:06 |
| 5 | 03 / Setup | One connection string | `CodeStage tabs` | `restorepoint.toml` / `docker-compose.yml` / `main.tf`, 9–12 lines each |
| 6 | Details | The things a DBA checks | `Bento` of six scenes | your KMS key ARN in a field; a retention slider at 35 days; a Slack message "Drill failed on billing-prod"; a region chip list; an audit row "alex@ restored invoices"; a size chart |
| 7 | Compare | Versus a `pg_dump` cron | `Table` | Rows: restore tested, PITR, encryption, alerting; the cron's honest column says "you script it" |
| 8 | Pricing | Priced per database | `PricingBand` | from `config/plans.ts` |
| 9 | FAQ | The three objections | `FaqBand` | — |
| 10 | Close | Connect a database | `ClosingCta` | the same CTA as the hero |

Then check it:

- **Device column**: frame, figures, flow, split scene, code, bento, table, pricing, FAQ, close. No device
  twice in a row, and something moves below the fold (the drill).
- **Hero uniqueness**: the backups screen appears only in the hero. Band 4's timeline is a different
  screen, and band 6's cells are fragments, not the backups list again.
- **Every moment is a change**: a drill failing and retrying, a run reaching "verified", a mistake and the
  restore point before it, a setting already set. None is "a list of features".
- **Proof is honest**: no logos, no testimonials (there are none yet), figures from config. Band 2 stays
  because all four values are real; with only two, it would be cut.

### Weak and strong rows, side by side

The first draft of the table had rows like these. Each is the same claim with a better moment.

| Claim | Weak | Strong |
| --- | --- | --- |
| Restore-tested | an icon of a shield and "Every backup is verified" | the drill animating from trigger to "Verified in 3 m 41 s" |
| Point in time | a card "PITR to any second" | the timeline with the `DROP TABLE` tick and the restore point one second before |
| Alerts | a grid of Slack, PagerDuty and email logos | the one Slack message a failed drill sends, with the table name and the row diff |
| Hero | a generic dashboard with uptime-style charts | the backups list with one failed drill, because a product that catches failures should show one |

## 3. The art direction

The product is about trust in something boring. Name it: **calm and clinical**. Closest reference: Keel,
but quieter, with fewer emphasis bands.

- **Type**: sans display at weight 600, mono for every number, table name and time.
- **Colour**: a deep teal as the one accent (the action and verified states); amber for the failed drill
  only; a cool grey neutral. Read nothing from a brand site, because there is none: build the ramp around
  one chosen oklch value.
- **Framing**: the `grid` hero tone and chapter numbers like Keel; hairlines instead of tinted bands for
  most of the page; one inverse band for the drills chapter, the heart of the story.
- **Motion**: only the drill diagram and the hero entrance.

```ts
const TOKENS = {
	"--ui-marketing-display-weight": "600",
	"--ui-marketing-display-tracking": "-0.03em",
	"--ui-marketing-eyebrow-font": "var(--ui-font-mono)",
	"--ui-marketing-eyebrow-transform": "uppercase",
	"--ui-marketing-cta-radius": "0.5rem",
	"--ui-button-radius": "0.5rem",
};
```

## 4. Only now, build

Generate the files with `sdxc make`, set the palette and tokens on the layout, build the hero first and
compare it with Keel's at 1440 and 375 before going further. Then the bands in table order, then the
review in @rules/verify-like-a-reviewer.md.

## Rules

1. Write the story and the band table before any markup.
2. Fill the moment column with a change you can draw; rewrite rows that describe a feature.
3. Read the device column for repeats and the hero for reuse.
4. Name the art direction and set it as tokens before building bands.
