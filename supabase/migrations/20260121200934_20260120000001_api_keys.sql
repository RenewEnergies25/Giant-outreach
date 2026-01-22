-- API Keys table for storing third-party service credentials
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service TEXT UNIQUE NOT NULL, -- 'hunter', 'openai', etc.
    api_key TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - restrict in production)
CREATE POLICY "Allow all operations on api_keys" ON api_keys
    FOR ALL USING (true) WITH CHECK (true);

-- Create index on service for quick lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_service ON api_keys(service);