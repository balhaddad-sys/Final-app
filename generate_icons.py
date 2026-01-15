from PIL import Image, ImageDraw

def create_icon(size, output_path):
    img = Image.new('RGB', (size, size), '#0a0a0f')
    draw = ImageDraw.Draw(img)
    padding = size // 10
    border_width = max(2, size // 25)
    draw.rounded_rectangle([padding, padding, size - padding, size - padding], radius=size // 6, outline='#f0c674', width=border_width)
    center = size // 2
    cross_size = size // 3
    cross_width = size // 8
    draw.rectangle([center - cross_width//2, center - cross_size//2, center + cross_width//2, center + cross_size//2], fill='#f0c674')
    draw.rectangle([center - cross_size//2, center - cross_width//2, center + cross_size//2, center + cross_width//2], fill='#f0c674')
    img.save(output_path, 'PNG')

create_icon(192, 'icons/icon-192.png')
create_icon(512, 'icons/icon-512.png')
