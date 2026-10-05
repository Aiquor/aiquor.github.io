"""Regenerate the social card with Pillow: python scripts/render-social-card.py."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
font_dir = Path('/System/Library/Fonts/Supplemental')
regular = font_dir / 'Arial.ttf'
bold = font_dir / 'Arial Bold.ttf'
if not bold.exists():
    font_dir = Path('/usr/share/fonts/truetype/dejavu')
    regular = font_dir / 'DejaVuSans.ttf'
    bold = font_dir / 'DejaVuSans-Bold.ttf'

scale = 2
image = Image.new('RGB', (1200 * scale, 630 * scale), '#101010')
draw = ImageDraw.Draw(image)
def text(x, y, value, size, color='#ffffff', weight='regular'):
    font = ImageFont.truetype(str(bold if weight == 'bold' else regular), size * scale)
    draw.text((x * scale, y * scale), value, font=font, fill=color)

draw.rounded_rectangle((860 * scale, 70 * scale, 1140 * scale, 560 * scale), radius=30 * scale, fill='#191c21', outline='#353b45', width=2 * scale)
for y, label in [(130, 'Support'), (255, 'Reporting'), (380, 'Operations')]:
    draw.rounded_rectangle((895 * scale, y * scale, 1105 * scale, (y + 86) * scale), radius=12 * scale, fill='#24282f', outline='#cc8066', width=2 * scale)
    text(918, y + 29, label, 22, '#e9b29c')
text(66, 55, 'aiquor.', 46, '#cc8066', 'bold')
text(66, 193, 'Less busywork.', 66, weight='bold')
text(66, 277, 'More possibility.', 66, weight='bold')
text(66, 408, 'AI agents and internal tools', 29, '#d1d1d1')
text(66, 453, 'for small teams.', 29, '#d1d1d1')
text(66, 552, 'Built around your business. Owned by you.', 20, '#b0b7c2')
image.resize((1200, 630), Image.Resampling.LANCZOS).save(root / 'assets/social/aiquor-og.png', optimize=True)
