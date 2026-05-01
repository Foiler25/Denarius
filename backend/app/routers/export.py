import io
import json
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_db, require_admin
from app.models.account import Account, AccountType
from app.models.budget import Budget
from app.models.category import Category, CategoryType
from app.models.expense_account import ExpenseAccount
from app.models.mortgage_detail import MortgageDetail
from app.models.net_worth_snapshot import NetWorthSnapshot
from app.models.recurring_item import RecurringItem, RecurringType, RecurringFrequency
from app.models.transaction import Transaction, TransactionType
from app.models.user import User

router = APIRouter(tags=["export"])

MAX_IMPORT_BYTES = 10 * 1024 * 1024  # 10 MB — matches nginx client_max_body_size


# ---------------------------------------------------------------------------
# EXPORT
# ---------------------------------------------------------------------------

@router.get("/export")
async def export_data(
    include_categories: bool = False,
    include_accounts: bool = False,
    include_expense_accounts: bool = False,
    include_recurring: bool = False,
    include_budgets: bool = False,
    include_mortgage: bool = False,
    include_networth: bool = False,
    include_transactions: bool = False,
    transaction_start_date: Optional[date] = None,
    transaction_end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    export: dict = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "version": "1.0",
    }

    if include_categories:
        result = await db.execute(
            select(Category).where(Category.deleted_at.is_(None)).order_by(Category.name)
        )
        cats = result.scalars().all()
        export["categories"] = [
            {
                "id": str(c.id),
                "name": c.name,
                "type": c.type.value,
                "color": c.color,
                "icon": c.icon,
                "sort_order": c.sort_order,
                "once_per_month": c.once_per_month,
                "is_system": c.is_system,
            }
            for c in cats
        ]

    if include_accounts:
        result = await db.execute(
            select(Account).where(Account.deleted_at.is_(None)).order_by(Account.sort_order)
        )
        accs = result.scalars().all()
        export["accounts"] = [
            {
                "id": str(a.id),
                "name": a.name,
                "type": a.type.value,
                "institution": a.institution,
                "current_balance": str(a.current_balance),
                "credit_limit": str(a.credit_limit) if a.credit_limit is not None else None,
                "sort_order": a.sort_order,
                "notes": a.notes,
                "color": a.color,
                "is_active": a.is_active,
            }
            for a in accs
        ]

    if include_expense_accounts:
        result = await db.execute(
            select(ExpenseAccount)
            .where(ExpenseAccount.deleted_at.is_(None))
            .order_by(ExpenseAccount.sort_order)
        )
        eas = result.scalars().all()
        export["expense_accounts"] = [
            {
                "id": str(ea.id),
                "name": ea.name,
                "color": ea.color,
                "is_active": ea.is_active,
                "sort_order": ea.sort_order,
            }
            for ea in eas
        ]

    if include_recurring:
        result = await db.execute(
            select(RecurringItem).where(RecurringItem.deleted_at.is_(None))
        )
        items = result.scalars().all()
        export["recurring_items"] = [
            {
                "id": str(r.id),
                "name": r.name,
                "account_id": str(r.account_id),
                "category_id": str(r.category_id) if r.category_id else None,
                "amount": str(r.amount),
                "amount_min": str(r.amount_min) if r.amount_min is not None else None,
                "amount_max": str(r.amount_max) if r.amount_max is not None else None,
                "type": r.type.value,
                "frequency": r.frequency.value,
                "day_of_month": r.day_of_month,
                "next_due_date": r.next_due_date.isoformat(),
                "auto_post": r.auto_post,
                "auto_match": r.auto_match,
                "keyword_match": r.keyword_match,
                "is_active": r.is_active,
                "notes": r.notes,
            }
            for r in items
        ]

    if include_budgets:
        result = await db.execute(
            select(Budget).options(selectinload(Budget.category))
        )
        budgets = result.scalars().all()
        export["budgets"] = [
            {
                "id": str(b.id),
                "category_id": str(b.category_id),
                "category_name": b.category.name if b.category else None,
                "month": b.month.isoformat(),
                "amount": str(b.amount),
            }
            for b in budgets
        ]

    if include_mortgage:
        result = await db.execute(
            select(MortgageDetail)
            .join(Account, MortgageDetail.account_id == Account.id)
            .where(Account.deleted_at.is_(None))
        )
        mortgages = result.scalars().all()
        export["mortgage_details"] = [
            {
                "id": str(m.id),
                "account_id": str(m.account_id),
                "original_principal": str(m.original_principal),
                "interest_rate": str(m.interest_rate),
                "term_months": m.term_months,
                "start_date": m.start_date.isoformat(),
                "extra_payment": str(m.extra_payment),
                "loan_type": m.loan_type,
            }
            for m in mortgages
        ]

    if include_networth:
        result = await db.execute(
            select(NetWorthSnapshot).order_by(NetWorthSnapshot.snapshot_date)
        )
        snapshots = result.scalars().all()
        export["net_worth_snapshots"] = [
            {
                "id": str(s.id),
                "snapshot_date": s.snapshot_date.isoformat(),
                "total_assets": str(s.total_assets),
                "total_liabilities": str(s.total_liabilities),
                "net_worth": str(s.net_worth),
                "account_breakdown": s.account_breakdown,
            }
            for s in snapshots
        ]

    if include_transactions:
        q = (
            select(Transaction)
            .options(selectinload(Transaction.category), selectinload(Transaction.account))
            .where(Transaction.deleted_at.is_(None))
        )
        if transaction_start_date:
            q = q.where(Transaction.date >= transaction_start_date)
        if transaction_end_date:
            q = q.where(Transaction.date <= transaction_end_date)
        q = q.order_by(Transaction.date.desc())
        result = await db.execute(q)
        txns = result.scalars().all()
        export["transactions"] = [
            {
                "id": str(t.id),
                "account_id": str(t.account_id),
                "account_name": t.account.name if t.account else None,
                "category_id": str(t.category_id) if t.category_id else None,
                "category_name": t.category.name if t.category else None,
                "transfer_account_id": str(t.transfer_account_id) if t.transfer_account_id else None,
                "amount": str(t.amount),
                "type": t.type.value,
                "description": t.description,
                "notes": t.notes,
                "date": t.date.isoformat(),
            }
            for t in txns
        ]

    today = date.today().isoformat()
    content = json.dumps(export, indent=2, default=str)
    return StreamingResponse(
        io.StringIO(content),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=denarius-export-{today}.json"},
    )


