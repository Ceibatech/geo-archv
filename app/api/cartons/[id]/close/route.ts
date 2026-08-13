import { apiError, assertSameOrigin, positiveInteger } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { closeCarton } from "@/services/carton-service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["agent"]);
    const id = positiveInteger((await params).id);
    return Response.json({ data: await closeCarton(id, user) });
  } catch (error) {
    return apiError(error);
  }
}
