import os, json

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif'}

CDN_PREFIX = "https://cdn.jsdelivr.net/gh/DawnNights/seer_gallery@main/"

def is_image(name):
    return os.path.splitext(name.lower())[1] in IMAGE_EXTS

def build_album(path):
    """递归构建相册结构"""
    album_name = os.path.basename(path)
    album = {
        "name": album_name,
        "path": CDN_PREFIX + (path.replace("\\", "/").strip("./") + "/" if path != "." else ""),
        "images": [],
        "subalbums": []
    }

    # 遍历目录
    try:
        entries = sorted(os.listdir(path))
    except FileNotFoundError:
        return album

    for entry in entries:
        full_path = os.path.join(path, entry)
        if os.path.isdir(full_path) and not entry.startswith('.'):
            sub_album = build_album(full_path)
            if sub_album["images"] or sub_album["subalbums"]:
                album["subalbums"].append(sub_album)
        elif is_image(entry):
            album["images"].append(entry)

    return album

def main(root="."):
    albums = []
    for entry in sorted(os.listdir(root)):
        full_path = os.path.join(root, entry)
        if os.path.isdir(full_path) and not entry.startswith('.') and entry not in ('.git', '__pycache__'):
            alb = build_album(full_path)
            if alb["images"] or alb["subalbums"]:
                albums.append(alb)

    with open("index.json", "w", encoding="utf-8") as f:
        json.dump({"albums": albums}, f, ensure_ascii=False, indent=2)
    print(f"✅ 已生成 index.json，共 {len(albums)} 个顶级相册")

if __name__ == "__main__":
    main()
