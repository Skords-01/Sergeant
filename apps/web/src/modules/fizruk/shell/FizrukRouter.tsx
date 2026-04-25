import { Dashboard } from "../pages/Dashboard";
import { Atlas } from "../pages/Atlas";
import { Exercise } from "../pages/Exercise";
import { Workouts } from "../pages/Workouts";
import { Progress } from "../pages/Progress";
import { Measurements } from "../pages/Measurements";
import { Body } from "../pages/Body";
import { Programs } from "../pages/Programs";
import { PlanCalendar } from "../pages/PlanCalendar";
import type { FizrukPage } from "./fizrukRoute";

export interface FizrukRouterProps {
  page: FizrukPage;
  exerciseId?: string;
  activeProgramId: string | null;
  activeProgram: unknown;
  activateProgram: (id: string | null) => void;
  deactivateProgram: () => void;
  todaySession: unknown;
  onNavigate: (page: FizrukPage) => void;
  onStartProgramWorkout: (session: unknown, program: unknown) => void;
  onOpenModule?: (moduleId: string, opts?: { hash?: string }) => void;
}

/**
 * Thin page switch for Fizruk. Kept here (instead of inlining in
 * FizrukApp) so adding/removing pages touches one small file and the
 * top-level App stays focused on orchestration.
 */
export function FizrukRouter({
  page,
  exerciseId,
  activeProgramId,
  activeProgram,
  activateProgram,
  deactivateProgram,
  todaySession,
  onNavigate,
  onStartProgramWorkout,
  onOpenModule,
}: FizrukRouterProps) {
  switch (page) {
    case "dashboard":
      return (
        <Dashboard
          onOpenPrograms={() => onNavigate("programs")}
          activeProgram={activeProgram}
          todaySession={todaySession}
          onStartProgramWorkout={onStartProgramWorkout}
        />
      );
    case "plan":
      return (
        <PlanCalendar
          onOpenRoutine={
            onOpenModule ? () => onOpenModule("routine") : undefined
          }
        />
      );
    case "atlas":
      return <Atlas />;
    case "workouts":
      return <Workouts />;
    case "progress":
      return <Progress />;
    case "measurements":
      return <Measurements />;
    case "programs":
      return (
        <Programs
          onStartWorkout={onStartProgramWorkout}
          activeProgramId={activeProgramId}
          activeProgram={activeProgram}
          activateProgram={activateProgram}
          deactivateProgram={deactivateProgram}
        />
      );
    case "body":
      return <Body onOpenMeasurements={() => onNavigate("measurements")} />;
    case "exercise":
      return <Exercise exerciseId={exerciseId} />;
    default:
      return null;
  }
}
