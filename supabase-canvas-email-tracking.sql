-- Add canvas upsell email tracking to paying_customers table
-- Run this in Supabase SQL Editor

-- Add columns for canvas email sequence tracking
ALTER TABLE paying_customers 
ADD COLUMN IF NOT EXISTS canvas_email_1_sent_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS canvas_email_2_sent_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS canvas_email_3_sent_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS canvas_purchased BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS canvas_purchased_at TIMESTAMPTZ DEFAULT NULL;

-- Add comments
COMMENT ON COLUMN paying_customers.canvas_email_1_sent_at IS 'When the first canvas upsell email was sent (1 hour after purchase)';
COMMENT ON COLUMN paying_customers.canvas_email_2_sent_at IS 'When the second canvas upsell email was sent (1 day after purchase)';
COMMENT ON COLUMN paying_customers.canvas_email_3_sent_at IS 'When the third/final canvas upsell email was sent (2 days after purchase)';
COMMENT ON COLUMN paying_customers.canvas_purchased IS 'Whether the customer has purchased a canvas';
COMMENT ON COLUMN paying_customers.canvas_purchased_at IS 'When the customer purchased a canvas';

-- Create index for efficient querying of customers who need emails
CREATE INDEX IF NOT EXISTS idx_paying_customers_canvas_emails 
ON paying_customers (first_purchase_at, canvas_email_1_sent_at, canvas_email_2_sent_at, canvas_email_3_sent_at, canvas_purchased);

