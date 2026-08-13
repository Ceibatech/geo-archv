import { apiError, assertSameOrigin, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createCartonSchema } from "@/lib/validation";
import { createCarton } from "@/services/carton-service";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["agent"]);
    const input = createCartonSchema.parse(await readJson(request));
    return Response.json({ data: await createCarton(input, user) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
