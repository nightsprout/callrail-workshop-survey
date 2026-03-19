Generate a branded image for the pre-read using nanobanana (Google Gemini API).

Arguments: $ARGUMENTS

When this command is invoked, follow this workflow:

---

## Step 0: Parse Arguments

The user passes a prompt description after `/image-gen`:
- **A text prompt** → Generate a square image with that scene description
- **No args** → Ask the user what they want to generate

Examples:
- `/image-gen A friendly T-Rex examining floating token fragments`
- `/image-gen test` → Ask for a prompt interactively

---

## Step 1: API Setup

**Model:** `nano-banana-pro-preview` via the Gemini REST API.

**Endpoint:**
```
POST https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=GEMINI_KEY
```

**The API key is NOT stored in this file.** Check for it in this order:
1. Environment variable `GEMINI_KEY`
2. Ask the user to provide it

**Character reference images** (from `~/workshop/brand/`):
1. `~/workshop/brand/logos/logo-symbol.png` — T-Rex head logo (always include)
2. `~/workshop/brand/mascot/TRexTech_Mascot_Illustration.png` — Full body mascot
3. `~/workshop/brand/mascot/TRexTech_Surfing_Illustration.png` — Surfing mascot (optional)
4. `~/workshop/brand/mascot/TRexTech_Dreaming_Illustration.png` — Dreaming mascot (optional)
5. `~/workshop/brand/textures/TRexTech_Claw_Pattern_Teal.jpg` — Claw scratch texture for backgrounds

**Output directory:** `public/images/slides/`

---

## Step 2: Generate the Image

Use this Python pattern to generate the image:

```python
import json, base64, urllib.request, os

API_KEY = os.environ.get('GEMINI_KEY') or '<ask-user>'
MODEL = 'nano-banana-pro-preview'
URL = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}'

def load_ref(path, mime='image/png'):
    with open(path, 'rb') as f:
        return {'inlineData': {'mimeType': mime, 'data': base64.b64encode(f.read()).decode('utf-8')}}

BRAND = os.path.expanduser('~/workshop/brand')
logo = load_ref(f'{BRAND}/logos/logo-symbol.png')
mascot = load_ref(f'{BRAND}/mascot/TRexTech_Mascot_Illustration.png')
surfing = load_ref(f'{BRAND}/mascot/TRexTech_Surfing_Illustration.png')
dreaming = load_ref(f'{BRAND}/mascot/TRexTech_Dreaming_Illustration.png')
texture = load_ref(f'{BRAND}/textures/TRexTech_Claw_Pattern_Teal.jpg', 'image/jpeg')

# Also load existing approved images as style refs for consistency
import glob
style_refs = []
for img_path in glob.glob('public/images/slides/**/*.jpg', recursive=True):
    try:
        style_refs.append(load_ref(img_path, 'image/jpeg'))
    except: pass
    if len(style_refs) >= 5: break

STYLE_PREFIX = """Reference images:
- Image 1 (LOGO): The brand T-Rex mascot logo — bold, flat, filled bright green, thick dark outlines, wide open mouth with jagged triangular teeth, confident toothy grin, small dot eye. When the T-Rex character appears, it MUST match this face/head design.
- Images 2-4 (body outlines): Body SHAPE references for the T-Rex — proportions (tiny arms, upright stance, thick tail, clawed feet). These are outlines only, NOT the style. Render in the bold flat filled style of the logo.
- Image 5: Brand claw scratch texture for background.
- Additional images: STYLE CONSISTENCY references — previously approved images. Match their visual treatment.

"""

STYLE_SUFFIX = """

Simple flat animation style with clean bold outlines, like a modern motion graphics frame.
Solid dark navy background (#00353B). Elements in bright green (#00CE7C).
Minimal detail, clean smooth edges, lots of negative space.
Subtle claw scratch texture on background (low opacity, tone-on-tone).
No scenery clutter, no foliage, no stars, no busy ground detail.
No text, no words, no labels, no writing of any kind.
Square 1:1 aspect ratio."""

prompt = STYLE_PREFIX + "Generate an image: " + SCENE_PROMPT + STYLE_SUFFIX

parts = [logo, mascot, surfing, dreaming, texture] + style_refs + [{'text': prompt}]

payload = json.dumps({
    'contents': [{'parts': parts}],
    'generationConfig': {'responseModalities': ['IMAGE']}
}).encode('utf-8')

req = urllib.request.Request(URL, data=payload, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req, timeout=120) as resp:
    data = json.loads(resp.read().decode('utf-8'))

for part in data['candidates'][0]['content']['parts']:
    if 'inlineData' in part:
        img = base64.b64decode(part['inlineData']['data'])
        os.makedirs('public/images/slides/', exist_ok=True)
        with open(OUTPUT_PATH, 'wb') as f:
            f.write(img)
        print(f"Saved {len(img)} bytes to {OUTPUT_PATH}")
```

Replace `SCENE_PROMPT` with the user's prompt and `OUTPUT_PATH` with the target filename.

---

## Step 3: Prompt Design Rules

1. **ONE central focal point** per image — not a collage
2. **Visual metaphor, not literal** — find one metaphor for the concept
3. **Simple** — only 2-3 elements max
4. **Lots of negative space** — these sit alongside text
5. **Friendly dino character** when appropriate — bold flat green T-Rex, confident mascot energy
6. **Positively themed** — even challenges feel empowering

---

## Step 4: Review

After generating, show the image path to the user. Ask:
- Does the image work for this concept?
- Want to try a different prompt?

If the user wants to iterate, regenerate with a tweaked prompt (delete the old image first).

---

## Notes

- Never store the API key in committed files
- Images go to `public/images/slides/` — flat directory (no sections needed for pre-read)
- nanobanana returns JPEG images, typically 400-900KB
- If generation fails, retry once then report the error
- Brand colors: Background `#00353B`, Foreground `#00CE7C`, Accents: `#007D8A`, `#00D2C8`, `#F2FF69`
