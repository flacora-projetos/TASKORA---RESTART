import {
  ApiError,
  GoogleGenAI,
  Chat,
  GenerateContentResponse,
  FunctionDeclaration,
  FunctionCallingConfigMode,
  createModelContent,
  createPartFromFunctionResponse,
} from "@google/genai";
import { Message, ToolCall, ToolResult } from "../types";
import { getTools } from "./openApiToGemini";
import { callMcpApi } from "./mcpApiService";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  throw new Error(
    "A variavel de ambiente VITE_GEMINI_API_KEY nao esta definida. Configure a chave do Gemini antes de iniciar o agente."
  );
}

const ai = new GoogleGenAI({ apiKey });
const tools: FunctionDeclaration[] = getTools();

const MAX_API_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1_000;

const chat: Chat = ai.chats.create({
  model: "gemini-2.0-flash",
  config: {
    tools: [{ functionDeclarations: tools }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.AUTO,
      },
    },
  },
});

const normalizeArgs = (args: unknown): Record<string, unknown> => {
  if (args && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return {};
};

type ToolExecutionResult = {
  call: ToolCall;
  output: unknown;
  id: string;
  isError: boolean;
};

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isTemporaryGeminiError = (error: ApiError): boolean => {
  const status = error.status;
  if (status === 503) {
    return true;
  }

  try {
    const parsed = JSON.parse(error.message);
    const code = parsed?.error?.code;
    const parsedStatus = parsed?.error?.status;
    if (code === 503) {
      return true;
    }
    if (
      typeof parsedStatus === "string" &&
      parsedStatus.toUpperCase() === "UNAVAILABLE"
    ) {
      return true;
    }
  } catch {
    // ignore JSON parse issues
  }

  return false;
};

const sendMessageWithRetry = async (
  payload: Parameters<Chat["sendMessage"]>[0],
  attempt = 1
): Promise<GenerateContentResponse> => {
  try {
    return await chat.sendMessage(payload);
  } catch (error) {
    if (
      error instanceof ApiError &&
      attempt < MAX_API_RETRIES &&
      isTemporaryGeminiError(error)
    ) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.warn(
        `Gemini respondeu 503. Nova tentativa (${attempt}/${MAX_API_RETRIES}) após ${backoff}ms.`
      );
      await wait(backoff);
      return sendMessageWithRetry(payload, attempt + 1);
    }

    if (error instanceof ApiError && isTemporaryGeminiError(error)) {
      throw new Error(
        "O modelo Gemini está temporariamente indisponível (503). Tente novamente em instantes."
      );
    }

    throw error;
  }
};

const executeToolCall = async (
  functionCall: NonNullable<GenerateContentResponse["functionCalls"]>[number],
  index: number
): Promise<ToolExecutionResult> => {
  if (!functionCall.name) {
    const fallbackId =
      functionCall.id ?? `missing-function-name-${Date.now()}-${index}`;
    const errorMessage =
      "O modelo solicitou uma chamada de ferramenta sem fornecer o `name` da funcao.";
    console.error(errorMessage, functionCall);

    const call: ToolCall = {
      id: fallbackId,
      name: "unknown_tool",
      args: {},
    };

    return {
      call,
      output: { error: errorMessage },
      id: fallbackId,
      isError: true,
    };
  }

  const args = normalizeArgs(functionCall.args);
  const callId =
    functionCall.id ?? `${functionCall.name}-${Date.now()}-${index}`;
  const call: ToolCall = {
    id: callId,
    name: functionCall.name,
    args,
  };

  try {
    const output = await callMcpApi(functionCall.name, args);

    return {
      call,
      output,
      id: callId,
      isError: false,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    return {
      call,
      output: { error: errorMessage },
      id: callId,
      isError: true,
    };
  }
};

export async function runConversation(prompt: string): Promise<Message> {
  let modelResponse: GenerateContentResponse = await sendMessageWithRetry({
    message: prompt,
  });

  const collectedToolCalls: ToolCall[] = [];
  const collectedToolResults: ToolResult[] = [];

  while (modelResponse.functionCalls && modelResponse.functionCalls.length > 0) {
    const toolExecutionResults = await Promise.all(
      modelResponse.functionCalls.map(executeToolCall)
    );

    toolExecutionResults.forEach((result) => {
      collectedToolCalls.push(result.call);
      collectedToolResults.push({ call: result.call, output: result.output });
    });

    const responseParts = toolExecutionResults.map((result) =>
      createPartFromFunctionResponse(
        result.id,
        result.call.name,
        result.isError
          ? { error: result.output }
          : { output: result.output }
      )
    );

    const toolFeedback = createModelContent(responseParts);

    modelResponse = await sendMessageWithRetry({
      // The current TypeScript definitions do not accept Content directly but
      // the runtime implementation supports it. Cast explicitly.
      message: toolFeedback as unknown as any,
    });
  }

  const finalModelText = modelResponse.text ?? "";

  return {
    id: `gemini-${Date.now()}`,
    role: "model",
    text: finalModelText,
    toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
    toolResults:
      collectedToolResults.length > 0 ? collectedToolResults : undefined,
  };
}
