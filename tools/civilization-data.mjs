import { composeUnitRecord } from '../shared/standIn.js';
import { CIVILIZATION, SURVIVAL, SURVIVAL_MON3TR } from '../shared/civilization.js';

/** Extend generated records with the explicitly requested local strategy, without changing DIY picks. */
export function addCivilizationData(data) {
  const unit = data.backups?.units?.char_4179_monstr;
  const identity = data.chess?.chess_char_5_diy1_a;
  if (!unit || !identity) throw new Error('Civilization requires the existing Mon3tr unit forms');
  const rec = composeUnitRecord({ ...identity, chessId: SURVIVAL_MON3TR, baseId: SURVIVAL_MON3TR,
    goldenId: null, upgradeChessId: null, upgradeNum: 0, isDiy: false, isHidden: true,
    chessType: 'PRESET', backup: { charId: unit.charId, tmplId: null, skillIndex: 2, uniEquipId: null, potRank: 0 }, bonds: ['maniShip', 'emptyShip', SURVIVAL], garrisonIds: [] }, unit,
  unit.forms['2/1/4/0'], { skillIndex: 2 });
  rec.name = '存续·Mon3tr';
  rec.kitRef = 'char_4179_monstr';
  rec.skills = rec.skills.filter(skill => skill.index === 2);
  data.chess[SURVIVAL_MON3TR] = rec;
  data.bands[CIVILIZATION] = {
    ...data.bands.band_bldsk, bandId: CIVILIZATION, sortId: 1000, name: '凯尔希',
    iconId: 'char_003_kalts', effectId: CIVILIZATION, effectName: '文明的存续',
    desc: '首次出售每一等阶的精锐干员时，获得其初始特质的遗产。商店提升至五阶后，获得Mon3tr，Mon3tr将继承所有产生的遗产。',
    buffs: [{ key: 'civilization_survival', bb: {}, bbStr: {} }], bondIds: [],
  };
  data.bands[CIVILIZATION].descRaw = data.bands[CIVILIZATION].desc;
  data.bonds[SURVIVAL] = { ...data.bonds.emptyShip, bondId: SURVIVAL, name: '存续',
    identifier: 1000, activeCount: 1, thresholds: [1], noStack: true,
    iconId: data.bonds.maniShip.iconId, effectId: SURVIVAL, effectName: '存续',
    desc: 'Mon3tr在场时，继承的遗产特质按原时机生效。获得时特质在继承时结算，也可被其他效果再次触发。',
    buffs: [], bb: {}, bbStr: {}, spec: null, members: [SURVIVAL_MON3TR], visibleMembers: [],
  };
  for (const key of ['descRaw', 'effectDesc', 'effectDescRaw']) data.bonds[SURVIVAL][key] = data.bonds[SURVIVAL].desc;
  for (const id of ['maniShip', 'emptyShip']) {
    const members = data.bonds[id].members;
    if (!members.includes(SURVIVAL_MON3TR)) members.push(SURVIVAL_MON3TR);
  }
  data.effects[CIVILIZATION] = { ...data.effects[data.bands.band_pith.effectId],
    effectId: CIVILIZATION, name: '文明的存续', desc: data.bands[CIVILIZATION].desc,
    descRaw: data.bands[CIVILIZATION].desc, buffs: data.bands[CIVILIZATION].buffs };
  data.effects[SURVIVAL] = { ...data.effects[data.bonds.emptyShip.effectId],
    effectId: SURVIVAL, name: '存续', desc: data.bonds[SURVIVAL].desc,
    descRaw: data.bonds[SURVIVAL].desc, buffs: [] };
  return data;
}
