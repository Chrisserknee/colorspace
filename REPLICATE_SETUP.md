# 🚀 Replicate SDXL Setup

## Quick Setup

Add to your `.env.local`:

```bash
# Enable Stable Diffusion (DEV SERVER ONLY - DO NOT DEPLOY TO PRODUCTION)
USE_STABLE_DIFFUSION=true

# Choose your model (RECOMMENDED: sdxl-ip-adapter-plus for best identity preservation)
SD_MODEL=sdxl-ip-adapter-plus

# IP-Adapter Plus settings (for identity preservation)
IP_ADAPTER_SCALE=0.85        # Higher = more identity preserved (0.7-0.9 recommended)
                              # 0.85 is optimal balance for pets

# ControlNet settings (if using ControlNet models)
CONTROLNET_SCALE=0.8         # Higher = more structure preserved (0.6-1.0)
CONTROLNET_TYPE=canny        # Options: pose, depth, canny

# Fine-tuning parameters
SD_GUIDANCE_SCALE=7.5        # Follows prompt more closely (5-15)
SD_STEPS=35                  # More steps = better quality (20-50, 35 recommended)
SD_STRENGTH=0.6              # For img2img: how much to change (0.5-0.9)

# Required: Replicate API token
REPLICATE_API_TOKEN=your_token_here
```

## Important: Remove Local API Settings

If you have `LOCAL_SD_API_URL` in your `.env.local`, remove it or comment it out:

```bash
# LOCAL_SD_API_URL=http://localhost:7860  # Commented out - using Replicate instead
```

## Get Your Replicate API Token

1. Go to: https://replicate.com/account/api-tokens
2. Create a new token or copy your existing one
3. Add it to `.env.local` as `REPLICATE_API_TOKEN=your_token_here`

## Restart Dev Server

After updating `.env.local`:
1. Stop your dev server (Ctrl+C)
2. Run `npm run dev` again
3. Environment variables only load on server start

## Verify It's Working

When you generate a portrait, you should see in the console:

```
⚠️⚠️⚠️ STABLE DIFFUSION MODE ACTIVE - DEV SERVER ONLY ⚠️⚠️⚠️
📌 Model: sdxl-ip-adapter-plus
=== ⚠️ STABLE DIFFUSION GENERATION (DEV SERVER ONLY) ===
🚀 Using SDXL + IP-Adapter Plus (BEST for identity preservation)...
```

## Available Models

- `sdxl-ip-adapter-plus` - **RECOMMENDED** - Best full-body identity preservation
- `ip-adapter-faceid` - Best face-only identity preservation
- `sdxl-controlnet-pose` - Lock in pet's pose
- `sdxl-controlnet-depth` - Preserve 3D structure
- `sdxl-controlnet-canny` - Preserve edges/structure
- `sdxl-img2img` - Good balance
- `flux-img2img` - Highest quality (slower)

See `ENABLE_SD_MODE.md` for full documentation.

