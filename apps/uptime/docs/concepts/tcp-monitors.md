---
title: TCP Monitors
description: Verify servers are accepting connections on specific ports. Ideal for monitoring databases, mail servers, and custom services.
section:
  title: Concepts
  order: 2
order: 4
lastUpdated: 2026-02-14
---

TCP monitors focus on raw connectivity—they attempt to establish a TCP connection and report whether it was accepted, refused, or timed out. Unlike HTTP monitors that check web content, TCP monitors verify that a service is running and accepting connections at the network level.

## How TCP Monitors Work

When a TCP monitor runs, it:

1. Attempts to open a TCP connection to the specified host and port
2. Waits for the connection to be accepted or rejected
3. Records the result and connection time
4. Closes the connection

This simple handshake is enough to verify that a service is running and accepting connections, without requiring any protocol-specific communication.

## Use Cases

TCP monitors are ideal for any service that isn't accessible via HTTP.

### Database Servers

Monitor your database connectivity to catch issues before they affect your application:

- **PostgreSQL** - Port 5432
- **MySQL / MariaDB** - Port 3306
- **Redis** - Port 6379
- **MongoDB** - Port 27017
- **Memcached** - Port 11211

### Mail Servers

Ensure your email infrastructure is reachable:

- **SMTP** - Port 25 (standard) or 587 (submission)
- **IMAP** - Port 143 (standard) or 993 (SSL/TLS)
- **POP3** - Port 110 (standard) or 995 (SSL/TLS)

### Game Servers

Monitor game server availability for your players:

- Minecraft servers (default port 25565)
- Source engine games (default port 27015)
- Custom game servers on any port

### Custom Services

Any TCP-based service can be monitored:

- Message queues (RabbitMQ port 5672, Kafka port 9092)
- Search engines (Elasticsearch port 9200)
- SSH servers (port 22)
- FTP servers (port 21)
- Internal microservices

## Configuration Options

### Host

The hostname or IP address of the server to monitor. You can use:

- Domain names (e.g., `db.example.com`)
- IPv4 addresses (e.g., `192.168.1.100`)
- IPv6 addresses (e.g., `2001:db8::1`)

### Port

The TCP port number to connect to. Valid range is **1-65535**.

Common ports:

| Service    | Default Port |
| ---------- | ------------ |
| SSH        | 22           |
| SMTP       | 25, 587      |
| DNS        | 53           |
| HTTP       | 80           |
| POP3       | 110, 995     |
| IMAP       | 143, 993     |
| HTTPS      | 443          |
| MySQL      | 3306         |
| PostgreSQL | 5432         |
| Redis      | 6379         |

### Timeout

How long to wait for a connection before marking the check as timed out. Range is **1-30 seconds**.

- **Default**: 10 seconds
- **Recommended**: 5-10 seconds for most services
- **Longer timeouts**: Use for services that may be slow to accept connections under load

### Check Interval

How frequently to run the monitor. Range is **1-60 minutes**.

- **1-5 minutes**: Critical production services
- **5-15 minutes**: Standard monitoring
- **15-60 minutes**: Non-critical services or development environments

## Monitor Statuses

TCP monitors report one of three statuses:

### Up

The connection was successfully established. The server is accepting connections on the specified port.

### Down

The connection was refused. This typically means:

- The service is not running
- The port is not open
- A firewall is actively rejecting the connection

### Timeout

The connection attempt did not complete within the configured timeout. Possible causes:

- The server is unreachable (network issue)
- A firewall is silently dropping packets
- The service is overloaded and not accepting new connections
- The timeout value is too short

## Best Practices

### Monitor Database Connectivity

Database connection issues often cascade into application failures. Monitor your database ports to detect problems before users are affected.

```
Host: db.example.com
Port: 5432
Timeout: 10s
Interval: 1 minute
```

### Use Appropriate Timeouts

Set timeouts based on your service characteristics:

- **Fast services**: 5 seconds is usually sufficient
- **Services under load**: Use 10-15 seconds to avoid false positives
- **Remote services**: Account for network latency

### Consider Firewall Rules

The Uptime monitoring service needs network access to your servers. Ensure your firewall rules allow incoming connections from our monitoring infrastructure.

If you're monitoring internal services:

- Whitelist our monitoring IP addresses
- Consider using a VPN or private network connection
- Monitor from within your network if external access isn't possible

### Combine with HTTP Monitors

For web applications backed by databases or other services, use both monitor types:

1. **HTTP monitor** - Verifies the web application is responding
2. **TCP monitor** - Verifies backend services are accessible

This combination helps you quickly identify whether an outage is caused by the web server or a backend dependency.

### Create Monitors for Each Critical Service

Don't rely on a single monitor. If your application depends on PostgreSQL, Redis, and an external API:

- Create a TCP monitor for PostgreSQL (port 5432)
- Create a TCP monitor for Redis (port 6379)
- Create an HTTP monitor for the external API

This granular approach makes it easy to pinpoint the root cause of issues.
