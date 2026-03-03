from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from dateutil.relativedelta import relativedelta

from app.schemas.mortgage import AmortizationRow, ExtraPaymentCalcResult


def _monthly_payment(principal: Decimal, annual_rate: Decimal, term_months: int) -> Decimal:
    # annual_rate is a percentage (e.g. 6.5 for 6.5%), so divide by 1200 to get monthly decimal rate
    r = annual_rate / Decimal("1200")
    if r == 0:
        return principal / Decimal(term_months)
    factor = (1 + r) ** term_months
    return (principal * r * factor / (factor - 1)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def build_amortization_schedule(
    original_principal: Decimal,
    annual_rate: Decimal,
    term_months: int,
    start_date: date,
    extra_payment: Decimal = Decimal("0.00"),
) -> list[AmortizationRow]:
    standard_payment = _monthly_payment(original_principal, annual_rate, term_months)
    total_payment = standard_payment + extra_payment
    monthly_rate = annual_rate / Decimal("1200")

    balance = original_principal
    cumulative_interest = Decimal("0.00")
    schedule: list[AmortizationRow] = []
    payment_date = start_date + relativedelta(months=1)

    for payment_number in range(1, term_months + 1):
        if balance <= 0:
            break

        interest = (balance * monthly_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        principal_portion = min(total_payment - interest, balance)
        if principal_portion < 0:
            principal_portion = Decimal("0.00")

        balance = (balance - principal_portion).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if balance < 0:
            balance = Decimal("0.00")

        cumulative_interest += interest

        schedule.append(AmortizationRow(
            payment_number=payment_number,
            payment_date=payment_date,
            payment_amount=(principal_portion + interest).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            principal=principal_portion,
            interest=interest,
            balance=balance,
            cumulative_interest=cumulative_interest.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        ))

        payment_date = payment_date + relativedelta(months=1)

    return schedule


def calculate_extra_payment_savings(
    original_principal: Decimal,
    annual_rate: Decimal,
    term_months: int,
    start_date: date,
    extra_monthly: Decimal,
) -> ExtraPaymentCalcResult:
    base_schedule = build_amortization_schedule(
        original_principal, annual_rate, term_months, start_date, Decimal("0.00")
    )
    new_schedule = build_amortization_schedule(
        original_principal, annual_rate, term_months, start_date, extra_monthly
    )

    months_saved = len(base_schedule) - len(new_schedule)
    interest_saved = (
        base_schedule[-1].cumulative_interest - new_schedule[-1].cumulative_interest
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    new_payoff_date = new_schedule[-1].payment_date if new_schedule else start_date

    return ExtraPaymentCalcResult(
        months_saved=months_saved,
        interest_saved=interest_saved,
        new_payoff_date=new_payoff_date,
    )
