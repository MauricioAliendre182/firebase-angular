import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface OpenAIRequest {
  model: string;                      // Modelo a usar (gpt-4o, gpt-4o-mini, etc.)
  messages: MessageOpenAI[];          // Array de mensajes de la conversación
  max_tokens?: number;                // Máximo número de tokens en la respuesta
  temperature?: number;               // Creatividad de la respuesta (0-2)
}

interface MessageOpenAI {
  role: 'system' | 'user' | 'assistant';  // Rol del mensaje
  content: string;                        // Contenido del mensaje
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}


@Injectable({
  providedIn: 'root',
})
export class OpenAIService {
 private http = inject(HttpClient);

  private readonly apiUrl = environment.openai.apiUrl;
  private readonly apiKey = environment.openai.apiKey;
  private readonly model = environment.openai.model;

  sendMessage(message: string, previousHistory: MessageOpenAI[] = []): Observable<string> {
    // Verificamos que tenemos la clave de API configurada
    if (!this.apiKey || this.apiKey === 'TU_API_KEY_DE_OPENAI') {
      console.error('❌ OpenAI API Key is not configured properly.');
      return throwError(() => new Error('OpenAI API Key is not configured. Please set your key in environment.ts'));
    }

    // OpenAI requiere la API key en el header Authorization como Bearer token
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    });

    // Preparamos el mensaje del sistema para dar personalidad al asistente
    const systemMessage: MessageOpenAI = {
      role: 'system',
      content: `You are a virtual assistant who is helpful and friendly. Always respond in Spanish clearly and concisely.
               You specialize in helping with general questions, programming, and technology.
               Maintain a professional but approachable tone.`
    };

    // Preparamos los mensajes para enviar a OpenAI
    const messages: MessageOpenAI[] = [
      systemMessage,
      // Añadimos el historial previo para mantener el contexto
      ...previousHistory,
      // Añadimos el mensaje actual del usuario
      {
        role: 'user',
        content: message
      }
    ];

    // Preparamos el cuerpo de la petición según la especificación de OpenAI
    const payloadsRequest: OpenAIRequest = {
      model: this.model,
      messages: messages,
      max_tokens: 800,         // Límite de tokens para la respuesta
      temperature: 0.7         // Creatividad moderada (0-2 en OpenAI)
    };

    // Hacemos la petición HTTP a la API de OpenAI
    return this.http.post<OpenAIResponse>(this.apiUrl, payloadsRequest, { headers })
      .pipe(
        // Transformamos la respuesta para extraer solo el contenido del mensaje
        map(response => {
          // Verificamos que la respuesta tenga el formato esperado
          if (response.choices && response.choices.length > 0) {
            const choice = response.choices[0];

            if (choice.message && choice.message.content) {
              let contentResponse = choice.message.content;

              // Verificamos si la respuesta fue truncada por límite de tokens
              if (choice.finish_reason === 'length') {
                contentResponse += '\n\n[Note: Response truncated due to token limit. You can ask me to continue.]';
              }

              return contentResponse;
            } else {
              throw new Error('OpenAI response does not contain valid message content');
            }
          } else {
            throw new Error('OpenAI response does not have the expected format');
          }
        }),

        // Manejamos los errores que puedan ocurrir
        catchError(error => {
          console.error('❌ Error communicating with OpenAI:', error);

          // Personalizamos el mensaje de error según el tipo
          let errorMessage = 'Error connecting to OpenAI';

          if (error.status === 400) {
            errorMessage = 'Invalid request to OpenAI. Check the configuration.';
          } else if (error.status === 401) {
            errorMessage = 'Invalid or unauthorized OpenAI API key.';
          } else if (error.status === 429) {
            errorMessage = 'You have exceeded the request limit. Please try again later.';
          } else if (error.status === 500) {
            errorMessage = 'OpenAI server error. Please try again later.';
          } else if (error.error?.error?.message) {
            errorMessage = error.error.error.message;
          }

          return throwError(() => new Error(errorMessage));
        })
      );
  }

  /**
   * Convierte nuestro historial de mensajes al formato que espera OpenAI
   * También optimiza el historial para mantener dentro de límites de tokens
   *
   * @param messages - Nuestros mensajes internos
   * @returns Array de mensajes en formato OpenAI
   */
  convertHistoryToOpenAI(messages: any[]): MessageOpenAI[] {
    // Convertimos los mensajes al formato de OpenAI
    const convertedHistory: MessageOpenAI[] = messages.map(msg => ({
      role: (msg.type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content
    }));

    // Si tenemos demasiados mensajes, priorizamos los más recientes
    // pero siempre mantenemos pares de pregunta-respuesta completos
    if (convertedHistory.length > 8) {
      // Tomamos los últimos 6 mensajes, pero asegurándonos de mantener pares
      const lastMessages = convertedHistory.slice(-6);

      // Si empezamos con una respuesta del asistente, quitamos el primer mensaje
      // para mantener el contexto conversacional correcto
      if (lastMessages.length > 0 && lastMessages[0].role === 'assistant') {
        return lastMessages.slice(1);
      }

      return lastMessages;
    }

    return convertedHistory;
  }

  /**
   * Verifica si la API de OpenAI está configurada correctamente
   *
   * @returns true si la configuración es válida
   */
  verifyConfiguration(): boolean {
    const validConfiguration = !!(this.apiKey && this.apiUrl && this.model);

    return validConfiguration;
  }
}
