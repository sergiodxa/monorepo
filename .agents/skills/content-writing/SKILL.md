---
name: content-writing
description: Use it when creating tutorials or articles in the style of sergiodxa.com.
---

# Content Writing Specification

This specification defines requirements for writing tutorials and articles for sergiodxa.com.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

## Content Types

Content MUST be classified as either a **tutorial** or an **article** before writing begins.

### Tutorials

Tutorials teach readers HOW to build something specific.

- Tutorials MUST have titles starting with "How to"
- Tutorials MUST focus on implementation steps
- Tutorials MUST use code as the primary content
- Tutorials MUST result in working functionality
- Tutorials MUST include the `tech` field in frontmatter

### Articles

Articles help readers UNDERSTAND concepts.

- Articles MUST NOT have titles starting with "How to"
- Articles MUST focus on "why" and "when" questions
- Articles MUST explore trade-offs and design decisions
- Articles SHOULD use code to illustrate points, not as primary content
- Articles MUST NOT include the `tech` field in frontmatter

## Frontmatter

### Required Fields

All content MUST include:

- `title`: The content title
- `excerpt`: A description under 130 characters

### Tutorial-Only Fields

Tutorials MUST include:

- `tech`: Package versions in format `name@version` or `@namespace/name@version`

Tech versions MUST be actual released versions. When uncertain, confirm with the author.

## Structure

### Tutorial Structure

1. Tutorials MUST start with 1-2 paragraphs describing the use case and challenge
2. Tutorials MAY include a TL;DR with link to example repository
3. Tutorials MUST use action-oriented headings
4. Tutorials MUST build incrementally where each section adds to the previous
5. Tutorials MUST show code first, then explain
6. Tutorials SHOULD keep explanations between code blocks to 2-4 sentences

### Article Structure

1. Articles MUST start with 1-2 paragraphs establishing the problem space
2. Articles MUST organize around conceptual sections, not implementation steps
3. Articles MUST use descriptive headings: "The Problem with X", "Why Y Matters", "When to Use Z"
4. Articles MUST present trade-offs explicitly
5. Articles SHOULD compare alternatives when relevant
6. Articles MUST end with a brief conclusion summarizing key insights
7. Articles MAY use rhetorical questions to introduce sections or provoke thought
8. Articles MAY include an appendix section for related tangents

### Closing Sections

- Tutorials SHOULD use "Final Thoughts" as the closing heading
- Articles SHOULD use "Conclusion" as the closing heading
- Closing sections MUST be brief (2-4 sentences)
- Closing sections MUST NOT introduce new concepts
- Closing sections MAY suggest extensions the reader could explore: "You can extend this further by adding..."
- Extension suggestions MUST NOT include implementation details, only ideas

## Code Blocks

### Language Annotations

- Code blocks MUST specify a language
- TypeScript without JSX MUST use `ts`
- TypeScript with JSX MUST use `tsx`
- SQL MUST use `sql`
- Plain text SHOULD use `txt`
- ERB templates MUST use `erb`
- JSON MUST use `json`
- CSS MUST use `css`
- HTML MUST use `html`
- Shell commands MUST use `bash` or `sh`

### File Path Annotations

- Tutorial code blocks MUST include file path annotations
- Path annotations MUST be on the same line as opening backticks
- Path annotations MUST use format `{% path="path/to/file.ts" %}`
- Paths MUST be realistic project paths
- Article code blocks SHOULD NOT include path annotations unless referencing specific files

### Code Quality

- Code MUST be functional and realistic
- Code MUST use proper TypeScript types
- Code MUST include imports when relevant
- Code SHOULD show complete file contents when demonstrating a feature
- Code MUST use `let` for local variables (project convention)
- Code MUST use `interface` over `type` when possible (project convention)
- Code MAY include brief inline comments to clarify intent: `// You assume the user is already authenticated`
- Code comments MUST NOT be used for lengthy explanations (put those in prose)
- Constants SHOULD be defined at the top of code files, after imports

### Code Evolution in Tutorials

When showing the same file multiple times as it evolves:

- Code MUST use comments to indicate unchanged portions: `// ... previous code`
- Code MUST show enough context for the reader to locate where new code goes
- Code SHOULD show the full file on first introduction
- Code MAY show only the changed sections in subsequent appearances

Example:

```ts {% path="app/service.ts" %}
import { db } from "./db";

// ... previous code

export function newFunction() {
	// new code here
}
```

### Error Handling in Code

- Code MUST include error handling only when the section is specifically about error handling
- Code MAY omit error handling for clarity when demonstrating other concepts
- Code MUST NOT show try/catch blocks unless errors are the topic

### Component Patterns in Code

When demonstrating React component patterns:

- Compound components SHOULD use the `Component.SubComponent = function...` export style
- Component examples SHOULD include both the component definition and usage
- State management SHOULD be shown in context, not abstracted away

### Diagrams

- Diagrams MUST use ASCII art inside code blocks
- Diagrams MUST use `txt` as the language annotation
- Diagrams SHOULD be used sparingly to clarify complex flows or architectures
- Diagrams MUST NOT use external images or Mermaid syntax

Example:

```txt
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Client  │────▶│ Worker  │────▶│   DO    │
└─────────┘     └─────────┘     └─────────┘
                     │
                     ▼
               ┌─────────┐
               │   KV    │
               └─────────┘
```

## Language

### Spelling and Grammar

- Content MUST use American English spelling
- Content MUST NOT use dashes or em-dashes in prose
- Content MAY use dashes in markdown lists and code
- Content SHOULD use commas, colons, or periods instead of dashes

### Headings

