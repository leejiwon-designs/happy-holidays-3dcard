export type CityId = 'toronto' | 'seoul' | 'vancouver' | 'brussels';

export type OrnamentId =
  | 'espresso-martini'
  | 'kirby'
  | 'rubber-duck'
  | 'cinnamoroll'
  | 'lord-farquaad'
  | 'french-fries'
  | 'kiwi'
  | 'empanada'
  | 'volleyball'
  | 'cat'
  | 'dog'
  | 'wallet'
  | 'laptop'
  | 'daisy'
  | 'hamster'
  | 'fish'
  | 'eiffel-tower'
  | 'mistletoe'
  | 'tequila-bottle'
  | 'film-slate'
  | 'honey-bee'
  | 'acrylic-paint'
  | 'pizza-slice'
  | 'banana';

export interface OrnamentMeta {
  id: OrnamentId;
  label: string;
  shortLabel: string;
  accentHex: string;
  hint: string;
}

export interface CityTheme {
  id: CityId;
  name: string;
  localLabel: string;
  tagline: string;
  cardWish: string;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  cardPaper: string;
  cardPaperShadow: string;
  cardDeckTint: string;
  wallSkyTop: string;
  wallSkyBottom: string;
  redAccent: string;
  redShadow: string;
  greenAccent: string;
  greenShadow: string;
  goldAccent: string;
  goldShadow: string;
  uiInkColor: string;
  uiHalo: string;
}

export interface TreeHookSlot {
  index: number;
  position: [number, number, number];
  outwardAngle: number;
  tier: number;
}

export interface PlacedOrnamentInfo {
  instanceId: string;
  ornamentId: OrnamentId;
  slotIndex: number;
}
