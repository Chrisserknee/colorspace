# 🎨 Composite System Setup - BEST for Identity Preservation

## Overview

The **Composite System** is now the default and BEST approach for creating pet portraits that look exactly like your pet. It uses a systematic 5-step process:

1. **Segment** pet from background (preserves exact pet)
2. **Apply Painterly Effects** to pet (adds style while preserving identity)
3. **Generate Royal Scene** separately (with pose/palette context)
4. **Composite** pet onto scene
5. **Harmonize** final portrait (blends edges, adds shadows, ensures consistent painterly style)

## Why Composite is Better

✅ **Exact Identity Preservation**: Pet is segmented first, so it stays exactly the same
✅ **Intelligent Art Creation**: Scene generated separately, then composited
✅ **Systematic Approach**: Each step is controlled and predictable
✅ **Better Results**: No random AI art - you get exactly what you want

## Configuration

### Default (Recommended)

The composite system is **enabled by default** if you have:
- `REPLICATE_API_TOKEN` (for segmentation)
- `OPENAI_API_KEY` (for scene generation and harmonization)

**No configuration needed!** Just remove `USE_STABLE_DIFFUSION=true` from `.env.local` if it's there.

### Optional Settings

Add to `.env.local` to customize:

```bash
# Enable/disable painterly effects on pet (default: enabled)
USE_PET_PAINTERLY=true  # or false to skip painterly step

# Enable/disable final harmonization (default: enabled)
USE_COMPOSITE_HARMONIZATION=true  # or false to skip harmonization

# Disable composite system (use OpenAI img2img instead)
USE_COMPOSITE=false
```

## How It Works

### Step 1: Segmentation
- Uses `rembg` to extract pet from background
- Preserves exact pet appearance (no changes)

### Step 2: Painterly Effects (Optional)
- Applies oil painting texture to pet
- Preserves exact identity while adding style
- Uses OpenAI `images.edit` with careful prompts

### Step 3: Scene Generation
- Generates royal scene separately (no pet)
- Uses pose and palette context for consistency
- Creates cushion, robe, background, jewelry

### Step 4: Compositing
- Places pet onto scene using Sharp
- Positions pet on cushion
- Maintains exact pet appearance

### Step 5: Harmonization
- Adds shadows beneath pet
- Blends edges where pet meets background
- Applies consistent painterly texture throughout
- Ensures lighting matches across scene

## Troubleshooting

### Pet looks too photo-like?
- Ensure `USE_PET_PAINTERLY=true` (default)
- Ensure `USE_COMPOSITE_HARMONIZATION=true` (default)

### Pet doesn't match original?
- Check segmentation quality (should be automatic)
- Verify pet description is accurate

### Scene doesn't match pose/palette?
- Check that pose and palette are being passed correctly
- Verify OpenAI API is working

## Comparison

| Approach | Identity Preservation | Painterly Style | Reliability |
|----------|----------------------|-----------------|-------------|
| **Composite** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| SDXL img2img | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| OpenAI img2img | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Composite is the best balance** of identity preservation and painterly style.

