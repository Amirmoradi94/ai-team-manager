from core.gif_builder import GIFBuilder
from PIL import Image, ImageDraw# 1. Create builder
builder = GIFBuilder(width=128, height=128, fps=10)# 2. Generate frames
for i in range(12):
frame = Image.new('RGB', (128, 128), (240, 248, 255))
draw = ImageDraw.Draw(frame)# Draw your animation using PIL primitives
# (circles, polygons, lines, etc.)builder.add_frame(frame)# 3. Save with optimization
builder.save('output.gif', num_colors=48, optimize_for_emoji=True)