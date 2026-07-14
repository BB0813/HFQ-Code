import { z } from "zod";

export const SkillFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  homepage: z.string().optional(),
  "user-invocable": z.boolean().optional(),
  metadata: z
    .object({
      openclaw: z
        .object({
          os: z.array(z.enum(["darwin", "linux", "win32"])).optional(),
          requires: z
            .object({
              bins: z.array(z.string()).optional(),
              anyBins: z.array(z.string()).optional(),
              env: z.array(z.string()).optional(),
            })
            .optional(),
          emoji: z.string().optional(),
          homepage: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export const SkillRecordSchema = z.object({
  name: z.string(),
  description: z.string(),
  dir: z.string(),
  source: z.enum(["workspace", "project_agents", "user", "shared_agents", "bundled"]),
  body: z.string(),
  enabled: z.boolean(),
  eligible: z.boolean(),
  ineligibleReason: z.string().optional(),
});

export type SkillRecord = z.infer<typeof SkillRecordSchema>;
