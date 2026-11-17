import { FormEvent, useEffect, useState, useSyncExternalStore } from 'react';
import type { Stage } from '../Stage';
import { formatRoll, Mode, Roll } from '../dice';
import '../index.scss';

function DieIcon({ value, className = '' }: { value?: string | number; className?: string }) {
  return <svg className={className} viewBox="0 0 120 132" fill="none" aria-hidden="true">
    <path d="M60 4 113 34v64l-53 30L7 98V34Z" fill="currentColor" fillOpacity=".08" stroke="currentColor" strokeWidth="1.5" />
    <path d="M60 4 30 49h60L60 4ZM7 34l23 15L7 98l53-12 53 12-23-49 23-15M30 49l30 37 30-37M60 86v42M7 98l23-49M113 98 90 49" stroke="currentColor" strokeOpacity=".45" />
    {value !== undefined && <text x="60" y="71" textAnchor="middle" fill="currentColor" stroke="none" fontSize="26" fontWeight="600">{value}</text>}
  </svg>;
}

function Breakdown({ roll }: { roll: Roll }) {
  return <div className="breakdown" aria-label="Individual dice">
    {roll.groups.map((group, g) => <div className="dice-group" key={g}>
      <span className="group-label">{group.sign < 0 ? '− ' : g ? '+ ' : ''}d{group.sides}</span>
      {group.values.map((value, i) => <span key={i} className={`pip ${group.kept[i] ? '' : 'dropped'}`} title={group.kept[i] ? `d${group.sides}: ${value}` : `${value} dropped`}>{value}</span>)}
    </div>)}
    {!!roll.modifier && <span className="modifier">{roll.modifier > 0 ? '+' : '−'} {Math.abs(roll.modifier)}</span>}
  </div>;
}

