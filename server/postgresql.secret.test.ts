import { Client } from "pg";
import { describe, expect, it } from "vitest";

describe("PostgreSQL deployment configuration", () => {
  it("connects to the configured PostgreSQL database with a lightweight health query", async () => {
    const connectionString = process.env.POSTGRESQL_URL;
    expect(connectionString).toBeTruthy();
    const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 });
    try {
      await client.connect();
      const result = await client.query("SELECT 1 AS healthy");
      expect(result.rows[0]?.healthy).toBe(1);
      const schema = await client.query("SELECT to_regclass('public.users') AS users_table, to_regclass('public.projects') AS projects_table, to_regclass('public.official_allocation_imports') AS allocation_imports_table, to_regclass('public.allocation_model_scores') AS allocation_scores_table, (SELECT version_num FROM alembic_version LIMIT 1) AS migration_version");
      expect(schema.rows[0]?.users_table).toBe("users");
      expect(schema.rows[0]?.projects_table).toBe("projects");
      expect(schema.rows[0]?.allocation_imports_table).toBe("official_allocation_imports");
      expect(schema.rows[0]?.allocation_scores_table).toBe("allocation_model_scores");
      expect(schema.rows[0]?.migration_version).toBe("0003_allocation_context");
    } finally {
      await client.end().catch(() => undefined);
    }
  }, 15_000);
});
