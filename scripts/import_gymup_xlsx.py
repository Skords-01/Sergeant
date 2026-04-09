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

MUSCLE_GROUP_UK = {
    "Chest": "Груди",
    "Lats": "Найширші",
    "Middle Back": "Середина спини",
    "Lower Back": "Нижня частина спини",
    "Traps": "Трапеції",
    "Shoulders": "Плечі",
    "Biceps": "Біцепс",
    "Triceps": "Трицепс",
    "Forearms": "Передпліччя",
    "Abdominals": "Прес",
    "Quadriceps": "Квадрицепс",
    "Hamstrings": "Задня поверхня стегна",
    "Calves": "Ікри",
    "Adductors": "Привідні",
    "Abductors": "Відвідні",
    "Glutes": "Сідниці",
    "Neck": "Шия",
}

PRIMARY_GROUP_UK = {
    "chest": "Груди",
    "back": "Спина",
    "shoulders": "Плечі",
    "legs": "Ноги",
    "glutes": "Сідниці",
    "arms": "Руки",
    "core": "Прес",
    "full_body": "Все тіло",
    "cardio": "Кардіо",
}

EQUIPMENT_UK = {
    "bodyweight": "Власна вага",
    "barbell": "Штанга",
    "dumbbell": "Гантелі",
    "kettlebell": "Гиря",
    "cable": "Блок/трос",
    "machine": "Тренажер",
    "band": "Еспандер/резинка",
    "bench": "Лава",
    "other": "Інше",
}


def to_uk_name(en: str) -> str:
    """
    Lightweight rule-based translation for exercise names.
    Not perfect, but makes the catalog readable in Ukrainian.
    """
    s = (en or "").strip()
    if not s:
        return s

    rules = [
        (r"\bDumbbell(s)?\b", "гантел(і)"),
        (r"\bBarbell\b", "штанги"),
        (r"\bCable(s)?\b", "блоку"),
        (r"\bMachine\b", "тренажері"),
        (r"\bBench\b", "лаві"),
        (r"\bPress\b", "жим"),
        (r"\bRow\b", "тяга"),
        (r"\bPulldown\b", "тяга зверху"),
        (r"\bPull[- ]?up(s)?\b", "підтягування"),
        (r"\bChin[- ]?up(s)?\b", "підтягування зворотним хватом"),
        (r"\bSquat(s)?\b", "присідання"),
        (r"\bDeadlift(s)?\b", "тяга"),
        (r"\bRomanian\b", "румунська"),
        (r"\bLunge(s)?\b", "випади"),
        (r"\bCurl(s)?\b", "згинання"),
        (r"\bExtension(s)?\b", "розгинання"),
        (r"\bRaise(s)?\b", "підйом(и)"),
        (r"\bFly(e)?(s)?\b", "розведення"),
        (r"\bPlank\b", "планка"),
        (r"\bTwist(s)?\b", "скручування"),
        (r"\bSingle[- ]?Leg\b", "на одну ногу"),
        (r"\bLeg Press\b", "жим ногами"),
    ]

    out = s
    for pat, rep in rules:
        out = re.sub(pat, rep, out, flags=re.IGNORECASE)

    # Keep original if nothing changed
    return out if out != s else s


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
        mg_uk = MUSCLE_GROUP_UK.get(mg, mg) if mg else ""
        description_uk = f"Вправа для групи: {mg_uk}." if mg_uk else "Вправа з каталогу."
        if meta_desc and meta_desc.lower() != "nan":
            description_uk += " Рівень: середній."

        name_uk = to_uk_name(name)

        exercises.append(
            {
                "id": ex_id,
                "name": {"uk": name_uk, "en": name},
                "primaryGroup": pg,
                "primaryGroupUk": PRIMARY_GROUP_UK.get(pg, pg),
                "muscles": {
                    "primary": [primary_muscle] if primary_muscle else [],
                    "secondary": [],
                    "stabilizers": [],
                },
                "equipment": [eq],
                "equipmentUk": [EQUIPMENT_UK.get(eq, eq)],
                "description": description_uk,
                "descriptionUrl": url,
                "images": [u for u in (img1, img2) if u],
                "rating": rating,
                "source": "bodybuilding.com",
            }
        )

    out = {
        "schemaVersion": 3,
        "source": {
            "name": xlsx.name,
            "importedFrom": str(xlsx),
            "rows": int(len(df)),
            "exercises": int(len(exercises)),
        },
        "labels": {
            "primaryGroupsUk": PRIMARY_GROUP_UK,
            "equipmentUk": EQUIPMENT_UK,
            "muscleGroupsUk": MUSCLE_GROUP_UK,
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

