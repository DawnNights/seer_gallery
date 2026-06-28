"""
扫描 gallery/ 下的所有作品，重新生成 tags.json
- 已有 tag 的作品保留 tag
- 新作品 tag 为空数组
- 不存在的作品自动删除
- 打印哪些作品缺少 tag
"""
import os, json

GALLERY_DIR = "gallery"
TAGS_FILE = "tags.json"


def scan_works():
    """扫描 gallery/，返回所有作品 ID 列表（文件夹 basename / 文件 base）"""
    ids = set()
    try:
        entries = os.listdir(GALLERY_DIR)
    except FileNotFoundError:
        return ids

    video_names = set()
    for e in entries:
        if e.lower().endswith(".mp4"):
            video_names.add(os.path.splitext(e)[0])

    for e in entries:
        if e.startswith("."):
            continue
        full_path = os.path.join(GALLERY_DIR, e)
        base, ext = os.path.splitext(e)

        # 跳过视频封面文件
        if base in video_names and ext.lower() in {".webp", ".jpg"}:
            continue

        if os.path.isfile(full_path) and ext.lower() == ".jpg":
            ids.add(base)
        elif os.path.isfile(full_path) and ext.lower() == ".mp4":
            ids.add(base)
        elif os.path.isfile(full_path) and ext.lower() == ".txt":
            ids.add(base)
        elif os.path.isdir(full_path):
            ids.add(e)

    return ids


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    current_ids = scan_works()
    if not current_ids:
        print("❌ gallery/ 为空或不存在")
        return

    # 读取旧的 tags.json
    old_tags = {}
    if os.path.exists(TAGS_FILE):
        with open(TAGS_FILE, "r", encoding="utf-8") as f:
            old_tags = json.load(f)

    # 重建：保留存在的，新作品给空数组
    new_tags = {}
    kept = 0
    added = 0
    removed = 0

    for wid in sorted(current_ids):
        if wid in old_tags:
            new_tags[wid] = old_tags[wid]
            kept += 1
        else:
            new_tags[wid] = []
            added += 1

    # 统计被删除的
    for wid in old_tags:
        if wid not in current_ids:
            removed += 1

    # 写入
    with open(TAGS_FILE, "w", encoding="utf-8") as f:
        json.dump(new_tags, f, ensure_ascii=False, indent=2)

    print(f"✅ tags.json 已更新")
    print(f"   保留: {kept}  新增: {added}  删除: {removed}")

    # 打印没有 tag 的作品
    untagged = [(wid, new_tags[wid] == []) for wid in sorted(current_ids)]
    no_tags = [wid for wid, empty in untagged if empty]
    if no_tags:
        print(f"\n⚠️  以下 {len(no_tags)} 个作品缺少 tag（tags 为空数组）：")
        for wid in no_tags:
            print(f"   {wid}")


if __name__ == "__main__":
    main()
