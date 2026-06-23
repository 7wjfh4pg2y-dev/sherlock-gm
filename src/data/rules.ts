// ── Game rules ──
// Condensed from the physical game's rulebook (setup, turn structure, scoring).
// Static reference shown in a modal from the header on both screens.

export interface RuleSection {
  heading: string;
  paragraphs: string[];
}

export const RULES_INTRO =
  'You are members of the Baker Street Irregulars, the unofficial gang founded by ' +
  'Sherlock Holmes to keep him informed of the word on the street. Working together, ' +
  'you follow leads across Victorian London to solve the case — then measure yourselves ' +
  'against the master himself.';

export const RULES_SECTIONS: RuleSection[] = [
  {
    heading: 'How to Play',
    paragraphs: [
      'Everyone cooperates to solve a single case. You have the Case Brief, a map of London, a directory of addresses, the list of informants, and the day\'s newspapers (plus all earlier ones).',
      'To investigate an address, find it in the Directory and follow the matching lead — for example, Holmes lives at 42 NW. Each lead corresponds to a place on the map. Informants are recurring contacts who can help; it is up to you to decide when a lead is worth calling on one of them.',
      'You may consult the directory, the informants, and the newspapers freely at any time, and reread leads you have already followed as much as you like.',
    ],
  },
  {
    heading: 'Taking Turns',
    paragraphs: [
      'The game runs over a series of turns. On each turn the lead investigator picks one lead to follow, and that lead is read aloud and marked as visited. Their turn is then over.',
      'Play passes to the next person, who becomes the new lead investigator and chooses a lead of their own. On a single turn a player may only follow one lead.',
      'You may discuss freely and follow as many leads as you wish across the game, but if there is a disagreement about the next destination, the current lead investigator has the final word.',
    ],
  },
  {
    heading: 'Scoring',
    paragraphs: [
      'When you believe you have solved the case, stop following leads and answer the case\'s questions. The first series relates directly to the case; the second awards bonus points for related discoveries. Then read Holmes\'s solution and tally your score.',
      'Holmes always scores 100 points. Compare the number of leads you followed to the number Holmes needed: for every lead more than Holmes you subtract 5 points, and for every lead fewer than Holmes you add 5 points. (Some leads are marked "free" in the solution and do not count.)',
      'For example: you answer the questions for 95 points and followed 8 leads, while Holmes finished in 6. Two extra leads cost 10 points, leaving a final score of 85. Defeating the master is hard — but not impossible!',
    ],
  },
];
