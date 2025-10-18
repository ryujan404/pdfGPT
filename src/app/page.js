"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPdfReady, setIsPdfReady] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [chatHistory, setChatHistory] = useState([]);

  // Handle file selection
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setUploadStatus("");
    } else {
      alert("Please select a PDF file!");
    }
  };

  // Upload PDF to API
  const handleUpload = async () => {
    if (!file) {
      alert("Please select a PDF file first!");
      return;
    }

    setIsUploading(true);
    setUploadStatus("Uploading and processing PDF...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setIsPdfReady(true);
        setUploadStatus("✅ PDF processed! You can now ask questions.");
      } else {
        setUploadStatus("❌ Error: " + data.message);
      }
    } catch (error) {
      setUploadStatus("❌ Error uploading PDF: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Ask question to API
  const handleAskQuestion = async (e) => {
    e.preventDefault();
    
    if (!isPdfReady) {
      alert("Please upload a PDF first!");
      return;
    }

    if (!question.trim()) {
      alert("Please enter a question!");
      return;
    }

    setIsGenerating(true);
    setAnswer("Generating answer...");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      if (data.success) {
        setAnswer(data.answer);
        setChatHistory([...chatHistory, { question, answer: data.answer }]);
        setQuestion("");
      } else {
        setAnswer("❌ Error: " + data.message);
      }
    } catch (error) {
      setAnswer("❌ Error: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="canvas-container">
      <div className="canvas-content">
        {/* Header */}
        <div className="header">
          <h1 className="title">📄 pdfGPT</h1>
          <p className="subtitle">Upload a PDF and ask questions about it</p>
        </div>

        {/* Upload Section */}
        <div className="upload-section">
          <div className="file-input-wrapper">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="file-input"
              id="file-upload"
              disabled={isUploading}
            />
            <label htmlFor="file-upload" className="file-label">
              {file ? `📄 ${file.name}` : "Choose PDF File"}
            </label>
            
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="upload-button"
            >
              {isUploading ? "Processing..." : "Upload & Process"}
            </button>
          </div>

          {uploadStatus && (
            <div className={`status-message ${isPdfReady ? "success" : ""}`}>
              {uploadStatus}
            </div>
          )}
        </div>

        {/* Chat Section */}
        {isPdfReady && (
          <>
            {/* Chat History */}
            <div className="chat-history">
              {chatHistory.length === 0 ? (
                <p className="empty-state">Ask a question about your PDF below!</p>
              ) : (
                chatHistory.map((chat, index) => (
                  <div key={index} className="chat-item">
                    <div className="question-bubble">
                      <strong>Q:</strong> {chat.question}
                    </div>
                    <div className="answer-bubble">
                      <strong>A:</strong> {chat.answer}
                    </div>
                  </div>
                ))
              )}
              
              {/* Current Answer */}
              {answer && chatHistory.length === 0 && (
                <div className="chat-item">
                  <div className="answer-bubble">
                    <strong>A:</strong> {answer}
                  </div>
                </div>
              )}
            </div>

            {/* Question Input */}
            <form onSubmit={handleAskQuestion} className="question-form">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about your PDF..."
                className="question-input"
                disabled={isGenerating}
              />
              <button
                type="submit"
                disabled={isGenerating || !question.trim()}
                className="ask-button"
              >
                {isGenerating ? "Thinking..." : "Ask"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
