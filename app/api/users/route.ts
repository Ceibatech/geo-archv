import { apiError, assertSameOrigin, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createUserSchema } from "@/lib/validation";
import { createUser, listUsers } from "@/services/user-service";

export async function GET() {
  try {
    await requireApiUser(["admin"]);
    return Response.json({ data: await listUsers() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiUser(["admin"]);
    const input = createUserSchema.parse(await readJson(request));
    return Response.json({ data: await createUser(input) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
