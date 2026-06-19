# Article Template

This template demonstrates the structure and style for articles on sergiodxa.com.

## Frontmatter

```yaml
---
title: [Conceptual Title About the Topic]
excerpt: [Complete sentence under 130 characters exploring what the reader will understand.]
---
```

Note: Articles do NOT include the `tech` field.

## Title Patterns

Article titles should be conceptual, not instructional:

**Good titles:**

- "Understanding X in the Context of Y"
- "The Trade-offs of X"
- "Why X Matters for Y"
- "Defense in Depth for X"
- "When X Fails"
- "Request-Level State in React Router Middleware"
- "Why Per-Request Singletons Beat Module Caches in Workers"

**Bad titles (these are tutorial titles):**

- "How to Implement X"
- "Building X with Y"
- "A Guide to X"

Article title guidance:

- Be descriptive enough that the topic is obvious in a feed
- Name the actual concept, trade-off, or failure mode
- Avoid vague bucket titles like `Notes`, `Weekly Links`, or `Some Thoughts`
- Avoid clickbait or teasing phrasing that hides the point

## Opening (1-2 paragraphs)

Establish the problem space or concept. Frame the topic in terms of real challenges developers face. Do not jump into technical details immediately.

The opening should make the reader understand why this topic matters and what questions the article will address.

## Body Sections

### Section Heading Patterns

Use conceptual headings that describe ideas, not actions:

- "The Core Problem"
- "Why This Approach Works"
- "When X Makes Sense"
- "When X Fails"
- "The Trade-offs"
- "Security Implications"

Avoid action headings like "Create the Service" or "Add the Handler".

### Section Content Pattern

Explain concepts with supporting examples. Code should illustrate the point, not be the focus.

```ts
// Brief example showing the concept
let example = illustrateConcept();
```

This demonstrates the underlying principle. The key insight is that X leads to Y, which has implications for Z.

### Trade-off Pattern

Present both sides explicitly:

**Advantages:**

- Benefit one with brief explanation
- Benefit two with brief explanation

**Limitations:**

- Cost one with brief explanation
- Cost two with brief explanation

### Comparison Pattern

When comparing approaches, be explicit about criteria:

| Approach | Isolation | Complexity | When to Use |
| -------- | --------- | ---------- | ----------- |
| Option A | Strong    | High       | Scenario X  |
| Option B | Weak      | Low        | Scenario Y  |

## Closing Section

Summarize key insights in 2-3 sentences. Reinforce when the approach applies. Keep it brief.

## Example: Complete Article

```markdown
---
title: Understanding Timing Attacks in Authentication
excerpt: How response time differences leak secrets and why constant time operations matter.
---

Computers are predictable. When comparing two strings, most programming languages check character by character and stop at the first mismatch. This optimization, harmless in normal code, becomes a vulnerability when comparing secrets. An attacker who can measure response times can extract secrets one character at a time.

## The Core Problem

The vulnerability stems from a fundamental truth: different code paths take different amounts of time. When you compare a user provided API key against a stored one using strict equality, the comparison returns immediately upon finding a mismatch.

\`\`\`ts
// This comparison leaks timing information
if (providedKey === storedKey) {
// grant access
}
\`\`\`

An attacker exploits this by sending many requests with different guesses and measuring response times. A guess that takes slightly longer means more characters matched.

## The Threat Model

Not every system is equally vulnerable. Timing attacks require precision, and several factors affect their practicality.

**Network proximity matters.** An attacker on the same local network can measure microsecond differences reliably. Over the public internet, network jitter adds noise, but statistical analysis across thousands of requests can filter it out.

**Request volume is essential.** Extracting a secret requires many requests. Rate limiting provides some protection, but determined attackers can work slowly over extended periods.

**The secret must be valuable.** Timing attacks require effort. Attackers target high value secrets: API keys, session tokens, HMAC signatures.

## The Defense

The solution is to ensure comparisons take the same amount of time regardless of where the strings differ. This is called constant time comparison.

\`\`\`ts
import { timingSafeEqual } from "node:crypto";

function secureCompare(a: Buffer, b: Buffer): boolean {
if (a.length !== b.length) {
timingSafeEqual(a, a); // Still perform work
return false;
}
return timingSafeEqual(a, b);
}
\`\`\`

The function compares every byte, accumulating differences without returning early. The execution time depends only on the length of the inputs, not their contents.

## When Timing Does Not Matter

Not every comparison needs to be timing safe. Use constant time operations when:

1. The value being compared is secret
2. An attacker could benefit from learning it incrementally
3. The comparison happens server side where timing is measurable

Regular comparison is fine for public identifiers, payload contents after signature verification, and any non-secret data.

## Conclusion

Timing attacks exploit the property that different code paths take different amounts of time. The defenses are well understood: use constant time comparison for secrets and always run expensive operations regardless of input validity. These patterns add negligible overhead while closing a real attack vector.
```
