-- Control-plane schema for the blog SaaS platform (D1).

CREATE TABLE accounts (
	id TEXT PRIMARY KEY,
	oidc_subject TEXT NOT NULL UNIQUE,
	email TEXT NOT NULL,
	display_name TEXT,
	polar_customer_id TEXT UNIQUE,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX idx_accounts_subject ON accounts (oidc_subject);

CREATE TABLE blogs (
	id TEXT PRIMARY KEY,
	account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	slug TEXT NOT NULL UNIQUE,
	region TEXT NOT NULL DEFAULT 'wnam',
	status TEXT NOT NULL DEFAULT 'provisioning',
	custom_hostname_active INTEGER NOT NULL DEFAULT 0,
	deleted_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX idx_blogs_account ON blogs (account_id);
CREATE INDEX idx_blogs_slug ON blogs (slug);
CREATE INDEX idx_blogs_status ON blogs (status);

CREATE TABLE hostnames (
	id TEXT PRIMARY KEY,
	blog_id TEXT NOT NULL UNIQUE REFERENCES blogs (id) ON DELETE CASCADE,
	hostname TEXT NOT NULL UNIQUE,
	status TEXT NOT NULL DEFAULT 'pending_validation',
	ssl_status TEXT,
	validation_txt_name TEXT,
	validation_txt_value TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX idx_hostnames_status ON hostnames (status);

CREATE TABLE subscriptions (
	id TEXT PRIMARY KEY,
	account_id TEXT NOT NULL UNIQUE REFERENCES accounts (id) ON DELETE CASCADE,
	polar_subscription_id TEXT UNIQUE,
	polar_product_id TEXT,
	status TEXT NOT NULL DEFAULT 'incomplete',
	current_period_start TEXT,
	current_period_end TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX idx_subscriptions_status ON subscriptions (status);

CREATE TABLE usage_daily (
	id TEXT PRIMARY KEY,
	blog_id TEXT NOT NULL REFERENCES blogs (id) ON DELETE CASCADE,
	date TEXT NOT NULL,
	page_views INTEGER NOT NULL DEFAULT 0,
	reported_at TEXT,
	created_at TEXT NOT NULL,
	UNIQUE (blog_id, date)
);
CREATE INDEX idx_usage_blog_date ON usage_daily (blog_id, date);