- Headings MUST use The Chicago Manual of Style title case
- Headings MUST NOT use words like "clever" or "magic"
- Headings SHOULD be concise (under 8 words)

### Terminology

- Content MUST use "route modules" for React Router files, not "components"
- Content MUST use standard industry pattern names
- Content MUST be consistent with terminology throughout
- Content MUST NOT use unexplained acronyms
- Content MAY define acronyms inline when first used
- HTTP status codes MUST include the code number and name: "HTTP 429 (Too Many Requests)"
- HTTP status codes MUST NOT use just the number or just the name

### Formatting

- Content MAY use **bold** for emphasis on key concepts (sparingly)
- Content MUST use `backticks` for code terms, filenames, and identifiers
- Content MAY use _italics_ to introduce or define a term on first use
- Content MUST NOT use italics for general emphasis

### Blockquotes

- Blockquotes MAY be used for notes and asides: `> Note:` or `> TL;DR:`
- Blockquotes MUST NOT be used for emphasis or pull quotes
- Blockquotes SHOULD be brief (1-3 sentences)

### Emojis

- Content MUST NOT use emojis in prose or headings
- Content MAY use checkmark emojis (✅) only in summary checklists at the end of articles
- Content MUST NOT use emojis for decoration or emphasis

## Tone and Style

### Sentence Structure

- Sentences SHOULD be short and declarative
- Sentences MUST lead with the main point
- Complex ideas SHOULD be broken across multiple sentences

### Paragraphs

- Paragraphs MUST be 2-4 sentences maximum
- Paragraphs MUST contain one idea each
- Content SHOULD use whitespace generously

### Voice

- Content MUST use direct and practical language
- Content MUST NOT use marketing language ("powerful", "elegant", "perfect")
- Content MUST NOT use phrases like "as you can see" or "it's worth noting"
- Content SHOULD acknowledge uncertainty when it exists
- Content MUST NOT use absolutism ("always", "never") unless technically accurate

### Trade-offs

- Content MUST present trade-offs explicitly when discussing approaches
- Content SHOULD use patterns like "X provides Y, but at the cost of Z"
- Content MUST NOT present any approach as universally correct

## Prohibited Content

- Content MUST NOT include long explanatory sections without examples
- Content MUST NOT include purely theoretical discussions
- Content MUST NOT include non-functional code examples
- Content MUST NOT include marketing-style language or hyperbole
- Content MUST NOT use explicit transition words ("Furthermore", "Additionally")
- Content MUST NOT include external links (only internal links to other sergiodxa.com content)
- Content MUST NOT include dates or "as of" statements

## Linking

- Links MUST only point to other content on sergiodxa.com
- Links MUST NOT be repeated: if a term was linked once, subsequent mentions MUST NOT link again
- Links SHOULD be natural parts of the content, not separate "See also" sections
- Links MAY reference related tutorials or articles when contextually relevant
- Links MUST NOT point to external documentation, GitHub repos, or other sites

This follows the Wikipedia convention: link on first mention only.

### Cross-Linking Patterns

- Links MUST be fully integrated into the prose, not separate callouts
- Links SHOULD read naturally as if the link were not there: "when using [React Router middleware](/tutorials/...) you can..."
- Links MUST NOT use patterns like "Click here", "Read more about this", or "See [article] for more"

## Version References

- Tech field versions MUST be the minimum version required for the features used
- Content MUST note when an API is experimental or unstable
- Content MUST NOT include dates or "current version" language
- Content SHOULD specify the version when a feature was introduced if relevant

Example: "The `unstable_middleware` export (available in React Router 7.0) enables..."

## Audience

- Content MUST assume intermediate to senior developer knowledge
- Content MUST NOT explain basic programming concepts (loops, functions, async/await)
- Content MUST NOT explain basic web concepts (HTTP, cookies, forms) unless that is the topic of the content
- Content MAY briefly explain domain-specific concepts (OAuth flows, WebAuthn ceremonies)
- Content SHOULD link to other articles for prerequisite knowledge when helpful

## Naming Conventions in Examples

When introducing file naming conventions or patterns in tutorials:

- Content SHOULD explain the convention inline: "I use `noun-verb.ts` where the noun is the resource and the verb is the action"
- Content MAY acknowledge alternative conventions exist
- Content MUST use consistent naming throughout the tutorial

## Workflow

Before writing:

1. Agent MUST confirm whether content is a tutorial or article
2. Agent MUST fetch relevant examples from reference files
3. Agent SHOULD review referenced documentation for technologies involved

## References

### Libraries

When writing about these technologies, agents SHOULD fetch their documentation:

- Zod: https://zod.dev/llms.txt
- Drizzle ORM: https://orm.drizzle.team/llms.txt
- React Router: https://reactrouter.com/llms.txt
- React Router Middleware: https://raw.githubusercontent.com/remix-run/react-router/main/docs/how-to/middleware.md

### Example Content

Agents MUST fetch and review these examples before writing:

For tutorials:

- https://sergiodxa.com/md/tutorials/add-a-color-scheme-toggle-in-react-router
- https://sergiodxa.com/md/tutorials/create-a-per-request-singleton-with-react-router-middleware
- https://sergiodxa.com/md/tutorials/use-action-routes-in-react-router

For articles:

- https://sergiodxa.com/md/articles/oauth2-tokens-explained
- https://sergiodxa.com/md/articles/on-frontend-vs-backend
- https://sergiodxa.com/md/articles/making-web-component-good-enough

### Structure Templates

See bundled reference files for structural templates:

- [Tutorial Template](./templates/tutorial.md)
- [Article Template](./templates/article.md)
