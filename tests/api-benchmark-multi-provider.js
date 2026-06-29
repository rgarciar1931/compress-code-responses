#!/usr/bin/env node
/**
 * Multi-Provider API Benchmark
 * 
 * Tests multiple LLM providers (OpenRouter, Cerebras, NVIDIA NIM) to compare
 * real token usage between normal and compressed instruction behavior.
 * 
 * Requires free API keys from any of the providers below.
 * 
 * Environment variables (set what you have):
 *   OPENROUTER_API_KEY  - OpenRouter key (get at https://openrouter.ai)
 *   CEREBRAS_API_KEY    - Cerebras key (get at https://inference.cerebras.io)
 *   NVIDIA_API_KEY      - NVIDIA NIM key (get at https://build.nvidia.com)
 * 
 * Run: node tests/api-benchmark-multi-provider.js
 */

import { minifyWhitespace } from "../lib/minify-whitespace.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import https from "node:https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const testOutputDir = path.join(root, "test-output", "multi-provider-benchmark");

// ============================================================================
// PROVIDER CONFIGURATION
// Tested successfully with free-tier API keys.
// ============================================================================

const PROVIDERS = [
  {
    id: "openrouter",
    label: "OpenRouter",
    apiKey: process.env.OPENROUTER_API_KEY || null,
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    models: [
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
    ],
    authHeader: "OpenRouter API",
    keyExample: "sk-or-v1-...",
    keyEnv: "OPENROUTER_API_KEY",
  },
  {
    id: "cerebras",
    label: "Cerebras",
    apiKey: process.env.CEREBRAS_API_KEY || null,
    baseUrl: "https://api.cerebras.ai/v1/chat/completions",
    models: [
      { id: "gpt-oss-120b", label: "GPT-OSS-120B" },
      { id: "zai-glm-4.7", label: "ZAI-GLM-4.7" },
    ],
    authHeader: "Cerebras API",
    keyExample: "csk-...",
    keyEnv: "CEREBRAS_API_KEY",
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    apiKey: process.env.NVIDIA_API_KEY || null,
    baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    models: [
      { id: "deepseek-ai/deepseek-v4-flash", label: "DeepSeek V4 Flash" },
    ],
    authHeader: "Authorization",
    keyExample: "nvapi-...",
    keyEnv: "NVIDIA_API_KEY",
  },
];

// ============================================================================
// TEST PROMPTS (Adobe Commerce focused)
// ============================================================================

const SAMPLE_PROMPTS = [
  {
    name: "PHP Service Class",
    category: "adobe-commerce",
    system: "You are an Adobe Commerce (Magento 2) developer.",
    prompt: `Write a complete PHP service class with:
- Namespace: VendorName\ModuleName\Service
- Class: OrderProcessor
- Constructor with DI (log, repository, config)
- 2+ public methods with docBlocks, @param, @return
- Private helper methods
- Try/catch error handling
- Return structured array`,
    expectedLines: 120,
  },
  {
    name: "GraphQL Schema",
    category: "adobe-commerce",
    system: "You are an Adobe Commerce (Magento 2) GraphQL developer.",
    prompt: `Write a Magento 2 GraphQL schema with:
- Query with custom type
- Mutation for data creation
- Input type with validation
- Custom type with fields
- @doc comments and type safety`,
    expectedLines: 70,
  },
  {
    name: "XML Config (di.xml)",
    category: "adobe-commerce",
    system: "You are an Adobe Commerce (Magento 2) developer specializing in XML configuration.",
    prompt: `Write a Magento 2 di.xml configuration file with:
- Type definitions
- Plugin definitions (before/after/around)
- Virtual types
- Arguments with object and string types
- Comments explaining each section`,
    expectedLines: 80,
  },
];

// ============================================================================
// API REQUEST FUNCTION
// ============================================================================

