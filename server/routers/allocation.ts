import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { ensureOfficialAllocationModel, getOfficialAllocationCase, getOfficialAllocationDashboard } from "../allocation/service";

export const allocationRouter = router({
  dashboard: publicProcedure.query(() => getOfficialAllocationDashboard()),
  case: publicProcedure.input(z.object({ scoreId: z.number().int().positive() })).query(({ input }) => getOfficialAllocationCase(input.scoreId)),
  retrain: adminProcedure.mutation(() => ensureOfficialAllocationModel()),
});
