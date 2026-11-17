import { describe, expect, it, vi } from 'vitest';
vi.mock('@chub-ai/stages-ts', () => ({ StageBase: class {} }));
vi.mock('../src/components/DicePanel', () => ({ DicePanel: () => null }));
import { DEFAULT_INITIAL, DEFAULT_MESSAGE } from '@chub-ai/stages-ts/dist/types/defaults';
import { Stage } from '../src/Stage';
function createStage() { return new Stage({ ...DEFAULT_INITIAL, config: {}, messageState: null }); }
const message = (content: string, isBot = false) => ({ ...DEFAULT_MESSAGE, content, isBot });
describe('Chub lifecycle', () => {
  it('shares exact panel results once on the next human message', async () => {
    const stage = createStage();
    const roll = stage.roll('d20+3', 'normal', 'Check', null, true);
    const response = await stage.beforePrompt(message('I try the door.'));
    expect(response.systemMessage).toContain(`= ${roll.total}`);
    expect(response.stageDirections).toContain('fixed');
    expect(stage.getSnapshot().pending).toHaveLength(0);
    expect((await stage.beforePrompt(message('Continue.'))).systemMessage).toBeNull();
  });
  it('keeps practice rolls out of model context', async () => {
    const stage = createStage(); stage.roll('d6', 'normal', '', null, false);
    expect((await stage.beforePrompt(message('Hello'))).systemMessage).toBeNull();
  });
  it('does not execute bot commands or consume pending rolls on bot prompts', async () => {
    const stage = createStage(); stage.roll('d6', 'normal', '', null, true);
    await stage.beforePrompt(message('/roll d20', true));
    expect(stage.getSnapshot().history).toHaveLength(1);
    expect(stage.getSnapshot().pending).toHaveLength(1);
    await stage.afterResponse();
    expect(stage.getSnapshot().history).toHaveLength(1);
  });
  it('restores branches and clears transient queues', async () => {
    const stage = createStage();
    const response = await stage.beforePrompt(message('/roll d6'));
    stage.roll('d20', 'normal', '', null, true);
    await stage.setState(response.messageState!);
    expect(stage.getSnapshot().history).toHaveLength(1);
    expect(stage.getSnapshot().pending).toHaveLength(0);
    await stage.setState(null);
    expect(stage.getSnapshot().latest).toBeNull();
    expect(stage.getSnapshot().history).toHaveLength(0);
  });
  it('rejects malformed batches without altering history or pending queue', async () => {
    const stage = createStage(); stage.roll('d6', 'normal', '', null, true);
    const before = stage.getSnapshot();
    expect((await stage.beforePrompt(message('/roll d20\n/roll nonsense'))).error).toBeTruthy();
    expect(stage.getSnapshot()).toBe(before);
  });
  it('caps stored history and pending queue', () => {
    const stage = createStage();
    for (let i = 0; i < 25; i++) stage.roll('d6', 'normal', '', null, false);
    expect(stage.getSnapshot().history).toHaveLength(20);
    for (let i = 0; i < 10; i++) stage.roll('d6', 'normal', '', null, true);
    expect(() => stage.roll('d6', 'normal', '', null, true)).toThrow();
    stage.discardQueue();
    expect(stage.getSnapshot().pending).toHaveLength(0);
  });
});
