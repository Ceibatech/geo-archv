import { apiError, assertSameOrigin, positiveInteger, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { updateInventorySchema } from "@/lib/validation";
import { getInventoryRecordById, updateInventoryRecord } from "@/services/inventory-service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await requireApiUser(["agent"]);
    const id = positiveInteger((await params).id);
    return Response.json({ data: await getInventoryRecordById(id, user) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["agent"]);
    const id = positiveInteger((await params).id);
    const input = updateInventorySchema.parse(await readJson(request));
    return Response.json({ data: await updateInventoryRecord(id, input, user) });
  } catch (error) {
    return apiError(error);
  }
}
