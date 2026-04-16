# RssCloud API

Archivist's Note: This documentation applies to [RSS 2.0](index.md).

This is version 1.2 of this document.

#### 1. Introduction

The RssCloud Application Programming Interface (API) is an XML-RPC, SOAP 1.1 and REST web service that enables client software to be notified of updates to [RSS](index.md) documents. A server (called the "cloud") takes notification requests for particular RSS documents.

When a monitored document changes, the cloud calls a remote method on all interested clients to note the update.

#### 2. Conventions

In this specification, the key words must, must not, required, shall, shall not, should, should not, recommended, may and optional are to be interpreted as described in [RFC 2119](http://www.ietf.org/rfc/rfc2119.txt).

#### 3. Methods

The interface consists of two requests: a client-to-cloud call to request notification and a cloud-to-client call to perform notification.

#### 3.1. Client Request

A notification request from a client to the cloud must contain five parameters:

1. The name of the remote procedure the cloud should call on the client upon an update.
2. The client's TCP port.
3. The client's remote procedure call path.
4. The string `xml-rpc` if the client employs XML-RPC, `soap` for SOAP, and `http-post` for REST.
5. A list of URLs of RSS documents that the client seeks to monitor.

The cloud must return the boolean `true` if the cloud successfully registers the request or `false` otherwise.

The request for notification must be sent from the IP address that will receive notifications. A client that connects to the Internet through a firewall or some form of network address translation (NAT) might not be able to receive calls back from the cloud.

#### 3.2. Cloud Request

An update notification from the cloud to a client must contain one parameter, the URL of the RSS document that changed.

The client must return the boolean `true`.

#### 4. Frequency

Two conventions govern the client-cloud relationship: the cloud should discard a notification after 25 hours and clients should request to monitor a particular URL once every 24 hours.

#### Contributors

The interface was created by UserLand Software in December 2000 and originally implemented in [Radio UserLand](http://radio.userland.com).

#### License

![Creative Commons logo](https://www.rssboard.org/images/creative-commons-logo.gif)

Copyright 2026 [RSS Advisory Board](https://www.rssboard.org/). This document titled RssCloud API is authored by the [RSS Advisory Board](https://www.rssboard.org/), published at the URL [https://www.rssboard.org/rsscloud-interface](rsscloud-interface.md) and shared under the terms of the Creative Commons [Attribution/Share Alike](https://creativecommons.org/licenses/by-sa/2.0/) license.

---

- [RSS 2.0 Specification](index.md)
- [Really Simple Syndication Best Practices Profile](rss-profile.md)
- [RSS Autodiscovery](rss-autodiscovery.md)
- [RSS Language Codes](rss-language-codes.md)
