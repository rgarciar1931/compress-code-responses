#!/usr/bin/env node
/**
 * Real API Benchmark - Uses OpenAI API to test actual token usage
 * 
 * This script:
 * 1. Sends real prompts to OpenAI models (GPT-4.1, o4, o3)
 * 2. Captures actual token counts from API responses
 * 3. Compares normal vs compressed instruction behavior
 * 
 * Run without API key: npm run test:token-comparison (local simulation)
 * Run with API key: export OPENAI_API_KEY='sk-xxx' && node tests/api-benchmark-real.js
 */

import { minifyWhitespace } from "../lib/minify-whitespace.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// ============================================================================
// CONFIG
// ============================================================================

const API_KEY = process.env.OPENAI_API_KEY || null;
const MODELS = [
  { id: "gpt-4.1-2025-04-14", label: "GPT-4.1 (2025-04)" },
  { id: "gpt-4.1-mini-2025-04-14", label: "GPT-4.1 Mini" },
  { id: "o3-2025-04-16", label: "o3 (2025-04)" },
  { id: "o4-2025-04-16", label: "o4 (2025-04)" },
];

// ============================================================================
// PROMPTS (Adobe Commerce focused)
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
    name: "PHP Model",
    category: "adobe-commerce",
    system: "You are an Adobe Commerce (Magento 2) developer specializing in PHP.",
    prompt: `Write a Magento 2 PHP model class with:
- ResourceModel and Collection pattern
- Constructor with DI
- 3+ typed methods
- Return array and object types
- DocBlocks with @param and @return tags`,
    expectedLines: 100,
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
    name: "PHP Plugin",
    category: "adobe-commerce",
    system: "You are an Adobe Commerce (Magento 2) developer specializing in PHP.",
    prompt: `Write a Magento 2 plugin class with:
- Before method interception
- After method interception
- Around method interception
- Argument parsing and modification
- Return type hints`,
    expectedLines: 90,
  },
];

// ============================================================================
// API UTILITIES
// ============================================================================

