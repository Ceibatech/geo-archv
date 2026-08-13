import { apiError, assertSameOrigin, positiveInteger, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { reportRejectionSchema } from "@/lib/validation";
import { rejectInventoryRecord } from "@/services/inventory-service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["superviseur"]);
    const id = positiveInteger((await params).id);
    const input = reportRejectionSchema.parse(await readJson(request));
    return Response.json({ data: await rejectInventoryRecord(id, user, input.reason) });
  } catch (error) {
    return apiError(error);
  }
}
