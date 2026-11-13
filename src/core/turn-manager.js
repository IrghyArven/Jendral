/** Tracks turn order, passes, trick resets and finishing order. Pure bookkeeping, no card rules. */
export class TurnManager {
  constructor(n = 4) {
    this.n = n; this.finished = []; this.current = 0;
    this.lastPlayer = null; this.passed = new Set(); this.leading = true;
  }
  isActive(p) { return !this.finished.includes(p); }
  activePlayers() { return [...Array(this.n).keys()].filter((p) => this.isActive(p)); }
  nextActive(from, skipPassed = false) {
    for (let i = 1; i <= this.n; i++) {
      const p = (from + i) % this.n;
      if (this.isActive(p) && !(skipPassed && this.passed.has(p))) return p;
    }
    return null;
  }
  activeOrderAfter(player) {
    const out = [];
    for (let i = 1; i < this.n; i++) { const p = (player + i) % this.n; if (this.isActive(p)) out.push(p); }
    return out;
  }
  playerFinished(p) { if (!this.finished.includes(p)) this.finished.push(p); }
  recordPlay(p) {
    this.lastPlayer = p; this.leading = false; this.passed.clear();
    this.current = this.nextActive(p, true);
  }
  recordPass(p) {
    this.passed.add(p);
    const others = this.activePlayers().filter((q) => q !== this.lastPlayer);
    if (others.every((q) => this.passed.has(q))) {
      // Trick over: last successful player leads; if finished, next active player in turn order.
      const leader = this.isActive(this.lastPlayer) ? this.lastPlayer : this.nextActive(this.lastPlayer);
      this.passed.clear(); this.lastPlayer = null; this.leading = true; this.current = leader;
      return { trickEnded: true, leader };
    }
    this.current = this.nextActive(p, true);
    return { trickEnded: false };
  }
}
