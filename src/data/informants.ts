// ── Informants ──
// Recurring contacts from the physical game's reference page. Static reference
// data, identical for every case and visible to both GM and players.

export interface Informant {
  name: string;
  /** Map lead reference, e.g. "38 EC". */
  location: string;
  description: string;
}

export const INFORMANTS: Informant[] = [
  {
    name: 'Sir Jasper Meeks',
    location: '38 EC',
    description:
      "Head Medical Examiner at Saint Bartholomew's hospital. He performs the autopsies on all bodies found during the investigations.",
  },
  {
    name: 'H.R. Murray',
    location: '22 SW',
    description: 'Criminologist. He analyses all items and substances found during cases.',
  },
  {
    name: 'Scotland Yard',
    location: '13 SW',
    description:
      'Police (represented by Inspectors Lestrade and Gregson). They have reports and details relating to the case.',
  },
  {
    name: "Disraeli O'Brian",
    location: '14 WC',
    description: 'Archivist with the Office of National Archives. Compiles legal and criminal records.',
  },
  {
    name: 'Somerset House',
    location: '17 WC',
    description: 'Records of births, deaths, marriages, and wills. Free access.',
  },
  {
    name: 'Edward Hall',
    location: '36 EC',
    description: 'Lawyer at the Old Bailey court. Source of information on court cases and legal affairs.',
  },
  {
    name: 'Porky Shinwell',
    location: '52 EC',
    description: 'Owner of the Raven and Rat pub. Source of information on all illegal affairs and underworld figures.',
  },
  {
    name: 'Fred Porlock',
    location: '18 NW',
    description:
      'Member of the criminal underground. Leaves coded information about the activities of Moriarty (leader of the criminal underground and sworn enemy of Holmes) at the Parsons & Son toy shop.',
  },
  {
    name: 'Henry Ellis',
    location: '30 EC',
    description: 'Reporter for the London Times. Source of information on current events, mainly on foreign affairs.',
  },
  {
    name: 'Quintin Hogg',
    location: '35 EC',
    description: 'Reporter for the Police Gazette. Source of information for criminal cases.',
  },
  {
    name: 'Mycroft Holmes',
    location: '8 SW',
    description: 'Eminence grise. Source of information on all things relating to politics and government.',
  },
  {
    name: 'Langdale Pike',
    location: '2 SW',
    description: 'Social columnist. Knows all London society gossip.',
  },
  {
    name: 'Central Carriage Depot',
    location: '5 WC',
    description: 'Meeting point for London cab drivers. Source of information on the movements of suspects.',
  },
  {
    name: 'Lomax',
    location: '5 SW',
    description: 'Librarian at the London Library. To be consulted for any encyclopedic research.',
  },
  {
    name: 'Sherlock Holmes',
    location: '42 NW',
    description:
      "If you're stuck in your investigation, Sherlock Holmes will set you back on track with some good advice. Be careful, that help could spoil the fun of investigating!",
  },
];
