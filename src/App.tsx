import {ReactRunner} from "@chub-ai/stages-ts";
import {Stage, Config, MessageState} from "./Stage";
import {TestStageRunner} from "./TestRunner";

function App() {
  // A development server can also be embedded by Chub's Staging URL setting.
  // Embedded stages must answer INIT/BEFORE/AFTER instead of showing the simulator.
  const isDev = import.meta.env.MODE === 'development' && window.self === window.top;
  console.info(`Running in ${import.meta.env.MODE}`);

  return isDev ? <TestStageRunner factory={data => new Stage(data)} /> :
      <ReactRunner<Stage, null, null, MessageState, Config> factory={data => new Stage(data)} />;
}

export default App