# ---------------------------------------------------------------------------
# IMPORT
# ---------------------------------------------------------------------------

@router.post("/import")
async def import_data(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if file.size is not None and file.size > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail=f"Import file exceeds {MAX_IMPORT_BYTES // (1024 * 1024)} MB limit")

    raw = await file.read(MAX_IMPORT_BYTES + 1)
    if len(raw) > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail=f"Import file exceeds {MAX_IMPORT_BYTES // (1024 * 1024)} MB limit")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Expected a JSON object at top level")

    imported: dict[str, int] = {}
    skipped: dict[str, int] = {}
    errors: list[str] = []

    # ID remap tables: old_str_id -> new UUID
    cat_map: dict[str, uuid.UUID] = {}
    acc_map: dict[str, uuid.UUID] = {}
    ea_map: dict[str, uuid.UUID] = {}

    # ---- Categories ----
    if "categories" in data:
        imp = skp = 0
        for item in data["categories"]:
            try:
                name = item["name"]
                ctype = CategoryType(item["type"])
                result = await db.execute(
                    select(Category).where(
                        Category.name == name,
                        Category.type == ctype,
                        Category.deleted_at.is_(None),
                    )
                )
                existing = result.scalar_one_or_none()
                if existing:
                    cat_map[item["id"]] = existing.id
                    skp += 1
                else:
                    new_cat = Category(
                        name=name,
                        type=ctype,
                        color=item.get("color", "#6B7280"),
                        icon=item.get("icon"),
                        sort_order=item.get("sort_order", 0),
                        once_per_month=item.get("once_per_month", False),
                        is_system=False,
                    )
                    db.add(new_cat)
                    await db.flush()
                    cat_map[item["id"]] = new_cat.id
                    imp += 1
            except Exception as e:
                errors.append(f"Category '{item.get('name', '?')}': {e}")
        await db.commit()
        imported["categories"] = imp
        skipped["categories"] = skp

    # ---- Accounts ----
    if "accounts" in data:
        imp = skp = 0
        for item in data["accounts"]:
            try:
                name = item["name"]
                atype = AccountType(item["type"])
                result = await db.execute(
                    select(Account).where(
                        Account.name == name,
                        Account.type == atype,
                        Account.deleted_at.is_(None),
                    )
                )
                existing = result.scalar_one_or_none()
                if existing:
                    acc_map[item["id"]] = existing.id
                    skp += 1
                else:
                    new_acc = Account(
                        name=name,
                        type=atype,
                        institution=item.get("institution"),
                        current_balance=Decimal(item.get("current_balance", "0")),
                        credit_limit=Decimal(item["credit_limit"]) if item.get("credit_limit") else None,
                        sort_order=item.get("sort_order", 0),
                        notes=item.get("notes"),
                        color=item.get("color", "#6B7280"),
                        is_active=item.get("is_active", True),
                    )
                    db.add(new_acc)
                    await db.flush()
                    acc_map[item["id"]] = new_acc.id
                    imp += 1
            except Exception as e:
                errors.append(f"Account '{item.get('name', '?')}': {e}")
        await db.commit()
        imported["accounts"] = imp
        skipped["accounts"] = skp

    # ---- Expense Accounts ----
    if "expense_accounts" in data:
        imp = skp = 0
        for item in data["expense_accounts"]:
            try:
                name = item["name"]
                result = await db.execute(
                    select(ExpenseAccount).where(
                        ExpenseAccount.name == name,
                        ExpenseAccount.deleted_at.is_(None),
                    )
                )
                existing = result.scalar_one_or_none()
                if existing:
                    ea_map[item["id"]] = existing.id
                    skp += 1
                else:
                    new_ea = ExpenseAccount(
                        name=name,
                        color=item.get("color", "#6B7280"),
                        is_active=item.get("is_active", True),
                        sort_order=item.get("sort_order", 0),
                    )
                    db.add(new_ea)
                    await db.flush()
                    ea_map[item["id"]] = new_ea.id
                    imp += 1
            except Exception as e:
                errors.append(f"Expense account '{item.get('name', '?')}': {e}")
        await db.commit()
        imported["expense_accounts"] = imp
        skipped["expense_accounts"] = skp

    # ---- Recurring Items ----
    if "recurring_items" in data:
        imp = skp = 0
        for item in data["recurring_items"]:
            try:
                name = item["name"]
                result = await db.execute(
                    select(RecurringItem).where(
                        RecurringItem.name == name,
                        RecurringItem.deleted_at.is_(None),
                    )
                )
                existing = result.scalar_one_or_none()
                if existing:
                    skp += 1
                    continue

                old_acc_id = item.get("account_id")
                new_acc_id = acc_map.get(old_acc_id) if old_acc_id else None
                if new_acc_id is None and old_acc_id:
                    # Try to use the original ID if it exists in DB
                    try:
                        orig_uuid = uuid.UUID(old_acc_id)
                        res = await db.execute(
                            select(Account).where(Account.id == orig_uuid, Account.deleted_at.is_(None))
                        )
                        if res.scalar_one_or_none():
                            new_acc_id = orig_uuid
                    except Exception:
                        pass
                if new_acc_id is None:
                    errors.append(f"Recurring '{name}': account not found, skipping")
                    skp += 1
                    continue

                old_cat_id = item.get("category_id")
                new_cat_id = cat_map.get(old_cat_id) if old_cat_id else None
                if new_cat_id is None and old_cat_id:
                    try:
                        orig_uuid = uuid.UUID(old_cat_id)
                        res = await db.execute(
                            select(Category).where(Category.id == orig_uuid, Category.deleted_at.is_(None))
                        )
                        if res.scalar_one_or_none():
                            new_cat_id = orig_uuid
                    except Exception:
                        pass

                new_r = RecurringItem(
                    name=name,
                    account_id=new_acc_id,
                    category_id=new_cat_id,
                    created_by=current_user.id,
                    amount=Decimal(item["amount"]),
                    amount_min=Decimal(item["amount_min"]) if item.get("amount_min") else None,
                    amount_max=Decimal(item["amount_max"]) if item.get("amount_max") else None,
                    type=RecurringType(item["type"]),
                    frequency=RecurringFrequency(item["frequency"]),
                    day_of_month=item.get("day_of_month"),
                    next_due_date=date.fromisoformat(item["next_due_date"]),
                    auto_post=item.get("auto_post", False),
                    auto_match=item.get("auto_match", False),
                    keyword_match=item.get("keyword_match"),
                    is_active=item.get("is_active", True),
                    notes=item.get("notes"),
                )
                db.add(new_r)
                imp += 1
            except Exception as e:
                errors.append(f"Recurring '{item.get('name', '?')}': {e}")
        await db.commit()
        imported["recurring_items"] = imp
        skipped["recurring_items"] = skp

    # ---- Budgets ----
    if "budgets" in data:
        imp = skp = 0
        for item in data["budgets"]:
            try:
                old_cat_id = item.get("category_id")
                new_cat_id = cat_map.get(old_cat_id) if old_cat_id else None
                if new_cat_id is None and old_cat_id:
                    try:
                        orig_uuid = uuid.UUID(old_cat_id)
                        res = await db.execute(
                            select(Category).where(Category.id == orig_uuid, Category.deleted_at.is_(None))
                        )
                        if res.scalar_one_or_none():
                            new_cat_id = orig_uuid
                    except Exception:
                        pass
                if new_cat_id is None:
                    errors.append(f"Budget for category '{old_cat_id}' month '{item.get('month')}': category not found, skipping")
                    skp += 1
                    continue

                month = date.fromisoformat(item["month"])
                result = await db.execute(
                    select(Budget).where(
                        Budget.category_id == new_cat_id,
                        Budget.month == month,
                    )
                )
                if result.scalar_one_or_none():
                    skp += 1
                    continue

                new_b = Budget(
                    category_id=new_cat_id,
                    month=month,
                    amount=Decimal(item["amount"]),
                )
                db.add(new_b)
                imp += 1
            except Exception as e:
                errors.append(f"Budget '{item.get('category_name', '?')} {item.get('month', '?')}': {e}")
        await db.commit()
        imported["budgets"] = imp
        skipped["budgets"] = skp

    # ---- Mortgage Details ----
    if "mortgage_details" in data:
        imp = skp = 0
        for item in data["mortgage_details"]:
            try:
                old_acc_id = item.get("account_id")
                new_acc_id = acc_map.get(old_acc_id) if old_acc_id else None
                if new_acc_id is None and old_acc_id:
                    try:
                        orig_uuid = uuid.UUID(old_acc_id)
                        res = await db.execute(
                            select(Account).where(Account.id == orig_uuid, Account.deleted_at.is_(None))
                        )
                        if res.scalar_one_or_none():
                            new_acc_id = orig_uuid
                    except Exception:
                        pass
                if new_acc_id is None:
                    errors.append(f"Mortgage for account '{old_acc_id}': account not found, skipping")
                    skp += 1
                    continue

                result = await db.execute(
                    select(MortgageDetail).where(MortgageDetail.account_id == new_acc_id)
                )
                if result.scalar_one_or_none():
                    skp += 1
                    continue

                new_m = MortgageDetail(
                    account_id=new_acc_id,
                    original_principal=Decimal(item["original_principal"]),
                    interest_rate=Decimal(item["interest_rate"]),
                    term_months=item["term_months"],
                    start_date=date.fromisoformat(item["start_date"]),
                    extra_payment=Decimal(item.get("extra_payment", "0")),
                    loan_type=item.get("loan_type"),
                )
                db.add(new_m)
                imp += 1
            except Exception as e:
                errors.append(f"Mortgage account '{item.get('account_id', '?')}': {e}")
        await db.commit()
        imported["mortgage_details"] = imp
        skipped["mortgage_details"] = skp

    # ---- Net Worth Snapshots ----
    if "net_worth_snapshots" in data:
        imp = skp = 0
        for item in data["net_worth_snapshots"]:
            try:
                snap_date = date.fromisoformat(item["snapshot_date"])
                result = await db.execute(
                    select(NetWorthSnapshot).where(NetWorthSnapshot.snapshot_date == snap_date)
                )
                if result.scalar_one_or_none():
                    skp += 1
                    continue

                new_s = NetWorthSnapshot(
                    snapshot_date=snap_date,
                    total_assets=Decimal(item["total_assets"]),
                    total_liabilities=Decimal(item["total_liabilities"]),
                    net_worth=Decimal(item["net_worth"]),
                    account_breakdown=item.get("account_breakdown", []),
                )
                db.add(new_s)
                imp += 1
            except Exception as e:
                errors.append(f"Net worth snapshot '{item.get('snapshot_date', '?')}': {e}")
        await db.commit()
        imported["net_worth_snapshots"] = imp
        skipped["net_worth_snapshots"] = skp

    # ---- Transactions ----
    if "transactions" in data:
        imp = skp = 0
        for item in data["transactions"]:
            try:
                old_acc_id = item.get("account_id")
                new_acc_id = acc_map.get(old_acc_id) if old_acc_id else None
                if new_acc_id is None and old_acc_id:
                    try:
                        orig_uuid = uuid.UUID(old_acc_id)
                        res = await db.execute(
                            select(Account).where(Account.id == orig_uuid, Account.deleted_at.is_(None))
                        )
                        if res.scalar_one_or_none():
                            new_acc_id = orig_uuid
                    except Exception:
                        pass
                if new_acc_id is None:
                    errors.append(f"Transaction '{item.get('description', '?')} {item.get('date', '?')}': account not found, skipping")
                    skp += 1
                    continue

                txn_date = date.fromisoformat(item["date"])
                amount = Decimal(item["amount"])
                description = item.get("description")

                result = await db.execute(
                    select(Transaction).where(
                        Transaction.account_id == new_acc_id,
                        Transaction.date == txn_date,
                        Transaction.amount == amount,
                        Transaction.description == description,
                        Transaction.deleted_at.is_(None),
                    )
                )
                if result.scalar_one_or_none():
                    skp += 1
                    continue

                old_cat_id = item.get("category_id")
                new_cat_id = cat_map.get(old_cat_id) if old_cat_id else None
                if new_cat_id is None and old_cat_id:
                    try:
                        orig_uuid = uuid.UUID(old_cat_id)
                        res = await db.execute(
                            select(Category).where(Category.id == orig_uuid, Category.deleted_at.is_(None))
                        )
                        if res.scalar_one_or_none():
                            new_cat_id = orig_uuid
                    except Exception:
                        pass

                old_transfer_id = item.get("transfer_account_id")
                new_transfer_id = acc_map.get(old_transfer_id) if old_transfer_id else None
                if new_transfer_id is None and old_transfer_id:
                    try:
                        orig_uuid = uuid.UUID(old_transfer_id)
                        res = await db.execute(
                            select(Account).where(Account.id == orig_uuid, Account.deleted_at.is_(None))
                        )
                        if res.scalar_one_or_none():
                            new_transfer_id = orig_uuid
                    except Exception:
                        pass

                new_t = Transaction(
                    account_id=new_acc_id,
                    category_id=new_cat_id,
                    transfer_account_id=new_transfer_id,
                    created_by=current_user.id,
                    amount=amount,
                    type=TransactionType(item["type"]),
                    description=description,
                    notes=item.get("notes"),
                    date=txn_date,
                )
                db.add(new_t)
                imp += 1
            except Exception as e:
                errors.append(f"Transaction '{item.get('description', '?')} {item.get('date', '?')}': {e}")
        await db.commit()
        imported["transactions"] = imp
        skipped["transactions"] = skp

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
    }
