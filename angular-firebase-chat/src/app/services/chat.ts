import { inject, Injectable } from '@angular/core';
import { ChatMessage } from '../models/chat';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { AuthService } from './auth';
import { FirestoreService } from './firestore';
import { OpenAIService } from './openai';

const firestoreServiceMock = {
  getUserMessages: (userId: string) => of([]),
  saveMessage: async (message: ChatMessage) => Promise.resolve(),
};

const openaiServiceMock = {
  convertHistoryToOpenAI: (history: ChatMessage[]) => history,
  sendMessage: async (content: string, history: any) => 'Mocked response from OpenAI API',
};

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);
  private openaiService = inject(OpenAIService);

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

      // Convertimos nuestro historial al formato que espera OpenAI
      // Solo tomamos los últimos 6 mensajes para no exceder límites de tokens
      // Esto deja más espacio para respuestas más completas

      const openaiHistory = this.openaiService.convertHistoryToOpenAI(
        currentMessages.slice(-6)
      );

      // This is the mocked version
      // const openaiHistory = openaiServiceMock.convertHistoryToOpenAI(
      //   currentMessages.slice(-6)
      // );

      // Enviamos el mensaje a OpenAI y esperamos la respuesta
      // firstValueFrom is to convert Observable to Promise
      // For example, if the service returns an Observable<string>, we can use firstValueFrom to get the string value
      const assistantResponse = await firstValueFrom(
        this.openaiService.sendMessage(messageContent, openaiHistory)
      );

      // THis is the mocked version
      // const assistantResponse = await openaiServiceMock.sendMessage(
      //   messageContent,
      //   openaiHistory
      // );

      // Creamos el mensaje con la respuesta del asistente
      const assistantMessage: ChatMessage = {
        userId: currentUser.uid,
        content: assistantResponse,
        sentAt: new Date(),
        type: 'assistant',
        status: 'sent'
      };

      // POR AHORA, como no tenemos OpenAI implementado, usamos un mock
      // const assistantMessage: ChatMessage = {
      //   userId: currentUser.uid,
      //   content: assistantResponse,
      //   sentAt: new Date(),
      //   type: 'assistant',
      //   status: 'sent',
      // };

      // PRIMERO mostramos la respuesta en la UI inmediatamente
      const updatedMessages = this.subjectMessages.value;

      const newMessages2 = [...updatedMessages, assistantMessage];
      this.subjectMessages.next(newMessages2);

      // DESPUÉS intentamos guardar en Firestore ya con la respuesta de OpenAI incluida (en background)
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
    const openaiConfigured = this.openaiService.verifyConfiguration();

    // Por ahora, como no tenemos OpenAI implementado, asumimos que siempre está configurado
    // const openaiConfigured = true;

    return userAuthenticated && openaiConfigured;
  }
}
