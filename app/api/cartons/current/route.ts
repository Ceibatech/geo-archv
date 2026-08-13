import { apiError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getCurrentCarton } from "@/services/carton-service";

export async function GET() {
  try {
    const user = await requireApiUser(["agent"]);
    return Response.json({ data: await getCurrentCarton(user.id) });
  } catch (error) {
    return apiError(error);
  }
}
