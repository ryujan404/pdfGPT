## 📄 pdfGPT

AI-powered PDF document Q&A: upload a PDF, ask questions, and get grounded answers pulled from your document via semantic search with vector embeddings and a fast LLM.

### ✨ Features
- PDF upload and text extraction
- Chunking with overlap for robust retrieval
- Sentence-transformer embeddings (384-d) on Hugging Face Inference API
- Vector similarity search in Supabase (pgvector)
- Context-grounded answers with Groq LLM (Llama 3.3)
- Clean UI built with Next.js App Router and React 19

### 🧰 Tech Stack
- Frontend: Next.js 15, React 19
- AI/RAG: LangChain (loaders, splitters, embeddings), Hugging Face Inference
- Vector DB: Supabase (Postgres + pgvector)
- LLM: Groq SDK (Llama-3.3-70B Versatile)

---

## 🚀 Getting Started

### 1) Clone and install
```bash
git clone <your-repo-url>
cd pdfgpt
npm install
```

### 2) Environment variables
Create a `.env.local` at the project root with:
```bash
# Hugging Face Inference (free tier works)
HUGGINGFACE_API_KEY=your_hf_api_key

# Supabase (Project Settings → API)
SUPABASE_URL=your_supabase_project_url
SUPABASE_PRIVATE_KEY=your_service_role_key

# Groq (https://console.groq.com/)
GROQ_API_KEY=your_groq_api_key
```


