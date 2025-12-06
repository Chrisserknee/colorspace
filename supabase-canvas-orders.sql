-- Canvas Orders Table for Printify Integration
-- Run this SQL in your Supabase SQL Editor

-- Create the canvas_orders table
CREATE TABLE IF NOT EXISTS canvas_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id TEXT NOT NULL,
  customer_email TEXT,
  canvas_size TEXT NOT NULL,
  stripe_session_id TEXT,
  printify_order_id TEXT,
  printify_product_id TEXT,
  status TEXT DEFAULT 'pending',
  shipping_address JSONB,
  amount_paid INTEGER, -- In cents
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_canvas_orders_image_id ON canvas_orders(image_id);
CREATE INDEX IF NOT EXISTS idx_canvas_orders_customer_email ON canvas_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_canvas_orders_stripe_session ON canvas_orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_canvas_orders_printify_order ON canvas_orders(printify_order_id);
CREATE INDEX IF NOT EXISTS idx_canvas_orders_status ON canvas_orders(status);
CREATE INDEX IF NOT EXISTS idx_canvas_orders_created_at ON canvas_orders(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE canvas_orders ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access (full access for backend)
CREATE POLICY "Service role can manage canvas_orders" ON canvas_orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_canvas_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_canvas_orders_updated_at ON canvas_orders;
CREATE TRIGGER trigger_canvas_orders_updated_at
  BEFORE UPDATE ON canvas_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_canvas_orders_updated_at();

-- Comments for documentation
COMMENT ON TABLE canvas_orders IS 'Tracks canvas print orders fulfilled via Printify';
COMMENT ON COLUMN canvas_orders.image_id IS 'Reference to the portrait image ID';
COMMENT ON COLUMN canvas_orders.canvas_size IS 'Canvas size ordered (12x12 or 16x16)';
COMMENT ON COLUMN canvas_orders.printify_order_id IS 'Printify order ID for tracking';
COMMENT ON COLUMN canvas_orders.printify_product_id IS 'Printify product ID created for this order';
COMMENT ON COLUMN canvas_orders.status IS 'Order status: pending, production, shipped, delivered, cancelled';
COMMENT ON COLUMN canvas_orders.shipping_address IS 'JSON object with shipping address details';
COMMENT ON COLUMN canvas_orders.amount_paid IS 'Amount paid in cents';

