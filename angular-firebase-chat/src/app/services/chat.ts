import { inject, Injectable } from '@angular/core';
import { ChatMessage } from '../models/chat';
import { BehaviorSubject, of } from 'rxjs';
import { AuthService } from './auth';
import { FirestoreService } from './firestore';

const firestoreServiceMock = {
  getUserMessages: (userId: string) => of([]),
  saveMessage: async (message: ChatMessage) => Promise.resolve(),
};

const geminiServiceMock = {
  convertHistoryToGemini: (history: ChatMessage[]) => history,
  sendMessage: async (content: string, history: any) => 'Mocked response from Gemini API',
};

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);

  // Todavía no implementados:
  // private geminiService = inject(GeminiService);

  // BehaviorSubject para mantener la lista de mensajes del chat actual
  // BehaviorSubject siempre tiene un valor inicial y emite el último valor a nuevos suscriptores
  private subjectMessages = new BehaviorSubject<ChatMessage[]>([]);

  // Observable público para que los componentes puedan suscribirse a los mensajes
  public messages$ = this.subjectMessages.asObservable();

  private loadingHistory = false;

  // Variable para controlar si el asistente está respondiendo
  private assistantResponding = new BehaviorSubject<boolean>(false);
  public assistantResponding$ = this.assistantResponding.asObservable();

  async initializeChat(userId: string): Promise<void> {
    if (this.loadingHistory) {
      return;
    }

    this.loadingHistory = true;

    try {
      // Using real firstore service
      this.firestoreService.getUserMessages(userId).subscribe({
        next: (messages) => {
          // Actualizamos el BehaviorSubject con los mensajes obtenidos
          this.subjectMessages.next(messages);
          this.loadingHistory = false;
        },
        error: (error) => {
          console.error('❌ Error loading history:', error);
          this.loadingHistory = false;

          // En caso de error, iniciamos con una lista vacía
          this.subjectMessages.next([]);
        }
      });

      // 🎭 Usando mock del FirestoreService
      // firestoreServiceMock.getUserMessages(userId).subscribe({
      //   next: (messages) => {
      //     // Actualizamos el BehaviorSubject con los mensajes obtenidos
      //     this.subjectMessages.next(messages);
      //     this.loadingHistory = false;
      //   },
      //   error: (error) => {
      //     console.error('❌ Error loading messages:', error);
      //     this.loadingHistory = false;
      //     // En caso de error, iniciamos con una lista vacía
      //     this.subjectMessages.next([]);
      //   },
      // });
    } catch (error) {
      console.error('❌ Error initializing chat:', error);
      this.loadingHistory = false;
      this.subjectMessages.next([]);
    }
  }

  async sendMessage(messageContent: string): Promise<void> {
    // Obtenemos el usuario actual
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser) {
      console.error('❌ No authenticated user');
      throw new Error('User not authenticated');
    }

    if (!messageContent.trim()) {
      return;
    }

    // Creamos el mensaje del usuario
    const userMessage: ChatMessage = {
      userId: currentUser.uid,
      content: messageContent.trim(),
      sentAt: new Date(),
      type: 'user',
      status: 'sending',
    };

    try {
      // PRIMERO mostramos el mensaje del usuario en la UI inmediatamente
      const userMessages = this.subjectMessages.value;

      const newMessages = [...userMessages, userMessage];
      // next is to emit new values to all subscribers
      this.subjectMessages.next(newMessages);

      // DESPUÉS intentamos guardarlo en Firestore (en background)
      try {
        // This is the real service call
        await this.firestoreService.saveMessage(userMessage);

        // This is mocked version
        // await firestoreServiceMock.saveMessage(userMessage);
      } catch (firestoreError) {
        // El mensaje ya está visible, así que continuamos
      }

      // Indicamos que el asistente está procesando la respuesta
      this.assistantResponding.next(true);

      // Obtenemos el historial actual para dar contexto a ChatGPT
      const currentMessages = this.subjectMessages.value;

      // Convertimos nuestro historial al formato que espera Gemini
      // Solo tomamos los últimos 6 mensajes para no exceder límites de tokens
      // Esto deja más espacio para respuestas más completas

      // const geminiHistory = this.geminiService.convertirHistorialAGemini(
      //   mensajesActuales.slice(-6)
      // );

      // This is the mocked version
      const geminiHistory = geminiServiceMock.convertHistoryToGemini(
        currentMessages.slice(-6)
      );

      // Enviamos el mensaje a ChatGPT y esperamos la respuesta (usando mock)
      // const assistantResponse = await firstValueFrom(
      //   this.geminiService.enviarMensaje(contenidoMensaje, historialParaGemini)
      // );

      // THis is the mocked version
      const assistantResponse = await geminiServiceMock.sendMessage(
        messageContent,
        geminiHistory
      );

      // Creamos el mensaje con la respuesta del asistente
      // const mensajeAsistente: MensajeChat = {
      //   usuarioId: usuarioActual.uid,
      //   contenido: respuestaAsistente,
      //   fechaEnvio: new Date(),
      //   tipo: 'asistente',
      //   estado: 'enviado'
      // };

      // POR AHORA, como no tenemos Gemini implementado, usamos un mock
      const assistantMessage: ChatMessage = {
        userId: currentUser.uid,
        content: assistantResponse,
        sentAt: new Date(),
        type: 'assistant',
        status: 'sent',
      };

      // PRIMERO mostramos la respuesta en la UI inmediatamente
      const updatedMessages = this.subjectMessages.value;

      const newMessages2 = [...updatedMessages, assistantMessage];
      this.subjectMessages.next(newMessages2);

      // DESPUÉS intentamos guardar en Firestore ya con la respuesta de Gemini incluida (en background)
      try {
        // This is the real service call
        await this.firestoreService.saveMessage(assistantMessage);

        // This is mocked version
        // await firestoreServiceMock.saveMessage(assistantMessage);
      } catch (firestoreError) {
        // El mensaje ya está visible, así que no es crítico
      }
    } catch (error) {
      console.error('❌ Error processing message:', error);

      // En caso de error, creamos un mensaje de error del asistente
      const errorMessage: ChatMessage = {
        userId: currentUser.uid,
        content:
          'Sorry, there was a problem processing your message. Please try again.',
        sentAt: new Date(),
        type: 'assistant',
        status: 'error',
      };

      try {
        // await this.firestoreService.guardarMensaje(mensajeError);
        await firestoreServiceMock.saveMessage(errorMessage);
      } catch (saveErrorError) {
        console.error('❌ Error saving error message:', saveErrorError);
        // As a last resort, temporarily show the error in the UI
        const currentMessages = this.subjectMessages.value;
        this.subjectMessages.next([...currentMessages, errorMessage]);
      }

      throw error;
    } finally {
      // Siempre indicamos que el asistente ya no está respondiendo
      this.assistantResponding.next(false);
    }
  }

  getMessages(): ChatMessage[] {
    return this.subjectMessages.value;
  }

  clearChat(): void {
    this.subjectMessages.next([]);
  }

  isChatReady(): boolean {
    const userAuthenticated = !!this.authService.getCurrentUser();
    // const geminiConfigured = this.geminiService.checkConfiguration();

    // Por ahora, como no tenemos Gemini implementado, asumimos que siempre está configurado
    const geminiConfigured = true;

    return userAuthenticated && geminiConfigured;
  }
}
