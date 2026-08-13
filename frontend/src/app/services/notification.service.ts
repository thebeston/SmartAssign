import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly successSubject = new Subject<string>();
  private readonly errorSubject = new Subject<string>();

  readonly success$ = this.successSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();

  success(message: string): void {
    this.successSubject.next(message);
  }

  error(message: string): void {
    this.errorSubject.next(message);
  }
}
