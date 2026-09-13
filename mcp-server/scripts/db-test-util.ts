// Dev-only DB utility for seeding/cleaning up test data ahead of tools that
// don't exist yet (e.g. weight_logs rows, before log_weight is built).
// NOT one of the product's MCP tools — talks to Supabase directly.
//   npx tsx scripts/db-test-util.ts insert-weight <kg>
//   npx tsx scripts/db-test-util.ts delete-weight <id>
//   npx tsx scripts/db-test-util.ts delete-all-weight
//   npx tsx scripts/db-test-util.ts delete-all-water
//   npx tsx scripts/db-test-util.ts delete-profile
//   npx tsx scripts/db-test-util.ts delete-goals
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const USER_ID = process.env.CALTRACK_USER_ID!;

async function main() {
  const [, , action, arg] = process.argv;

  if (action === "insert-weight") {
    const { data, error } = await supabase
      .from("weight_logs")
      .insert({ user_id: USER_ID, weight_kg: Number(arg ?? 75) })
      .select()
      .single();
    if (error) throw error;
    console.log(data.id);
  } else if (action === "delete-weight") {
    const { error } = await supabase.from("weight_logs").delete().eq("id", arg);
    if (error) throw error;
    console.log("deleted");
  } else if (action === "delete-all-weight") {
    const { error } = await supabase.from("weight_logs").delete().eq("user_id", USER_ID);
    if (error) throw error;
    console.log("deleted");
  } else if (action === "delete-all-water") {
    const { error } = await supabase.from("water_logs").delete().eq("user_id", USER_ID);
    if (error) throw error;
    console.log("deleted");
  } else if (action === "delete-profile") {
    const { error } = await supabase.from("profile").delete().eq("user_id", USER_ID);
    if (error) throw error;
    console.log("deleted");
  } else if (action === "delete-goals") {
    const { error } = await supabase.from("goals").delete().eq("user_id", USER_ID);
    if (error) throw error;
    console.log("deleted");
  } else {
    console.error("Usage: insert-weight <kg> | delete-weight <id> | delete-profile | delete-goals");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
