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

// --- FUNGSI BARU: Penerjemah menggunakan Mistral ---
async function translateWithMistral(text, apiKey) {
  console.log(`📝 Menerjemahkan teks dengan Mistral: "${text}"`);
  
  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          {
            role: "system",
            content: "You are a direct translation engine. Your only task is to translate the user's text from Indonesian to English. Do not add any extra words, explanations, or formatting. Your response must be only the English translation.",
          },
          { role: "user", content: text },
        ],
        temperature: 0,
        max_tokens: 100, // Batas yang wajar untuk sebuah terjemahan
      }),
    });

    if (!response.ok) {
      throw new Error(`Mistral translation API error: ${response.status}`);
    }

    const result = await response.json();
    const translatedText = result.choices?.[0]?.message?.content.trim();

    if (translatedText) {
      console.log(`✅ Terjemahan Mistral berhasil: "${translatedText}"`);
      return translatedText;
    } else {
      throw new Error("Gagal mendapatkan hasil terjemahan dari Mistral.");
    }
  } catch (error) {
    console.error("💥 Error saat menerjemahkan dengan Mistral:", error);
    return text; // Fallback ke teks asli jika gagal
  }
}

// ---- Endpoint Handler ----
export async function POST(req) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

    if (!modelState.isReady) {
        await loadEmbedder();
    }

    const { question } = await req.json(); // Pertanyaan asli dalam Bahasa Indonesia
    if (!question) {
      return NextResponse.json({ error: "Question required" }, { status: 400 });
    }
    console.log("🔎 Pertanyaan Asli (ID):", question);

    // --- LANGKAH BARU: Terjemahkan dengan Mistral ---
    const englishQuestion = await translateWithMistral(question, MISTRAL_API_KEY);
    
    const embedder = modelState.instance;

    // Gunakan pertanyaan yang sudah diterjemahkan untuk embedding
    const out = await embedder(englishQuestion, { pooling: "mean", normalize: true });
    const queryVector = toVector(out);

    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: queryVector,
      match_count: 5,
      match_threshold: 0.3,
    });
    if (error) throw new Error(`Supabase RPC error: ${error.message}`);

    const context = (data || [])
      .map((d, i) => {
        const meta = safeJSON(d.metadata);
        const title = meta.title || "Unknown";
        const snippet = (d.content || "").slice(0, 500) + (d.content.length > 500 ? "..." : "");
        return `[${i + 1}] (Sumber: ${title})\n${snippet}`;
      })
      .join("\n\n");

    // Panggilan kedua ke Mistral untuk jawaban akhir
    const finalPrompt = `You are a helpful research assistant for herbal medicine. Use the following context to answer the question.\n\nContext:\n${context || "(no context found)"}\n\nQuestion: ${question}\nAnswer in Bahasa Indonesia (use bullet points if possible) and include sources (titles).`.trim();
    
    let answer = "(retrieval only)";
    if (MISTRAL_API_KEY) {
        const mr = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
            body: JSON.stringify({
                model: "mistral-small-latest",
                messages: [
                    { role: "system", content: "You are a helpful assistant for herbal medicine." },
                    { role: "user", content: finalPrompt },
                ],
            }),
        });
        const mj = await mr.json();
        if (!mr.ok) throw new Error(`Mistral answer API error: ${mr.status}`);
        answer = mj.choices?.[0]?.message?.content ?? "(no answer)";
    }

    return NextResponse.json({
        answer,
        retrieved_docs: (data || []).slice(0, 5).map((d, i) => ({
            rank: i + 1,
            title: safeJSON(d.metadata).title || "Unknown",
            similarity: typeof d.similarity === "number" ? d.similarity.toFixed(4) : "n/a",
            snippet: (d.content || "").slice(0, 200) + "...",
        })),
    });

  } catch (err) {
    console.error("💥 Error in /api/query:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
