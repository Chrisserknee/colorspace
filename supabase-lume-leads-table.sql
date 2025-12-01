-- ============================================
-- LUME LEADS TABLE - Email Sequence Tracking
-- ============================================
-- This table tracks leads who entered their email but haven't purchased yet.
-- Used for automated follow-up email sequences.

-- Create the lume_leads table
CREATE TABLE IF NOT EXISTS lume_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    has_purchased BOOLEAN DEFAULT FALSE,
    purchased_at TIMESTAMP WITH TIME ZONE,
    last_email_step_sent INTEGER DEFAULT 0,
    -- 0 = none sent
    -- 1 = Email #1 (immediate)
    -- 2 = Email #2 (1 day)
    -- 3 = Email #3 (3 days)
    -- 4 = Email #4 (7 days)
    -- 5 = Email #5 (21 days)
    -- 6 = Email #6 (30 days)
    context JSONB,
    -- Store context like { style: "rainbow-bridge", petType: "cat", etc. }
    source TEXT DEFAULT 'checkout',
    -- Where the lead came from: "checkout", "upload", "rainbow-bridge", etc.
    unsubscribed BOOLEAN DEFAULT FALSE,
    unsubscribed_at TIMESTAMP WITH TIME ZONE
);

-- Create unique constraint on email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS lume_leads_email_unique 
ON lume_leads (LOWER(email));

-- Create index for cron job queries (finding leads that need emails)
CREATE INDEX IF NOT EXISTS lume_leads_followup_idx 
ON lume_leads (has_purchased, last_email_step_sent, created_at)
WHERE has_purchased = FALSE AND unsubscribed = FALSE;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS lume_leads_email_idx 
ON lume_leads (LOWER(email));

-- Enable Row Level Security (RLS)
ALTER TABLE lume_leads ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role can do everything" ON lume_leads
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lume_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS lume_leads_updated_at_trigger ON lume_leads;
CREATE TRIGGER lume_leads_updated_at_trigger
    BEFORE UPDATE ON lume_leads
    FOR EACH ROW
    EXECUTE FUNCTION update_lume_leads_updated_at();

-- ============================================
-- HELPFUL QUERIES FOR MONITORING
-- ============================================

-- View leads pending follow-up emails
-- SELECT * FROM lume_leads 
-- WHERE has_purchased = FALSE 
-- AND unsubscribed = FALSE 
-- ORDER BY created_at DESC;

-- View email sequence progress
-- SELECT 
--     last_email_step_sent,
--     COUNT(*) as count
-- FROM lume_leads
-- WHERE has_purchased = FALSE
-- GROUP BY last_email_step_sent
-- ORDER BY last_email_step_sent;

-- View conversion rate
-- SELECT 
--     COUNT(*) FILTER (WHERE has_purchased = TRUE) as purchased,
--     COUNT(*) FILTER (WHERE has_purchased = FALSE) as not_purchased,
--     ROUND(100.0 * COUNT(*) FILTER (WHERE has_purchased = TRUE) / COUNT(*), 2) as conversion_rate
-- FROM lume_leads;

