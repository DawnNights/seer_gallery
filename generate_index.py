import re, os, json, subprocess

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif'}

CDN_PREFIX = "https://gcore.jsdelivr.net/gh/DawnNights/seer_gallery@main/"

def is_image(name):
    return os.path.splitext(name.lower())[1] in IMAGE_EXTS

def image_sort_key(name):
    # 提取文件名中的第一个数字（自然排序）
    m = re.search(r'\d+', name)
    return int(m.group()) if m else 0


def git_last_commit_time(path):
    try:
        ts = subprocess.check_output(
            ["git", "log", "-1", "--format=%ct", "--", path],
            stderr=subprocess.DEVNULL,
            text=True
        ).strip()
        return int(ts)
    except Exception:
        return 0


def build_album(path):
    """递归构建相册结构（子相册按修改时间，图片按自然数字）"""
    album = {
        "name": os.path.basename(path),
        "path": CDN_PREFIX + (path.replace("\\", "/").strip("./") + "/"),
        "images": [],
        "subalbums": [],
    }

    print(path, git_last_commit_time(path))

    try:
        entries = os.listdir(path)
    except FileNotFoundError:
        return None

    # -------- 图片：自然数字排序 --------
    images = [e for e in entries if is_image(e)]
    images.sort(key=image_sort_key)
    album["images"].extend(images)

    # -------- 子相册：按修改时间排序 --------
    dirs = [
        e for e in entries
        if os.path.isdir(os.path.join(path, e)) and not e.startswith('.')
    ]

    dirs.sort(
        key=lambda d: git_last_commit_time(os.path.join(path, d)),
        reverse=True
    )

    for d in dirs:
        sub = build_album(os.path.join(path, d))
        if sub and (sub["images"] or sub["subalbums"]):
            album["subalbums"].append(sub)

    return album


def main(root="."):
    albums = []

    # -------- 顶级相册：按修改时间排序 --------
    dirs = [
        e for e in os.listdir(root)
        if os.path.isdir(os.path.join(root, e))
        and not e.startswith('.')
        and e not in ('.git', '__pycache__')
    ]

    dirs.sort(
        key=lambda d: git_last_commit_time(os.path.join(root, d)),
        reverse=True
    )

    for d in dirs:
        alb = build_album(os.path.join(root, d))
        if alb and (alb["images"] or alb["subalbums"]):
            albums.append(alb)

    with open("index.json", "w", encoding="utf-8") as f:
        json.dump({"albums": albums}, f, ensure_ascii=False, indent=2)

    print(f"✅ 已生成 index.json，共 {len(albums)} 个顶级相册")


if __name__ == "__main__":
    main()
