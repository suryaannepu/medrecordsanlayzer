/**
 * Medical Data Extraction Service
 * 
 * Post-processes OCR text to:
 * 1. Correct OCR errors using medical context
 * 2. Normalize symbols, abbreviations, and units
 * 3. Extract structured medical information
 */

export interface MedicalFact {
  type: 'laboratory_value' | 'vital' | 'diagnosis' | 'medication' | 'blood_group' | 'allergy' | 'test' | 'patient_info';
  name: string;
  value: string;
  unit: string;
  confidence: 'high' | 'medium' | 'low';
  interpretation_reason: string;
}

export interface ExtractedMedicalData {
  document_type: 'Blood Report' | 'Prescription' | 'Scan' | 'Receipt' | 'Unknown';
  report_date: string | null;
  extracted_facts: MedicalFact[];
  corrected_text: string;
}

// Medical abbreviation expansions
const ABBREVIATIONS: Record<string, string> = {
  'hb': 'Hemoglobin',
  'hgb': 'Hemoglobin',
  'bp': 'Blood Pressure',
  'fbs': 'Fasting Blood Sugar',
  'rbs': 'Random Blood Sugar',
  'ppbs': 'Post Prandial Blood Sugar',
  'wbc': 'White Blood Cell Count',
  'rbc': 'Red Blood Cell Count',
  'plt': 'Platelet Count',
  'esr': 'Erythrocyte Sedimentation Rate',
  'hba1c': 'Glycated Hemoglobin',
  'ldl': 'Low Density Lipoprotein',
  'hdl': 'High Density Lipoprotein',
  'tsh': 'Thyroid Stimulating Hormone',
  't3': 'Triiodothyronine',
  't4': 'Thyroxine',
  'sgpt': 'Serum Glutamic Pyruvic Transaminase',
  'sgot': 'Serum Glutamic Oxaloacetic Transaminase',
  'alt': 'Alanine Aminotransferase',
  'ast': 'Aspartate Aminotransferase',
  'bun': 'Blood Urea Nitrogen',
  'mcv': 'Mean Corpuscular Volume',
  'mch': 'Mean Corpuscular Hemoglobin',
  'mchc': 'Mean Corpuscular Hemoglobin Concentration',
  'rdw': 'Red Cell Distribution Width',
  'mpv': 'Mean Platelet Volume',
  'pcv': 'Packed Cell Volume',
  'hct': 'Hematocrit',
  'crp': 'C-Reactive Protein',
  'bnp': 'B-type Natriuretic Peptide',
  'psa': 'Prostate Specific Antigen',
  'ecg': 'Electrocardiogram',
  'ekg': 'Electrocardiogram',
  'ct': 'Computed Tomography',
  'mri': 'Magnetic Resonance Imaging',
  'usg': 'Ultrasonography',
};

// Unit normalizations
const UNIT_NORMALIZATIONS: Record<string, string> = {
  'mg%': 'mg/dL',
  'gm%': 'g/dL',
  'gm/dl': 'g/dL',
  'mg/dl': 'mg/dL',
  'mmol/l': 'mmol/L',
  'iu/l': 'IU/L',
  'u/l': 'U/L',
  'cells/cumm': 'cells/cu.mm',
  'cells/ul': 'cells/µL',
  '/cumm': '/cu.mm',
  'mm/hr': 'mm/hr',
  'sec': 'seconds',
  'secs': 'seconds',
};

/**
 * Correct common OCR errors in medical context
 */
function correctOCRErrors(text: string): string {
  let corrected = text;

  // Blood group corrections - "°", "0", "O" near blood grouping context
  corrected = corrected.replace(/\b(blood\s*(?:group|type)[:\s]*)[°0](\s*(?:positive|negative|\+|-))/gi, '$1O$2');
  corrected = corrected.replace(/\b[°0]\s*(?:positive|\+)\b/gi, 'O Positive');
  corrected = corrected.replace(/\b[°0]\s*(?:negative|-)\b/gi, 'O Negative');
  
  // Fix common character substitutions
  corrected = corrected.replace(/\bl\s*(?=\d)/gi, '1'); // l before numbers -> 1
  corrected = corrected.replace(/(?<=\d)\s*[oO](?=\s|$|\D)/g, '0'); // O after numbers -> 0
  
  // Fix Rh factor representations
  corrected = corrected.replace(/\brh\s*(?:factor)?\s*[:\s]*(?:pos|positive|\+)/gi, 'Rh Positive');
  corrected = corrected.replace(/\brh\s*(?:factor)?\s*[:\s]*(?:neg|negative|-)/gi, 'Rh Negative');

  // Normalize temperature symbols
  corrected = corrected.replace(/(\d+\.?\d*)\s*[°º]\s*[fF]/g, '$1°F');
  corrected = corrected.replace(/(\d+\.?\d*)\s*[°º]\s*[cC]/g, '$1°C');

  // Fix common medical term OCR errors
  corrected = corrected.replace(/hem[o0]gl[o0]bin/gi, 'Hemoglobin');
  corrected = corrected.replace(/plat[e3]l[e3]ts?/gi, 'Platelets');
  corrected = corrected.replace(/gl[u0]c[o0]se/gi, 'Glucose');
  corrected = corrected.replace(/ch[o0]lester[o0]l/gi, 'Cholesterol');

  return corrected;
}

