# 🚀 Enhanced SDXL Setup: IP-Adapter Plus + ControlNet + LoRA

## Overview

This setup uses **Stable Diffusion XL (SDXL)** with advanced identity preservation techniques:

- **IP-Adapter Plus**: Best for full-body identity preservation (better than FaceID)
- **ControlNet**: Lock in pose/structure (pose, depth, or canny edge detection)
- **LoRA Support**: Train your own LumePet style LoRA for consistent oil-paint aesthetic

## Step 1: Choose Local or Cloud API

### Option A: Local API (Recommended for Testing) 🏠

Set up Automatic1111 (Stable Diffusion WebUI) or ComfyUI on your machine, then add to `.env.local`:

```bash
# Enable Stable Diffusion (DEV SERVER ONLY - DO NOT DEPLOY TO PRODUCTION)
USE_STABLE_DIFFUSION=true

# Use LOCAL API (set this to your local SD API URL)
LOCAL_SD_API_URL=http://localhost:7860  # Automatic1111 default port
# LOCAL_SD_API_TYPE=automatic1111        # Optional: "automatic1111" or "comfyui" (default: automatic1111)

# Choose your model
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
```

**Setup Automatic1111:**
1. Install [Automatic1111 WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
2. Install SDXL base model and IP-Adapter Plus extension
3. Start WebUI: `python webui.py --api`
4. Set `LOCAL_SD_API_URL=http://localhost:7860` in `.env.local`

### Option B: Cloud API (Replicate)

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

# LoRA Support (optional - for custom style training)
# LORA_URL=https://replicate.delivery/pbxt/your-lora-file.safetensors
# Note: LoRA support may require specialized models

# Required: Replicate API token (only needed if not using LOCAL_SD_API_URL)
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
⚠️⚠️⚠️ STABLE DIFFUSION MODE ACTIVE - DEV SERVER ONLY ⚠️⚠️⚠️
📌 Model: sdxl-ip-adapter-plus
=== ⚠️ STABLE DIFFUSION GENERATION (DEV SERVER ONLY) ===
🚀 Using SDXL + IP-Adapter Plus (BEST for identity preservation)...
```

## Available Models

### 🏆 Recommended: Identity Preservation

| Model | Best For | Identity Preservation | Speed |
|-------|----------|----------------------|-------|
| `sdxl-ip-adapter-plus` | **BEST full-body identity** | ⭐⭐⭐⭐⭐ | Fast |
| `ip-adapter-faceid` | Face-only focus | ⭐⭐⭐⭐⭐ | Fast |
| `sdxl-img2img` | Good balance | ⭐⭐⭐⭐ | Medium |

### 🎯 Structure Control (ControlNet)

| Model | Best For | Use Case |
|-------|----------|----------|
| `sdxl-controlnet-pose` | **Lock in pet's pose** | Preserve exact body position |
| `sdxl-controlnet-depth` | 3D structure preservation | Maintain depth/volume |
| `sdxl-controlnet-canny` | Edge/structure preservation | Preserve outlines and structure |

### 🎨 Style Training (LoRA)

| Model | Best For | Requirements |
|-------|----------|--------------|
| `sdxl-lora` | Custom style matching | Requires `LORA_URL` env var |

### ⚡ Other Models

| Model | Best For | Notes |
|-------|----------|-------|
| `flux-img2img` | Highest quality | Slower, less identity preservation |
| `flux` | Text-to-image quality | No identity preservation |
| `sd3` | Latest SD model | Text-to-image only |

## Recommended Configurations

### For Best Identity Preservation (Recommended)

```bash
USE_STABLE_DIFFUSION=true
SD_MODEL=sdxl-ip-adapter-plus
IP_ADAPTER_SCALE=0.85
SD_STEPS=35
SD_GUIDANCE_SCALE=7.5
```

**Why IP-Adapter Plus?**
- Preserves entire pet (not just face like FaceID)
- Better at maintaining unique markings, fur patterns, body shape
- Optimal for pet portraits where full-body likeness matters

### For Strict Pose Control

```bash
USE_STABLE_DIFFUSION=true
SD_MODEL=sdxl-controlnet-pose
CONTROLNET_SCALE=0.8
SD_STEPS=35
SD_GUIDANCE_SCALE=7.5
```

**When to use:**
- You want to lock in the exact pose from the reference image
- Pet has a unique position you want to preserve
- Combine with IP-Adapter Plus for best results (may require custom model)

### For Custom Style (LoRA Training)

```bash
USE_STABLE_DIFFUSION=true
SD_MODEL=sdxl-lora
LORA_URL=https://replicate.delivery/pbxt/your-lumepet-style.safetensors
SD_STEPS=35
SD_GUIDANCE_SCALE=7.5
```

**How to train a LoRA:**
1. Collect 20-50 of your best LumePet portraits
2. Use a LoRA training service (e.g., Replicate, RunPod, or local)
3. Upload the trained LoRA file and get the URL
4. Set `LORA_URL` in `.env.local`

**Note:** Direct LoRA support in Replicate may require specialized models. Consider using IP-Adapter Plus with your style images as an alternative.

## Parameter Tuning Guide

### IP_ADAPTER_SCALE
- **0.7-0.75**: More creative freedom, less strict identity
- **0.8-0.85**: **Recommended** - Good balance for pets
- **0.9-1.0**: Maximum identity preservation (may reduce style flexibility)

### CONTROLNET_SCALE
- **0.6-0.7**: More creative freedom, less strict structure
- **0.8**: **Recommended** - Good balance
- **0.9-1.0**: Maximum structure preservation

### SD_STEPS
- **20-25**: Faster, slightly lower quality
- **30-35**: **Recommended** - Best quality/speed balance
- **40-50**: Highest quality, slower

### SD_GUIDANCE_SCALE
- **5-7**: More creative, less prompt adherence
- **7.5**: **Recommended** - Good balance
- **10-15**: Strict prompt following (may reduce naturalness)

## Troubleshooting

### Still using OpenAI?
- ✅ Check `.env.local` has `USE_STABLE_DIFFUSION=true` (exactly "true" as a string)
- ✅ **Restart dev server** (env vars only load on startup!)
- ✅ Check `REPLICATE_API_TOKEN` is set
- ✅ Look for `SD Mode Active: ✅ YES (DEV SERVER ONLY)` in console logs

### Model not found error?
- Use one of the available models listed above
- Check Replicate model availability (some models may be temporarily unavailable)
- Try the latest version first (fallback to specific version is automatic)

### Low identity preservation?
- Increase `IP_ADAPTER_SCALE` to 0.9
- Try `sdxl-ip-adapter-plus` instead of other models
- Ensure reference image is high quality and well-lit

### Images too stylized / not matching prompt?
- Decrease `IP_ADAPTER_SCALE` to 0.75
- Increase `SD_GUIDANCE_SCALE` to 10
- Try `sdxl-controlnet-pose` for more structure control

### Slow generation?
- Reduce `SD_STEPS` to 25-30
- Use `sdxl-ip-adapter-plus` (faster than ControlNet variants)
- Check Replicate queue times

## ⚠️ Important Notes

1. **DEV SERVER ONLY**: Do NOT deploy to production with `USE_STABLE_DIFFUSION=true`
2. **Cost**: Replicate charges per generation - monitor your usage
3. **Rate Limits**: Replicate has rate limits - batch generations may be throttled
4. **Model Availability**: Some models may be temporarily unavailable on Replicate

## Next Steps

1. Test with `sdxl-ip-adapter-plus` (recommended starting point)
2. Tune `IP_ADAPTER_SCALE` based on results
3. Consider training a custom LoRA for your exact style
4. Experiment with ControlNet for pose control if needed
