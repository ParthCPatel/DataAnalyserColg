import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { Serialized } from "@langchain/core/load/serializable";
import { AgentAction, AgentFinish } from "@langchain/core/agents";
import { ChainValues } from "@langchain/core/utils/types";

export class GraphLogger extends BaseCallbackHandler {
  name = "GraphLogger";
  logs: string[] = [];

  constructor() {
    super();
    this.logs = [];
  }

  getLogs() {
    return this.logs;
  }

  handleChainStart(chain: Serialized, inputs: ChainValues) {
    if (chain.id.includes("graph")) {
        this.logs.push(`[SYSTEM] Starting execution workflow...`);
    }
  }



  handleAgentAction(action: AgentAction) {
    this.logs.push(`[AGENT] Action: ${action.tool}`);
  }

  handleToolEnd(output: string) {
    this.logs.push(`[TOOL] Output: ${output}`);
  }


}
