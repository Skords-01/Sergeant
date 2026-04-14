## Nutrition mobile (iOS-first)

Це окремий Expo застосунок для модуля **Харчування** з нативним голосом (через `expo-speech-recognition`) і викликами існуючих ендпоїнтів `hub`:
- `/api/nutrition/analyze-photo`
- `/api/nutrition/refine-photo`
- `/api/nutrition/parse-pantry`
- `/api/nutrition/recommend-recipes`

### Налаштування
- Потрібно задати `EXPO_PUBLIC_API_BASE_URL` — базовий URL твого деплою `hub` (Vercel), напр.: `https://<твій-домен>.vercel.app`

### Запуск
```bash
npm run start
```

Далі відкрий в **Expo Go** на iPhone (або Dev Client, якщо знадобляться додаткові нативні фічі).

### Голос
- На iOS веб (Safari/Chrome) голос часто **не працює** через обмеження браузера.
- В апці використовується `expo-speech-recognition` (iOS `SFSpeechRecognizer`).
- Потрібні дозволи на **Speech Recognition** та **Microphone** (система попросить автоматично).

