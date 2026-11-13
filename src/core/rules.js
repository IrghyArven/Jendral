// All uncertain / configurable rules live HERE, isolated from engine logic.
// See README "Asumsi aturan" for the reasoning behind each default.
export const DEFAULT_RULES = Object.freeze({
  trisGandengan: Object.freeze({
    // Uncertainty #2: may a Joker replace a card in Tris gandengan? Default: no.
    allowJoker: false,
    // Uncertainty #1: tie on triple rank is impossible with one deck (only 4 cards per rank),
    // so comparison is by triple rank only.
  }),
  tangga: Object.freeze({
    minLength: 3,
    allowTwo: false, // '2' is the top card and is not used in a ladder (A-2 / 2-3 ambiguity).
    leadAnyLength: true, // Uncertainty #3: leader may choose any length >= minLength.
  }),
  jenderal: Object.freeze({
    // Uncertainty #5: 'anyOtherPlayer' = every other player holding four of a kind gets an
    // opportunity (in turn order). Alternative: 'nextPlayerOnly'.
    eligibility: 'anyOtherPlayer',
  }),
  // Uncertainty #4: one combination per turn (no multiple Tris/Tangga in a single turn).
  multipleCombosPerTurn: false,
});

export function mergeRules(overrides = {}) {
  return Object.freeze({
    ...DEFAULT_RULES,
    ...overrides,
    trisGandengan: { ...DEFAULT_RULES.trisGandengan, ...(overrides.trisGandengan || {}) },
    tangga: { ...DEFAULT_RULES.tangga, ...(overrides.tangga || {}) },
    jenderal: { ...DEFAULT_RULES.jenderal, ...(overrides.jenderal || {}) },
  });
}

export function isRankAllowedInTangga(rank, rules = DEFAULT_RULES) {
  return rank !== '2' || rules.tangga.allowTwo;
}
