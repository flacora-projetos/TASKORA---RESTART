export type ToolArgs = Record<string, unknown> | null | undefined;

export type ToolResponse<TData = unknown> =
  | { status: "ok"; data: TData }
  | { status: "pending"; data: TData }
  | { status: "error"; error: string; details?: unknown };

export type ToolHandler = (args: ToolArgs) => Promise<ToolResponse>;
