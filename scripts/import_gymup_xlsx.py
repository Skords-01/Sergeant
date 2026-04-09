import json
import re
import sys
from pathlib import Path

import pandas as pd


def slug(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "exercise"


MUSCLE_TO_GROUP = {
    "Chest": "chest",
    "Lats": "back",
    "Middle Back": "back",
    "Lower Back": "back",
    "Traps": "back",
    "Shoulders": "shoulders",
    "Biceps": "arms",
    "Triceps": "arms",
    "Forearms": "arms",
    "Abdominals": "core",
    "Quadriceps": "legs",
    "Hamstrings": "legs",
    "Calves": "legs",
    "Adductors": "legs",
    "Abductors": "legs",
    "Glutes": "glutes",
    "Neck": "back",
}

MUSCLE_TO_ID = {
    "Chest": "pectoralis_major",
    "Lats": "latissimus_dorsi",
    "Middle Back": "rhomboids",
    "Lower Back": "erector_spinae",
    "Traps": "trapezius",
    "Shoulders": "lateral_deltoid",
    "Biceps": "biceps",
    "Triceps": "triceps",
    "Forearms": "forearms",
    "Abdominals": "rectus_abdominis",
    "Quadriceps": "quadriceps",
    "Hamstrings": "hamstrings",
    "Calves": "calves",
    "Adductors": "adductors",
    "Abductors": "abductors",
    "Glutes": "gluteus_maximus",
    "Neck": "trapezius",
}

EQ_MAP = {
    "Body Only": "bodyweight",
    "Barbell": "barbell",
    "Dumbbell": "dumbbell",
    "Dumbbells": "dumbbell",
    "Cable": "cable",
    "Cables": "cable",
    "Machine": "machine",
    "Bands": "band",
    "Kettlebells": "kettlebell",
    "Weight Bench": "bench",
    "E-Z Curl Bar": "barbell",
    "Exercise Ball": "other",
    "Medicine Ball": "other",
    "Other": "other",
}


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scripts/import_gymup_xlsx.py <path-to-xlsx>")
        return 2

    xlsx = Path(sys.argv[1]).expanduser().resolve()
    if not xlsx.exists():
        print(f"File not found: {xlsx}")
        return 2

    df = pd.read_excel(xlsx)

    seen: set[str] = set()
    exercises = []

    for _, r in df.iterrows():
        name = str(r.get("Exercise_Name") or "").strip()
        if not name:
            continue

        ex_id = slug(name)
        if ex_id in seen:
            i = 2
            while f"{ex_id}_{i}" in seen:
                i += 1
            ex_id = f"{ex_id}_{i}"
        seen.add(ex_id)

        mg = str(r.get("muscle_gp") or "").strip()
        pg = MUSCLE_TO_GROUP.get(mg, "full_body")
        primary_muscle = MUSCLE_TO_ID.get(mg)

        eq_raw = str(r.get("Equipment") or "").strip()
        eq = EQ_MAP.get(eq_raw, "other")

        url = str(r.get("Description_URL") or "").strip() or None
        img1 = str(r.get("Exercise_Image") or "").strip() or None
        img2 = str(r.get("Exercise_Image1") or "").strip() or None

        rating = r.get("Rating")
        try:
            rating = float(rating) if rating == rating else None
        except Exception:
            rating = None

        meta_desc = str(r.get("Description") or "").strip() or None
        description = f"Вправа для групи: {mg}." if mg else "Вправа з каталогу."
        if meta_desc and meta_desc.lower() != "nan":
            description += f" Рівень/мітка: {meta_desc}."

        exercises.append(
            {
                "id": ex_id,
                "name": {"uk": name, "en": name},
                "primaryGroup": pg,
                "muscles": {
                    "primary": [primary_muscle] if primary_muscle else [],
                    "secondary": [],
                    "stabilizers": [],
                },
                "equipment": [eq],
                "description": description,
                "descriptionUrl": url,
                "images": [u for u in (img1, img2) if u],
                "rating": rating,
                "source": "bodybuilding.com",
            }
        )

    out = {
        "schemaVersion": 2,
        "source": {
            "name": xlsx.name,
            "importedFrom": str(xlsx),
            "rows": int(len(df)),
            "exercises": int(len(exercises)),
        },
        "exercises": exercises,
    }

    out_path = Path(__file__).resolve().parents[1] / "src" / "modules" / "fizruk" / "data" / "exercises.gymup.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"Written: {out_path} ({len(exercises)} exercises)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

