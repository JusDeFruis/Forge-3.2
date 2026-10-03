/* NOTE: this stays a loose record on purpose — naming every key makes
   indexing return `string | undefined` and breaks dozens of call sites,
   while `{}` must remain a valid partial config. `tsc --noEmit` runs in
   `npm test` so real type errors are still caught. */
export type ForgeConfig = Record<string, any>;

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatMessage {
  role: string;
  content: string;
  reasoning_content?: string;
  reasoning_model?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export type EventSink = (event: string, body: Record<string, any>) => void;

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
}

export interface ModelChoice {
  backend: string;
  model: string;
  tag: 'free' | 'paid';
  keyed: boolean;
  is_default: boolean;
  label: string;
  traits: string[];
  search: string;
  price_in: number;
  price_out: number;
}

export interface SessionRow {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  message_count: number;
  preview: string;
  workspace?: string;
  project_id?: string;
}

export interface Turn {
  role: string;
  content: string;
  reasoning_content?: string;
  reasoning_model?: string;
}
