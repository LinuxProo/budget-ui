import { Component } from '@angular/core';
import { addMonths, set } from 'date-fns';
import { InfiniteScrollCustomEvent, ModalController, RefresherCustomEvent } from '@ionic/angular';
import { ExpenseModalComponent } from '../expense-modal/expense-modal.component';
import { Category, CategoryCriteria, Expense, ExpenseCriteria, SortOption } from '../../shared/domain';
import { formatPeriod } from '../../shared/period';
import {debounce, from, groupBy, interval, mergeMap, Subject, takeUntil, toArray} from 'rxjs';
import { ToastService } from '../../shared/service/toast.service';
import { ExpenseService } from '../expense.service';
import {FormBuilder, FormGroup} from '@angular/forms';

interface ExpenseGroup {
  date: string;
  expenses: Expense[];
}

@Component({
  selector: 'app-expense-overview',
  templateUrl: './expense-list.component.html',
})
export class ExpenseListComponent {
  date = set(new Date(), { date: 1 });
  expenseGroups: ExpenseGroup[] | null = null;
  expenses: Expense[] | null = null;
  readonly initialSort = 'name,asc';
  lastPageReached = false;

  loading = false;
  searchCriteria: ExpenseCriteria = { page: 0, size: 25, sort: this.initialSort };
  readonly searchForm: FormGroup;
  expense: Expense[] | null = null;

  readonly sortOptions: SortOption[] = [
    { label: 'Created at (newest first)', value: 'createdAt,desc' },
    { label: 'Created at (oldest first)', value: 'createdAt,asc' },
    { label: 'Name (A-Z)', value: 'name,asc' },
    { label: 'Name (Z-A)', value: 'name,desc' },
  ];
  private readonly unsubscribe = new Subject<void>();
  constructor(
    private readonly modalCtrl: ModalController,
    private readonly expenseService: ExpenseService,
    private readonly toastService: ToastService,
    private readonly formBuilder: FormBuilder,
  ) {
    this.searchForm = this.formBuilder.group({ name: [], sort: [this.initialSort] });
    this.searchForm = this.formBuilder.group({ name: [], sort: [this.initialSort] });
    this.searchForm.valueChanges
      .pipe(
        takeUntil(this.unsubscribe),
        debounce((value) => (value.name?.length ? interval(400) : interval(0)))
      )
      .subscribe((value) => {
        this.searchCriteria = { ...this.searchCriteria, ...value, page: 0 };
        this.loadExpenses();
      });
  }


  addMonths = (number: number): void => {
    this.date = addMonths(this.date, number);
  };
  async openModal(expense?: Expense): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ExpenseModalComponent,
      componentProps: { expense: expense ? { ...expense } : {} },
    });
    modal.present();
    const { role } = await modal.onWillDismiss();
    console.log('role', role);
  }

  private loadExpenses(next: () => void = () => {}): void {
    if (!this.searchCriteria.name) delete this.searchCriteria.name;
    this.loading = true;
    this.expenseService.getExpenses(this.searchCriteria).subscribe({
      next: (expenses) => {
        if (this.searchCriteria.page === 0 || !this.expenses) this.expenses = [];
        this.expenses.push(...expenses.content);
        this.lastPageReached = expenses.last;
        next();
        this.loading = false;
      },
      error: (error) => {
        this.toastService.displayErrorToast('Could not load categories', error);
        this.loading = false;
      },
    });
  }

  reloadExpenses($event?: any): void {
    this.searchCriteria.page = 0;
    this.loadExpenses(() => ($event ? ($event as RefresherCustomEvent).target.complete() : {}));
  }

  loadNextExpensePage($event: any) {
    this.searchCriteria.page++;
    this.loadExpenses(() => ($event as InfiniteScrollCustomEvent).target.complete());
  }

  ngOnInit(): void {
    this.loadExpenses();
  }

  ngOnDestroy(): void {
    this.unsubscribe.next();
    this.unsubscribe.complete();
  }

  private sortExpenses = (expenses: Expense[]): Expense[] => expenses.sort((a, b) => a.name.localeCompare(b.name));
}
