/**
 * React hook that boots the mobile SQLite read path for Routine
 * completions.
 */

import { useEffect, useRef } from "react";

import { useUser } from "@sergeant/api-client/react";

import { bootSqliteReadPath } from "../lib/sqliteReadBoot";

export function useSqliteReadBoot(): void {
  const { data: user } = useUser({
    retry: false,
    refetchOnWindowFocus: false,
  });
  const userId = user?.user?.id ?? null;
  const didBoot = useRef(false);

  useEffect(() => {
    if (didBoot.current || !userId) return;
    didBoot.current = true;
    void bootSqliteReadPath(userId);
  }, [userId]);
}
