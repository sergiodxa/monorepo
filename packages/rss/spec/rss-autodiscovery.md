# RSS Autodiscovery

Editor's Note: This is version 1.0 of this document, published Nov. 27, 2006.

#### 1. Introduction

RSS autodiscovery is a technique that makes it possible for browsers and other software to automatically find a site's RSS feed, whether it's in [RSS 1.0](http://web.resource.org/rss/1.0/) or [RSS 2.0](index.md) format.

Supported by Mozilla Firefox 2.0, Microsoft Internet Explorer 7.0 and other browsers, autodiscovery has become the best way to inform users that a web site offers a syndication feed. When a browser loads a page and discovers that a feed is available, Firefox and Internet Explorer display the common feed icon in the address bar.

![Firefox address bar of page with RSS feed identified using RSS Autodiscovery](https://www.rssboard.org/images/rss-autodiscovery-address-bar.gif)

Users can click the icon to subscribe with the browser's RSS reader or the user's preferred reader. Web publishers who offer feeds reach a wider potential audience with autodiscovery.

This specification describes how web publishers can support autodiscovery by adding an HTML header to web pages.

#### 2. Conventions

In this documentation, the key words may, must, must not, optional, recommended, required, shall, shall not, should and should not are to be interpreted as described in [RFC 2119](http://www.ietf.org/rfc/rfc2119.txt).

#### 3. `link` Element

Autodiscovery employs the `link` element from [HTML](http://www.w3.org/TR/html4/struct/links.html#h-12.3) and [XHTML](http://www.w3.org/TR/2002/REC-xhtml1-20020801/) to identify a site's syndication feed. The link must be placed within a web page's `head` element to establish a relationship between the page and another document.

To support autodiscovery, a `link` element must be added to the header, as shown in this HTML markup from [The RSS Blog](http://www.kbcafe.com/rss):

```html
<html>
	<head>
		<title>The RSS Blog</title>
		<link
			rel="alternate"
			type="application/rss+xml"
			title="RSS"
			href="http://feeds.feedburner.com/TheRssBlog"
		/>
	</head>
	<body>
		<!-- the web page's contents -->
	</body>
</html>
```

The link can be placed within the header of the site's home page, individual pages such as weblog entries and any other page where a user might want to know that a feed's available. A `head` may include more than one autodiscovery link, but each must identify a different feed.

To make the RSS subscription process simple for inexperienced users, publishers should include only one autodiscovery link per page, using it to identify a site's main feed.

If you decide to include more than one autodiscovery link, the first link should be the site's main feed.

Publishers who offer the same feed content in several syndication formats should not use autodiscovery links for all of them. Choosing only one feed format for autodiscovery makes it easier on new subscribers, especially if they are unfamiliar with syndication and can't distinguish between the Atom, RSS 1.0 and RSS 2.0 formats.

The `link` element must have three attributes that describe the relationship: `href`, `rel`, and `type`, and may have a `title` attribute.

Because attribute names must be lowercase in XHTML, autodiscovery link attributes should have lowercase names in HTML as well.

#### 3.1. `href` Attribute

The `href` attribute must be the feed's URL. This can be a relative URL in pages that include a [base](http://www.w3.org/TR/html4/struct/links.html#h-12.4) element in the header.

```html
<head>
	<title>RSS Advisory Board</title>
	<base href="https://www.rssboard.org/" />
	<link rel="alternate" type="application/rss+xml" href="rss-feed" />
</head>
```

Because some software might not check for a base URL in relation to autodiscovery links, publishers should identify feeds with full URLs. When an autodiscovery link is relative and no base URL has been provided, clients should treat the web page's URL as the base.

#### 3.2. `rel` Attribute

The `rel` attribute must have a value of `alternate`, a keyword that indicates the link is an alternate version of the site's main content.

Although for purposes other than autodiscovery this attribute may contain multiple keywords separated by spaces, in an autodiscovery link, the value must not contain keywords other than `alternate`.

Additionally, though `rel` keywords are case-insensitive elsewhere, `alternate` must be lowercase.

#### 3.3. `type` Attribute

The `type` attribute must contain the feed's MIME type, which is `application/rss+xml` for RSS 1.0 or RSS 2.0 feeds.

Although `type` values are case-insensitive for other HTML and XHTML links, the value must be lowercase for autodiscovery.

#### 3.4. `title` Attribute

The `title` attribute, when present, contains a short, human-readable label such as the site's name or the feed's name. When a page contains more than one autodiscovery link, the title enables users to differentiate between the feeds, as demonstrated by Om Malik's [GigaOM](http://www.gigaom.com/) site.

![Firefox address bar of page with multiple RSS feeds identified using RSS Autodiscovery](https://www.rssboard.org/images/rss-autodiscovery-multiple-links.gif)

Each autodiscovery link has a different title, which Mozilla Firefox displays in a drop-down menu when a user clicks the common feed icon.

#### Credits

Rogers Cadenhead, James Holderness and Randy Charles Morin contributed to this document. Comments and corrections regarding this document are encouraged on the [RSS-Public](https://groups.google.com/g/rss-public) mailing list.

#### License

![Creative Commons logo](https://www.rssboard.org/images/creative-commons-logo.gif)

Copyright 2026 RSS Advisory Board. This document titled RSS Autodiscovery is authored by the [RSS Advisory Board](https://www.rssboard.org/), published at the URL [https://www.rssboard.org/rss-autodiscovery](rss-autodiscovery.md) and shared under the terms of the Creative Commons [Attribution/Share Alike](https://creativecommons.org/licenses/by-sa/2.0/) license.

---

- [RSS 2.0 Specification](index.md)
- [Really Simple Syndication Best Practices Profile](rss-profile.md)
- [RSS Language Codes](rss-language-codes.md)
- [RssCloud API](rsscloud-interface.md)
