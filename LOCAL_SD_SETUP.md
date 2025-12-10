# 🏠 Local SDXL Setup Guide

Quick guide to run Stable Diffusion locally for testing.

## Prerequisites

- **GPU with 8GB+ VRAM** (recommended for SDXL)
- **Python 3.10+**
- **Git**

## Option 1: Automatic1111 WebUI (Recommended)

### Step 1: Install Automatic1111

```bash
# Clone the repository
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
cd stable-diffusion-webui
```

### Step 2: Install Dependencies

**Windows:**
```bash
# Run the webui-user.bat file - it will auto-install dependencies
webui-user.bat
```

**Mac/Linux:**
```bash
# Run the webui.sh script - it will auto-install dependencies
./webui.sh
```

### Step 3: Download SDXL Base Model

1. Download SDXL base model from [HuggingFace](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)
2. Place it in `stable-diffusion-webui/models/Stable-diffusion/`
3. Rename to something like `sdxl-base.safetensors`

### Step 4: Install IP-Adapter Plus Extension

1. Go to the "Extensions" tab in WebUI
2. Click "Install from URL"
3. Enter: `https://github.com/tencent-research/IP-Adapter`
4. Click "Install"
5. Restart WebUI

### Step 5: Download IP-Adapter Plus Models

1. Download IP-Adapter Plus SDXL models from [HuggingFace](https://huggingface.co/h94/IP-Adapter/tree/main/models)
2. Place in `stable-diffusion-webui/extensions/IP-Adapter/models/`
3. You'll need:
   - `ip-adapter-plus_sdxl_vit-h.safetensors` (recommended)

### Step 6: Start WebUI with API Enabled

```bash
# Windows
webui-user.bat --api

# Mac/Linux
./webui.sh --api
```

The API will be available at `http://localhost:7860`

### Step 7: Configure LumePet

Add to your `.env.local`:

```bash
USE_STABLE_DIFFUSION=true
LOCAL_SD_API_URL=http://localhost:7860
LOCAL_SD_API_TYPE=automatic1111
SD_MODEL=sdxl-ip-adapter-plus
IP_ADAPTER_SCALE=0.85
SD_STEPS=35
SD_GUIDANCE_SCALE=7.5
SD_STRENGTH=0.6
```

### Step 8: Test It

1. Restart your Next.js dev server: `npm run dev`
2. Generate a portrait
3. Check console logs - you should see: `🏠 Using LOCAL SD API: http://localhost:7860`

## Option 2: ComfyUI (Advanced)

ComfyUI is more complex but offers more control. See [ComfyUI documentation](https://github.com/comfyanonymous/ComfyUI) for setup.

## Troubleshooting

### "Connection refused" error
- Make sure Automatic1111 is running with `--api` flag
- Check that port 7860 is not blocked by firewall
- Verify `LOCAL_SD_API_URL` matches your WebUI port

### "No image returned" error
- Check Automatic1111 console for errors
- Verify SDXL model is loaded
- Try without IP-Adapter first (remove IP-Adapter config)

### Out of memory errors
- Reduce `SD_STEPS` to 20-25
- Use `--medvram` flag: `webui-user.bat --api --medvram`
- Use `--lowvram` flag: `webui-user.bat --api --lowvram`

### IP-Adapter not working
- Verify IP-Adapter extension is installed
- Check that models are in correct folder
- Try using ControlNet tab in WebUI first to test

## Performance Tips

- **Faster generation**: Reduce `SD_STEPS` to 20-25
- **Better quality**: Increase `SD_STEPS` to 40-50
- **More identity**: Increase `IP_ADAPTER_SCALE` to 0.9
- **More creativity**: Decrease `IP_ADAPTER_SCALE` to 0.7

## Next Steps

Once local testing works, you can:
1. Train a custom LoRA for your exact style
2. Fine-tune IP-Adapter weights
3. Experiment with different ControlNet models
4. Optimize for your specific hardware

