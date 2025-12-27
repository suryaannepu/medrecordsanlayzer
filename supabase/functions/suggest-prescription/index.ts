import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { medicineName, diagnosis, patientAge, patientWeight, allergies } = await req.json();
    
    console.log("Generating prescription suggestions for:", medicineName);

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    }

    const systemPrompt = `You are a prescription assistant for doctors at a university hospital.

IMPORTANT DISCLAIMERS:
1. These are SUGGESTIONS only - the doctor makes all final decisions
2. Always recommend checking for drug interactions
3. Consider patient allergies if provided
4. This is for educational/prototype purposes only

For the given medicine, suggest:
1. Common dosages
2. Frequency options (OD, BD, TDS, QID, etc.)
3. Duration recommendations
4. Common instructions (before/after food, etc.)
5. Alternative medicines with the same salt/composition if known

Return JSON format:
{
  "medicine": string,
  "suggestions": {
    "dosage_options": ["500mg", "250mg"],
    "frequency_options": ["OD", "BD", "TDS"],
    "duration_options": ["3 days", "5 days", "7 days"],
    "instructions": ["Take after food", "Avoid dairy"],
    "alternatives": [{"name": string, "note": string}]
  },
  "warnings": string[]
}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Medicine: ${medicineName}
Diagnosis: ${diagnosis || 'Not specified'}
Patient Age: ${patientAge || 'Not specified'}
Patient Weight: ${patientWeight || 'Not specified'}
Known Allergies: ${allergies?.join(', ') || 'None known'}` 
          }
        ],
        temperature: 0.2,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate suggestions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    let suggestions = {};
    try {
      suggestions = JSON.parse(content);
    } catch {
      console.error("Failed to parse prescription suggestions");
    }

    return new Response(
      JSON.stringify(suggestions),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in suggest-prescription function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});