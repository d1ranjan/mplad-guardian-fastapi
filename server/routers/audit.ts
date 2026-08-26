import { z } from "zod";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getAlertCase,
  getDashboard,
  importProjectCsv,
  listAlerts,
  listProjects,
  reviewAlert,
  runAudit,
  seedDemoWorkspace,
} from "../audit/service";
import { validateProjectRows } from "../audit/importValidation";

const csvProjectRowSchema = z.object({
  projectCode: z.string(), title: z.string(), description: z.string().optional(), category: z.string(), state: z.string(), district: z.string(), locality: z.string(), latitude: z.string().optional(), longitude: z.string().optional(), vendorName: z.string(), financialYear: z.string(), sanctionedAmount: z.string(), estimatedAmount: z.string().optional(), actualExpenditure: z.string(), sanctionDate: z.string(), expectedCompletionDate: z.string(), lastUpdateDate: z.string(), progressPercent: z.string(), status: z.string(),
});

export const auditRouter = router({
  dashboard: publicProcedure.query(() => getDashboard()),
  listAlerts: publicProcedure.input(z.object({ status: z.string().optional(), riskType: z.string().optional(), query: z.string().max(160).optional(), minScore: z.number().min(0).max(100).optional() }).optional()).query(({ input }) => listAlerts(input ?? {})),
  alertCase: publicProcedure.input(z.object({ alertId: z.number().int().positive() })).query(({ input }) => getAlertCase(input.alertId)),
  projects: publicProcedure.query(() => listProjects()),
  run: adminProcedure.mutation(({ ctx }) => runAudit(ctx.user.id)),
  seedDemo: adminProcedure.mutation(() => seedDemoWorkspace()),
  review: protectedProcedure.input(z.object({ alertId: z.number().int().positive(), action: z.enum(["field_verification", "dismissed", "resolved"]), note: z.string().trim().min(3).max(2000) })).mutation(({ ctx, input }) => reviewAlert({ ...input, reviewerId: ctx.user.id })),
});

export const importRouter = router({
  validate: publicProcedure.input(z.object({ rows: z.array(csvProjectRowSchema).min(1).max(500) })).mutation(({ input }) => validateProjectRows(input.rows)),
  execute: adminProcedure.input(z.object({ filename: z.string().min(1).max(255), rawCsv: z.string().min(1).max(2_000_000), rows: z.array(csvProjectRowSchema).min(1).max(500) })).mutation(({ ctx, input }) => importProjectCsv({ ...input, importedBy: ctx.user.id })),
});
