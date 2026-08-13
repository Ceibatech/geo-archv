import { apiError, assertSameOrigin } from "@/lib/api";
import { deleteSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await deleteSession();
    return Response.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