/**
 * Expand medical abbreviations
 */
function expandAbbreviations(text: string): string {
  let expanded = text;
  
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    expanded = expanded.replace(regex, full);
  }
  
  return expanded;
}

/**
 * Normalize units in text
 */
function normalizeUnits(text: string): string {
  let normalized = text;
  
  for (const [variant, standard] of Object.entries(UNIT_NORMALIZATIONS)) {
    const regex = new RegExp(variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    normalized = normalized.replace(regex, standard);
  }
  
  return normalized;
}

/**
 * Extract date from text and normalize to ISO format
 */
function extractDate(text: string): string | null {
  // Various date patterns
  const patterns = [
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,  // DD/MM/YYYY or MM/DD/YYYY
    /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,  // YYYY/MM/DD
    /(\d{1,2})\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4})/i,
    /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2}),?\s*(\d{4})/i,
  ];

  const monthMap: Record<string, string> = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Try to parse and return ISO format
      try {
        if (pattern.source.includes('jan|feb')) {
          const monthMatch = text.match(/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
          if (monthMatch) {
            const month = monthMap[monthMatch[0].toLowerCase().substring(0, 3)];
            const day = match[1].padStart(2, '0');
            const year = match[2] || match[3];
            return `${year}-${month}-${day}`;
          }
        } else if (match[1].length === 4) {
          // YYYY/MM/DD format
          return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else {
          // Assume DD/MM/YYYY for medical reports
          return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Extract blood group information
 */
function extractBloodGroup(text: string): MedicalFact | null {
  const patterns = [
    /blood\s*(?:group|type)[:\s]*([AaBbOo0°])\s*(positive|negative|\+|-)/i,
    /\b([AaBbOo0°])\s*(positive|negative|\+|-)\s*(?:blood)?/i,
    /\b([AaBbOo0°])([+-])\b/,
    /blood\s*(?:group|type)[:\s]*([AaBbOo0°]{1,2})\s*(?:rh)?\s*(pos|neg|\+|-)?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let group = match[1].toUpperCase();
      if (group === '0' || group === '°') group = 'O';
      
      let rh = match[2]?.toLowerCase() || '';
      if (rh === '+' || rh === 'pos' || rh === 'positive') rh = '+';
      else if (rh === '-' || rh === 'neg' || rh === 'negative') rh = '-';
      else rh = '';

      return {
        type: 'blood_group',
        name: 'Blood Group',
        value: `${group}${rh}`,
        unit: '',
        confidence: 'high',
        interpretation_reason: `Extracted blood group ${group}${rh} from document`
      };
    }
  }

  return null;
}

/**
 * Extract laboratory values
 */
function extractLabValues(text: string): MedicalFact[] {
  const facts: MedicalFact[] = [];
  
  const labPatterns = [
    { pattern: /hemoglobin[:\s]*(\d+\.?\d*)\s*(g\/dL|g%|gm%)?/i, name: 'Hemoglobin', unit: 'g/dL', type: 'laboratory_value' as const },
    { pattern: /(?:wbc|white\s*blood\s*cell)[:\s]*(\d+\.?\d*)\s*(cells\/cu\.?mm|\/cumm|cells\/µL)?/i, name: 'White Blood Cell Count', unit: 'cells/cu.mm', type: 'laboratory_value' as const },
    { pattern: /(?:rbc|red\s*blood\s*cell)[:\s]*(\d+\.?\d*)\s*(million\/cu\.?mm|cells\/µL)?/i, name: 'Red Blood Cell Count', unit: 'million/cu.mm', type: 'laboratory_value' as const },
    { pattern: /platelet[s]?[:\s]*(\d+\.?\d*)\s*(lakh|thousand|\/cu\.?mm|cells\/µL)?/i, name: 'Platelet Count', unit: '/cu.mm', type: 'laboratory_value' as const },
    { pattern: /(?:fasting\s*)?(?:blood\s*)?sugar[:\s]*(\d+\.?\d*)\s*(mg\/dL|mg%)?/i, name: 'Blood Sugar', unit: 'mg/dL', type: 'laboratory_value' as const },
    { pattern: /glucose[:\s]*(\d+\.?\d*)\s*(mg\/dL|mg%|mmol\/L)?/i, name: 'Glucose', unit: 'mg/dL', type: 'laboratory_value' as const },
    { pattern: /cholesterol[:\s]*(\d+\.?\d*)\s*(mg\/dL)?/i, name: 'Cholesterol', unit: 'mg/dL', type: 'laboratory_value' as const },
    { pattern: /(?:bp|blood\s*pressure)[:\s]*(\d+)\s*\/\s*(\d+)\s*(mmHg)?/i, name: 'Blood Pressure', unit: 'mmHg', type: 'vital' as const },
    { pattern: /pulse[:\s]*(\d+)\s*(\/min|bpm)?/i, name: 'Pulse Rate', unit: 'bpm', type: 'vital' as const },
    { pattern: /temperature[:\s]*(\d+\.?\d*)\s*(°?[FC])?/i, name: 'Temperature', unit: '°F', type: 'vital' as const },
    { pattern: /esr[:\s]*(\d+\.?\d*)\s*(mm\/hr)?/i, name: 'ESR', unit: 'mm/hr', type: 'laboratory_value' as const },
    { pattern: /hba1c[:\s]*(\d+\.?\d*)\s*(%)?/i, name: 'HbA1c', unit: '%', type: 'laboratory_value' as const },
    { pattern: /creatinine[:\s]*(\d+\.?\d*)\s*(mg\/dL)?/i, name: 'Creatinine', unit: 'mg/dL', type: 'laboratory_value' as const },
    { pattern: /urea[:\s]*(\d+\.?\d*)\s*(mg\/dL)?/i, name: 'Urea', unit: 'mg/dL', type: 'laboratory_value' as const },
  ];

  for (const { pattern, name, unit, type } of labPatterns) {
    const match = text.match(pattern);
    if (match) {
      let value = match[1];
      if (name === 'Blood Pressure' && match[2]) {
        value = `${match[1]}/${match[2]}`;
      }
      
      facts.push({
        type,
        name,
        value,
        unit: match[2] || match[3] || unit,
        confidence: 'high',
        interpretation_reason: `Extracted ${name} value from document`
      });
    }
  }

  return facts;
}

/**
 * Extract medication information
 */
function extractMedications(text: string): MedicalFact[] {
  const facts: MedicalFact[] = [];
  
  // Common medication patterns
  const medPatterns = [
    /tab(?:let)?\.?\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(\d+\s*mg)?/gi,
    /cap(?:sule)?\.?\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(\d+\s*mg)?/gi,
    /syp?\.?\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(\d+\s*ml)?/gi,
    /inj\.?\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)/gi,
  ];

  const dosagePattern = /(\d+)\s*(?:times?|x)\s*(?:a\s*)?(?:day|daily)|(?:od|bd|tds|qid)/gi;
  const durationPattern = /(?:for\s*)?(\d+)\s*(?:days?|weeks?|months?)/gi;

  for (const pattern of medPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const medName = match[1].trim();
      const dosage = match[2] || '';
      
      // Skip common false positives
      if (['the', 'and', 'for', 'with'].includes(medName.toLowerCase())) continue;
      
      facts.push({
        type: 'medication',
        name: medName,
        value: dosage,
        unit: '',
        confidence: 'medium',
        interpretation_reason: `Medication extracted from prescription context`
      });
    }
  }

  return facts;
}

/**
 * Detect document type from content
 */
function detectDocumentType(text: string): ExtractedMedicalData['document_type'] {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('blood') && (lowerText.includes('report') || lowerText.includes('test'))) {
    return 'Blood Report';
  }
  if (lowerText.includes('prescription') || lowerText.includes('rx') || lowerText.includes('tab.') || lowerText.includes('cap.')) {
    return 'Prescription';
  }
  if (lowerText.includes('scan') || lowerText.includes('x-ray') || lowerText.includes('mri') || lowerText.includes('ct') || lowerText.includes('ultrasound')) {
    return 'Scan';
  }
  if (lowerText.includes('receipt') || lowerText.includes('invoice') || lowerText.includes('bill') || lowerText.includes('payment')) {
    return 'Receipt';
  }
  
  return 'Unknown';
}

/**
 * Main extraction function - processes OCR text into structured medical data
 */
export function extractMedicalData(rawText: string): ExtractedMedicalData {
  // Step 1: Correct OCR errors
  let processedText = correctOCRErrors(rawText);
  
  // Step 2: Expand abbreviations
  processedText = expandAbbreviations(processedText);
  
  // Step 3: Normalize units
  processedText = normalizeUnits(processedText);
  
  // Step 4: Extract structured data
  const facts: MedicalFact[] = [];
  
  // Extract blood group
  const bloodGroup = extractBloodGroup(processedText);
  if (bloodGroup) facts.push(bloodGroup);
  
  // Extract lab values
  facts.push(...extractLabValues(processedText));
  
  // Extract medications
  facts.push(...extractMedications(processedText));
  
  // Extract date
  const reportDate = extractDate(processedText);
  
  // Detect document type
  const documentType = detectDocumentType(processedText);
  
  return {
    document_type: documentType,
    report_date: reportDate,
    extracted_facts: facts,
    corrected_text: processedText
  };
}

/**
 * Format extracted data as display-friendly JSON
 */
export function formatExtractedDataForDisplay(data: ExtractedMedicalData): string {
  return JSON.stringify(data, null, 2);
}
