import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./context.js";
import { redactStaleModelSelfClaims } from "./loop.js";

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
    expect(prompt).toMatch(/do not claim GPT-4\/GPT-5/i);
    expect(prompt).toMatch(/equals "grok-4\.5"/i);
    expect(prompt).toMatch(/Older assistant messages|obsolete/i);
    expect(prompt).toMatch(/HFQ Goal mode|long-running objective/i);
  });

  it("tells the model to ignore superseded self-intros after a switch", () => {
    const prompt = buildSystemPrompt({
      workspacePath: "/tmp/ws",
      projectRules: "",
      skills: [],
      model: "mimo-v2.5-free",
      providerId: "opencode",
    });
    expect(prompt).toContain("mimo-v2.5-free");
    expect(prompt).toMatch(/obsolete|switched models/i);
    expect(prompt).not.toMatch(/powered by "grok/i);
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

describe("redactStaleModelSelfClaims", () => {
  it("rewrites prior grok self-claims to the current model id", () => {
    const src = "我是 **HFQ Code**，模型是 **grok-4.5**。能帮你写代码。";
    const out = redactStaleModelSelfClaims(src, "mimo-v2.5-free");
    expect(out).toContain("mimo-v2.5-free");
    expect(out).not.toContain("grok-4.5");
  });

  it("leaves matching model claims alone", () => {
    const src = "模型是 **mimo-v2.5-free**";
    expect(redactStaleModelSelfClaims(src, "mimo-v2.5-free")).toBe(src);
  });
});
