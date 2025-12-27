import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, studentId, medicalContext } = await req.json();
    
    console.log("Received request:", { question, studentId, hasContext: !!medicalContext });

    // Get Groq API key from environment
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      console.error("GROQ_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the system prompt for medical analysis
    const systemPrompt = `You are MediAnalyzer, a medical record analysis assistant for a university hospital system.

CRITICAL RULES:
1. You can ONLY answer questions based on the provided medical records.
2. If the answer cannot be found in the records, respond EXACTLY: "Not found in your medical records."
3. NEVER make up or hallucinate medical information.
4. NEVER provide general medical advice.
5. Always cite which report contains the information.
6. Be concise and factual.

When answering:
- Quote specific values from the records
- Mention the report date and type
- If multiple reports exist, compare them chronologically if relevant`;

    // Build context from medical records
    let contextMessage = "PATIENT'S MEDICAL RECORDS:\n\n";
    
    if (medicalContext && medicalContext.length > 0) {
      for (const record of medicalContext) {
        contextMessage += `--- Report: ${record.document_type || 'Unknown'} (${record.report_date || record.created_at}) ---\n`;
        if (record.extracted_facts && record.extracted_facts.length > 0) {
          for (const fact of record.extracted_facts) {
            contextMessage += `• ${fact.name}: ${fact.value} ${fact.unit || ''}\n`;
          }
        }
        if (record.corrected_text) {
          contextMessage += `\nRaw text:\n${record.corrected_text.substring(0, 500)}...\n`;
        }
        contextMessage += "\n";
      }
    } else {
      contextMessage += "No medical records found for this patient.\n";
    }

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: contextMessage },
      { role: "user", content: `Patient question: ${question}` }
    ];

    console.log("Calling Groq API...");

    // Call Groq API
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: messages,
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to analyze medical records" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "Unable to process your question.";

    console.log("Groq response received successfully");

    // Find relevant reports for proof
    const relevantReports: string[] = [];
    if (medicalContext) {
      for (const record of medicalContext) {
        // Check if any extracted fact is mentioned in the answer
        if (record.extracted_facts) {
          for (const fact of record.extracted_facts) {
            if (answer.toLowerCase().includes(fact.name.toLowerCase()) ||
                answer.toLowerCase().includes(fact.value.toLowerCase())) {
              if (!relevantReports.includes(record.id)) {
                relevantReports.push(record.id);
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        answer,
        relevantReports,
        model: "llama-3.3-70b-versatile"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-medical function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});