import { apiError, assertSameOrigin, positiveInteger, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { updateUserSchema } from "@/lib/validation";
import { getUserById, updateUser } from "@/services/user-service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    await requireApiUser(["admin"]);
    const id = positiveInteger((await params).id);
    return Response.json({ data: await getUserById(id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const actor = await requireApiUser(["admin"]);
    const id = positiveInteger((await params).id);
    const input = updateUserSchema.parse(await readJson(request));
    return Response.json({ data: await updateUser(id, input, actor.id) });
  } catch (error) {
    return apiError(error);
  }
}
