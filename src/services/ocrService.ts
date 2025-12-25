import { createWorker } from 'tesseract.js';

/**
 * OCR Service using Tesseract.js
 * 
 * This service handles optical character recognition for medical documents.
 * It supports images (JPG, PNG) and can extract text from scanned documents,
 * prescriptions, lab reports, and receipts.
 */

export interface OCRResult {
  text: string;
  confidence: number;
}

/**
 * Perform OCR on an image file
 * @param file - The image file to process
 * @param onProgress - Callback for progress updates (0-100)
 * @returns Promise with extracted text and confidence score
 */
export async function performOCR(
  file: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  // Create a Tesseract worker
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      // Report progress during recognition
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  try {
    // Convert file to base64 for Tesseract
    const imageData = await fileToBase64(file);
    
    // Perform text recognition
    const { data } = await worker.recognize(imageData);
    
    return {
      text: data.text.trim(),
      confidence: data.confidence,
    };
  } finally {
    // Always terminate the worker to free resources
    await worker.terminate();
  }
}

/**
 * Convert a File object to a base64 data URL
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Check if a file is a supported image format for OCR
 */
export function isSupportedFormat(file: File): boolean {
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
  return supportedTypes.includes(file.type);
}

/**
 * Get human-readable file type
 */
export function getFileTypeLabel(file: File): string {
  const typeMap: Record<string, string> = {
    'image/jpeg': 'JPEG Image',
    'image/png': 'PNG Image',
    'image/webp': 'WebP Image',
    'image/bmp': 'BMP Image',
    'application/pdf': 'PDF Document',
  };
  return typeMap[file.type] || 'Unknown';
}
