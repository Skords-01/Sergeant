import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const VALID_MODULES = new Set(["finyk", "fizruk", "routine", "nutrition"]);

export type HubModuleId = "finyk" | "fizruk" | "routine" | "nutrition";

export interface OpenModuleOptions {
  hash?: string | null;
}

export interface HubNavigation {
  activeModule: HubModuleId | null;
  openModule: (id: string | null | undefined, opts?: OpenModuleOptions) => void;
  goToHub: () => void;
  moduleAnimClass: "module-enter" | "hub-enter";
}

function parseModule(value: string | null): HubModuleId | null {
  if (value && VALID_MODULES.has(value)) return value as HubModuleId;
  return null;
}

export function useHubNavigation(): HubNavigation {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialModule = parseModule(searchParams.get("module"));

  const [activeModule, setActiveModule] = useState<HubModuleId | null>(
    initialModule,
  );
  const [moduleAnimClass, setModuleAnimClass] = useState<
    "module-enter" | "hub-enter"
  >("module-enter");

  const goToHub = useCallback(() => {
    setModuleAnimClass("hub-enter");
    setActiveModule(null);
    navigate("/", { replace: false });
  }, [navigate]);

  const openModule = useCallback(
    (id: string | null | undefined, opts: OpenModuleOptions = {}) => {
      const nextId = String(id ?? "").trim();
      if (!VALID_MODULES.has(nextId)) return;
      const typedId = nextId as HubModuleId;
      const isSame = typedId === activeModule;

      let hashStr = "";
      try {
        const raw = opts.hash != null ? String(opts.hash).trim() : "";
        if (raw) {
          hashStr = raw.startsWith("#") ? raw : `#${raw}`;
          window.location.hash = hashStr;
        } else if (!isSame) {
          window.location.hash = "";
        }
      } catch {
        /* ignore */
      }

      setModuleAnimClass("module-enter");
      setActiveModule(typedId);
      navigate(`/?module=${typedId}${hashStr}`, { replace: false });
    },
    [activeModule, navigate],
  );

  useEffect(() => {
    const mod = parseModule(searchParams.get("module"));
    if (mod !== activeModule) {
      setModuleAnimClass(mod ? "module-enter" : "hub-enter");
      setActiveModule(mod);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return { activeModule, openModule, goToHub, moduleAnimClass };
}
