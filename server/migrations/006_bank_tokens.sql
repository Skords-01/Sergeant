-- PR: server-side encrypted vault для банківських credentials.
--
-- Контекст. До цієї міграції Monobank personal token і PrivatBank merchant
-- id/token зберігалися в `localStorage` браузера і надсилалися в заголовках
-- кожного запиту до `/api/mono` і `/api/privat`. Monobank personal token
-- довгоживучий (не ротується, не має scoped-permissions) — один XSS на
-- PWA-домені спричиняє повну компрометацію фінансових даних користувача.
--
-- Рішення: вивести credentials у серверне сховище, шифроване AES-256-GCM
-- ключем з env (`BANK_TOKEN_ENC_KEY`). Фронт ніколи більше не бачить
-- відкритого токена після його збереження; замість цього знає лише
-- boolean "провайдер підключений".
--
-- Схема:
-- ─ user_id     — власник, FK до `user` (better-auth-таблиця).
-- ─ provider    — enum-like TEXT ('monobank' | 'privatbank'), частина PK.
-- ─ ciphertext  — зашифрований JSON payload (рядок-токен для Mono,
--                 {"id": "...", "token": "..."} для Privat).
-- ─ iv          — 12-байтний nonce GCM (унікальний на кожне шифрування).
-- ─ auth_tag    — 16-байтний GCM auth-tag (витягується з encrypted-блока).
-- ─ key_id      — позначка, яким ключем зашифровано (для майбутньої
--                 ротації: поточний ключ 'v1', після rotate додасться 'v2',
--                 старі рядки читаються старим ключем за key_id).
-- ─ created_at  — для observability, коли саме юзер підключив банк.
-- ─ updated_at  — оновлюється при повторному збереженні (reconnect).
--
-- `UNIQUE(user_id, provider)` — один рядок на юзера-провайдера. Reconnect
-- робить UPSERT, а не створює новий рядок.

CREATE TABLE IF NOT EXISTS bank_tokens (
  user_id     TEXT NOT NULL,
  provider    TEXT NOT NULL,
  ciphertext  BYTEA NOT NULL,
  iv          BYTEA NOT NULL,
  auth_tag    BYTEA NOT NULL,
  key_id      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, provider)
);

-- CHECK-и ловлять очевидні помилки в коді (напр. випадкове порожнє
-- ім'я провайдера або не-GCM розмір IV/tag). Ідемпотентні через
-- pg_constraint-лукап — міграцію можна переграти на існуючій БД.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_tokens_provider_enum'
  ) THEN
    ALTER TABLE bank_tokens
      ADD CONSTRAINT bank_tokens_provider_enum
        CHECK (provider IN ('monobank', 'privatbank'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_tokens_iv_length'
  ) THEN
    ALTER TABLE bank_tokens
      ADD CONSTRAINT bank_tokens_iv_length
        CHECK (octet_length(iv) = 12);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_tokens_auth_tag_length'
  ) THEN
    ALTER TABLE bank_tokens
      ADD CONSTRAINT bank_tokens_auth_tag_length
        CHECK (octet_length(auth_tag) = 16);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_tokens_ciphertext_nonempty'
  ) THEN
    ALTER TABLE bank_tokens
      ADD CONSTRAINT bank_tokens_ciphertext_nonempty
        CHECK (octet_length(ciphertext) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_tokens_key_id_nonempty'
  ) THEN
    ALTER TABLE bank_tokens
      ADD CONSTRAINT bank_tokens_key_id_nonempty
        CHECK (char_length(key_id) > 0);
  END IF;
END $$;
