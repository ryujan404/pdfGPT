// ✅ REFACTORED for Cloud Deployment with Supabase

import { NextResponse } from "next/server";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { createClient } from "@supabase/supabase-js";


// Export named function POST (or GET, PUT, DELETE, etc.)
export async function POST(request) {
  try {
    // Get form data (for file uploads)
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({
        success: false,
        message: "No file uploaded",
      });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({
        success: false,
        message: "File is not a PDF",
      });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // create a blob outof the buffer
    const blob = new Blob([buffer], { type: "application/pdf" });

    // load the pdf
    const loader = new PDFLoader(blob);

    // it will extract the text from the pdf
    const docs = await loader.load();

    // here the breaking configuration is set
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000, //per chunk will have 1000 characters
      chunkOverlap: 200, //basically here we say that last 200 characters of previous chunk will be the first 200 characters of the next chunk
    });

    // here the actual splitting is happening
    const chunks = await textSplitter.splitDocuments(docs);

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

    // ✅ Store vectors in Supabase (RAW SQL - bulletproof method)
    
    // Generate embeddings for all chunks manually
    for (const chunk of chunks) {
      const embedding = await embeddings.embedQuery(chunk.pageContent);
      
      // Convert embedding array to PostgreSQL vector format (with brackets)
      const vectorString = `[${embedding.join(',')}]`;
      
      // Insert using raw SQL to ensure proper vector type
      const { error: insertError } = await supabaseClient.rpc('insert_document', {
        p_content: chunk.pageContent,
        p_metadata: chunk.metadata,
        p_embedding: vectorString
      });
      
      if (insertError) {
        console.error("❌ Insert error:", insertError);
        throw new Error(`Failed to insert document: ${insertError.message}`);
      }
    }
    
    // Verify the documents were stored WITH proper embeddings
    const { data: verifyData, error: verifyError } = await supabaseClient
      .rpc('check_embedding_dimensions');
    
    if (verifyError) {
      
    } else if (verifyData) {
      
    }
    
    const { count } = await supabaseClient
      .from('documents')
      .select('*', { count: 'exact', head: true });
    
    return NextResponse.json({
      success: true,
      message: "PDF processed successfully",
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
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
