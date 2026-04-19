/**
 * Anthropic tool-use definitions + system-prompt префікс для `/api/chat`.
 *
 * Вилучено зі `server/modules/chat.ts` (колись ~970 LOC) у окремий файл, щоб
 * handler не розростався разом з каталогом інструментів. Всі tool-результати
 * виконуються клієнтом, сервер лише пересилає `tool_use`-блоки від моделі
 * й отримує назад `tool_results` — тому змінювати сигнатури tools треба
 * синхронно з frontend-виконавцями (`src/core/lib/hubChatActions.ts`).
 */

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export const TOOLS: AnthropicTool[] = [
  {
    name: "change_category",
    description:
      "Змінити категорію транзакції. Використовуй коли користувач просить перенести транзакцію в іншу категорію.",
    input_schema: {
      type: "object",
      properties: {
        tx_id: {
          type: "string",
          description: "ID транзакції з блоку [Останні операції]",
        },
        category_id: {
          type: "string",
          description: "ID категорії з блоку [Категорії]",
        },
      },
      required: ["tx_id", "category_id"],
    },
  },
  {
    name: "create_debt",
    description: "Створити новий борг (я винен комусь).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Назва боргу або кому винен" },
        amount: { type: "number", description: "Сума боргу в грн" },
        due_date: {
          type: "string",
          description: "Дата погашення YYYY-MM-DD (опціонально)",
        },
        emoji: {
          type: "string",
          description: "Емодзі (опціонально, за замовчуванням 💸)",
        },
      },
      required: ["name", "amount"],
    },
  },
  {
    name: "create_receivable",
    description: "Додати дебіторку (мені хтось винен).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Хто винен" },
        amount: { type: "number", description: "Сума в грн" },
      },
      required: ["name", "amount"],
    },
  },
  {
    name: "hide_transaction",
    description: "Приховати транзакцію зі статистики.",
    input_schema: {
      type: "object",
      properties: {
        tx_id: { type: "string", description: "ID транзакції" },
      },
      required: ["tx_id"],
    },
  },
  {
    name: "set_budget_limit",
    description: "Встановити або змінити ліміт бюджету для категорії.",
    input_schema: {
      type: "object",
      properties: {
        category_id: { type: "string", description: "ID категорії" },
        limit: { type: "number", description: "Ліміт в грн на місяць" },
      },
      required: ["category_id", "limit"],
    },
  },
  {
    name: "set_monthly_plan",
    description:
      "Задати або оновити місячний фінплан (планові дохід, витрати, заощадження у грн/міс). Можна передати лише ті поля, які змінюються.",
    input_schema: {
      type: "object",
      properties: {
        income: {
          type: "number",
          description: "Плановий дохід грн/міс (опційно)",
        },
        expense: {
          type: "number",
          description: "Планові витрати грн/міс (опційно)",
        },
        savings: {
          type: "number",
          description: "Планові заощадження грн/міс (опційно)",
        },
      },
    },
  },
  {
    name: "mark_habit_done",
    description:
      "Відмітити звичку як виконану на сьогодні (або на вказану дату). ID звички беріть з блоку [Рутина сьогодні].",
    input_schema: {
      type: "object",
      properties: {
        habit_id: {
          type: "string",
          // eslint-disable-next-line sergeant-design/no-ellipsis-dots -- pattern syntax for the LLM (id:<id> placeholder), not user-facing copy
          description: "ID звички (id:... з блоку [Рутина сьогодні])",
        },
        date: {
          type: "string",
          description: "Дата YYYY-MM-DD (опційно, за замовчуванням — сьогодні)",
        },
      },
      required: ["habit_id"],
    },
  },
  {
    name: "plan_workout",
    description:
      "Створити (запланувати) тренування у Фізруку на сьогодні або вказану дату/час. Можна додати список вправ із підходами/повтореннями/вагою.",
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description:
            "Дата тренування YYYY-MM-DD (опційно, за замовчуванням — сьогодні)",
        },
        time: {
          type: "string",
          description:
            "Час початку тренування HH:MM (опційно, за замовчуванням 09:00)",
        },
        note: {
          type: "string",
          description: "Коротка нотатка/назва тренування (опційно)",
        },
        exercises: {
          type: "array",
          description:
            "Список вправ. Кожна вправа: name (обов'язково), sets, reps, weight (опційно).",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Назва вправи" },
              sets: { type: "number", description: "Кількість підходів" },
              reps: { type: "number", description: "Повторень у підході" },
              weight: { type: "number", description: "Вага в кг" },
            },
            required: ["name"],
          },
        },
      },
    },
  },
  {
    name: "create_habit",
    description:
      "Створити нову звичку в модулі Рутина. Використовуй коли користувач просить додати / завести / почати нову звичку (напр. 'додай звичку пити воду', 'заведи пробіжку щопонеділка').",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Назва звички" },
        emoji: {
          type: "string",
          description: "Емодзі (опційно, за замовчуванням ✓)",
        },
        recurrence: {
          type: "string",
          description:
            "Регулярність: 'daily' (щодня), 'weekdays' (будні), 'weekly' (у конкретні дні тижня), 'monthly' (щомісяця). За замовчуванням — 'daily'.",
        },
        weekdays: {
          type: "array",
          description:
            "Для recurrence='weekly': номери днів 0-6 (0 — неділя, 1 — понеділок, …, 6 — субота). Опційно.",
          items: { type: "number" },
        },
        time_of_day: {
          type: "string",
          description: "Час доби HH:MM (опційно, напр. '08:00')",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "create_transaction",
    description:
      "Записати ручну витрату або дохід у Фінік. Використовуй коли користувач повідомляє що витратив/отримав кошти (напр. 'я витратив 200 грн на каву', 'запиши дохід 5000 грн').",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description:
            "'expense' (витрата) або 'income' (дохід). Default: expense.",
        },
        amount: {
          type: "number",
          description: "Сума в грн (завжди додатнє число)",
        },
        category: {
          type: "string",
          description:
            "Категорія: або id канонічної категорії (food, transport, restaurant, subscriptions, health тощо) з блоку [Категорії], або підпис manual-категорії (напр. 'їжа', 'транспорт'). Для доходу можна лишити порожнім.",
        },
        description: {
          type: "string",
          description: "Короткий опис / мерчант (опційно)",
        },
        date: {
          type: "string",
          description: "Дата YYYY-MM-DD (опційно, за замовчуванням — сьогодні)",
        },
      },
      required: ["amount"],
    },
  },
  {
    name: "log_set",
    description:
      "Додати підхід (set) до тренування у Фізрук. Використовуй коли користувач каже 'я зробив X повторень Y кг жиму/присіду' тощо. Якщо зараз є активне тренування — додає підхід до відповідної вправи; інакше — створює нове тренування на сьогодні й додає туди.",
    input_schema: {
      type: "object",
      properties: {
        exercise_name: {
          type: "string",
          description: "Назва вправи (напр. 'Жим штанги лежачи')",
        },
        weight_kg: {
          type: "number",
          description: "Вага в кг (0 — якщо власна вага)",
        },
        reps: { type: "number", description: "Кількість повторень у підході" },
        sets: {
          type: "number",
          description: "Скільки однакових підходів додати (опційно, default 1)",
        },
      },
      required: ["exercise_name", "reps"],
    },
  },
  {
    name: "log_water",
    description:
      "Додати випиту воду в журнал Харчування. Використовуй коли користувач каже 'я випив X мл/склянку води'. Одна склянка ≈ 250 мл.",
    input_schema: {
      type: "object",
      properties: {
        amount_ml: {
          type: "number",
          description: "Кількість випитої води в мілілітрах (напр. 250, 500)",
        },
        date: {
          type: "string",
          description: "Дата YYYY-MM-DD (опційно, за замовчуванням — сьогодні)",
        },
      },
      required: ["amount_ml"],
    },
  },
  {
    name: "log_meal",
    description:
      "Записати прийом їжі в щоденник харчування на сьогодні. Використовуй коли користувач каже що з'їв щось і хоче записати.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Назва страви або продукту",
        },
        kcal: {
          type: "number",
          description: "Калорії (ккал)",
        },
        protein_g: {
          type: "number",
          description: "Білок в грамах (опційно)",
        },
        fat_g: {
          type: "number",
          description: "Жири в грамах (опційно)",
        },
        carbs_g: {
          type: "number",
          description: "Вуглеводи в грамах (опційно)",
        },
      },
      required: ["name", "kcal"],
    },
  },
  // ── Фінік (розширені) ─────────────────────────────────────────────
  {
    name: "delete_transaction",
    description:
      "Видалити ручну транзакцію з Фініка. Приймає id ручної транзакції (починається з 'm_') — такий, як у блоці [Останні операції]. Монобанк-транзакції видалити не можна — для них використовуй hide_transaction. Ідемпотентно: якщо транзакції немає — повертає відповідне повідомлення.",
    input_schema: {
      type: "object",
      properties: {
        tx_id: {
          type: "string",
          description:
            // eslint-disable-next-line sergeant-design/no-ellipsis-dots -- pattern syntax for the LLM (m_<suffix> placeholder), not user-facing copy
            "ID ручної транзакції (формат 'm_...'). Напр. 'm_abc123'",
        },
      },
      required: ["tx_id"],
    },
  },
  {
    name: "update_budget",
    description:
      "Оновити або створити бюджет: або ліміт на категорію (scope='limit'), або ціль заощаджень (scope='goal'). Для ліміту потрібні category_id + limit. Для цілі — name + target_amount, опціонально saved_amount. Ідемпотентно (upsert).",
    input_schema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          description:
            "'limit' — ліміт витрат на категорію; 'goal' — ціль заощаджень",
        },
        category_id: {
          type: "string",
          description: "Для scope='limit': id категорії з блоку [Категорії]",
        },
        limit: {
          type: "number",
          description: "Для scope='limit': сума ліміту грн/міс",
        },
        name: {
          type: "string",
          description: "Для scope='goal': назва цілі (напр. 'Відпустка')",
        },
        target_amount: {
          type: "number",
          description: "Для scope='goal': цільова сума грн",
        },
        saved_amount: {
          type: "number",
          description: "Для scope='goal': вже накопичена сума грн (опційно)",
        },
      },
      required: ["scope"],
    },
  },
  {
    name: "mark_debt_paid",
    description:
      "Відмітити борг як (частково чи повністю) сплачений. Створює ручну витрату-погашення на вказану суму (якщо не задано — на суму боргу) і лінкує її до боргу (linkedTxIds). Якщо повна сума покрита — борг вважається закритим. ID боргу беріть з блоку [Борги].",
    input_schema: {
      type: "object",
      properties: {
        debt_id: {
          type: "string",
          // eslint-disable-next-line sergeant-design/no-ellipsis-dots -- pattern syntax for the LLM (d_<suffix> placeholder), not user-facing copy
          description: "ID боргу (формат 'd_...')",
        },
        amount: {
          type: "number",
          description:
            "Сума погашення грн (опційно; за замовчуванням — повна сума боргу)",
        },
        note: {
          type: "string",
          description: "Короткий опис транзакції (опційно)",
        },
      },
      required: ["debt_id"],
    },
  },
  {
    name: "add_asset",
    description:
      "Додати актив (вклад, готівка, нерухомість, авто тощо) у розділ Фінік/Активи.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Назва активу" },
        amount: { type: "number", description: "Сума грн (або в currency)" },
        currency: {
          type: "string",
          description: "Валюта 3 літери (опційно, default 'UAH')",
        },
      },
      required: ["name", "amount"],
    },
  },
  {
    name: "import_monobank_range",
    description:
      "Попросити Фінік перезавантажити транзакції з Монобанку за період YYYY-MM-DD..YYYY-MM-DD. Очищує кеш відповідних місяців і диспатчить подію, на яку реагує модуль Фінік. Сам імпорт виконується коли користувач відкриє Фінік (потрібен токен).",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Початкова дата YYYY-MM-DD" },
        to: { type: "string", description: "Кінцева дата YYYY-MM-DD" },
      },
      required: ["from", "to"],
    },
  },
  // ── Фізрук (розширені) ────────────────────────────────────────────
  {
    name: "start_workout",
    description:
      "Розпочати нове тренування зараз (або з вказаного часу). Зберігає як активне у Фізруку, щоб наступні log_set підходи записувались у нього. Якщо вже є активне — лише повідомляє про нього (ідемпотентно).",
    input_schema: {
      type: "object",
      properties: {
        note: { type: "string", description: "Коротка нотатка / назва" },
        date: {
          type: "string",
          description: "Дата YYYY-MM-DD (опційно, default — сьогодні)",
        },
        time: {
          type: "string",
          description: "Час початку HH:MM (опційно, default — зараз)",
        },
      },
    },
  },
  {
    name: "finish_workout",
    description:
      "Завершити поточне активне тренування (виставити endedAt=now) і прибрати активний статус. Якщо передано workout_id — завершує саме його. Ідемпотентно.",
    input_schema: {
      type: "object",
      properties: {
        workout_id: {
          type: "string",
          description:
            "ID тренування (опційно; default — поточне активне або останнє незавершене)",
        },
      },
    },
  },
  {
    name: "log_measurement",
    description:
      "Записати антропометрію у Фізрук/Заміри. Можна передавати лише ті поля, які виміряні. Додає новий запис у журнал замірів (не перезаписує попередні).",
    input_schema: {
      type: "object",
      properties: {
        weight_kg: { type: "number", description: "Вага кг" },
        body_fat_pct: { type: "number", description: "% жиру" },
        neck_cm: { type: "number", description: "Шия см" },
        chest_cm: { type: "number", description: "Груди см" },
        waist_cm: { type: "number", description: "Талія см" },
        hips_cm: { type: "number", description: "Стегна (обхват) см" },
        bicep_l_cm: { type: "number", description: "Біцепс лівий см" },
        bicep_r_cm: { type: "number", description: "Біцепс правий см" },
        thigh_l_cm: { type: "number", description: "Стегно лівий см" },
        thigh_r_cm: { type: "number", description: "Стегно правий см" },
        calf_l_cm: { type: "number", description: "Литка лівий см" },
        calf_r_cm: { type: "number", description: "Литка правий см" },
      },
    },
  },
  {
    name: "add_program_day",
    description:
      "Додати/оновити день тижневого шаблону програми тренувань (fizruk_plan_template_v1). weekday: 0=неділя..6=субота. Ідемпотентно: перезаписує день за weekday.",
    input_schema: {
      type: "object",
      properties: {
        weekday: {
          type: "number",
          description: "День тижня 0-6 (0=нд, 1=пн, …, 6=сб)",
        },
        name: { type: "string", description: "Назва тренування дня" },
        exercises: {
          type: "array",
          description: "Список вправ для дня",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Назва вправи" },
              sets: { type: "number", description: "Кількість підходів" },
              reps: { type: "number", description: "Повторень" },
              weight: { type: "number", description: "Вага кг" },
            },
            required: ["name"],
          },
        },
      },
      required: ["weekday", "name"],
    },
  },
  {
    name: "log_wellbeing",
    description:
      "Записати самопочуття у щоденний журнал Фізрука: сон, енергія 1-5, настрій 1-5, вага, нотатка. Можна передавати лише частину полів.",
    input_schema: {
      type: "object",
      properties: {
        weight_kg: { type: "number", description: "Вага кг" },
        sleep_hours: { type: "number", description: "Годин сну" },
        energy_level: { type: "number", description: "Енергія 1-5" },
        mood_score: { type: "number", description: "Настрій 1-5" },
        note: { type: "string", description: "Нотатка (опційно)" },
      },
    },
  },
  // ── Рутина (розширені) ────────────────────────────────────────────
  {
    name: "create_reminder",
    description:
      "Додати час нагадування HH:MM до звички у Рутині. ID звички — з блоку [Рутина сьогодні]. Ідемпотентно: якщо такий час вже є — не дублюється.",
    input_schema: {
      type: "object",
      properties: {
        habit_id: { type: "string", description: "ID звички" },
        time: { type: "string", description: "Час HH:MM (напр. '08:00')" },
      },
      required: ["habit_id", "time"],
    },
  },
  {
    name: "complete_habit_for_date",
    description:
      "Позначити або зняти позначку виконання звички на конкретну дату YYYY-MM-DD. Якщо completed=false — знімає позначку; default=true.",
    input_schema: {
      type: "object",
      properties: {
        habit_id: { type: "string", description: "ID звички" },
        date: { type: "string", description: "Дата YYYY-MM-DD" },
        completed: {
          type: "boolean",
          description: "true=позначити, false=зняти (default true)",
        },
      },
      required: ["habit_id", "date"],
    },
  },
  {
    name: "archive_habit",
    description:
      "Заархівувати звичку (прибрати зі списку активних) або повернути з архіву. Ідемпотентно.",
    input_schema: {
      type: "object",
      properties: {
        habit_id: { type: "string", description: "ID звички" },
        archived: {
          type: "boolean",
          description: "true=заархівувати (default), false=повернути з архіву",
        },
      },
      required: ["habit_id"],
    },
  },
  {
    name: "add_calendar_event",
    description:
      "Додати разову подію в календар Рутини (реалізовано як звичка recurrence='once' на одну дату). Корисно для нагадувань про зустріч, деньнародження тощо.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Назва події" },
        date: { type: "string", description: "Дата YYYY-MM-DD" },
        time: { type: "string", description: "Час HH:MM (опційно)" },
        emoji: { type: "string", description: "Емодзі (опційно)" },
      },
      required: ["name", "date"],
    },
  },
  // ── Харчування (розширені) ────────────────────────────────────────
  {
    name: "add_recipe",
    description:
      "Зберегти рецепт у книгу рецептів (IndexedDB). Напр. коли користувач каже 'збережи рецепт омлету з …'. Збереження асинхронне, повідомлення повертається одразу.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Назва рецепту" },
        ingredients: {
          type: "array",
          description: "Список інгредієнтів (рядки)",
          items: { type: "string" },
        },
        steps: {
          type: "array",
          description: "Кроки приготування (рядки)",
          items: { type: "string" },
        },
        servings: { type: "number", description: "Порцій" },
        time_minutes: { type: "number", description: "Час готування хв" },
        kcal: { type: "number", description: "Ккал на порцію (опційно)" },
        protein_g: { type: "number", description: "Білок г (опційно)" },
        fat_g: { type: "number", description: "Жири г (опційно)" },
        carbs_g: { type: "number", description: "Вуглеводи г (опційно)" },
      },
      required: ["title"],
    },
  },
  {
    name: "add_to_shopping_list",
    description:
      "Додати продукт у список покупок. Якщо такий вже є у відповідній категорії — оновлює кількість/нотатку (ідемпотентно по імені).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Назва продукту" },
        quantity: {
          type: "string",
          description: "Кількість (напр. '500 г', '2 шт')",
        },
        note: { type: "string", description: "Нотатка (опційно)" },
        category: {
          type: "string",
          description: "Категорія списку (опційно, default 'Інше')",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "consume_from_pantry",
    description:
      "Видалити / спожити продукт з активної комори (pantry). Ідемпотентно: якщо продукту немає — повертає відповідне повідомлення.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Назва продукту" },
      },
      required: ["name"],
    },
  },
  {
    name: "set_daily_plan",
    description:
      "Задати/оновити щоденні цілі Харчування: ккал, білок, жири, вуглеводи, ціль по воді (мл). Можна передавати лише ті поля, які змінюються.",
    input_schema: {
      type: "object",
      properties: {
        kcal: { type: "number", description: "Ціль ккал/день" },
        protein_g: { type: "number", description: "Ціль білка г/день" },
        fat_g: { type: "number", description: "Ціль жирів г/день" },
        carbs_g: { type: "number", description: "Ціль вуглеводів г/день" },
        water_ml: { type: "number", description: "Ціль води мл/день" },
      },
    },
  },
  {
    name: "log_weight",
    description:
      "Записати поточну вагу (кг) у щоденний журнал Фізрука. Аналог log_wellbeing, але лише з вагою — швидкий шлях для прокидання ваги.",
    input_schema: {
      type: "object",
      properties: {
        weight_kg: { type: "number", description: "Вага кг" },
        note: { type: "string", description: "Нотатка (опційно)" },
      },
      required: ["weight_kg"],
    },
  },
];

