"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const supabase_js_1 = require("@supabase/supabase-js");
const zod_1 = require("zod");
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const USER_ID = process.env.CALTRACK_USER_ID;
const server = new mcp_js_1.McpServer({
    name: "caltrack",
    version: "0.1.0",
});
server.registerTool("ping", {
    title: "Ping",
    description: "A test tool that echoes back a message, to confirm the server is wired up correctly.",
    inputSchema: { message: zod_1.z.string() },
}, async ({ message }) => ({
    content: [{ type: "text", text: `pong: ${message}` }],
}));
server.registerTool("log_food_entry", {
    title: "Log Food Entry",
    description: "Logs a meal, snack, or single food item, broken down into its individual ingredients with their macros.",
    inputSchema: {
        description: zod_1.z.string().describe("Short description of what was eaten, e.g. 'Beef mince with potatoes'"),
        meal_type: zod_1.z.enum(["breakfast", "lunch", "dinner", "snack"]),
        ingredients: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            quantity: zod_1.z.number(),
            unit: zod_1.z.string().optional(),
            calories: zod_1.z.number(),
            protein_g: zod_1.z.number(),
            carb_g: zod_1.z.number(),
            fat_g: zod_1.z.number(),
            fiber_g: zod_1.z.number().default(0),
            sugar_g: zod_1.z.number().default(0),
        })),
        logged_at: zod_1.z.string().optional().describe("ISO timestamp; defaults to now"),
    },
}, async ({ description, meal_type, ingredients, logged_at }) => {
    const { data: entry, error: entryError } = await supabase
        .from("food_entries")
        .insert({
        user_id: USER_ID,
        description,
        meal_type,
        logged_at: logged_at ?? new Date().toISOString(),
        source: "text_estimated",
    })
        .select()
        .single();
    if (entryError) {
        return { content: [{ type: "text", text: `Error creating entry: ${entryError.message}` }], isError: true };
    }
    const rows = ingredients.map((ing) => ({ entry_id: entry.id, ...ing }));
    const { error: ingError } = await supabase.from("food_entry_ingredients").insert(rows);
    if (ingError) {
        return { content: [{ type: "text", text: `Error adding ingredients: ${ingError.message}` }], isError: true };
    }
    const { data: finalEntry } = await supabase
        .from("food_entries")
        .select("calories, protein_g, carb_g, fat_g")
        .eq("id", entry.id)
        .single();
    return {
        content: [
            {
                type: "text",
                text: `Logged "${description}" (${meal_type}): ${finalEntry?.calories} kcal, ${finalEntry?.protein_g}g protein, ${finalEntry?.carb_g}g carbs, ${finalEntry?.fat_g}g fat.`,
            },
        ],
    };
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main();
