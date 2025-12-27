import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedData {
  blood_group?: string;
  lab_values?: Record<string, { value: string; unit: string }>;
  medications?: Array<{ name: string; dosage?: string; frequency?: string; duration?: string }>;
  allergies?: string[];
  diagnosis?: string[];
  vitals?: Record<string, { value: string; unit: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ocrText } = await req.json();
    
    console.log("Received OCR text for extraction, length:", ocrText?.length);

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      console.error("GROQ_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a medical data extraction system. Extract structured medical information from the provided OCR text.

IMPORTANT RULES:
1. Extract ONLY what is explicitly stated in the text
2. Do NOT infer or hallucinate any values
3. For blood group, look for A, B, AB, O followed by + or - or positive/negative
4. Correct common OCR errors: "0" or "°" near blood group context likely means "O"
5. Return JSON format only

Extract these fields if present:
- blood_group: string (e.g., "O+", "A-", "B+", "AB-")
- lab_values: object with test names as keys, each containing {value, unit}
- medications: array of {name, dosage, frequency, duration}
- allergies: array of strings
- diagnosis: array of strings
- vitals: object with vital names as keys, each containing {value, unit}

If a field is not found, omit it from the response.`;

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
          { role: "user", content: `Extract medical data from this OCR text:\n\n${ocrText}` }
        ],
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to extract medical data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    let extractedData: ExtractedData = {};
    try {
      extractedData = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse Groq response as JSON:", parseError);
      extractedData = {};
    }

    console.log("Extraction complete:", Object.keys(extractedData));

    return new Response(
      JSON.stringify({ extractedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in extract-medical function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});