function apiRequest(config, messages, modelId) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: modelId,
      messages,
      temperature: 0.3,
      max_tokens: 2048,
    });

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    };

    // OpenRouter-specific headers
    if (config.id === "openrouter") {
      headers["HTTP-Referer"] = "https://github.com/compress-code-responses";
      headers["X-Title"] = "Compress Code Responses Benchmark";
    }

    const url = new URL(config.baseUrl);
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: "POST",
        headers,
        timeout: 60000, // Shorter timeout (60s)
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode === 200) {
              if (parsed.usage) {
                resolve({
                  usage: parsed.usage,
                  provider: config.label,
                  model: config.models.find(m => m.id === modelId)?.label || modelId,
                });
              } else if (parsed.error) {
                reject(new Error(
                  parsed.error.message || parsed.error.code || `HTTP ${res.statusCode}`
                ));
              } else {
                reject(new Error(`No usage/error data: ${body.slice(0, 200)}`));
              }
            } else {
              reject(new Error(
                parsed.error?.message || parsed.message || `HTTP ${res.statusCode}: ${body.slice(0, 200)}`
              ));
            }
          } catch (e) {
            reject(new Error("Invalid JSON response: " + body.slice(0, 300)));
          }
        });
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout (60s)"));
    });
    req.write(data);
    req.end();
  });
}

// ============================================================================
// RUN SINGLE REQUEST
// ============================================================================

