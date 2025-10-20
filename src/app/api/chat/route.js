import { NextResponse } from "next/server";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

export async function POST(request) {
  try {
    const { question } = await request.json();
    if (!question) {
      return NextResponse.json({
        success: false,
        message: "Question is required",
      });
    }

    // ✅ HuggingFace embeddings (free API)
    const embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey: process.env.HUGGINGFACE_API_KEY,
      model: "sentence-transformers/all-MiniLM-L6-v2", // 384 dimensions
    });

    // ✅ Initialize Supabase client (free tier)
    const supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PRIVATE_KEY
    );

    // First, check if there are ANY documents in the database
    const { data: allDocs, error: countError } = await supabaseClient
      .from('documents')
      .select('id', { count: 'exact' });
    
    if (countError) {
      console.error("❌ Error counting documents:", countError);
    }

    // ✅ Query Supabase using direct RPC call (more reliable)
    
    const questionEmbedding = await embeddings.embedQuery(question);
    
    // Format embedding as PostgreSQL vector string
    const vectorString = `[${questionEmbedding.join(',')}]`; // ✅ With brackets
    
    
    const { data: relevantResults, error: searchError } = await supabaseClient
      .rpc('match_documents', {
        query_embedding: vectorString,
        match_count: 10, // Get more results
        filter: {}
      });
    
    if (searchError) {
      console.error("❌ Search error:", searchError);
      throw searchError;
    }
    
    if (relevantResults && relevantResults.length > 0) {
      // Filter results with very low similarity
      const filteredResults = relevantResults.filter(doc => doc.similarity > 0.01); // Very low threshold
      
      if (filteredResults.length === 0) {
        return NextResponse.json({
          success: true,
          answer: `Based on the document content: ${relevantResults[0].content.substring(0, 500)}...`,
          sourcesUsed: 1,
        });
      }
    } else {
      
    }
    
    const relevantDocs = relevantResults || [];

    if (relevantDocs.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No relevant documents found. Try asking a question related to your PDF content.",
      });
    }

    const context = relevantDocs.map((doc) => doc.content).join("\n");

    // ✅ Groq API (free tier, super fast!)
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that answers questions based on the provided context from documents. If the context doesn't contain relevant information, say so politely.",
        },
        {
          role: "user",
          content: `Context from the document:\n${context}\n\nQuestion: ${question}\n\nAnswer based on the context above:`,
        },
      ],
      model: "llama-3.3-70b-versatile", // Fast and powerful free model
      temperature: 0.7,
      max_tokens: 1024,
    });

    const answer = chatCompletion.choices[0]?.message?.content || "No answer generated";

    return NextResponse.json({
      success: true,
      answer: answer,
      sourcesUsed: relevantDocs.length,
    });
  } catch (error) {
    console.error("❌ Chat error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || String(error),
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
