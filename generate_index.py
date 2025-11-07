import os, json

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif'}

def is_image(name):
    return os.path.splitext(name.lower())[1] in IMAGE_EXTS

def main(root='.'):
    albums = []
    for entry in sorted(os.listdir(root)):
        p = os.path.join(root, entry)
        if os.path.isdir(p) and not entry.startswith('.'):
            imgs = [f for f in sorted(os.listdir(p)) if is_image(f)]
            if imgs:
                albums.append({
                    "name": entry,
                    "path": f"https://cdn.jsdelivr.net/gh/DawnNights/seer_gallery@main/{entry}/",
                    "images": imgs
                })
    index = {"albums": albums}
    with open('index.json', 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f"✅ 已生成 index.json，包含 {len(albums)} 个相册")

if __name__ == '__main__':
    main()
