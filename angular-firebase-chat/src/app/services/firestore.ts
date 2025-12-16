import { inject, Injectable } from '@angular/core';
import { ChatConversation, ChatMessage } from '../models/chat';
import {
  addDoc,
  collection,
  DocumentData,
  Firestore,
  onSnapshot,
  query,
  QuerySnapshot,
  Timestamp,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  private firestore = inject(Firestore);

  async saveMessage(message: ChatMessage): Promise<void> {
    try {
      if (!message.userId) {
        throw new Error('userId is required');
      }
      if (!message.content) {
        throw new Error('content is required');
      }
      if (!message.type) {
        throw new Error('type is required');
      }

      // Obtenemos la referencia a la colección 'messages'
      const messageCollection = collection(this.firestore, 'messages');

      // Preparamos el mensaje para guardarlo, convirtiendo la fecha a Timestamp de Firebase
      const messageToSave = {
        userId: message.userId,
        content: message.content,
        type: message.type,
        status: message.status || 'sent',
        // Firebase requiere usar Timestamp en lugar de Date
        sentAt: Timestamp.fromDate(message.sentAt),
      };

      // Añadimos el documento a la colección
      const docRef = await addDoc(messageCollection, messageToSave);
    } catch (error: any) {
      console.error('❌ Error saving Firestore message:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      throw error;
    }
  }

  getUserMessages(userId: string): Observable<ChatMessage[]> {
    // Observable is used to create a custom observable
    // the parameter is a function that takes an observer
    return new Observable((observer) => {
      // Creamos una consulta para obtener solo los mensajes del usuario especificado
      // NOTA: Removemos temporalmente orderBy para evitar el problema del índice
      // query is used to create a query against the collection
      // first parameter is the collection reference
      // subsequent parameters are the query constraints
      const consult = query(
        collection(this.firestore, 'messages'),
        // Filtramos por el ID del usuario
        where('userId', '==', userId)
      );

      // Configuramos el listener en tiempo real
      // onSnapshot is used to listen to real-time updates
      // It takes the query and two callbacks: one for data and one for errors
      // QuerySnapshot<DocumentData> represents a snapshot of the results of a query
      // unsubscribe is a function that can be called to stop listening to updates (stop subscriptions)
      const unsubscribe = onSnapshot(
        consult,
        (snapshot: QuerySnapshot<DocumentData>) => {
          // Transformamos los documentos de Firestore en nuestros objetos ChatMessage
          const messages: ChatMessage[] = snapshot.docs.map((doc) => {
            const data = doc.data();

            return {
              id: doc.id,
              userId: data['userId'],
              content: data['content'],
              type: data['type'],
              status: data['status'],
              // Convertimos el Timestamp de Firebase de vuelta a Date
              sentAt: data['sentAt'].toDate(),
            } as ChatMessage;
          });

          // ORDENAMOS en el cliente ya que removimos orderBy de la query
          messages.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());

          // Emitimos los mensajes a través del Observable
          observer.next(messages);
        },
        (error) => {
          console.error('❌ Error listening messages:', error);
          observer.error(error);
        }
      );

      // Función de limpieza que se ejecuta cuando se cancela la suscripción
      return () => {
        unsubscribe();
      };
    });
  }

  async saveConversation(conversation: ChatConversation): Promise<void> {
    try {
      // collection is used to get a reference to the collection
      // first parameter is the Firestore instance
      // second parameter is the name of the collection
      const conversationsCollection = collection(this.firestore, 'conversations');

      // Preparamos la conversación, convirtiendo las fechas a Timestamps
      const conversationToSave = {
        ...conversation,
        createdAt: Timestamp.fromDate(conversation.createdAt),
        lastActivity: Timestamp.fromDate(conversation.lastActivity),
        // También convertimos las fechas de los mensajes
        messages: conversation.messages.map((message) => ({
          ...message,
          sentAt: Timestamp.fromDate(message.sentAt),
        })),
      };

      // addDoc is used to add a new document to the collection
      // first parameter is the collection reference
      // second parameter is the data to save
      await addDoc(conversationsCollection, conversationToSave);
    } catch (error) {
      console.error('❌ Error saving conversation:', error);
      throw error;
    }
  }
}
