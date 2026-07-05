import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyAnalysesTool from "./tools/list-my-analyses";
import getMyAnalysisTool from "./tools/get-my-analysis";
import getSharedAnalysisTool from "./tools/get-shared-analysis";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "betweenthelines-mcp",
  title: "BetweenTheLines",
  version: "0.1.0",
  instructions:
    "Tools for BetweenTheLines, a relationship conversation analyzer. Use `list_my_analyses` and `get_my_analysis` to browse the signed-in user's saved reports, and `get_shared_analysis` to look up a public share link by id.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMyAnalysesTool, getMyAnalysisTool, getSharedAnalysisTool],
});