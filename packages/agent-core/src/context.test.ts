import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./context.js";

describe("buildSystemPrompt", () => {
  it("embeds the active model id so the agent does not invent another brand", () => {
    const prompt = buildSystemPrompt({
      workspacePath: "C:\\proj",
      projectRules: "",
      skills: [],
      model: "grok-4.5",
      providerId: "openai-compatible",
    });
    expect(prompt).toContain("grok-4.5");
    expect(prompt).toContain("openai-compatible");
    expect(prompt).toMatch(/do not claim to be GPT-4\/GPT-5/i);
    expect(prompt).toMatch(/HFQ Goal mode|long-running objective/i);
  });

  it("avoids inventing a model brand when id is missing", () => {
    const prompt = buildSystemPrompt({
      workspacePath: "/tmp/ws",
      projectRules: "",
      skills: [],
    });
    expect(prompt).toMatch(/do not invent a brand name/i);
    expect(prompt).not.toMatch(/GPT-5\.2/);
  });
});