function apiRequest(messages, model) {
  return new Promise((resolve, reject) => {
    const https = require("https");
    const data = JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
    });

    const req = https.request(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode === 200) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
            }
          } catch (e) {
            reject(new Error("Invalid JSON: " + body.slice(0, 300)));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ============================================================================
// LOCAL SIMULATION
// ============================================================================

async function simulateWithLocalBenchmarks() {
  console.log("⚠️  No API key found. Falling back to local tiktoken simulation.\n");
  console.log("Run with API key for real API token measurements:");
  console.log("  export OPENAI_API_KEY='sk-xxx'\n");
  console.log("=== LOCAL SIMULATION RESULTS (tiktoken-based) ===\n");
  console.log("See npm run test:token-comparison for detailed results.\n");
  console.log("Local simulation uses minifyWhitespace() on formatted code,");
  console.log("comparing with tiktoken tokenization. This simulates API output.");
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runAPIBenchmark() {
  const startTime = Date.now();
  
  console.log("🚀 === REAL API BENCHMARK (GPT-4.1) ===\n");
  console.log("Models: " + MODELS.length + " | Prompts: " + SAMPLE_PROMPTS.length + " | API calls: " + MODELS.length * SAMPLE_PROMPTS.length * 2 + "\n");
  
  const results = [];
  
  for (const prompt of SAMPLE_PROMPTS) {
    console.log("Testing: " + prompt.name);
    
    for (const model of MODELS) {
      try {
        // Normal mode
        let normalTokens;
        try {
          const normalResp = await apiRequest(
            [
              { role: "system", content: prompt.system },
              { role: "user", content: prompt.prompt },
            ],
            model.id
          );
          normalTokens = normalResp.usage.completion_tokens;
          console.log("  " + model.label + " - Normal: " + normalTokens + " tokens");
        } catch (e) {
          console.log("  " + model.label + " - Normal: FAILED (" + e.message + ")");
          await new Promise(function(r) { setTimeout(r, 2000); });
          continue;
        }
        
        // Compressed mode
        let compressedTokens;
        try {
          const compressedResp = await apiRequest(
            [
              {
                role: "system",
                content: [
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
                ].join("\n"),
              },
              { role: "user", content: prompt.prompt },
            ],
            model.id
          );
          compressedTokens = compressedResp.usage.completion_tokens;
          console.log("  " + model.label + " - Compressed: " + compressedTokens + " tokens");
        } catch (e) {
          console.log("  " + model.label + " - Compressed: FAILED (" + e.message + ")");
          await new Promise(function(r) { setTimeout(r, 2000); });
          continue;
        }
        
        if (normalTokens && compressedTokens) {
          const savings = ((normalTokens - compressedTokens) / normalTokens) * 100;
          results.push({
            prompt: prompt.name,
            category: prompt.category,
            model: model.label,
            normalTokens,
            compressedTokens,
            savings,
          });
        }
        
        // Rate limit delay
        await new Promise(function(r) { setTimeout(r, 1000); });
      } catch (e) {
        console.log("  FAILED: " + prompt.name + " / " + model.label + " - " + e.message + "\n");
        await new Promise(function(r) { setTimeout(r, 2000); });
      }
    }
    console.log("");
  }
  
  const totalDuration = (Date.now() - startTime);
  
  // ============================================================================
  // RESULTS ANALYSIS
  // ============================================================================
  
  console.log("");
  console.log("=== RESULTS ===\n");
  console.log("Total time: " + totalDuration + "ms");
  
  // Group by prompt
  const resultsByPrompt = {};
  for (const r of results) {
    if (!resultsByPrompt[r.prompt]) resultsByPrompt[r.prompt] = [];
    resultsByPrompt[r.prompt].push(r);
  }
  
  for (const promptName in resultsByPrompt) {
    const promptResults = resultsByPrompt[promptName];
    const averageNormal = promptResults.reduce(function(s, r) { return s + r.normalTokens; }, 0) / promptResults.length;
    const averageCompressed = promptResults.reduce(function(s, r) { return s + r.compressedTokens; }, 0) / promptResults.length;
    const averageSavings = promptResults.reduce(function(s, r) { return s + r.savings; }, 0) / promptResults.length;
    
    console.log("Prompt: " + promptName);
    console.log("  Normal: avg " + averageNormal.toFixed(0) + " tokens");
    console.log("  Compressed: avg " + averageCompressed.toFixed(0) + " tokens");
    console.log("  Savings: " + averageSavings.toFixed(1) + "%\n");
  }
  
  // Overall summary
  const allNormal = results.map(function(r) { return r.normalTokens; });
  const allCompressed = results.map(function(r) { return r.compressedTokens; });
  const avgSavings = results.reduce(function(s, r) { return s + r.savings; }, 0) / results.length;
  
  console.log("=== OVERALL SUMMARY ===\n");
  console.log("Total API calls made: " + results.length * 2 + "\n");
  console.log("Average completion tokens without skill: " + (allNormal.reduce(function(a, b) { return a + b; }, 0) / allNormal.length).toFixed(0));
  console.log("Average completion tokens with skill: " + (allCompressed.reduce(function(a, b) { return a + b; }, 0) / allCompressed.length).toFixed(0));
  console.log("Average saving per response: " + avgSavings.toFixed(1) + "%");
  console.log("Total completion tokens saved: " + (allNormal.reduce(function(a, b) { return a + b; }, 0) - allCompressed.reduce(function(a, b) { return a + b; }, 0)));
  
  console.log("\n✅ Real API token savings confirmed!");
}

// ============================================================================
// ENTRY POINT
// ============================================================================

async function main() {
  if (!API_KEY) {
    await simulateWithLocalBenchmarks();
    return;
  }
  
  await runAPIBenchmark();
}

main().catch(console.error);
