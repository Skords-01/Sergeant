import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

function tryLoadSpeech() {
  try {
    // В Expo Go нативного модуля немає → буде runtime error.
    // У Dev Client модуль буде доступний.
    const m = require("expo-speech-recognition");
    return m || null;
  } catch {
    return null;
  }
}

export default function App() {
  const apiBase = String(process.env.EXPO_PUBLIC_API_BASE_URL || "").replace(
    /\/$/,
    "",
  );
  const apiToken = String(process.env.EXPO_PUBLIC_NUTRITION_API_TOKEN || "");

  const speech = useMemo(() => tryLoadSpeech(), []);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const [image, setImage] = useState(null);
  const [photoResult, setPhotoResult] = useState(null);
  const [portionGrams, setPortionGrams] = useState("");
  const [answers, setAnswers] = useState({});

  const [pantryText, setPantryText] = useState("");
  const [pantryItems, setPantryItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [recipesRaw, setRecipesRaw] = useState("");

  const [listening, setListening] = useState(false);
  const lastTranscriptRef = useRef("");

  speech?.useSpeechRecognitionEvent?.("result", (e) => {
    const transcript = e?.results?.[0]?.[0]?.transcript;
    if (!transcript) return;
    const t = String(transcript).trim();
    if (!t || t === lastTranscriptRef.current) return;
    lastTranscriptRef.current = t;
    setPantryText((cur) =>
      cur ? `${cur}${cur.trim().endsWith(",") ? " " : ", "}${t}` : t,
    );
  });
  speech?.useSpeechRecognitionEvent?.("end", () => setListening(false));
  speech?.useSpeechRecognitionEvent?.("error", (e) => {
    setListening(false);
    const msg = e?.error?.message || e?.error?.code || "Помилка розпізнавання";
    Alert.alert("Голос", String(msg));
  });

  const canVoice = useMemo(
    () => !!speech?.ExpoSpeechRecognitionModule?.isRecognitionAvailable?.(),
    [speech],
  );

  function apiUrl(path) {
    if (!apiBase) return null;
    return `${apiBase}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  async function postJson(path, body) {
    const url = apiUrl(path);
    if (!url) {
      throw new Error(
        "Не задано EXPO_PUBLIC_API_BASE_URL (вкажи базовий URL веб-хаба на Vercel).",
      );
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken ? { "X-Token": apiToken } : {}),
      },
      body: JSON.stringify(body || {}),
    });
    const raw = await res.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error("Сервер повернув не-JSON відповідь.");
    }
    if (!res.ok) throw new Error(String(data?.error || `HTTP ${res.status}`));
    return data;
  }

  async function pickPhoto() {
    setPhotoResult(null);
    setAnswers({});
    setPortionGrams("");
    const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!r.granted) {
      Alert.alert("Доступ", "Потрібен доступ до фото.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.85,
    });
    if (picked.canceled) return;
    const a = picked.assets?.[0];
    if (!a?.base64) {
      Alert.alert("Фото", "Не вдалося отримати base64. Спробуй інше фото.");
      return;
    }
    if (String(a.base64).length > 7_000_000) {
      Alert.alert("Фото", "Фото завелике. Обріж або стисни і спробуй ще раз.");
      return;
    }
    setImage({
      uri: a.uri,
      base64: a.base64,
      mime: a.mimeType || "image/jpeg",
    });
  }

  async function analyzePhoto() {
    if (!image?.base64) {
      Alert.alert("Фото", "Спочатку обери фото.");
      return;
    }
    setBusy(true);
    setStatus("Аналізую фото…");
    try {
      const data = await postJson("/api/nutrition/analyze-photo", {
        image_base64: image.base64,
        mime_type: image.mime,
        locale: "uk-UA",
      });
      setPhotoResult(data?.result || null);
    } catch (e) {
      Alert.alert("Помилка", e?.message || "Помилка аналізу");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function refinePhoto() {
    if (!image?.base64) return;
    setBusy(true);
    setStatus("Перераховую…");
    try {
      const questions = Array.isArray(photoResult?.questions)
        ? photoResult.questions.slice(0, 6)
        : [];
      const qna = questions
        .map((q) => ({ question: q, answer: String(answers[q] || "").trim() }))
        .filter((x) => x.answer);
      const grams = Number(String(portionGrams).replace(",", "."));
      const data = await postJson("/api/nutrition/refine-photo", {
        image_base64: image.base64,
        mime_type: image.mime,
        prior_result: photoResult,
        portion_grams: Number.isFinite(grams) && grams > 0 ? grams : null,
        qna,
        locale: "uk-UA",
      });
      setPhotoResult(data?.result || null);
    } catch (e) {
      Alert.alert("Помилка", e?.message || "Помилка уточнення");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function parsePantry() {
    setBusy(true);
    setStatus("Розбираю список…");
    try {
      const data = await postJson("/api/nutrition/parse-pantry", {
        text: pantryText.trim(),
        locale: "uk-UA",
      });
      setPantryItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      Alert.alert("Помилка", e?.message || "Помилка розбору");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function recommendRecipes() {
    setBusy(true);
    setStatus("Генерую рецепти…");
    try {
      setRecipesRaw("");
      const items =
        pantryItems.length > 0
          ? pantryItems
          : pantryText.trim()
            ? [{ name: pantryText.trim() }]
            : [];
      const data = await postJson("/api/nutrition/recommend-recipes", {
        items,
        preferences: {
          goal: "balanced",
          servings: 1,
          timeMinutes: 25,
          exclude: "",
          locale: "uk-UA",
        },
      });
      setRecipes(Array.isArray(data?.recipes) ? data.recipes : []);
      setRecipesRaw(typeof data?.rawText === "string" ? data.rawText : "");
    } catch (e) {
      Alert.alert("Помилка", e?.message || "Помилка рецептів");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function toggleVoice() {
    if (!canVoice) {
      Alert.alert(
        "Голос",
        "Голос недоступний у Expo Go. Потрібен Dev Client (EAS build) або користуйся диктовкою клавіатури iOS.",
      );
      return;
    }
    if (listening) {
      try {
        speech.ExpoSpeechRecognitionModule.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }
    try {
      await speech.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      speech.ExpoSpeechRecognitionModule.start({ lang: "uk-UA" });
      setListening(true);
    } catch (e) {
      setListening(false);
      Alert.alert("Голос", e?.message || "Не вдалося запустити розпізнавання");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.h1}>Харчування (mobile)</Text>
        <Text style={styles.p}>
          Потрібен `EXPO_PUBLIC_API_BASE_URL` (URL твого хабу на Vercel).
        </Text>

        {!!status && (
          <View style={styles.statusBox}>
            <ActivityIndicator />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.h2}>Фото → КБЖВ</Text>
          <View style={styles.row}>
            <Button title="Обрати фото" onPress={pickPhoto} disabled={busy} />
            <View style={styles.spacer} />
            <Button
              title="Аналізувати"
              onPress={analyzePhoto}
              disabled={busy || !image}
            />
          </View>
          {image?.uri && (
            <Image source={{ uri: image.uri }} style={styles.image} />
          )}
          {photoResult && (
            <View style={styles.result}>
              <Text style={styles.bold}>
                {photoResult.dishName || "Результат"}
              </Text>
              <Text style={styles.p}>
                Ккал: {fmt(photoResult?.macros?.kcal)} · Б/Ж/В:{" "}
                {fmt(photoResult?.macros?.protein_g)}/
                {fmt(photoResult?.macros?.fat_g)}/
                {fmt(photoResult?.macros?.carbs_g)}
              </Text>
              {Array.isArray(photoResult?.questions) &&
                photoResult.questions.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.h3}>Уточнення</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Порція (г), напр. 320"
                      value={portionGrams}
                      onChangeText={setPortionGrams}
                      keyboardType="decimal-pad"
                      editable={!busy}
                    />
                    {photoResult.questions.slice(0, 3).map((q) => (
                      <View key={q} style={{ marginTop: 8 }}>
                        <Text style={styles.q}>{q}</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Відповідь…"
                          value={answers[q] || ""}
                          onChangeText={(t) =>
                            setAnswers((a) => ({ ...a, [q]: t }))
                          }
                          editable={!busy}
                        />
                      </View>
                    ))}
                    <View style={{ marginTop: 10 }}>
                      <Button
                        title="Перерахувати"
                        onPress={refinePhoto}
                        disabled={busy}
                      />
                    </View>
                  </View>
                )}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>Продукти вдома (голос/текст)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder='Напр.: "2 яйця, курка, рис, огірок, сир"'
            value={pantryText}
            onChangeText={setPantryText}
            multiline
            editable={!busy}
          />
          <View style={styles.row}>
            <Button
              title={listening ? "Зупинити 🎙️" : "Говорити 🎙️"}
              onPress={toggleVoice}
              disabled={busy || !canVoice}
            />
            <View style={styles.spacer} />
            <Button title="Розібрати" onPress={parsePantry} disabled={busy} />
          </View>
          {pantryItems.length > 0 && (
            <Text style={styles.p}>
              Розібрано: {pantryItems.length} ·{" "}
              {pantryItems
                .slice(0, 12)
                .map((x) => x.name)
                .filter(Boolean)
                .join(", ")}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>Рецепти</Text>
          <Button
            title="Запропонувати рецепти"
            onPress={recommendRecipes}
            disabled={busy}
          />
          {!!recipesRaw && recipes.length === 0 && (
            <Text style={styles.p}>Діагностика (raw): {recipesRaw}</Text>
          )}
          {recipes.length > 0 &&
            recipes.map((r, idx) => (
              <View key={idx} style={styles.recipe}>
                <Text style={styles.bold}>{r.title || `Рецепт ${idx + 1}`}</Text>
                <Text style={styles.p}>
                  {r.timeMinutes ? `${r.timeMinutes} хв` : "—"} ·{" "}
                  {r.servings ? `${r.servings} порц.` : "—"} · ккал:{" "}
                  {fmt(r?.macros?.kcal)}
                </Text>
                {Array.isArray(r.ingredients) && r.ingredients.length > 0 && (
                  <Text style={styles.p}>
                    Інгредієнти: {r.ingredients.join(", ")}
                  </Text>
                )}
                {Array.isArray(r.steps) && r.steps.length > 0 && (
                  <Text style={styles.p}>
                    Кроки: {r.steps.slice(0, 6).join(" · ")}
                  </Text>
                )}
              </View>
            ))}
        </View>
      </ScrollView>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0f14" },
  container: {
    padding: 16,
    gap: 12,
  },
  h1: { color: "white", fontSize: 22, fontWeight: "700" },
  h2: { color: "white", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  h3: { color: "white", fontSize: 14, fontWeight: "700", marginBottom: 6 },
  p: { color: "#b8c4d6", fontSize: 13, lineHeight: 18 },
  bold: { color: "white", fontSize: 14, fontWeight: "700" },
  q: { color: "#c7d2fe", fontSize: 12, marginBottom: 4 },
  card: {
    backgroundColor: "#111827",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  row: { flexDirection: "row", alignItems: "center" },
  spacer: { width: 10 },
  image: { width: "100%", height: 220, borderRadius: 14 },
  input: {
    backgroundColor: "#0b1220",
    borderColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "white",
    fontSize: 14,
  },
  textarea: { minHeight: 96, textAlignVertical: "top" },
  result: { gap: 6 },
  recipe: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    gap: 4,
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.25)",
    borderWidth: 1,
    padding: 10,
    borderRadius: 14,
  },
  statusText: { color: "#fde68a", fontSize: 13, flex: 1 },
});

function fmt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

