import { ReactElement } from 'react';
import { StageBase, StageResponse, InitialData, Message } from '@chub-ai/stages-ts';
import { LoadResponse } from '@chub-ai/stages-ts/dist/types/load';
import { DicePanel } from './components/DicePanel';
import { extractCommands, formatRoll, Mode, parseCommand, Roll, rollDice } from './dice';

export interface MessageState { version: 1; history: Roll[] }
export interface Config { defaultExpression?: string; shareWithChat?: boolean }
export interface Snapshot { history: Roll[]; pending: Roll[]; latest: Roll | null }
export class Stage extends StageBase<null, null, MessageState, Config> {
  readonly config: Config;
  private snapshot: Snapshot;
  private listeners = new Set<() => void>();
  constructor(data: InitialData<null, null, MessageState, Config>) {
    super(data);
    this.config = data.config ?? {};
    const history = data.messageState?.version === 1 ? data.messageState.history.slice(0, 20) : [];
    this.snapshot = { history, pending: [], latest: history[0] ?? null };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private update(next: Snapshot) { this.snapshot = next; this.listeners.forEach(listener => listener()); }
  private state(): MessageState { return { version: 1, history: this.snapshot.history }; }
  async load(): Promise<Partial<LoadResponse<null, null, MessageState>>> { return { success: true, error: null }; }
  async setState(state: MessageState | null) {
    const history = state?.version === 1 ? state.history.slice(0, 20) : [];
    this.update({ history, pending: [], latest: history[0] ?? null });
  }
  roll(expression: string, mode: Mode, label: string, dc: number | null, share: boolean) {
    if (share && this.snapshot.pending.length >= 10) throw new Error('10 rolls are queued. Send a chat message or discard the queue first.');
    const roll = rollDice(expression, mode, label, dc);
    this.update({ history: [roll, ...this.snapshot.history].slice(0, 20), latest: roll, pending: share ? [...this.snapshot.pending, roll] : this.snapshot.pending });
    return roll;
  }
  discardQueue = () => { this.update({ ...this.snapshot, pending: [] }); };
  async beforePrompt(message: Message): Promise<Partial<StageResponse<null, MessageState>>> {
    if (message.isBot) return { messageState: this.state() };
    try {
      const commands = extractCommands(message.content ?? '');
      // Commit only when the entire command batch is valid.
      const rolls = commands.map(command => { const { expression, mode, label, dc } = parseCommand(command); return rollDice(expression, mode, label, dc); });
      const all = [...this.snapshot.pending, ...rolls];
      const history = [...rolls].reverse().concat(this.snapshot.history).slice(0, 20);
      this.update({ history, pending: [], latest: rolls[rolls.length - 1] ?? this.snapshot.latest });
      const results = all.map(formatRoll).join('\n');
      return {
        messageState: this.state(),
        systemMessage: all.length ? `🎲 Dice results\n${results}` : null,
        stageDirections: all.length ? `The dice stage calculated these results. Treat their numbers as fixed; do not reroll or invent different totals. Narrate consequences in context. Natural 1/20 are highlights, not automatic success/failure rules. DC outcomes compare the total to the target.\n${results}` : null,
        error: null,
      };
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to roll dice.';
      return { messageState: this.state(), error: text, stageDirections: `Dice command failed: ${text} No new dice results were committed. Ask for a corrected roll; do not invent a result.` };
    }
  }
  async afterResponse(): Promise<Partial<StageResponse<null, MessageState>>> { return { messageState: this.state() }; }
  render(): ReactElement { return <DicePanel stage={this} />; }
}
