import { apiError, assertSameOrigin, positiveInteger, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { reportSignatureSchema } from "@/lib/validation";
import { sendApprovedDailyReport } from "@/services/daily-report-email";
import { approveDailyReport } from "@/services/daily-report-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["superviseur"]);
    const id = positiveInteger((await params).id, "rapport");
    const input = reportSignatureSchema.parse(await readJson(request));
    const report = await approveDailyReport(id, user, input);
    const email = await sendApprovedDailyReport(id, user.id);
    return Response.json({ data: report, email });
  } catch (error) {
    return apiError(error);
  }
}
