import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface GeminiRequest {
  contents: ContentGemini[];         // Array de contenidos de la conversación
  generationConfig?: {                // Configuración opcional de generación
    maxOutputTokens?: number;         // Máximo número de tokens en la respuesta
    temperature?: number;             // Creatividad de la respuesta (0-1)
  };
  safetySettings?: SafetySetting[];   // Configuraciones de seguridad
}

interface ContentGemini {
  role: 'user' | 'model';            // Rol del mensaje (user o model en Gemini)
  parts: PartGemini[];               // Array de partes del contenido
}

interface PartGemini {
  text: string;                      // Contenido del mensaje
}

interface SafetySetting {
  category: string;                  // Categoría de seguridad
  threshold: string;                 // Umbral de bloqueo
}

interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
    finishReason: string;
  }[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}


@Injectable({
  providedIn: 'root',
})
export class GeminiService {
 private http = inject(HttpClient);

  private readonly apiUrl = environment.gemini.apiUrl;
  private readonly apiKey = environment.gemini.apiKey;

  sendMessage(message: string, previousHistory: ContentGemini[] = []): Observable<string> {
    // Verificamos que tenemos la clave de API configurada
    if (!this.apiKey || this.apiKey === 'TU_API_KEY_DE_GEMINI') {
      console.error('❌ Gemini API Key is not configured properly.');
      return throwError(() => new Error('Gemini API Key is not configured. Please set your key in environment.ts'));
    }

    // No necesitamos headers de autorización ya que la API key va en la URL
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    // Preparamos el contenido del sistema para dar personalidad al asistente
    const systemMessage: ContentGemini = {
      role: 'user',
      parts: [{
        text: `You are a virtual assistant who is helpful and friendly. Always respond in Spanish clearly and concisely.
               You specialize in helping with general questions, programming, and technology.
               Maintain a professional but approachable tone.`
      }]
    };

    const systemResponse: ContentGemini = {
      role: 'model',
      parts: [{
        text: 'Understood. I am your virtual assistant specialized in technology and programming. I will help you clearly and professionally in Spanish. How can I assist you?'
      }]
    };

    // Preparamos los contenidos para enviar a Gemini
    const contenidos: ContentGemini[] = [
      systemMessage,
      systemResponse,
      // Añadimos el historial previo para mantener el contexto
      ...previousHistory,
      // Añadimos el mensaje actual del usuario
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ];

    // Configuraciones de seguridad para permitir más contenido técnico
    const securityConfig: SafetySetting[] = [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ];

    // Preparamos el cuerpo de la petición según la especificación de Gemini
    const payloadsRequest: GeminiRequest = {
      contents: contenidos,
      generationConfig: {
        maxOutputTokens: 800,         // Límite de tokens para la respuesta
        temperature: 0.7              // Creatividad moderada
      },
      safetySettings: securityConfig
    };

    // URL completa con la API key como parámetro
    const fullUrl = `${this.apiUrl}?key=${this.apiKey}`;

    // Hacemos la petición HTTP a la API de Gemini
    return this.http.post<GeminiResponse>(fullUrl, payloadsRequest, { headers })
      .pipe(
        // Transformamos la respuesta para extraer solo el contenido del mensaje
        map(response => {
          // Verificamos que la respuesta tenga el formato esperado
          if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];

            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
              let contentResponse = candidate.content.parts[0].text;

              // Verificamos si la respuesta fue truncada por límite de tokens
              if (candidate.finishReason === 'MAX_TOKENS') {
                contentResponse += '\n\n[Note: Response truncated due to token limit. You can ask me to continue.]';
              }

              return contentResponse;
            } else {
              throw new Error('Gemini response does not contain valid content parts');
            }
          } else {
            throw new Error('Gemini response does not have the expected format');
          }
        }),

        // Manejamos los errores que puedan ocurrir
        catchError(error => {
          console.error('❌ Error communicating with Gemini:', error);

          // Personalizamos el mensaje de error según el tipo
          let errorMessage = 'Error connecting to Gemini';

          if (error.status === 400) {
            errorMessage = 'Invalid request to Gemini. Check the configuration.';
          } else if (error.status === 403) {
            errorMessage = 'Invalid or unauthorized Gemini API key.';
          } else if (error.status === 429) {
            errorMessage = 'You have exceeded the request limit. Please try again later.';
          } else if (error.status === 500) {
            errorMessage = 'Gemini server error. Please try again later.';
          } else if (error.error?.error?.message) {
            errorMessage = error.error.error.message;
          }

          return throwError(() => new Error(errorMessage));
        })
      );
  }

  /**
   * Convierte nuestro historial de mensajes al formato que espera Gemini
   * También optimiza el historial para mantener dentro de límites de tokens
   *
   * @param messages - Nuestros mensajes internos
   * @returns Array de contenidos en formato Gemini
   */
  convertHistoryToGemini(messages: any[]): ContentGemini[] {
    // Convertimos los mensajes al formato de Gemini
    const convertedHistory: ContentGemini[] = messages.map(msg => ({
      role: (msg.type === 'user' ? 'user' : 'model') as 'user' | 'model',
      parts: [{ text: msg.content }]
    }));

    // Si tenemos demasiados mensajes, priorizamos los más recientes
    // pero siempre mantenemos pares de pregunta-respuesta completos
    if (convertedHistory.length > 8) {
      // Tomamos los últimos 6 mensajes, pero asegurándonos de mantener pares
      const lastMessages = convertedHistory.slice(-6);

      // Si empezamos con una respuesta del modelo, quitamos el primer mensaje
      // para mantener el contexto conversacional correcto
      if (lastMessages.length > 0 && lastMessages[0].role === 'model') {
        return lastMessages.slice(1);
      }

      return lastMessages;
    }

    return convertedHistory;
  }

  /**
   * Verifica si la API de Gemini está configurada correctamente
   *
   * @returns true si la configuración es válida
   */
  verifyConfiguration(): boolean {
    const validConfiguration = !!(this.apiKey && this.apiUrl);

    return validConfiguration;
  }
}
