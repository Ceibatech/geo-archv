import { apiError, assertSameOrigin, positiveInteger, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { teamSchema } from "@/lib/validation";
import { updateTeam } from "@/services/team-service";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    await requireApiUser(["admin"]);
    const id = positiveInteger((await params).id, "Équipe");
    const input = teamSchema.parse(await readJson(request));
    return Response.json({ data: await updateTeam(id, input) });
  } catch (error) {
    return apiError(error);
  }
}
