---
title: Security
description: Which releases get fixes, and how to report something privately.
---

<hero>
<split lean="copy">
<split-copy>

# Security

There is one line of releases, published from `main`, and the fix for a security problem goes
out on the next release date. That is the whole policy, and the rest of this page is what it
means for a version you have pinned.

<actions cta-href="mailto:hello+security@sergiodxa.com" cta-label="Report privately" alt-href="https://github.com/sergiodxa/monorepo/blob/main/.github/SECURITY.md" alt-label="Policy on GitHub" />

<fine-print>Last updated 21 September 2026.</fine-print>

</split-copy>
<split-media>

```text {% title="hello+security@sergiodxa.com" %}
Package   @sdxc/webhooks
Version   2026.9.21
Steps     how to reproduce
Impact    what it exposes
Attached  logs, screenshots
```

</split-media>
</split>
</hero>

<section-block id="which-releases-get-fixes">
<split>
<split-copy>

## Which releases get fixes

The next one. A fix lands on `main` and ships with the dated release published after it,
together with every public package that depends on the one it changed.

- Dependents republish the same day, so their pins move with the fix
- The fix reaches the package you installed and the packages underneath it on one date
- Nothing is backported, and there are no maintenance branches
- An older version keeps working exactly as it was published

So taking the fix means moving your pin forward.

<actions cta-href="/maintenance" cta-label="Read the maintenance policy" size="sm" />

</split-copy>
<split-media>

```diff {% title="package.json" %}
 {
 	"dependencies": {
-		"@sdxc/webhooks": "2026.9.21"
+		"@sdxc/webhooks": "2026.10.30"
 	}
 }
```

> [!WARNING]
> Read the release notes before you move. A later date carries no compatibility promise, so the
> release that carries a fix may also change or remove an export — that is what
> [dated versions](/docs/releases/versioning) mean.

</split-media>
</split>
</section-block>

<section-block id="reporting-something-privately" tone="tinted">
<split>
<split-copy>

## Reporting something privately

Report it privately rather than in the open. Issues are closed on the repository, so there is
nowhere public to file it in any case.

There are two ways to reach me, both listed in the repository's own security policy. Say which
package or app is affected, how to reproduce it, and what you think the impact is.

<actions cta-href="https://github.com/sergiodxa/monorepo/blob/main/.github/SECURITY.md" cta-label="Read SECURITY.md" size="sm" />

</split-copy>
<split-media>

<feature-grid columns="2">
<feature title="Email" icon="mail">
Send it to **hello+security@sergiodxa.com**, with the package, the steps and the impact.
</feature>

<feature title="Discord" icon="message">
A direct message to **@sergiodxa** reaches the same person. Logs and screenshots help either way.
</feature>
</feature-grid>

</split-media>
</split>
</section-block>

<section-block id="what-happens-next" eyebrow="After" title="What happens next">

<feature-grid columns="2">
<feature title="Reviewed as soon as I can" icon="shield">
Reports are reviewed as soon as I can get to them, by the one person who maintains these
packages.
</feature>

<feature title="Fixed before it is public" icon="lock">
A valid report is fixed privately before anything about it is published, and the fix ships on
the next release date.
</feature>

<feature title="No stated response time" icon="clock">
There is no stated response time. Promising a window I cannot hold to would be worse than saying
so.
</feature>

<feature title="No bounty" icon="coins">
There is no paid bounty or compensation program. What a valid report gets is a fix, shipped on
the next release date.
</feature>
</feature-grid>
</section-block>

<section-block id="report" title="Found something? Say so privately." tone="grid" align="center">

A report by email is the fastest way in, and nothing about it is published before the fix ships.

<actions cta-href="mailto:hello+security@sergiodxa.com" cta-label="Email a report" alt-href="/docs/releases/changelog" alt-label="Read the changelog" />
</section-block>
