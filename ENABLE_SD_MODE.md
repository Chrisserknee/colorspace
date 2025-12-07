# 🚀 Quick Setup: Enable Stable Diffusion Mode

## Step 1: Add to `.env.local`

Open your `.env.local` file and add these lines:

```bash
# Enable Stable Diffusion (LOCAL TESTING ONLY)
USE_STABLE_DIFFUSION=true

# Choose your model (recommended: ip-adapter-faceid for best identity preservation)
SD_MODEL=ip-adapter-faceid

# Fine-tuning (optional - defaults are fine)
SD_STRENGTH=0.7       # Lower = more identity preserved (0.5-0.9)
SD_STEPS=35          # More steps = better quality (20-50)
SD_GUIDANCE_SCALE=7.5 # Follows prompt more closely (5-15)

# Make sure you have this (required)
REPLICATE_API_TOKEN=your_token_here
```

## Step 2: Restart Dev Server

**IMPORTANT:** You MUST restart your dev server after changing `.env.local`:

1. Stop the server (Ctrl+C)
2. Run `npm run dev` again
3. Environment variables are only loaded on server start

## Step 3: Verify It's Working

When you generate a portrait, you should see in the console:

```
⚠️⚠️⚠️ STABLE DIFFUSION MODE - LOCAL TESTING ONLY ⚠️⚠️⚠️
📌 Using SD model: ip-adapter-faceid
```

If you see:
```
- USE_STABLE_DIFFUSION: not set ❌ NOT ENABLED
⚠️ To enable SD mode, set USE_STABLE_DIFFUSION=true in .env.local
```

Then:
1. Check that `.env.local` has `USE_STABLE_DIFFUSION=true` (exactly "true" as a string)
2. **Restart your dev server** (env vars only load on startup)

## Recommended Models

| Model | Best For | Identity Preservation |
|-------|----------|----------------------|
| `ip-adapter-faceid` | **Best face matching** | ⭐⭐⭐⭐⭐ |
| `sdxl-controlnet` | Best structure | ⭐⭐⭐⭐ |
| `sdxl-img2img` | Good balance | ⭐⭐⭐⭐ |
| `flux-img2img` | Highest quality | ⭐⭐⭐ |

## Troubleshooting

**Still using OpenAI?**
- ✅ Check `.env.local` has `USE_STABLE_DIFFUSION=true` (not `USE_STABLE_DIFFUSION="true"` or `USE_STABLE_DIFFUSION=1`)
- ✅ **Restart dev server** (env vars only load on startup!)
- ✅ Check `REPLICATE_API_TOKEN` is set
- ✅ Look for `SD Mode Active: ✅ YES` in console logs

**Model not found error?**
- Use one of: `flux-img2img`, `sdxl-img2img`, `sdxl-controlnet`, `ip-adapter-faceid`, `flux`, `sd3`

