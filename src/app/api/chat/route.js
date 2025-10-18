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
    
    console.log(`📊 Total documents in database: ${allDocs?.length || 0}`);
    
    if (countError) {
      console.error("❌ Error counting documents:", countError);
    }

    // ✅ Query Supabase using direct RPC call (more reliable)
    console.log(`\n🔍 ========== SEARCH DEBUG ==========`);
    console.log(`📝 Question: "${question}"`);
    
    const questionEmbedding = await embeddings.embedQuery(question);
    console.log(`✅ Generated embedding with ${questionEmbedding.length} dimensions`);
    console.log(`📊 First 5 values: [${questionEmbedding.slice(0, 5).join(', ')}...]`);
    
    // Format embedding as PostgreSQL vector string
    const vectorString = `[${questionEmbedding.join(',')}]`; // ✅ With brackets

    console.log(`📦 Vector string length: ${vectorString.length} characters`);
    
    console.log(`🚀 Calling match_documents with:`);
    console.log(`   - match_count: 10`);
    console.log(`   - filter: {}`);
    
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
    
    console.log(`✅ Search completed!`);
    console.log(`📊 Found ${relevantResults?.length || 0} documents`);
    
    if (relevantResults && relevantResults.length > 0) {
      console.log(`\n📄 Search Results:`);
      relevantResults.forEach((doc, idx) => {
        console.log(`   ${idx + 1}. Doc ID: ${doc.id}`);
        console.log(`      Similarity: ${(doc.similarity * 100).toFixed(2)}%`);
        console.log(`      Content preview: ${doc.content.substring(0, 100)}...`);
      });
      
      // Filter results with very low similarity
      const filteredResults = relevantResults.filter(doc => doc.similarity > 0.01); // Very low threshold
      console.log(`\n🔍 After filtering (similarity > 0.01): ${filteredResults.length} results`);
      
      if (filteredResults.length === 0) {
        console.log(`⚠️  All results have very low similarity. Using top result anyway...`);
        return NextResponse.json({
          success: true,
          answer: `Based on the document content: ${relevantResults[0].content.substring(0, 500)}...`,
          sourcesUsed: 1,
        });
      }
    } else {
      console.log(`⚠️  No documents returned from search!`);
    }
    console.log(`========================================\n`)
    
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

    console.log("✅ Answer generated with Groq!");

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
