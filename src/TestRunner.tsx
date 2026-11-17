import { useState } from 'react';
import { DEFAULT_INITIAL, DEFAULT_MESSAGE, InitialData } from '@chub-ai/stages-ts';
import { Config, MessageState, Stage } from './Stage';

type Props = { factory: (data: InitialData<null, null, MessageState, Config>) => Stage };
export function TestStageRunner({ factory }: Props) {
  const [stage] = useState(() => factory({ ...DEFAULT_INITIAL, config: {}, messageState: null }));
  const [message, setMessage] = useState('/roll d20+5 adv dc15 # Stealth');
  const [output, setOutput] = useState('Local preview. Send a message here to test the Chub beforePrompt hook. No AI requests are made.');
  return <>{stage.render()}<details className="dev-chat"><summary>Developer chat simulator · local preview only</summary><form onSubmit={async event => { event.preventDefault(); const response = await stage.beforePrompt({ ...DEFAULT_MESSAGE, content: message, isBot: false }); setOutput(response.error || response.systemMessage || 'Message sent. No dice results attached.'); }}><input aria-label="Simulated chat message" value={message} onChange={e => setMessage(e.target.value)} /><button>Send message</button></form><pre aria-live="polite">{output}</pre><button onClick={() => stage.setState(null)}>Simulate empty branch</button></details></>;
}
