import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { Type } from "typebox";

import { loadErrorMessage, registerTkTools, runBoundedProcess } from "./common.ts";

export default async function tkOmpExtension(omp: ExtensionAPI): Promise<void> {
  try {
    await registerTkTools({
      harnessName: "omp",
      wrapSchema(schema) {
        return Type.Unsafe<Record<string, unknown>>(schema);
      },
      run: runBoundedProcess,
      registerTool(tool) {
        omp.registerTool({
          name: tool.name,
          label: tool.label,
          description: tool.description,
          parameters: tool.parameters as never,
          loadMode: tool.loadMode,
          async execute(_toolCallId, params, signal, _onUpdate, ctx) {
            const actor = ctx.model
              ? `omp:${ctx.model.provider}/${ctx.model.id}`
              : undefined;
            return tool.execute(params as Record<string, unknown>, signal, {
              cwd: ctx.cwd,
              actor,
            });
          },
        });
      },
    });
  } catch (error) {
    console.error(`tk: ${loadErrorMessage(error)}`);
  }
}
