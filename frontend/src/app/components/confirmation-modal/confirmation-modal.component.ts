import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ConfirmationService } from '../../services/confirmation.service';

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-modal.component.html',
  styleUrls: ['./confirmation-modal.component.css']
})
export class ConfirmationModalComponent implements OnInit, OnDestroy {
  private readonly confirmation = inject(ConfirmationService);
  private subscription?: Subscription;

  title = '';
  message = '';
  confirmLabel = 'Confirm';
  open = false;
  private resolveFn: ((value: boolean) => void) | null = null;

  ngOnInit(): void {
    this.subscription = this.confirmation.prompt$.subscribe(prompt => {
      if (!prompt) {
        this.open = false;
        this.resolveFn = null;
        return;
      }
      this.title = prompt.title;
      this.message = prompt.message;
      this.confirmLabel = prompt.confirmLabel;
      this.resolveFn = prompt.resolve;
      this.open = true;
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  confirm(): void {
    if (this.resolveFn) {
      this.confirmation.respond(true, this.resolveFn);
    }
  }

  cancel(): void {
    if (this.resolveFn) {
      this.confirmation.respond(false, this.resolveFn);
    }
  }
}
