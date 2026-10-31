-- 成年自我声明，不是身份证明或年龄核验。既有用户字段保持 NULL，不补造历史声明。
ALTER TABLE users ADD COLUMN adult_declared_at TEXT;
ALTER TABLE users ADD COLUMN adult_declaration_version TEXT;

-- OAuth 开始前保存 10 分钟有效的声明，cookie 只携带随机令牌。
-- 用 D1 原子 DELETE ... RETURNING 消费，避免 KV 最终一致导致并发重复使用。
CREATE TABLE adult_oauth_flows (
  token_hash TEXT PRIMARY KEY,
  oauth_state TEXT NOT NULL UNIQUE,
  verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  redirect_path TEXT NOT NULL,
  declared_at TEXT NOT NULL,
  declaration_version TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_adult_oauth_expiry ON adult_oauth_flows(expires_at);
