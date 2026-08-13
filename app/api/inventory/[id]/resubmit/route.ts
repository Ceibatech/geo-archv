import { apiError, assertSameOrigin, positiveInteger, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { inventoryResubmissionSchema } from "@/lib/validation";
import { resubmitInventoryRecord } from "@/services/inventory-service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["agent"]);
    const id = positiveInteger((await params).id);
    const input = inventoryResubmissionSchema.parse(await readJson(request));
    return Response.json({ data: await resubmitInventoryRecord(id, input, user) });
  } catch (error) {
    return apiError(error);
  }
}
