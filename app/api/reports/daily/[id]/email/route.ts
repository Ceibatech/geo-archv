import { apiError, assertSameOrigin, positiveInteger } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { sendApprovedDailyReport } from "@/services/daily-report-email";
import { getDailyReportForUser } from "@/services/daily-report-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["superviseur"]);
    const id = positiveInteger((await params).id, "rapport");
    await getDailyReportForUser(id, user);
    const result = await sendApprovedDailyReport(id, user.id, true);
    return Response.json({ data: result }, { status: result.sent ? 200 : 502 });
  } catch (error) {
    return apiError(error);
  }
}
