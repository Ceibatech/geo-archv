import { apiError, assertSameOrigin, positiveInteger, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { reportRejectionSchema } from "@/lib/validation";
import { rejectDailyReport } from "@/services/daily-report-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["superviseur"]);
    const id = positiveInteger((await params).id, "rapport");
    const input = reportRejectionSchema.parse(await readJson(request));
    return Response.json({ data: await rejectDailyReport(id, user, input.reason) });
  } catch (error) {
    return apiError(error);
  }
}
