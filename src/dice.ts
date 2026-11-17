export type Mode = 'normal' | 'advantage' | 'disadvantage';
export interface DiceTerm { sign: number; count: number; sides: number; keep?: 'kh' | 'kl'; keepCount?: number }
export type Term = DiceTerm | { sign: number; constant: number };
export interface RollGroup { sides: number; sign: number; values: number[]; kept: boolean[] }
export interface Roll { id: string; expression: string; label: string; mode: Mode; groups: RollGroup[]; modifier: number; total: number; dc: number | null; critical: 'high' | 'low' | null; time: number }

export function parseExpression(input: string): Term[] {
  const text = input.toLowerCase().replace(/\s+/g, '');
  if (!text || text.length > 120) throw new Error('Enter a dice expression, up to 120 characters.');
  const parts = text.match(/[+-]?[^+-]+/g);
  if (!parts || parts.join('') !== text || parts.length > 12) throw new Error('Use dice and modifiers, for example 2d6+3.');
  let diceCount = 0;
  const terms = parts.map((part): Term => {
    const sign = part.startsWith('-') ? -1 : 1;
    const token = part.replace(/^[+-]/, '');
    const match = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/.exec(token);
    if (match) {
      const count = Number(match[1] || 1), sides = Number(match[2]);
      const keep = match[3] as 'kh' | 'kl' | undefined;
      const keepCount = keep ? Number(match[4]) : undefined;
      diceCount += count;
      if (!Number.isInteger(count) || count < 1 || diceCount > 100) throw new Error('Roll between 1 and 100 dice at a time.');
      if (!Number.isInteger(sides) || sides < 2 || sides > 1000) throw new Error('Dice must have between 2 and 1,000 sides.');
      if (keepCount !== undefined && (keepCount < 1 || keepCount > count)) throw new Error('Keep at least one die, and no more than you roll.');
      return { sign, count, sides, keep, keepCount };
    }
    if (!/^\d+$/.test(token) || Number(token) > 100000) throw new Error('Use notation like d20+5, 2d6, or 4d6kh3. Modifiers may be up to 100,000.');
    return { sign, constant: Number(token) };
  });
  if (!diceCount) throw new Error('Include at least one die, such as d20.');
  return terms;
}

// Rejection sampling avoids modulo bias. Animation never determines results.
export function randomDie(sides: number): number {
  const buffer = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / sides) * sides;
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % sides + 1;
}

export function rollDice(expression: string, mode: Mode = 'normal', label = '', dc: number | null = null, random = randomDie): Roll {
  const terms = parseExpression(expression);
  const dice = terms.filter((term): term is DiceTerm => 'sides' in term);
  if (mode !== 'normal') {
    if (dice.length !== 1 || dice[0].count !== 1 || dice[0].sides !== 20 || dice[0].keep || dice[0].sign < 0) throw new Error('Advantage and disadvantage require a single d20, with optional modifiers.');
    dice[0].count = 2;
    dice[0].keep = mode === 'advantage' ? 'kh' : 'kl';
    dice[0].keepCount = 1;
  }
  if (dc !== null && (!Number.isInteger(dc) || dc < 1 || dc > 100000)) throw new Error('Target DC must be a whole number from 1 to 100,000.');
  let modifier = 0;
  const groups: RollGroup[] = [];
  for (const term of terms) {
    if ('constant' in term) { modifier += term.sign * term.constant; continue; }
    const values = Array.from({ length: term.count }, () => random(term.sides));
    const indices = values.map((_, i) => i).sort((a, b) => term.keep === 'kl' ? values[a] - values[b] : values[b] - values[a]);
    const selected = new Set(indices.slice(0, term.keepCount ?? term.count));
    groups.push({ sides: term.sides, sign: term.sign, values, kept: values.map((_, i) => selected.has(i)) });
  }
  const total = groups.reduce((sum, group) => sum + group.sign * group.values.reduce((s, v, i) => s + (group.kept[i] ? v : 0), 0), modifier);
  const singleD20 = groups.length === 1 && groups[0].sides === 20 && groups[0].sign === 1 && groups[0].kept.filter(Boolean).length === 1;
  const natural = singleD20 ? groups[0].values.find((_, i) => groups[0].kept[i]) : undefined;
  return { id: crypto.randomUUID(), expression: expression.toLowerCase().replace(/\s+/g, ''), label: label.trim().slice(0, 80), mode, groups, modifier, total, dc, critical: natural === 20 ? 'high' : natural === 1 ? 'low' : null, time: Date.now() };
}

export function formatRoll(roll: Roll): string {
  const groups = roll.groups.map(g => `${g.sign < 0 ? '−' : '+'}[${g.values.map((v, i) => g.kept[i] ? v : `(${v} dropped)`).join(', ')}]`).join(' ').replace(/^\+/, '');
  return `${roll.label ? `${roll.label}: ` : ''}${roll.expression}${roll.mode !== 'normal' ? ` (${roll.mode})` : ''} → ${groups}${roll.modifier ? ` ${roll.modifier > 0 ? '+' : '−'} ${Math.abs(roll.modifier)}` : ''} = ${roll.total}${roll.critical ? ` · Natural ${roll.critical === 'high' ? 20 : 1}` : ''}${roll.dc !== null ? ` · DC ${roll.dc}: ${roll.total >= roll.dc ? 'PASS' : 'FAIL'}` : ''}`;
}

export function parseCommand(command: string) {
  const [body, ...labels] = command.split('#');
  let expression = body.trim();
  let dc: number | null = null;
  expression = expression.replace(/\s+dc\s*(\d+)\s*$/i, (_, value: string) => { dc = Number(value); return ''; });
  let mode: Mode = 'normal';
  expression = expression.replace(/\s+(adv|dis)\s*$/i, (_, value: string) => { mode = value.toLowerCase() === 'adv' ? 'advantage' : 'disadvantage'; return ''; });
  return { expression: expression.trim(), mode, dc, label: labels.join('#').trim() };
}

export function extractCommands(content: string): string[] {
  const text = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const commands: string[] = [];
  const pattern = /^\s*\/roll\b([^\n]*)|\[\[roll\s+([^\]\n]+)\]\]/gim;
  for (const match of text.matchAll(pattern)) commands.push((match[1] ?? match[2]).trim());
  if (commands.length > 10) throw new Error('Use no more than 10 roll commands in one message.');
  return commands;
}
