import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_shared_analysis",
  title: "Get shared analysis",
  description:
    "Fetch a publicly shared BetweenTheLines analysis by id. Returns the sanitized report (no raw conversation content).",
  inputSchema: {
    id: z.string().uuid().describe("Analysis UUID from a public share link."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ id }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase.rpc("get_shared_analysis", { p_id: id });
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { content: [{ type: "text", text: "Shared analysis not found" }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(row) }],
      structuredContent: { analysis: row },
    };
  },
});