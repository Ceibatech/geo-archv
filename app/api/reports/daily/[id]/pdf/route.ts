import { apiError, positiveInteger } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { generateDailyReportPdf } from "@/lib/daily-report-pdf";
import { getDailyReportBinaryForUser } from "@/services/daily-report-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser(["agent", "superviseur", "executif"]);
    const id = positiveInteger((await params).id, "rapport");
    const report = await getDailyReportBinaryForUser(id, user);
    const pdf = await generateDailyReportPdf(report);
    const filename = `CG1020_rapport_${report.reportDate}_${report.agentCode || report.agentUserId}.pdf`;
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
