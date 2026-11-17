import { describe, expect, it, vi } from 'vitest';
import { extractCommands, formatRoll, parseCommand, parseExpression, randomDie, rollDice } from '../src/dice';
const sequence = (...values: number[]) => { let index = 0; return () => values[index++]; };
describe('dice arithmetic', () => {
  it('adds dice, subtracts dice, and combines signed modifiers', () => {
    expect(rollDice('2d6 + d8 - d4 + 5 - 2', 'normal', '', null, sequence(2, 6, 7, 3)).total).toBe(15);
  });
  it('keeps exactly the requested number when values tie', () => {
    const result = rollDice('4d6kh3', 'normal', '', null, sequence(6, 6, 2, 2));
    expect(result.total).toBe(14);
    expect(result.groups[0].kept.filter(Boolean)).toHaveLength(3);
  });
  it('supports lowest dice and negative groups', () => {
    expect(rollDice('2d6kl1-d4', 'normal', '', null, sequence(6, 2, 4)).total).toBe(-2);
  });
  it('advantage uses the higher d20 and recognizes natural 20 before modifiers', () => {
    const result = rollDice('d20+5', 'advantage', 'Stealth', 25, sequence(1, 20));
    expect(result.total).toBe(25);
    expect(result.critical).toBe('high');
    expect(formatRoll(result)).toContain('DC 25: PASS');
    expect(formatRoll(result)).toContain('(1 dropped)');
  });
  it('disadvantage uses the lower d20', () => {
    const result = rollDice('d20+4', 'disadvantage', '', 10, sequence(20, 1));
    expect(result.total).toBe(5);
    expect(result.critical).toBe('low');
    expect(formatRoll(result)).toContain('FAIL');
  });
  it('does not call a multi-die total a natural 20', () => {
    expect(rollDice('2d20', 'normal', '', null, sequence(10, 10)).critical).toBeNull();
  });
  it.each(['', '5', 'd1', '0d6', '101d6', '50d6+51d8', 'd1001', '4d6kh0', '4d6kl5', 'd6++2', 'd6-', 'd6/2', 'alert(1)', 'd6+100001'])('rejects unsafe or invalid input %s', input => {
    expect(() => parseExpression(input)).toThrow();
  });
  it.each(['2d20', 'd6', '-d20', 'd20+d6', '2d20kh1'])('rejects incompatible advantage %s', input => {
    expect(() => rollDice(input, 'advantage')).toThrow();
  });
  it('enforces valid DC', () => {
    for (const dc of [NaN, Infinity, 0, 1.5, 100001]) expect(() => rollDice('d20', 'normal', '', dc)).toThrow();
  });
  it('rejects biased random samples above the divisible range', () => {
    let count = 0;
    const mock = vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => {
      (array as Uint32Array)[0] = count++ === 0 ? 0xffffffff : 5;
      return array;
    });
    expect(randomDie(6)).toBe(6);
    expect(mock).toHaveBeenCalledTimes(2);
    mock.mockRestore();
  });
});
describe('chat notation', () => {
  it('parses modes, targets, and labels', () => {
    expect(parseCommand('d20+5 adv dc15 # Stealth')).toEqual({ expression: 'd20+5', mode: 'advantage', dc: 15, label: 'Stealth' });
  });
  it('extracts commands and inline rolls in order', () => {
    expect(extractCommands('I attack [[roll 2d6]]!\n/roll d20+3 # Save')).toEqual(['2d6', 'd20+3 # Save']);
  });
  it('ignores code examples and ordinary prose', () => {
    expect(extractCommands('Try `/roll d20`.\n```\n/roll 2d6\n```\nI mention /roll d6.')).toEqual([]);
  });
  it('caps commands per message', () => { expect(() => extractCommands(Array(11).fill('/roll d6').join('\n'))).toThrow(); });
});
