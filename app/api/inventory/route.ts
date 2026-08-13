import { apiError, assertSameOrigin, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createInventorySchema, inventoryListQuerySchema } from "@/lib/validation";
import { createInventoryRecord, listInventoryRecords } from "@/services/inventory-service";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(["agent"]);
    const query = inventoryListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return Response.json(await listInventoryRecords(query, user));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["agent"]);
    const input = createInventorySchema.parse(await readJson(request));
    const result = await createInventoryRecord(input, user);
    return Response.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return apiError(error);
  }
}
