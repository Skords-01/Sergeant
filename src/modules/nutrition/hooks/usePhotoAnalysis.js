import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { fileToBase64 } from "../lib/fileToBase64.js";
import {
  analyzePhoto as apiAnalyzePhoto,
  refinePhoto as apiRefinePhoto,
} from "../lib/nutritionApi.js";

export function usePhotoAnalysis({ setBusy, setErr, setStatusText }) {
  const fileRef = useRef(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoResult, setPhotoResult] = useState(null);
  const [lastPhotoPayload, setLastPhotoPayload] = useState(null);
  const [answers, setAnswers] = useState({});
  const [portionGrams, setPortionGrams] = useState("");

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        try {
          URL.revokeObjectURL(photoPreviewUrl);
        } catch {
          /* ignore */
        }
      }
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    if (photoResult && Array.isArray(photoResult.questions)) {
      setAnswers((cur) => {
        const next = { ...cur };
        photoResult.questions.slice(0, 6).forEach((q) => {
          if (next[q] == null) next[q] = "";
        });
        return next;
      });
    }
  }, [photoResult]);

  const onPickPhoto = async (file) => {
    setErr("");
    setPhotoResult(null);
    if (!file) return;
    if (!/^image\//.test(file.type || "")) {
      setErr("Обери файл зображення (jpg/png/heic).");
      return;
    }
    if (file.size > 4.5 * 1024 * 1024) {
      setErr(
        "Фото завелике для швидкого аналізу. Обріж або стисни (≈ до 4 МБ).",
      );
      return;
    }
    try {
      if (photoPreviewUrl) {
        try {
          URL.revokeObjectURL(photoPreviewUrl);
        } catch {
          /* ignore */
        }
      }
      const url = URL.createObjectURL(file);
      setPhotoPreviewUrl(url);
    } catch {
      /* ignore */
    }
  };

  // ─── Analyze photo ──────────────────────────────────────────────────────
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("Спочатку обери фото.");
      const b64 = await fileToBase64(file);
      const payload = {
        image_base64: b64,
        mime_type: file.type || "image/jpeg",
        locale: "uk-UA",
      };
      setLastPhotoPayload(payload);
      return apiAnalyzePhoto(payload);
    },
    onMutate: () => {
      setBusy(true);
      setErr("");
      setStatusText("Аналізую фото…");
      setPhotoResult(null);
      setAnswers({});
      setPortionGrams("");
    },
    onSuccess: (data) => {
      setPhotoResult(data?.result || null);
    },
    onError: (err) => {
      setErr(err?.message || "Помилка аналізу фото");
    },
    onSettled: () => {
      setStatusText("");
      setBusy(false);
    },
  });

  const analyzePhoto = useCallback(
    () => analyzeMutation.mutate(),
    [analyzeMutation],
  );

  // ─── Refine photo ───────────────────────────────────────────────────────
  const refineMutation = useMutation({
    mutationFn: () => {
      if (!lastPhotoPayload)
        throw new Error("Немає вихідного фото. Спочатку зроби аналіз.");
      const questions = Array.isArray(photoResult?.questions)
        ? photoResult.questions.slice(0, 6)
        : [];
      const qna = questions
        .map((q) => ({ question: q, answer: String(answers[q] || "").trim() }))
        .filter((x) => x.answer);
      const grams = Number(String(portionGrams).replace(",", "."));
      return apiRefinePhoto({
        ...lastPhotoPayload,
        prior_result: photoResult,
        portion_grams: Number.isFinite(grams) && grams > 0 ? grams : null,
        qna,
        locale: "uk-UA",
      });
    },
    onMutate: () => {
      setBusy(true);
      setErr("");
      setStatusText("Уточнюю порцію та перераховую…");
    },
    onSuccess: (data) => {
      setPhotoResult(data?.result || null);
    },
    onError: (err) => {
      setErr(err?.message || "Помилка уточнення");
    },
    onSettled: () => {
      setStatusText("");
      setBusy(false);
    },
  });

  const refinePhoto = useCallback(
    () => refineMutation.mutate(),
    [refineMutation],
  );

  return {
    fileRef,
    photoPreviewUrl,
    photoResult,
    lastPhotoPayload,
    answers,
    setAnswers,
    portionGrams,
    setPortionGrams,
    onPickPhoto,
    analyzePhoto,
    refinePhoto,
  };
}
