// Maintainer-requested custom mode: the official campaign, then late waves with a boss every 15 endless rounds.
// [ASSUMED] Balance: final normal-round stats × (1 + 0.15n) HP / (1 + 0.08n) ATK,
// n starts at 1; recurring bosses use their original pool / ATK as the base, with the same growth.
// Counts, movement speed and timing stay bounded by the original templates.
import { GameData } from './gamedata.js';

export class EndlessGameData extends GameData {
  constructor(data, modeId) {
    super(data, modeId);
    this.endlessStartRound = 0;
    this.modeInactiveBonds.clear();
    const rounds = Object.keys(this.mode.rounds || {}).map(Number)
      .filter(r => Number.isInteger(r) && r > 0 && r < this.bossRound && this.mode.rounds[r]?.template)
      .sort((a, b) => a - b);
    this.endlessTemplates = rounds.slice(-3);
  }

  bans() { return { core: 0, addon: 0 }; }

  // Keep the original Hidden Core data; only its campaign slot can enter that fight.
  isHiddenRound(r) { return !this.endlessStep(r) && super.isHiddenRound(r); }

  endlessStep(r) { return this.endlessStartRound && r >= this.endlessStartRound ? r - this.endlessStartRound + 1 : 0; }

  isEndlessBossRound(r) { return this.endlessStep(r) > 0 && this.endlessStep(r) % 15 === 0; }

  isBossRound(r) { return super.isBossRound(r) || this.isEndlessBossRound(r); }

  bossRoundFor(r) {
    const n = this.endlessStep(r);
    return n ? this.endlessStartRound + Math.ceil(n / 15) * 15 - 1 : super.bossRoundFor(r);
  }

  bossHpScale(r) { return 1 + 0.15 * this.endlessStep(r); }

  sourceRound(r) {
    if (this.isEndlessBossRound(r)) return this.bossRound;
    const n = this.endlessStep(r);
    return n && this.endlessTemplates.length ? this.endlessTemplates[(n - 1) % this.endlessTemplates.length] : r;
  }

  roundCfg(r) { return super.roundCfg(this.sourceRound(r)); }

  income(r) {
    return super.income(this.endlessStep(r) ? this.endlessTemplates.at(-1) : r);
  }

  enemyScale(r) {
    const n = this.endlessStep(r);
    if (!n) return super.enemyScale(r);
    const base = super.enemyScale(this.isEndlessBossRound(r) ? this.bossRound : this.endlessTemplates.at(-1));
    return { ...base, hpMul: base.hpMul * (1 + 0.15 * n), atkMul: base.atkMul * (1 + 0.08 * n) };
  }
}
