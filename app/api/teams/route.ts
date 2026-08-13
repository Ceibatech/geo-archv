import { apiError, assertSameOrigin, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { teamSchema } from "@/lib/validation";
import { createTeam, listTeams } from "@/services/team-service";

export async function GET() {
  try {
    await requireApiUser(["admin"]);
    return Response.json({ data: await listTeams() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiUser(["admin"]);
    const input = teamSchema.parse(await readJson(request));
    return Response.json({ data: await createTeam(input) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