export const SYSTEM_PREFIX = `Ти персональний асистент додатку "Мій простір". Ти маєш доступ до 4 модулів: Фінік (фінанси), Фізрук (тренування), Рутина (щоденні звички) та Харчування (нутрієнти й калорії). Відповідай ТІЛЬКИ українською, стисло (2-4 речення).

ПРАВИЛА:
- Усі числа бери з блоку ДАНІ нижче.
- Якщо потрібно порахувати (середня/день, прогноз, залишок ліміту, відсоток виконання) — рахуй на основі наданих чисел.
- Якщо користувач просить змінити або записати дані — використай відповідний tool.
  - Фінанси: create_transaction, delete_transaction (лише ручні m_<id>), change_category, hide_transaction, create_debt, mark_debt_paid, create_receivable, set_budget_limit, update_budget (ліміт або ціль), set_monthly_plan, add_asset, import_monobank_range
  - Фізрук: start_workout / finish_workout, log_set, plan_workout, add_program_day, log_measurement, log_wellbeing
  - Рутина: create_habit, mark_habit_done, complete_habit_for_date, create_reminder, archive_habit, add_calendar_event
  - Харчування: log_meal, log_water, add_recipe, add_to_shopping_list, consume_from_pantry, set_daily_plan, log_weight
- Транзакції мають id і дату — використовуй для tool calls.
- Категорії та їх id перелічені в [Категорії].
- Відповідай на питання по всіх 4 модулях.

ДАНІ:
`;
