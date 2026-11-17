import {ReactRunner} from "@chub-ai/stages-ts";
import {Stage, Config, MessageState} from "./Stage";
import {TestStageRunner} from "./TestRunner";

function App() {
  const isDev = import.meta.env.MODE === 'development';
  console.info(`Running in ${import.meta.env.MODE}`);

  return isDev ? <TestStageRunner factory={data => new Stage(data)} /> :
      <ReactRunner<Stage, null, null, MessageState, Config> factory={data => new Stage(data)} />;
}

export default App
