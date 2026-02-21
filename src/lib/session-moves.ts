// PLACEHOLDER: Replace with real physio-designed content before launch.

export interface SessionMove {
  name: string;
  prescription: string;
  notes?: string;
}

export const LATE_GAME_LEGS_MOVES: SessionMove[] = [
  { name: "Hip flexor lunge stretch", prescription: "30s each side", notes: "Keep torso upright" },
  { name: "Glute bridge hold", prescription: "2 × 12 reps" },
  { name: "Calf raise (slow eccentric)", prescription: "2 × 15 reps" },
  { name: "Single-leg balance", prescription: "30s each side" },
  { name: "Step-up hold", prescription: "8 reps each side" },
];

export const INJURY_PREVENTION_MOVES: SessionMove[] = [
  { name: "Nordic curl (partial)", prescription: "3 × 6 reps", notes: "Controlled descent only" },
  { name: "Copenhagen side plank", prescription: "20s each side" },
  { name: "Standing hamstring stretch", prescription: "30s each side" },
  { name: "Groin adductor slide", prescription: "10 reps each side" },
  { name: "Hip 90/90 rotation", prescription: "8 reps each side" },
];

export function getMovesForFocus(
  focus: "late_game" | "injury_prevention",
): SessionMove[] {
  return focus === "late_game"
    ? LATE_GAME_LEGS_MOVES
    : INJURY_PREVENTION_MOVES;
}
