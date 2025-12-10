# ✅ Local SDXL Setup - Next Steps

## What's Been Done

1. ✅ Automatic1111 WebUI cloned to: `C:\Users\SR115\stable-diffusion-webui`
2. ✅ IP-Adapter extension installed
3. ✅ `.env.local` updated with Local SDXL settings
4. ✅ Helper scripts created

## What You Need to Do Now

### Step 1: Download SDXL Base Model

1. Go to: https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0
2. Click "Files and versions" tab
3. Download: `sd_xl_base_1.0.safetensors` (~7GB)
4. Save to: `C:\Users\SR115\stable-diffusion-webui\models\Stable-diffusion\`

### Step 2: Download IP-Adapter Plus Model

1. Go to: https://huggingface.co/h94/IP-Adapter/tree/main/models
2. Download: `ip-adapter-plus_sdxl_vit-h.safetensors` (~1.5GB)
3. Save to: `C:\Users\SR115\stable-diffusion-webui\extensions\IP-Adapter\models\`

### Step 3: Start Automatic1111 WebUI

1. Open PowerShell or Command Prompt
2. Navigate to: `cd C:\Users\SR115\stable-diffusion-webui`
3. Run: `.\webui-user.bat --api --listen`

Wait for it to finish loading (you'll see "Running on local URL: http://127.0.0.1:7860")

### Step 4: Test It

1. Restart your Next.js dev server: `npm run dev`
2. Generate a portrait
3. Check console - you should see: `🏠 Using LOCAL SD API: http://localhost:7860`

## Quick Commands

**Start WebUI:**
```bash
cd C:\Users\SR115\stable-diffusion-webui
.\webui-user.bat --api --listen
```

**Or use the helper script:**
```bash
cd C:\Users\SR115\stable-diffusion-webui
.\start-api.bat
```

## Troubleshooting

- **Port 7860 already in use?** Change `LOCAL_SD_API_URL` in `.env.local` to a different port
- **Out of memory?** Add `--medvram` or `--lowvram` flags to webui-user.bat
- **Models not found?** Double-check file names and locations match exactly

## Your Configuration

Your `.env.local` now includes:
- `USE_STABLE_DIFFUSION=true`
- `LOCAL_SD_API_URL=http://localhost:7860`
- `SD_MODEL=sdxl-ip-adapter-plus`
- `IP_ADAPTER_SCALE=0.85`

You're all set! Just download the models and start the WebUI.

