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
  /** whether this row can actually be used right now. For a provider that
      means a key is stored; for a gateway it means the local login is there,
      because there is no key to store. */
  keyed: boolean;
  /** a gateway reaches its models through a subscription, not a key */
  gateway?: boolean;
  is_default: boolean;
  label: string;
  traits: string[];
  search: string;
  price_in: number;
  price_out: number;
  /** the provider's own server was asked about this model and said no, in these
      words. The row stays listed — the refusal may be lifted — but it does not
      pretend to be usable while the server says otherwise. */
  note?: string;
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
