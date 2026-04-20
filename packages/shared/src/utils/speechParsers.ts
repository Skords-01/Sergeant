/**
 * Speech-to-structured-data parsers for each module's entry format.
 * Supports Ukrainian and English input.
 */

// ── Finyk: expense parser ──────────────────────────────────────────────────
// e.g. "кава 45 гривень", "продукти 320 грн", "таксі двісті п'ятдесят"

const UA_NUMBER_WORDS: Record<string, number> = {
  нуль: 0,
  один: 1,
  одна: 1,
  два: 2,
  дві: 2,
  три: 3,
  чотири: 4,
  "п'ять": 5,
  шість: 6,
  сім: 7,
  вісім: 8,
  "дев'ять": 9,
  десять: 10,
  одинадцять: 11,
  дванадцять: 12,
  тринадцять: 13,
  чотирнадцять: 14,
  "п'ятнадцять": 15,
  шістнадцять: 16,
  сімнадцять: 17,
  вісімнадцять: 18,
  "дев'ятнадцять": 19,
  двадцять: 20,
  тридцять: 30,
  сорок: 40,
  "п'ятдесят": 50,
  шістдесят: 60,
  сімдесят: 70,
  вісімдесят: 80,
  "дев'яносто": 90,
  сто: 100,
  двісті: 200,
  триста: 300,
  чотириста: 400,
  "п'ятсот": 500,
  шістсот: 600,
  сімсот: 700,
  вісімсот: 800,
  "дев'ятсот": 900,
  тисяча: 1000,
  тисячі: 1000,
  тисяч: 1000,
};

function parseUaNumber(text: string): number | null {
  const lower = text.toLowerCase();
  const parsed = parseFloat(lower.replace(",", "."));
  if (!isNaN(parsed)) return parsed;
  let total = 0;
  let current = 0;
  const words = lower.split(/\s+/);
  for (const w of words) {
    const v = UA_NUMBER_WORDS[w];
    if (v == null) continue;
    if (v === 1000) {
      total += (current || 1) * 1000;
      current = 0;
    } else {
      current += v;
    }
  }
  total += current;
  return total > 0 ? total : null;
}

export interface ParsedExpense {
  name: string;
  amount: number | null;
  raw: string;
}

export function parseExpenseSpeech(text: string): ParsedExpense | null {
  if (!text?.trim()) return null;

  const lower = text.toLowerCase().replace(/[,]/g, ".");

  const amountMatch =
    lower.match(/(\d+(?:\.\d+)?)\s*(?:грн?|гривень|гривні|гривня|₴|uah)/i) ||
    lower.match(/(\d+(?:\.\d+)?)/);

  let amount: number | null = null;
  if (amountMatch) {
    amount = parseFloat(amountMatch[1]);
  }

  if (amount == null) {
    amount = parseUaNumber(text);
  }

  const currencyRe = /\b(?:грн?|гривень|гривні|гривня|₴|uah)\b/i;
  let name = text
    .replace(
      /(\d+(?:[.,]\d+)?)\s*(?:грн?|гривень|гривні|гривня|₴|uah)?\b/gi,
      " ",
    )
    .replace(currencyRe, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) name = "Витрата";
  name = name.charAt(0).toUpperCase() + name.slice(1);

  return {
    name,
    amount: amount != null ? Math.round(amount * 100) / 100 : null,
    raw: text,
  };
}

// ── Fizruk: workout set parser ─────────────────────────────────────────────
// e.g. "bench press 80 kg 8 reps", "присідання 100 кг 5 повторень"

export interface ParsedWorkoutSet {
  exerciseName: string | null;
  weight: number | null;
  reps: number | null;
  sets: number | null;
  raw: string;
}

export function parseWorkoutSetSpeech(text: string): ParsedWorkoutSet | null {
  if (!text?.trim()) return null;

  const lower = text.toLowerCase();

  const weightMatch =
    lower.match(/(\d+(?:[.,]\d+)?)\s*(?:кг|kg|кілограм|килограм)/i) ||
    lower.match(/(\d+(?:[.,]\d+)?)\s*(?:lb|lbs|фунт)/i);

  const repsMatch =
    lower.match(/(\d+)\s*(?:повт|повторень|повторів|reps?|раз|разів)/i) ||
    lower.match(/(?:повт|reps?)\s*(\d+)/i);

  const setsMatch =
    lower.match(/(\d+)\s*(?:підходів|підхід|sets?)/i) ||
    lower.match(/(?:підхід|sets?)\s*(\d+)/i);

  let weight: number | null = null;
  if (weightMatch) {
    weight = parseFloat(weightMatch[1].replace(",", "."));
    if (/lb|lbs|фунт/i.test(weightMatch[0]))
      weight = Math.round(weight * 0.453592);
  }

  let reps: number | null = null;
  if (repsMatch) reps = parseInt(repsMatch[1] || repsMatch[2], 10);

  let sets: number | null = null;
  if (setsMatch) sets = parseInt(setsMatch[1] || setsMatch[2], 10);

  let exerciseName: string | null = text
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:кг|kg|кілограм|lb|lbs|фунт)?\b/gi, " ")
    .replace(
      /(\d+)\s*(?:повт|повторень|повторів|reps?|раз|разів|підходів|підхід|sets?)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (!exerciseName) exerciseName = null;
  else
    exerciseName = exerciseName.charAt(0).toUpperCase() + exerciseName.slice(1);

  return {
    exerciseName,
    weight,
    reps,
    sets,
    raw: text,
  };
}

// ── Nutrition: meal parser ─────────────────────────────────────────────────
// e.g. "гречка 200 грам 180 ккал", "овочевий салат 150г 45 калорій"

export interface ParsedMeal {
  name: string;
  kcal: number | null;
  grams: number | null;
  protein: number | null;
  raw: string;
}

export function parseMealSpeech(text: string): ParsedMeal | null {
  if (!text?.trim()) return null;

  const lower = text.toLowerCase();

  const kcalMatch =
    lower.match(/(\d+(?:[.,]\d+)?)\s*(?:ккал|кілокалор|калор|kcal|cal)/i) ||
    lower.match(/(?:ккал|kcal)\s*(\d+(?:[.,]\d+)?)/i);

  const gramsMatch =
    lower.match(/(\d+(?:[.,]\d+)?)\s*(?:грам|гр|г\b|g\b|ml|мл)/i) ||
    lower.match(/(?:грам|гр)\s*(\d+(?:[.,]\d+)?)/i);

  const proteinMatch = lower.match(
    /(\d+(?:[.,]\d+)?)\s*(?:г\s*білка|г\s*протеїну|g\s*protein|protein)/i,
  );

  let kcal: number | null = null;
  if (kcalMatch)
    kcal = parseFloat((kcalMatch[1] || kcalMatch[2]).replace(",", "."));

  let grams: number | null = null;
  if (gramsMatch) grams = parseFloat(gramsMatch[1].replace(",", "."));

  let protein: number | null = null;
  if (proteinMatch) protein = parseFloat(proteinMatch[1].replace(",", "."));

  let name = text
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:ккал|кілокалор|калор|kcal|cal)?\b/gi, " ")
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:грам|гр|г\b|g\b|ml|мл)?\b/gi, " ")
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:г\s*білка|g\s*protein)?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) name = "Прийом їжі";
  else name = name.charAt(0).toUpperCase() + name.slice(1);

  return {
    name,
    kcal,
    grams,
    protein,
    raw: text,
  };
}
