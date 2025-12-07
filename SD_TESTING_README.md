# 🧪 Stable Diffusion Local Testing Guide

⚠️ **LOCAL TESTING ONLY - DO NOT DEPLOY TO PRODUCTION** ⚠️

This guide explains how to test Stable Diffusion models locally for pet portrait generation.

## Environment Variables

Add these to your `.env.local` file:

```bash
# Enable Stable Diffusion (LOCAL TESTING ONLY)
USE_STABLE_DIFFUSION=true

# Choose your model (see options below)
SD_MODEL=flux-img2img

# Fine-tuning parameters
SD_GUIDANCE_SCALE=7.5    # Higher = follows prompt more closely (5-15)
SD_STEPS=30              # More steps = better quality, slower (20-50)
SD_STRENGTH=0.75         # For img2img: how much to change (0.5-0.9)

# Required: Replicate API token
REPLICATE_API_TOKEN=your_token_here
```

## Available Models

### Best for Identity Preservation (img2img):

| Model | Description | Best For |
|-------|-------------|----------|
| `sdxl-img2img` | SDXL with image input | Good balance of quality & identity |
| `sdxl-controlnet` | SDXL + ControlNet (canny) | Best structure preservation |
| `ip-adapter-faceid` | IP-Adapter FaceID | Best face/identity preservation |
| `flux-img2img` | Flux with LoRA img2img | Highest quality + identity |

### Text-to-Image (less identity preservation):

| Model | Description | Best For |
|-------|-------------|----------|
| `flux` | Flux Dev | Highest quality text-to-image |
| `sd3` | Stable Diffusion 3 | Latest SD model |

## Recommended Settings for Testing

### For Best Identity Preservation:
```bash
USE_STABLE_DIFFUSION=true
SD_MODEL=ip-adapter-faceid
SD_STRENGTH=0.7    # Lower = preserve more identity
SD_STEPS=35
SD_GUIDANCE_SCALE=7.5
```

### For Highest Quality (less identity):
```bash
USE_STABLE_DIFFUSION=true
SD_MODEL=flux-img2img
SD_STRENGTH=0.75
SD_STEPS=30
SD_GUIDANCE_SCALE=7.5
```

### For Best Structure Preservation:
```bash
USE_STABLE_DIFFUSION=true
SD_MODEL=sdxl-controlnet
SD_STRENGTH=0.8
SD_STEPS=30
SD_GUIDANCE_SCALE=7.5
```

## Testing Locally

1. Copy the environment variables above to `.env.local`
2. Start the dev server: `npm run dev`
3. Generate a portrait as normal
4. Check the console logs for `⚠️ STABLE DIFFUSION MODE`

## Switching Back to Production Model

To use the normal OpenAI model, either:
- Remove `USE_STABLE_DIFFUSION` from `.env.local`
- Set `USE_STABLE_DIFFUSION=false`

## Tips for Fine-Tuning

1. **Lower `SD_STRENGTH`** (0.5-0.7) = More identity preservation, less artistic style
2. **Higher `SD_STRENGTH`** (0.8-0.9) = More artistic style, less identity
3. **More `SD_STEPS`** (40-50) = Higher quality, slower generation
4. **Higher `SD_GUIDANCE_SCALE`** (10-15) = Follows prompt more strictly

## Model Comparison

```
Identity Preservation: ip-adapter-faceid > sdxl-controlnet > sdxl-img2img > flux-img2img
Quality:              flux-img2img > sd3 > sdxl-img2img > ip-adapter-faceid
Speed:                sdxl-img2img > sd3 > flux-img2img > ip-adapter-faceid
```

---

**Remember: This is for LOCAL TESTING ONLY. Never set `USE_STABLE_DIFFUSION=true` in production/Vercel.**

