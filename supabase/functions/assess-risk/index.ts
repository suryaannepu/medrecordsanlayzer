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
    const { symptoms, medicalHistory } = await req.json();
    
    console.log("Assessing risk for symptoms:", symptoms);

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a triage assessment system for a university hospital.

TASK: Analyze the patient's symptoms and medical history to assign a risk score for queue prioritization.

SCORING (1-100):
- 90-100: CRITICAL - Life-threatening, needs immediate attention (chest pain, difficulty breathing, severe bleeding, stroke symptoms)
- 70-89: HIGH - Serious but not immediately life-threatening (high fever, severe pain, head injury)
- 50-69: MODERATE - Needs attention soon (moderate pain, infection symptoms, minor injuries)
- 30-49: LOW - Can wait safely (minor issues, follow-ups, routine concerns)
- 1-29: ROUTINE - Non-urgent (prescription refills, general checkups)

Consider:
1. Severity of symptoms
2. Duration of symptoms
3. Patient's medical history and risk factors
4. Potential for rapid deterioration

Return JSON: { "score": number, "priority": "CRITICAL|HIGH|MODERATE|LOW|ROUTINE", "reasoning": string }`;

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
            content: `Patient symptoms: ${symptoms}\n\nMedical history: ${medicalHistory || 'Not provided'}` 
          }
        ],
        temperature: 0.1,
        max_tokens: 512,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to assess risk" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    let assessment = { score: 50, priority: "MODERATE", reasoning: "Default assessment" };
    try {
      assessment = JSON.parse(content);
    } catch {
      console.error("Failed to parse risk assessment");
    }

    console.log("Risk assessment:", assessment);

    return new Response(
      JSON.stringify(assessment),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in assess-risk function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});