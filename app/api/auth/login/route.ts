import { apiError, assertSameOrigin, readJson } from "@/lib/api";
import { homePathForRole } from "@/lib/permissions";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";
import { verifyCredentials } from "@/services/auth-service";
import { getUserById } from "@/services/user-service";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = loginSchema.parse(await readJson(request));
    const userId = await verifyCredentials(input.identifier, input.password);
    const user = await getUserById(userId);
    await createSession(userId);
    return Response.json({ user, redirectTo: homePathForRole(user.role) });
  } catch (error) {
    return apiError(error);
  }
}
