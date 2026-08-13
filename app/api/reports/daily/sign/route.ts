import { apiError, assertSameOrigin, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { reportSignatureSchema } from "@/lib/validation";
import { signAgentDailyReport } from "@/services/daily-report-service";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["agent"]);
    const input = reportSignatureSchema.parse(await readJson(request));
    return Response.json({ data: await signAgentDailyReport(user, input) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
