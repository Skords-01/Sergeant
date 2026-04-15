export function Architecture() {
  const modules = [
    {
      id: "finyk",
      name: "Finyk",
      ua: "Фінанси",
      color: "bg-emerald-500",
      light: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-700",
      icon: "💳",
      pages: ["Огляд", "Транзакції", "Бюджети", "Активи", "Налаштування"],
      api: "/api/mono",
      desc: "Monobank інтеграція, категорії, бюджети, активи",
    },
    {
      id: "fizruk",
      name: "Fizruk",
      ua: "Тренування",
      color: "bg-blue-500",
      light: "bg-blue-50 border-blue-200",
      text: "text-blue-700",
      icon: "🏋️",
      pages: ["Сьогодні", "План", "Атлас", "Тренування", "Прогрес", "Виміри"],
      api: null,
      desc: "Щоденник тренувань, бібліотека вправ, графіки прогресу",
    },
    {
      id: "routine",
      name: "Routine",
      ua: "Звички",
      color: "bg-violet-500",
      light: "bg-violet-50 border-violet-200",
      text: "text-violet-700",
      icon: "✅",
      pages: ["Календар", "Звички"],
      api: null,
      desc: "Трекер звичок, стріки, єдиний календар модулів",
    },
    {
      id: "nutrition",
      name: "Nutrition",
      ua: "Харчування",
      color: "bg-orange-500",
      light: "bg-orange-50 border-orange-200",
      text: "text-orange-700",
      icon: "🥗",
      pages: ["Аналіз фото", "Щоденник", "Комора", "Рецепти"],
      api: "/api/nutrition/*",
      desc: "AI-аналіз їжі за фото, макро-трекер, Claude API",
    },
  ];

  const techStack = [
    { layer: "Frontend", items: ["React 18", "Vite 4", "Tailwind CSS 3", "PWA (manifest)"] },
    { layer: "Backend", items: ["Express.js 4", "Node.js 20", "In-memory rate limit"] },
    { layer: "AI / API", items: ["Anthropic Claude API", "Nutritionix API", "Monobank API"] },
    { layer: "Storage", items: ["localStorage (клієнт)", "Без БД (stateless API)"] },
    { layer: "Deployment", items: ["Replit (unified)", "Vercel (фронт)", "Railway (API)"] },
  ];

  return (
    <div
      className="min-h-screen bg-slate-50 p-8 font-sans"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-lg">
            🧩
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Мій простір</h1>
            <p className="text-sm text-slate-500">Технічна архітектура проєкту</p>
          </div>
        </div>
      </div>

      {/* Flow diagram */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Загальний потік</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: "Browser", color: "bg-slate-100 text-slate-700 border-slate-200" },
            { label: "→", color: "text-slate-400", bare: true },
            { label: "Vite Build → dist/", color: "bg-amber-50 text-amber-700 border-amber-200" },
            { label: "→", color: "text-slate-400", bare: true },
            { label: "Express (port 5000)", color: "bg-sky-50 text-sky-700 border-sky-200" },
            { label: "/api/*", color: "text-slate-400 text-xs", bare: true },
            { label: "Claude API", color: "bg-violet-50 text-violet-700 border-violet-200" },
          ].map((item, i) =>
            item.bare ? (
              <span key={i} className={`text-sm font-medium ${item.color}`}>{item.label}</span>
            ) : (
              <div key={i} className={`px-3 py-1.5 rounded-xl border text-sm font-medium ${item.color}`}>
                {item.label}
              </div>
            )
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {[
            { label: "React Router (hash)", color: "bg-slate-100 text-slate-700 border-slate-200" },
            { label: "→", color: "text-slate-400", bare: true },
            { label: "Hub", color: "bg-slate-800 text-white border-slate-800" },
            { label: "?module=...", color: "text-slate-400 text-xs", bare: true },
            { label: "Finyk", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            { label: "Fizruk", color: "bg-blue-50 text-blue-700 border-blue-200" },
            { label: "Routine", color: "bg-violet-50 text-violet-700 border-violet-200" },
            { label: "Nutrition", color: "bg-orange-50 text-orange-700 border-orange-200" },
          ].map((item, i) =>
            item.bare ? (
              <span key={i} className={`text-sm font-medium ${item.color}`}>{item.label}</span>
            ) : (
              <div key={i} className={`px-3 py-1.5 rounded-xl border text-sm font-medium ${item.color}`}>
                {item.label}
              </div>
            )
          )}
        </div>
      </div>

      {/* Modules grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {modules.map((mod) => (
          <div key={mod.id} className={`rounded-2xl border p-5 ${mod.light}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{mod.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{mod.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${mod.color} text-white`}>
                    {mod.ua}
                  </span>
                </div>
                <p className={`text-xs mt-0.5 ${mod.text}`}>{mod.desc}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {mod.pages.map((p) => (
                <span key={p} className="text-xs bg-white/70 border border-white/80 rounded-lg px-2 py-0.5 text-slate-600">
                  {p}
                </span>
              ))}
            </div>
            {mod.api && (
              <div className="flex items-center gap-1 mt-2">
                <span className="text-xs text-slate-400">API:</span>
                <code className={`text-xs font-mono ${mod.text} bg-white/60 px-1.5 py-0.5 rounded`}>{mod.api}</code>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tech stack */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Технічний стек</h2>
        <div className="grid grid-cols-5 gap-3">
          {techStack.map((layer) => (
            <div key={layer.layer}>
              <div className="text-xs font-semibold text-slate-500 mb-2">{layer.layer}</div>
              <div className="flex flex-col gap-1.5">
                {layer.items.map((item) => (
                  <div key={item} className="text-xs bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API routes */}
      <div className="mt-4 bg-slate-900 rounded-2xl p-5">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">API маршрути (Express)</h2>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ["GET /health", "Статус сервера"],
            ["POST /api/chat", "AI чат (Claude) · 30 req/хв"],
            ["POST /api/mono", "Monobank проксі · 60 req/хв"],
            ["POST /api/nutrition/analyze-photo", "Аналіз фото їжі"],
            ["POST /api/nutrition/parse-pantry", "Парсинг тексту комори"],
            ["POST /api/nutrition/recommend-recipes", "Рецепти з комори"],
            ["POST /api/nutrition/day-hint", "Підказка дня"],
            ["POST /api/nutrition/week-plan", "Тижневий план"],
            ["POST /api/nutrition/backup-upload", "Резервне копіювання"],
            ["GET /api/nutrition/backup-download", "Завантаження резерву"],
          ].map(([route, desc]) => (
            <div key={route} className="flex items-center gap-2">
              <code className="text-emerald-400 text-xs font-mono shrink-0">{route}</code>
              <span className="text-slate-500 text-xs">— {desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