export function DicePanel({ stage }: { stage: Stage }) {
  const { latest, history, pending } = useSyncExternalStore(stage.subscribe, stage.getSnapshot);
  const [expression, setExpression] = useState(stage.config.defaultExpression || '1d20');
  const [mode, setMode] = useState<Mode>('normal');
  const [label, setLabel] = useState('');
  const [dc, setDc] = useState('');
  const [share, setShare] = useState(stage.config.shareWithChat ?? true);
  const [error, setError] = useState('');
  const [rolling, setRolling] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!latest) { setRolling(false); return; }
    setRolling(true);
    setCopied(false);
    const timeout = window.setTimeout(() => setRolling(false), 620);
    return () => window.clearTimeout(timeout);
  }, [latest]);
  function roll(event: FormEvent) {
    event.preventDefault();
    try { stage.roll(expression, mode, label, dc.trim() ? Number(dc) : null, share); setError(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to roll.'); }
  }
  async function copyResult() {
    if (!latest) return;
    try { await navigator.clipboard.writeText(formatRoll(latest)); setCopied(true); }
    catch { setError('Clipboard unavailable. You can select and copy the result from the roll history.'); }
  }
  function preset(sides: number) { setExpression(`1d${sides}`); setMode('normal'); setError(''); }
  return <main className="dice-app">
    <header className="app-header"><div className="brand"><DieIcon /><div><span className="eyebrow">A CHUB CHAT COMPANION</span><h1>Fate & Fortune<span>Dice roller</span></h1></div></div><span className="live-badge"><i /> READY TO ROLL</span></header>
    <div className="workspace">
      <section className="roller" aria-label="Dice roller">
        <div className="section-heading"><span className="eyebrow">THE DICE TRAY</span><span className="tiny">Leave a little to chance.</span></div>
        <div className={`tray ${rolling ? 'rolling' : ''}`}>
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <span className="tray-star star-one">✦</span><span className="tray-star star-two">✧</span>
          <DieIcon className="hero-die" value={latest ? undefined : '20'} />
          <div className="result" aria-live="polite" aria-atomic="true">
            {latest ? <><span className="eyebrow">{rolling ? 'CASTING YOUR DICE' : latest.label || 'YOUR RESULT'}</span><strong className="total">{rolling ? '· · ·' : latest.total}</strong><span className="result-expression">{latest.expression}{latest.mode !== 'normal' ? ` · ${latest.mode}` : ''}</span></> : <><span className="eyebrow">EVERY STORY HAS A TURN</span><h2>Let the dice decide.</h2><p>Your next adventure starts with a roll.</p></>}
          </div>
          {latest && !rolling && <div className="outcomes">{latest.critical && <span className={`outcome ${latest.critical === 'high' ? 'success' : 'neutral'}`}>✦ Natural {latest.critical === 'high' ? '20' : '1'}</span>}{latest.dc !== null && <span className={`outcome ${latest.total >= latest.dc ? 'success' : 'failure'}`}>{latest.total >= latest.dc ? 'Passed' : 'Failed'} · DC {latest.dc}</span>}</div>}
        </div>
        {latest && <div className={`result-details ${rolling ? 'concealed' : ''}`}><Breakdown roll={latest} /><button type="button" className="text-button" onClick={copyResult}>{copied ? 'Copied ✓' : 'Copy result ↗'}</button></div>}
        <form onSubmit={roll} className="roll-form">
          <div className="field-heading"><label htmlFor="expression">Choose your dice</label><span className="tiny">Or write your own below</span></div>
          <div className="presets">{[4, 6, 8, 10, 12, 20, 100].map(sides => <button key={sides} type="button" aria-pressed={expression === `1d${sides}`} onClick={() => preset(sides)} className={expression === `1d${sides}` ? 'selected' : ''}><DieIcon value={sides === 100 ? '%' : sides} /><span>d{sides}</span></button>)}</div>
          <div className="expression-wrap"><span aria-hidden="true">ƒ</span><input id="expression" value={expression} onChange={e => setExpression(e.target.value)} spellCheck={false} autoComplete="off" maxLength={120} aria-describedby="expression-hint" /><kbd>DICE + MODIFIER</kbd></div>
          <span id="expression-hint" className="tiny hint">Try 2d6+3, d20+5, or 4d6kh3 (keep highest 3).</span>
          <div className="mode-control" role="group" aria-label="Roll mode">{(['normal', 'advantage', 'disadvantage'] as Mode[]).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={mode === value ? 'active' : ''}>{value === 'normal' ? 'Standard' : value === 'advantage' ? '↑ Advantage' : '↓ Disadvantage'}</button>)}</div>
          <div className="optional-fields"><label>Roll label <span>optional</span><input placeholder="e.g. Stealth check" value={label} onChange={e => setLabel(e.target.value)} maxLength={80} /></label><label>Target DC <span>optional</span><input type="number" min="1" max="100000" step="1" placeholder="—" value={dc} onChange={e => setDc(e.target.value)} /></label></div>
          <label className="share-toggle"><input type="checkbox" checked={share} onChange={e => setShare(e.target.checked)} /><span className="switch" /><span>Include in my next chat message</span></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="roll-button" disabled={rolling} type="submit"><span aria-hidden="true">✧</span>{rolling ? 'Rolling…' : 'Roll the dice'}<span aria-hidden="true">↗</span></button>
          <p className="form-note">{share ? 'Results are queued until you send a message in chat.' : 'Practice roll · result stays in this panel.'}</p>
        </form>
      </section>
      <aside className="sidebar">
        <section className="history-section"><div className="section-heading"><div><span className="eyebrow">THE STORY SO FAR</span><h2>Roll history <span>{history.length}</span></h2></div><span className="history-symbol" aria-hidden="true">◷</span></div>
          {pending.length > 0 && <div className="queue"><span><i />{pending.length} {pending.length === 1 ? 'roll' : 'rolls'} queued for chat</span><button className="text-button" onClick={stage.discardQueue}>Discard queue</button></div>}
          {history.length === 0 ? <div className="empty-history"><DieIcon value="?" /><h3>A clean slate.</h3><p>Your rolls will appear here.<br />Make the first move.</p></div> : <ol className="history-list">{history.map((item, i) => <li key={item.id} className={i === 0 ? 'newest' : ''}><div className="history-top"><span>{item.label || 'Dice roll'}{pending.some(p => p.id === item.id) && <small>QUEUED</small>}</span><strong>{item.total}</strong></div><p>{item.expression}{item.mode !== 'normal' && ` · ${item.mode}`}</p><Breakdown roll={item} />{item.dc !== null && <span className={`history-dc ${item.total >= item.dc ? 'pass' : 'fail'}`}>{item.total >= item.dc ? 'Passed' : 'Failed'} DC {item.dc}</span>}<time dateTime={new Date(item.time).toISOString()}>{new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></li>)}</ol>}
          <p className="history-footnote">Last 20 rolls · saved with your next chat turn</p>
        </section>
        <section className="command-help"><span className="eyebrow">KEEP THE STORY FLOWING</span><h3>Roll right in chat.</h3><p>Start a line with a command, or add an inline roll to your message.</p><code>/roll d20+5 adv dc15 # Stealth</code><code>I attack! [[roll 2d6+3]]</code><details><summary>A little dice wisdom <span>+</span></summary><p><b>adv / dis</b> rolls two d20s and keeps the higher / lower. Use with a single d20 and any modifier.</p><p><b>kh / kl</b> keeps the highest / lowest dice: <code>4d6kh3</code>. Dropped dice are crossed out.</p><p><b>DC</b> compares your total to a target. Natural 1 and 20 are highlighted; your game decides what they mean.</p><p>Only your commands trigger rolls. Code examples and character replies do not.</p></details></section>
      </aside>
    </div>
    <footer className="app-footer"><span>✦ FATE & FORTUNE</span><span>Random dice. Real possibilities.</span></footer>
  </main>;
}
