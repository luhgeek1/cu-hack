from __future__ import annotations

import argparse
import json
from pathlib import Path

from .parser import parse_pdf


def main() -> None:
    parser = argparse.ArgumentParser(description="Преобразовать банковскую PDF-выписку в JSON")
    parser.add_argument("pdf", type=Path, help="Путь к PDF-выписке")
    parser.add_argument("--account-id", help="Добавить account_id и вывести контракт /api/v1/imports")
    parser.add_argument("--output", type=Path, help="Сохранить JSON в файл вместо stdout")
    args = parser.parse_args()

    statement = parse_pdf(args.pdf.read_bytes())
    payload = statement.to_import_dict(args.account_id) if args.account_id else statement.to_dict()
    rendered = json.dumps(payload, ensure_ascii=False, indent=2, default=str)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)


if __name__ == "__main__":
    main()
