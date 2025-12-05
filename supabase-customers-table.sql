-- ============================================
-- CUSTOMERS TABLE - Purchased Customer Emails
-- ============================================
-- This table stores emails from customers who have completed a purchase.
-- Separate from the leads/emails table which is for nurturing non-purchasers.

-- Create the customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Purchase details
    first_purchase_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_purchase_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_purchases INTEGER DEFAULT 1,
    
    -- What they purchased
    purchase_type TEXT DEFAULT 'portrait', -- 'portrait', 'pack', 'rainbow-bridge'
    
    -- Optional: link to their portrait(s)
    image_ids TEXT[], -- Array of image IDs they've purchased
    
    -- Stripe data
    stripe_customer_id TEXT,
    stripe_session_ids TEXT[], -- Array of session IDs
    
    -- Marketing preferences
    marketing_opt_in BOOLEAN DEFAULT TRUE,
    unsubscribed BOOLEAN DEFAULT FALSE,
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    
    -- Context (pet info, preferences, etc.)
    context JSONB
);

-- Create unique constraint on email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique 
ON customers (LOWER(email));

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS customers_email_idx 
ON customers (LOWER(email));

CREATE INDEX IF NOT EXISTS customers_created_at_idx 
ON customers (created_at DESC);

CREATE INDEX IF NOT EXISTS customers_first_purchase_idx 
ON customers (first_purchase_at DESC);

CREATE INDEX IF NOT EXISTS customers_marketing_idx 
ON customers (marketing_opt_in, unsubscribed)
WHERE marketing_opt_in = TRUE AND unsubscribed = FALSE;

-- Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
DROP POLICY IF EXISTS "Service role can do everything" ON customers;
CREATE POLICY "Service role can do everything" ON customers
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Policy: Block public access
DROP POLICY IF EXISTS "Block public access" ON customers;
CREATE POLICY "Block public access" ON customers
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS customers_updated_at_trigger ON customers;
CREATE TRIGGER customers_updated_at_trigger
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_customers_updated_at();

-- Grant permissions to service_role
GRANT ALL ON customers TO service_role;

-- ============================================
-- HELPFUL QUERIES FOR MONITORING
-- ============================================

-- View all customers
-- SELECT * FROM customers ORDER BY created_at DESC;

-- View repeat customers
-- SELECT * FROM customers WHERE total_purchases > 1 ORDER BY total_purchases DESC;

-- View customers by purchase type
-- SELECT purchase_type, COUNT(*) as count 
-- FROM customers 
-- GROUP BY purchase_type 
-- ORDER BY count DESC;

-- View customers who can receive marketing emails
-- SELECT * FROM customers 
-- WHERE marketing_opt_in = TRUE AND unsubscribed = FALSE;

-- Export customer emails for marketing
-- SELECT email, first_purchase_at, total_purchases, purchase_type 
-- FROM customers 
-- WHERE marketing_opt_in = TRUE AND unsubscribed = FALSE
-- ORDER BY first_purchase_at DESC;

