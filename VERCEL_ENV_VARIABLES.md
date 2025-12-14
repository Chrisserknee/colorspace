# Required Vercel Environment Variables

## Stripe Configuration (Required for Checkout)

### `STRIPE_SECRET_KEY`
- **Required**: Yes
- **Description**: Your Stripe secret key (starts with `sk_`)
- **Where to find**: Stripe Dashboard → Developers → API Keys
- **Example**: `sk_live_...` (production) or `sk_test_...` (testing)

### `STRIPE_WEBHOOK_SECRET` (Optional but Recommended)
- **Required**: No (but needed for webhook processing)
- **Description**: Webhook signing secret for verifying Stripe webhooks
- **Where to find**: Stripe Dashboard → Developers → Webhooks → Add endpoint → Signing secret

## Supabase Configuration (Required)

### `NEXT_PUBLIC_SUPABASE_URL`
- **Required**: Yes
- **Description**: Your Supabase project URL
- **Example**: `https://xxxxx.supabase.co`

### `SUPABASE_SERVICE_ROLE_KEY`
- **Required**: Yes
- **Description**: Supabase service role key (has admin access)
- **Where to find**: Supabase Dashboard → Settings → API → service_role key

## Pricing Configuration

### Note on Pricing
- **Child Art Portrait**: Uses app config pricing ($19.99) - no env var needed
- **LumePet**: Uses `CONFIG.PRICE_AMOUNT` (defaults to 1999 = $19.99)
- **Unlimited Sessions**: Uses `CONFIG.UNLIMITED_SESSION_PRICE_AMOUNT` (defaults to 499 = $4.99)

**You do NOT need to set `PRICE_AMOUNT` for child-art purchases** - the price comes from the app configuration.

## Other Environment Variables

### `NEXT_PUBLIC_BASE_URL`
- **Required**: Yes (for production)
- **Description**: Your production domain URL
- **Example**: `https://yourdomain.com`

### `OPENAI_API_KEY`
- **Required**: Yes (for image generation)
- **Description**: OpenAI API key for GPT-4 Vision and image generation

### `REPLICATE_API_TOKEN`
- **Required**: Yes (for image upscaling)
- **Description**: Replicate API token for Real-ESRGAN upscaling

## Troubleshooting Checkout Issues

If checkout is not working, check:

1. **Is `STRIPE_SECRET_KEY` set?**
   - Check Vercel Dashboard → Settings → Environment Variables
   - Make sure it's set for the correct environment (Production/Preview/Development)

2. **Is the Stripe key valid?**
   - Test it in Stripe Dashboard
   - Make sure you're using the correct key (test vs live)

3. **Check server logs**
   - The checkout route logs errors if `STRIPE_SECRET_KEY` is missing
   - Look for: `❌ STRIPE_SECRET_KEY environment variable is not set`

4. **For child-art purchases specifically:**
   - Price comes from app config (1999 cents = $19.99)
   - No `PRICE_AMOUNT` env var needed
   - Make sure `STRIPE_SECRET_KEY` is set

## Quick Checklist

- [ ] `STRIPE_SECRET_KEY` is set in Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set
- [ ] `NEXT_PUBLIC_BASE_URL` is set (production)
- [ ] `OPENAI_API_KEY` is set
- [ ] `REPLICATE_API_TOKEN` is set
