import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface ConfirmationRequest {
  title: string;
  message: string;
  confirmLabel: string;
}

interface ConfirmationPrompt extends ConfirmationRequest {
  resolve: (confirmed: boolean) => void;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmationService {
  private readonly promptSubject = new Subject<ConfirmationPrompt | null>();

  readonly prompt$: Observable<ConfirmationPrompt | null> = this.promptSubject.asObservable();

  confirm(
    title: string,
    message: string,
    confirmLabel = 'Confirm'
  ): Promise<boolean> {
    return new Promise(resolve => {
      this.promptSubject.next({ title, message, confirmLabel, resolve });
    });
  }

  respond(confirmed: boolean, resolve: (value: boolean) => void): void {
    this.promptSubject.next(null);
    resolve(confirmed);
  }
}
