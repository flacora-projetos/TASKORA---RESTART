# -*- coding: utf-8 -*-
"""
Utility script to sanitize mojibake that sneaks into the frontend when a file is
saved with the wrong encoding. It walks through the target directory (default:
apps/web) and replaces common sequences such as "Ã§" or "Ã©" with the expected
accented characters.

Usage:
    python scripts/fix-mojibake.py            # fix apps/web
    python scripts/fix-mojibake.py apps/web/components/tasks
"""

from __future__ import annotations

import sys
from pathlib import Path

DEFAULT_TARGET = Path("apps/web")
TARGET_EXTENSIONS = {".ts", ".tsx"}

MAPPING = {
    "Ã¡": "á",
    "Ã ": "à",
    "Ã£": "ã",
    "Ã¢": "â",
    "Ã¤": "ä",
    "Ã§": "ç",
    "Ã©": "é",
    "Ã¨": "è",
    "Ãª": "ê",
    "Ã­": "í",
    "Ã³": "ó",
    "Ãµ": "õ",
    "Ã´": "ô",
    "Ãº": "ú",
    "Ã¼": "ü",
    "Ã": "Á",
    "Ã€": "À",
    "Ã‚": "Â",
    "Ãƒ": "Ã",
    "Ã‡": "Ç",
    "Ã‰": "É",
    "ÃŠ": "Ê",
    "Ã“": "Ó",
    "Ã•": "Õ",
    "Ã”": "Ô",
    "Ãš": "Ú",
    "Ãœ": "Ü",
    "Â": ""
}


def fix_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    new_text = text
    for wrong, right in MAPPING.items():
        new_text = new_text.replace(wrong, right)
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        return True
    return False


def main() -> None:
    target_root = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_TARGET
    if not target_root.exists():
        print(f"[fix-mojibake] Target path {target_root} not found.", file=sys.stderr)
        sys.exit(1)

    fixed_files = []
    for path in target_root.rglob("*"):
        if path.is_file() and path.suffix in TARGET_EXTENSIONS:
            if fix_file(path):
                fixed_files.append(path)

    if fixed_files:
        print("[fix-mojibake] Updated files:")
        for file_path in fixed_files:
            print(f"  - {file_path}")
    else:
        print("[fix-mojibake] No mojibake found. All good!")


if __name__ == "__main__":
    main()
