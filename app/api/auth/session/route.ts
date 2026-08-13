import { apiError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export async function GET() {
  try {
    return Response.json({ user: await requireApiUser() });
  } catch (error) {
    return apiError(error);
  }
}
