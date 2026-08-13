import { Pipe, PipeTransform } from '@angular/core';
import { getDaysRemaining } from '../utils/task.utils';

@Pipe({
  name: 'daysRemaining',
  standalone: true
})
export class DaysRemainingPipe implements PipeTransform {
  transform(dateStr: string | undefined): string {
    return getDaysRemaining(dateStr);
  }
}
