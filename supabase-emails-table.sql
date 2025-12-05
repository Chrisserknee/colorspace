-- ============================================
-- EMAILS TABLE - Royal Club Subscribers
-- ============================================
-- This table stores emails from Royal Club newsletter signups.
-- Separate from the customers table which is for paying customers.

-- Create the emails table
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Subscription details
    source TEXT DEFAULT 'royal-club', -- Where they signed up: 'royal-club', 'homepage', 'rainbow-bridge'
    signup_location TEXT, -- More specific: 'homepage-footer', 'checkout-modal', etc.
    
    -- Marketing preferences
    subscribed BOOLEAN DEFAULT TRUE,
    unsubscribed BOOLEAN DEFAULT FALSE,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    
    -- Conversion tracking
    has_purchased BOOLEAN DEFAULT FALSE,
    purchased_at TIMESTAMP WITH TIME ZONE,
    
    -- Context (what they were interested in, etc.)
    context JSONB
);

-- Create unique constraint on email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS emails_email_unique 
ON emails (LOWER(email));

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS emails_email_idx 
ON emails (LOWER(email));

CREATE INDEX IF NOT EXISTS emails_created_at_idx 
ON emails (created_at DESC);

CREATE INDEX IF NOT EXISTS emails_source_idx 
ON emails (source);

CREATE INDEX IF NOT EXISTS emails_subscribed_idx 
ON emails (subscribed, unsubscribed)
WHERE subscribed = TRUE AND unsubscribed = FALSE;

-- Enable Row Level Security (RLS)
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
DROP POLICY IF EXISTS "Service role can do everything" ON emails;
CREATE POLICY "Service role can do everything" ON emails
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Policy: Block public access
DROP POLICY IF EXISTS "Block public access" ON emails;
CREATE POLICY "Block public access" ON emails
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_emails_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS emails_updated_at_trigger ON emails;
CREATE TRIGGER emails_updated_at_trigger
    BEFORE UPDATE ON emails
    FOR EACH ROW
    EXECUTE FUNCTION update_emails_updated_at();

-- Grant permissions to service_role
GRANT ALL ON emails TO service_role;

-- ============================================
-- HELPFUL QUERIES FOR MONITORING
-- ============================================

-- View all Royal Club subscribers
-- SELECT * FROM emails WHERE source = 'royal-club' ORDER BY created_at DESC;

-- View active subscribers (for marketing)
-- SELECT email, created_at, source 
-- FROM emails 
-- WHERE subscribed = TRUE AND unsubscribed = FALSE
-- ORDER BY created_at DESC;

-- View subscribers who later purchased (conversion tracking)
-- SELECT * FROM emails WHERE has_purchased = TRUE ORDER BY purchased_at DESC;

-- Count subscribers by source
-- SELECT source, COUNT(*) as count 
-- FROM emails 
-- GROUP BY source 
-- ORDER BY count DESC;

-- Export Royal Club emails for marketing
-- SELECT email, created_at, source, signup_location
-- FROM emails 
-- WHERE subscribed = TRUE AND unsubscribed = FALSE
-- ORDER BY created_at DESC;
