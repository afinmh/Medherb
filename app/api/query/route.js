import { createClient } from "@supabase/supabase-js";
import { pipeline } from "@xenova/transformers";
import { NextResponse } from "next/server";

// --- State Management untuk Model (Tetap sama) ---
export const modelState = {
  instance: null,
  isLoading: false,
  isReady: false,
};

export async function loadEmbedder() {
  if (modelState.instance || modelState.isLoading) return;
  modelState.isLoading = true;
  console.log("🔄 Loading embedder (Xenova/all-MiniLM-L6-v2)...");
  try {
    modelState.instance = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("✅ Embedder loaded!");
  } catch(e) {
    console.error("❌ Failed loading embedder, trying fallback...", e);
    modelState.instance = await pipeline("feature-extraction", "sentence-transformers/all-MiniLM-L6-v2");
    console.log("✅ Fallback embedder loaded!");
  }
  modelState.isReady = true;
  modelState.isLoading = false;
}

// ---- Helper (Tetap sama) ----
function safeJSON(x) {
  if (!x) return {};
  if (typeof x === "object") return x;
  try { return JSON.parse(x); } catch { return {}; }
}

function toVector(output) {
    if (output?.data instanceof Float32Array) return Array.from(output.data);
    const maybeTensor = Array.isArray(output) ? output[0] : null;
    if (maybeTensor?.data instanceof Float32Array) return Array.from(maybeTensor.data);
    if (Array.isArray(output) && typeof output[0] === "number") return output;
    throw new Error("Unknown embedding output shape.");
}

// ---- PERBAIKAN: Jangan inisialisasi Supabase di sini ----
// const supabase = createClient(...); // <-- Hapus baris ini dari sini

// ---- Endpoint Handler ----
export async function POST(req) {
  try {
    // PERBAIKAN: Inisialisasi Supabase di dalam handler
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

    if (!modelState.isReady) {
        await loadEmbedder();
    }

    const { question } = await req.json();
    if (!question) {
      return NextResponse.json({ error: "Question required" }, { status: 400 });
    }
    console.log("🔎 Question:", question);

    const embedder = modelState.instance;

    console.time("⏱ embed_time");
    const out = await embedder(question, { pooling: "mean", normalize: true });
    console.timeEnd("⏱ embed_time");
    const queryVector = toVector(out);
    console.log("🧭 Embedding dim:", queryVector.length);

    console.time("⏱ supabase_rpc_time");
    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: queryVector,
      match_count: 5,
      match_threshold: 0.3,
    });
    console.timeEnd("⏱ supabase_rpc_time");
    if (error) throw new Error(`Supabase RPC error: ${error.message}`);
    console.log("📦 Retrieved docs:", data?.length || 0);

    const context = (data || [])
      .map((d, i) => {
        const meta = safeJSON(d.metadata);
        const title = meta.title || "Unknown";
        const sim = typeof d.similarity === "number" ? d.similarity.toFixed(4) : "n/a";
        const snippet = (d.content || "").slice(0, 500) + (d.content.length > 500 ? "..." : "");
        return `[${i + 1}] [Similarity: ${sim}] (Sumber: ${title})\n${snippet}`;
      })
      .join("\n\n");

    const prompt = `You are a helpful research assistant for herbal medicine. Use the following context to answer the question.\n\nContext:\n${context || "(no context found)"}\n\nQuestion: ${question}\nAnswer in Bahasa Indonesia (use bullet points if possible) and include sources (titles).`.trim();
    
    let answer = "(retrieval only — no Mistral API key)";
    if (MISTRAL_API_KEY) {
        console.time("⏱ mistral_time");
        const mr = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
            body: JSON.stringify({
                model: "mistral-small-latest",
                messages: [
                    { role: "system", content: "You are a helpful assistant for herbal medicine." },
                    { role: "user", content: prompt },
                ],
            }),
        });
        const mj = await mr.json();
        console.timeEnd("⏱ mistral_time");
        if (!mr.ok) throw new Error(`Mistral error ${mr.status}: ${JSON.stringify(mj)}`);
        answer = mj.choices?.[0]?.message?.content ?? "(no answer)";
    }

    return NextResponse.json({
        answer,
        retrieved_docs: (data || []).slice(0, 5).map((d, i) => ({
            rank: i + 1,
            title: safeJSON(d.metadata).title || "Unknown",
            similarity: typeof d.similarity === "number" ? d.similarity.toFixed(4) : "n/a",
            snippet: (d.content || "").slice(0, 200) + (d.content.length > 200 ? "..." : ""),
        })),
        debug: {
            embed_dim: queryVector.length,
            docs_total: (data || []).length,
        },
    });

  } catch (err) {
    console.error("💥 Error in /api/query:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
