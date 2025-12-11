import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  ElementRef,
  AfterViewChecked,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth';
import { ChatService } from '../../services/chat';
import { User } from '../../models/user';
import { ChatMessage } from '../../models/chat';
// import { MensajeChat } from '../../models/chat';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat implements OnInit, OnDestroy, AfterViewChecked {
  private authService = inject(AuthService);
  private chatService = inject(ChatService);
  private router = inject(Router);

  // Referencia al contenedor de mensajes para hacer scroll automático
  // @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  // @ViewChild('messageInput') messageInput!: ElementRef;

  // We can do this using signals in Angular 16+
  messagesContainer = viewChild<ElementRef<HTMLElement>>('messagesContainer');
  messageInput = viewChild<ElementRef<HTMLTextAreaElement>>('messageInput');

  user: User | null = null; // Información del usuario actual
  messages: ChatMessage[] = []; // Lista de mensajes del chat
  messageText = ''; // Texto del mensaje que está escribiendo el usuario
  sendingMessage = false; // Indica si se está enviando un mensaje
  assistantTyping = false; // Indica si el asistente está generando una respuesta
  loadingHistory = false; // Indica si se está cargando el historial
  messageError = ''; // Mensaje de error para mostrar al usuario

  private subscriptions: Subscription[] = [];

  // Control para hacer scroll automático
  private mustDoScroll = false;

  async ngOnInit(): Promise<void> {
    try {
      await this.verificarAutenticacion();
      await this.inicializarChat();
      this.configureSubscriptions();
    } catch (error) {
      console.error('❌ Error upon initializing chat:', error);
      this.messageError = 'Error loading chat. Please try reloading the page.';
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  /**
   * Se ejecuta después de que Angular actualiza la vista
   * Lo usamos para hacer scroll automático cuando hay nuevos mensajes
   */
  ngAfterViewChecked(): void {
    if (this.mustDoScroll) {
      this.scrollDown();
      this.mustDoScroll = false;
    }
  }

  private async verificarAutenticacion(): Promise<void> {
    // this.usuario = this.authService.obtenerUsuarioActual();

    // Simulación de usuario autenticado para desarrollo
    this.user = {
      uid: 'usuario123',
      name: 'Usuario de Prueba',
      photoUrl: '',
      createdAt: new Date(),
      lastConnection: new Date(),
      email: 'usuario@ejemplo.com',
    };

    if (!this.user) {
      await this.router.navigate(['/auth']);
      throw new Error('User not authenticated');
    }
  }

  private async inicializarChat(): Promise<void> {
    if (!this.user) return;

    this.loadingHistory = true;

    try {
      // Inicializamos el chat con el ID del usuario
      // await this.chatService.inicializarChat(this.user.uid);
    } catch (error) {
      console.error('❌ Error upon initializing chat in component:', error);
      throw error;
    } finally {
      this.loadingHistory = false;
    }
  }

  private configureSubscriptions(): void {
    // Suscribirse a los mensajes del chat
    // const subMensajes = this.chatService.mensajes$.subscribe(mensajes => {
    //   this.mensajes = mensajes;
    //   this.debeHacerScroll = true;
    // });
    // // Suscribirse al estado del asistente
    // const subAsistente = this.chatService.asistenteRespondiendo$.subscribe(respondiendo => {
    //   this.asistenteEscribiendo = respondiendo;
    //   if (respondiendo) {
    //     this.debeHacerScroll = true;
    //   }
    // });
    // this.suscripciones.push(subMensajes, subAsistente);
  }

  async sendMessage(): Promise<void> {
    // Validamos que hay texto para enviar
    if (!this.messageText.trim()) {
      return;
    }

    // Limpiamos errores previos
    this.messageError = '';
    this.sendingMessage = true;

    // Guardamos el texto del mensaje y limpiamos el input
    const texto = this.messageText.trim();
    this.messageText = '';

    try {
      // Enviamos el mensaje usando el servicio de chat
      // await this.chatService.enviarMensaje(texto);

      // Hacemos focus en el input para continuar escribiendo
      this.focusInput();
    } catch (error: any) {
      console.error('❌ Error sending message:', error);

      // Mostramos el error al usuario
      this.messageError = error.message || 'Error sending message';

      // Restauramos el texto en el input
      this.messageText = texto;
    } finally {
      this.sendingMessage = false;
    }
  }

  handleKeyPress(event: KeyboardEvent): void {
    // Enter sin Shift envía el mensaje
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  async logout(): Promise<void> {
    try {
      // Limpiamos el chat local
      // this.chatService.limpiarChat();

      // Cerramos sesión en Firebase
      // await this.authService.cerrarSesion();

      // Navegamos al login
      await this.router.navigate(['/auth']);
    } catch (error) {
      console.error('❌ Error logging out:', error);
      this.messageError = 'Error logging out';
    }
  }

  private scrollDown(): void {
    try {
      const container = this.messagesContainer()?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    } catch (error) {
      // Error al hacer scroll
    }
  }

  private focusInput(): void {
    setTimeout(() => {
      this.messageInput()?.nativeElement?.focus();
    }, 100);
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Formatea el contenido de los mensajes del asistente
   * Convierte texto plano en HTML básico
   */
  formatAssistantMessage(content: string): string {
    return content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  trackByMessage(index: number, message: ChatMessage): string {
    return message.id || `${message.type}-${message.sentAt.getTime()}`;
  }

  imageErrorHandler(event: any): void {
    event.target.src =
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMTIgMTRDOC42ODYyOSAxNCA2IDE2LjY4NjMgNiAyMEg2VjIySDZIMThINlYyMEM2IDE2LjY4NjMgMTUuMzEzNyAxNCAxMiAxNFoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo8L3N2Zz4K';
  }
}