async function runSingleRequest(provider, model, prompt, mode) {
  const systemContent = mode === "compressed"
    ? [
        prompt.system,
        "",
        "---",
        "IMPORTANT INSTRUCTION:",
        "1. Remove ALL extra blank lines in code",
        "2. Remove extra indentation (use minimal spacing)",
        "3. Keep code on same line when possible",
        "4. ONLY remove spacing, NEVER remove code/comments",
        "5. Preserve all logic, comments, and structure",
        "6. Return ONLY code with minimal whitespace",
      ].join("\n")
    : prompt.system;

  const response = await apiRequest(
    provider,
    [
      { role: "system", content: systemContent },
      { role: "user", content: prompt.prompt },
    ],
    model.id
  );

  return response;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const startTime = Date.now();

  // Filter available providers
  const availableProviders = PROVIDERS.filter(p => p.apiKey);
  
  if (availableProviders.length === 0) {
  console.log("No API keys found. Please set one or more of:");
  console.log("  OPENROUTER_API_KEY, CEREBRAS_API_KEY, NVIDIA_API_KEY\n");
    return;
  }

  console.log("=== MULTI-PROVIDER BENCHMARK ===\n");
  console.log("Available providers:", availableProviders.map(p => p.label).join(", "));
  console.log("Models:", availableProviders.reduce((sum, p) => sum + p.models.length, 0));
  console.log("Prompts:", SAMPLE_PROMPTS.length);
  console.log("Total API calls: ~", availableProviders.length * availableProviders.reduce((sum, p) => sum + p.models.length, 0) * SAMPLE_PROMPTS.length * 2, "\n");

  const allResults = [];
  const allResponses = new Map(); // Store raw responses for analysis

  for (const provider of availableProviders) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`PROVIDER: ${provider.label}`);
    console.log(`${"=".repeat(60)}\n`);

    for (const model of provider.models) {
      console.log(`Model: ${model.label} (${model.id})`);

      for (const prompt of SAMPLE_PROMPTS) {
        console.log(`  Prompt: "${prompt.name}"`);

        try {
          // Normal mode
          const normalResp = await runSingleRequest(provider, model, prompt, "normal");
          const normalTokens = normalResp.usage.completion_tokens;
          console.log(`    Normal:    ${normalTokens} tokens`);

          await new Promise(r => setTimeout(r, 800)); // Rate limit delay

          // Compressed mode
          const compressedResp = await runSingleRequest(provider, model, prompt, "compressed");
          const compressedTokens = compressedResp.usage.completion_tokens;
          console.log(`    Compressed: ${compressedTokens} tokens`);

          const savings = ((normalTokens - compressedTokens) / normalTokens) * 100;
          const inputTokens = normalResp.usage.prompt_tokens;

          allResults.push({
            provider: provider.label,
            model: model.label,
            modelId: model.id,
            prompt: prompt.name,
            category: prompt.category,
            normalTokens,
            compressedTokens,
            inputTokens,
            savings: parseFloat(savings.toFixed(1)),
          });

          // Store for analysis
          const key = `${provider.id}-${model.id}-${prompt.name}`;
          const sample = SAMPLE_PROMPTS.find(p => p.name === prompt.name);
          const minified = minifyWhitespace("dummy"); // Just needs the function
          allResponses.set(key, {
            normal: normalTokens,
            compressed: compressedTokens,
          });

          console.log(`    Savings:   ${savings.toFixed(1)}% (input: ${inputTokens} tokens)`);
        } catch (error) {
          console.log(`    ERROR: ${error.message}`);
          await new Promise(r => setTimeout(r, 3000)); // Longer delay on error
        }

        await new Promise(r => setTimeout(r, 500)); // Small delay between prompts
      }
      
      console.log("");
    }
  }

  const totalDuration = (Date.now() - startTime);

  // ============================================================================
  // RESULTS ANALYSIS
  // ============================================================================

  console.log(`\n${"=".repeat(60)}`);
  console.log("BENCHMARK COMPLETE");
  console.log(`${"=".repeat(60)}\n`);
  console.log(`Total elapsed time: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`Total API calls successful: ${allResults.length}\n`);

  // Results by provider
  const resultsByProvider = {};
  for (const r of allResults) {
    if (!resultsByProvider[r.provider]) resultsByProvider[r.provider] = [];
    resultsByProvider[r.provider].push(r);
  }

  for (const provider in resultsByProvider) {
    const pResults = resultsByProvider[provider];
    const avgSavings = pResults.reduce((s, r) => s + r.savings, 0) / pResults.length;
    const avgInput = pResults.reduce((s, r) => s + r.inputTokens, 0) / pResults.length;

    console.log(`Provider: ${provider} (${pResults.length} results)`);
    console.log(`  Avg input tokens: ${avgInput.toFixed(0)}`);
    console.log(`  Avg token savings: ${avgSavings.toFixed(1)}%`);
    console.log(`  Total tokens saved: ${pResults.reduce((s, r) => s + (r.normalTokens - r.compressedTokens), 0)}`);
    console.log("");
  }

  // Results by model
  const resultsByModel = {};
  for (const r of allResults) {
    const key = `${r.provider} - ${r.model}`;
    if (!resultsByModel[key]) resultsByModel[key] = [];
    resultsByModel[key].push(r);
  }

  console.log("Detailed results by model:");
  console.log("-".repeat(70));

  for (const modelKey in resultsByModel) {
    const mResults = resultsByModel[modelKey];
    const avgSavings = mResults.reduce((s, r) => s + r.savings, 0) / mResults.length;
    
    console.log(`\n${modelKey}:`);
    for (const r of mResults) {
      console.log(`  ${r.prompt.padEnd(30)} ${r.normalTokens.toString().padStart(5)} -> ${r.compressedTokens.toString().padStart(5)} (${r.savings.toString().padStart(5)}%)`);
    }
    console.log(`  Average savings: ${avgSavings.toFixed(1)}%`);
  }

  // Results by prompt (across all providers)
  const resultsByPrompt = {};
  for (const r of allResults) {
    if (!resultsByPrompt[r.prompt]) resultsByPrompt[r.prompt] = [];
    resultsByPrompt[r.prompt].push(r);
  }

  console.log("\n" + "-".repeat(70));
  console.log("Savings by prompt (averaged across models):");
  console.log("-".repeat(70));

  for (const promptName in resultsByPrompt) {
    const prResults = resultsByPrompt[promptName];
    const avgSavings = prResults.reduce((s, r) => s + r.savings, 0) / prResults.length;
    const providers = [...new Set(prResults.map(r => r.provider))];
    
    console.log(`\n${promptName}:`);
    console.log(`  Providers tested: ${providers.join(", ")}`);
    console.log(`  Average savings: ${avgSavings.toFixed(1)}%`);
    console.log(`  Range: ${Math.min(...prResults.map(r => r.savings)).toFixed(1)}% - ${Math.max(...prResults.map(r => r.savings)).toFixed(1)}%`);
  }

  // Overall overall
  const allSavings = allResults.map(r => r.savings);
  console.log("\n" + "=".repeat(70));
  console.log("OVERALL SUMMARY");
  console.log("=".repeat(70));
  console.log(`Providers: ${Object.keys(resultsByProvider).join(", ")}`);
  if (allSavings.length > 0) {
    console.log(`Avg savings across all: ${(allSavings.reduce((a, b) => a + b, 0) / allSavings.length).toFixed(1)}%`);
    console.log(`Min individual savings: ${Math.min(...allSavings).toFixed(1)}%`);
    console.log(`Max individual savings: ${Math.max(...allSavings).toFixed(1)}%`);
  } else {
    console.log("No successful API calls to summarize.");
  }

  // Best performing combinations
  console.log("\n--- Top 5 best savings ---");
  const sorted = [...allResults].sort((a, b) => b.savings - a.savings);
  for (const r of sorted.slice(0, 5)) {
    console.log(`  ${(r.provider + " - " + r.model).padEnd(30)} ${r.prompt} -> ${r.savings}%`);
  }

  // Worst performing combinations
  console.log("\n--- Bottom 5 savings ---");
  for (const r of sorted.slice(-5).reverse()) {
    console.log(`  ${(r.provider + " - " + r.model).padEnd(30)} ${r.prompt} -> ${r.savings}%`);
  }

  // ============================================================================
  // SAVE RESULTS
  // ============================================================================

  fs.mkdirSync(testOutputDir, { recursive: true });

  const resultsJson = {
    generatedAt: new Date().toISOString(),
    elapsedTimeMs: totalDuration,
    totalCalls: allResults.length,
    providers: availableProviders.map(p => ({
      id: p.id,
      label: p.label,
      models: p.models.map(m => m.id),
    })),
    results: allResults,
    summary: {
      providers: Object.keys(resultsByProvider),
      avgSavingsByProvider: Object.fromEntries(
        Object.entries(resultsByProvider).map(([provider, results]) => [
          provider,
          results.reduce((s, r) => s + r.savings, 0) / results.length,
        ])
      ),
      avgSavingsOverall: allSavings.reduce((a, b) => a + b, 0) / allSavings.length,
    },
  };

  fs.writeFileSync(
    path.join(testOutputDir, "results.json"),
    JSON.stringify(resultsJson, null, 2)
  );

  // Markdown summary
  const mdLines = [
    "# Multi-Provider API Benchmark Results",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Provider(s): ${Object.keys(resultsByProvider).join(", ")}`,
    `Total API calls: ${allResults.length}`,
    `Elapsed time: ${(totalDuration / 1000).toFixed(1)}s`,
    "",
    "## Overall Summary",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| **Avg Savings (%):** | ${allSavings.reduce((a, b) => a + b, 0) / allSavings.length.toFixed(1)}% |`,
    `| Min Savings: | ${Math.min(...allSavings).toFixed(1)}% |`,
    `| Max Savings: | ${Math.max(...allSavings).toFixed(1)}% |`,
    `| Total Tokens Saved: | ${allResults.reduce((s, r) => s + (r.normalTokens - r.compressedTokens), 0)} |`,
    "",
    "## Savings by Provider",
    "",
    "| Provider | Avg Input Tokens | Avg Savings | Total Saved |",
    "|----------|-----------------|-------------|-------------|",
  ];

  for (const provider in resultsByProvider) {
    const pResults = resultsByProvider[provider];
    const avgInput = pResults.reduce((s, r) => s + r.inputTokens, 0) / pResults.length;
    const avgSavings = pResults.reduce((s, r) => s + r.savings, 0) / pResults.length;
    const totalSaved = pResults.reduce((s, r) => s + (r.normalTokens - r.compressedTokens), 0);
    mdLines.push(`| ${provider} | ${avgInput.toFixed(0)} | ${avgSavings.toFixed(1)}% | ${totalSaved} |`);
  }

  mdLines.push("");
  mdLines.push("## Savings by Model");
  mdLines.push("");
  mdLines.push("| Model | Prompt | Normal | Compressed | Savings |");
  mdLines.push("|-------|--------|--------|------------|---------|");

  for (const r of sorted) {
    mdLines.push(`| ${r.provider} - ${r.model} | ${r.prompt} | ${r.normalTokens} | ${r.compressedTokens} | ${r.savings}% |`);
  }

  mdLines.push("");
  mdLines.push("---");
  mdLines.push("See `results.json` for full data.");

  fs.writeFileSync(
    path.join(testOutputDir, "summary.md"),
    mdLines.join("\n")
  );

  console.log("\nResults saved to:");
  console.log(`  ${path.join(testOutputDir, "results.json")}`);
  console.log(`  ${path.join(testOutputDir, "summary.md")}`);
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
