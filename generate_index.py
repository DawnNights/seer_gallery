import os, json, re
from datetime import datetime

GALLERY_DIR = "gallery"
IMAGE_EXT = ".jpg"
VIDEO_EXT = ".mp4"
COVER_EXTS = {".webp", ".jpg"}  # 视频封面，优先 .webp


def natural_sort_key(name):
    """自然排序：将文件名中的数字按数值比较，而非逐字符"""
    return [int(c) if c.isdigit() else c.lower() for c in re.split(r"(\d+)", name)]


def parse_date_title(name):
    """从文件名/文件夹名提取 YYYY-MM-DD 和标题"""
    m = re.match(r"(\d{4}-\d{2}-\d{2})_(.*)", name)
    if m:
        return m.group(1), m.group(2)
    return None, name


def get_mtime(path):
    try:
        return os.path.getmtime(path)
    except Exception:
        return 0


def scan_gallery():
    works = []

    # 读取 tags.json（可选）
    tags_db = {}
    if os.path.exists("tags.json"):
        with open("tags.json", "r", encoding="utf-8") as f:
            tags_db = json.load(f)

    # 读取 authors.json（可选），覆盖默认作者
    authors_db = {
        "2025-12-11_这个赫尔卡星人就是逊了(代发)": "Anticipate",
        "2026-01-10_莫妮卡(代发)": "，.。",
    }

    AUTH_DEFAULT = "醉星河"

    try:
        entries = os.listdir(GALLERY_DIR)
    except FileNotFoundError:
        print(f"❌ 目录 {GALLERY_DIR}/ 不存在")
        return works, {}

    # 收集所有 .mp4 文件名（不含扩展名），用于判断 .webp/.jpg 是否为视频封面
    video_names = set()
    for e in entries:
        if e.lower().endswith(VIDEO_EXT):
            video_names.add(os.path.splitext(e)[0])

    for entry in sorted(entries):
        if entry.startswith("."):
            continue

        full_path = os.path.join(GALLERY_DIR, entry)
        base, ext = os.path.splitext(entry)

        # --- 跳过视频封面文件（同名的 .webp 或 .jpg 且存在对应 .mp4）---
        if base in video_names and ext.lower() in COVER_EXTS:
            continue

        # --- Photo：单 .jpg ---
        if os.path.isfile(full_path) and ext.lower() == IMAGE_EXT:
            _, title = parse_date_title(base)
            mtime = get_mtime(full_path)
            tags = tags_db.get(base, [])
            works.append(
                {
                    "id": base,
                    "type": "photo",
                    "title": title or base,
                    "author": authors_db.get(base, AUTH_DEFAULT),
                    "date": int(mtime),
                    "tags": tags,
                }
            )

        # --- Video：单 .mp4 ---
        elif os.path.isfile(full_path) and ext.lower() == VIDEO_EXT:
            _, title = parse_date_title(base)
            mtime = get_mtime(full_path)
            tags = tags_db.get(base, [])

            # 找封面：同名的 .webp 或 .jpg
            cover = None
            for ce in COVER_EXTS:
                candidate = os.path.join(GALLERY_DIR, base + ce)
                if os.path.exists(candidate):
                    cover = base + ce
                    break

            work = {
                "id": base,
                "type": "video",
                "title": title or base,
                "author": authors_db.get(base, AUTH_DEFAULT),
                "date": int(mtime),
                "tags": tags,
            }
            if cover:
                work["cover"] = cover
            works.append(work)

        # --- Album：包含 .jpg 的文件夹 ---
        elif os.path.isdir(full_path):
            jpgs = sorted(
                [f for f in os.listdir(full_path) if f.lower().endswith(IMAGE_EXT)],
                key=natural_sort_key,
            )
            if not jpgs:
                continue

            _, title = parse_date_title(entry)
            album_mtime = max(get_mtime(os.path.join(full_path, f)) for f in jpgs)
            tags = tags_db.get(entry, [])

            works.append(
                {
                    "id": entry,
                    "type": "album",
                    "title": title or entry,
                    "author": authors_db.get(entry, AUTH_DEFAULT),
                    "date": int(album_mtime),
                    "tags": tags,
                    "files": jpgs,
                    "cover": jpgs[0],
                }
            )

    # 按时间倒序（新作品在前）
    works.sort(key=lambda w: w["date"], reverse=True)
    return works, video_names


def collect_tags(works):
    """收集所有 tag 并统计频次"""
    tag_count = {}
    for w in works:
        for t in w["tags"]:
            tag_count[t] = tag_count.get(t, 0) + 1
    return dict(sorted(tag_count.items(), key=lambda x: -x[1]))


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"扫描 {GALLERY_DIR}/ ...")
    works, video_names = scan_gallery()
    tags = collect_tags(works)

    # 统计各类型数量
    counts = {"photo": 0, "album": 0, "video": 0}
    for w in works:
        counts[w["type"]] += 1

    output = {"works": works, "tags": tags}

    with open("index.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
        print(f"已生成 index.json")

    with open(
        f"record/{datetime.now().strftime('%y%m%d')}.json", "w", encoding="utf-8"
    ) as f:
        json.dump(output, f, ensure_ascii=False)

    print(
        f"  相片: {counts['photo']}  相册: {counts['album']}  视频: {counts['video']}"
    )
    print(f"  标签: {len(tags)}")
    if video_names:
        print(f"  视频封面: {len(video_names)} 个 .mp4 文件")


if __name__ == "__main__":
    main()
