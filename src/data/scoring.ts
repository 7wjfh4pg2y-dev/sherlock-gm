// ── The Final Reckoning ──
// Sherlock always scores the classic 100 in Consulting Detective; the team's
// tally is measured against it. The verdict tiers are shared by the GM preview
// and the player reveal so both always read the same thing.

export const HOLMES_SCORE = 100;

export interface Verdict {
  title: string;
  line: string;
}

/** Thematic verdict for a team score, judged against Holmes' benchmark of 100. */
export function verdictFor(score: number): Verdict {
  if (score >= HOLMES_SCORE)
    return {
      title: 'Beyond Baker Street',
      line: 'Extraordinary. You have bested Sherlock Holmes at his own game — a feat precious few can claim.',
    };
  if (score >= 80)
    return {
      title: 'A Worthy Rival',
      line: 'Holmes tips his hat. Your reasoning was sharp and your deductions sound.',
    };
  if (score >= 60)
    return {
      title: 'A Capable Detective',
      line: 'A solid investigation. Scotland Yard would do well to have you on the case.',
    };
  if (score >= 40)
    return {
      title: 'The Case Is Closed',
      line: 'You reached the truth — though by a longer, foggier road than Holmes would have taken.',
    };
  if (score >= 20)
    return {
      title: "Lestrade's Equal",
      line: 'The good Inspector would be proud. Holmes, one suspects, rather less so.',
    };
  return {
    title: 'The Trail Goes Cold',
    line: 'The villain slips away into the London fog. Some mysteries guard their secrets well.',
  };
}
