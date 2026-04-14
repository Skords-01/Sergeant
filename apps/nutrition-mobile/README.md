## Nutrition mobile (iOS-first)

Це окремий Expo застосунок для модуля **Харчування** з нативним голосом (через `expo-speech-recognition`) і викликами існуючих ендпоїнтів `hub`:
- `/api/nutrition/analyze-photo`
- `/api/nutrition/refine-photo`
- `/api/nutrition/parse-pantry`
- `/api/nutrition/recommend-recipes`

### Налаштування
- Потрібно задати `EXPO_PUBLIC_API_BASE_URL` — базовий URL API: Vercel **або** окремий бекенд на Railway, напр.: `https://<твій-домен>.vercel.app` або `https://....up.railway.app`
- Опційно: `EXPO_PUBLIC_NUTRITION_API_TOKEN` — якщо на сервері виставлено `NUTRITION_API_TOKEN` (йде заголовком `X-Token`)

> Важливо: `EXPO_PUBLIC_*` змінні **видимі в клієнті**, це не “секрет”. Використовуй як легкий гейт для приватного деплою.

### Запуск
```bash
npm run start
```

Далі відкрий в **Expo Go** на iPhone (або Dev Client, якщо знадобляться додаткові нативні фічі).

### Голос
- На iOS веб (Safari/Chrome) голос часто **не працює** через обмеження браузера.
- В апці використовується `expo-speech-recognition` (iOS `SFSpeechRecognizer`).
- Потрібні дозволи на **Speech Recognition** та **Microphone** (система попросить автоматично).

