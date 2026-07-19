// Returns the public Turnstile site key so the frontend can render the widget
// without hardcoding it in the repo. Site keys are safe to expose publicly.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const siteKey = Deno.env.get("TURNSTILE_SITE_KEY") ?? "";
  return new Response(JSON.stringify({ siteKey }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
