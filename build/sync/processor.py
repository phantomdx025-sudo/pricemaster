from collections import defaultdict


def compute_running_balances(vendor_data: dict, ledger_type: str = "creditor") -> dict:
    """
    For creditors: balance = opening + credits - debits  (credit-normal)
    For debtors:   balance = opening + debits - credits  (debit-normal)
    """
    for vname, data in vendor_data.items():
        running = data["opening"]
        balances = []
        for (dt, vt, vno, nar, deb, cre) in data["transactions"]:
            if ledger_type == "debtor":
                running = round(running + deb - cre, 2)
            else:
                running = round(running + cre - deb, 2)
            balances.append(running)
        data["running_balances"] = balances
        data["computed_closing"] = round(running, 2)
    return vendor_data


def detect_anomalies(vendor_data: dict, ledger_type: str = "creditor") -> list:
    anomalies = []

    for vname, data in vendor_data.items():
        sc = data.get("stated_closing", 0) or 0
        cc = data.get("computed_closing", 0) or 0

        # 1. Closing balance mismatch
        if abs(sc - cc) >= 0.5:
            anomalies.append({
                "vendor": vname, "type": "Closing Balance Mismatch",
                "detail": f"Stated: {sc:,.2f} | Computed: {cc:,.2f} | Diff: {sc-cc:+,.2f}",
                "severity": "error"
            })

        # 2. Negative closing — means opposite thing per ledger type
        if ledger_type == "creditor" and cc < -0.5:
            anomalies.append({
                "vendor": vname, "type": "Overpaid",
                "detail": f"Closing balance is {cc:,.2f} (vendor owes you money)",
                "severity": "warning"
            })
        elif ledger_type == "debtor" and cc < -0.5:
            anomalies.append({
                "vendor": vname, "type": "Credit Balance",
                "detail": f"Closing balance is {cc:,.2f} (you owe this customer money — excess receipt)",
                "severity": "warning"
            })

        # 3. ANK entries
        ank_txns = [(vt, vno, nar) for (dt, vt, vno, nar, d, c)
                    in data["transactions"] if nar.strip() == "ANK"]
        if ank_txns:
            anomalies.append({
                "vendor": vname, "type": "ANK Entries",
                "detail": f"{len(ank_txns)} transaction(s) with 'ANK' narration — needs tracing",
                "severity": "warning"
            })

        # 4. Running balance goes negative mid-stream
        for i, rb in enumerate(data.get("running_balances", [])):
            if rb < -0.5:
                dt, vt, vno, nar, deb, cre = data["transactions"][i]
                anomalies.append({
                    "vendor": vname, "type": "Balance Went Negative",
                    "detail": f"After txn {i+1} ({vt} {vno}): balance = {rb:,.2f}",
                    "severity": "info"
                })
                break

        # 5. Same-day receipt + sale (debtors) or payment + purchase (creditors)
        by_date = defaultdict(list)
        for txn in data["transactions"]:
            d = txn[0]
            if d:
                date_key = d.date() if hasattr(d, "date") else d
                by_date[date_key].append(txn)

        for day, txns_on_day in by_date.items():
            types = [t[1] for t in txns_on_day]
            if ledger_type == "debtor":
                has_in  = any("Receipt" in tp or "Payment" in tp for tp in types)
                has_out = any("Sales" in tp or "SALES" in tp or "GST" in tp for tp in types)
            else:
                has_in  = any("Payment" in tp for tp in types)
                has_out = any("Purchase" in tp for tp in types)

            if has_in and has_out:
                if ledger_type == "debtor":
                    in_total  = sum(t[5] for t in txns_on_day if "Receipt" in t[1] or "Payment" in t[1])
                    out_total = sum(t[4] for t in txns_on_day if "Receipt" not in t[1] and "Payment" not in t[1])
                    anomalies.append({
                        "vendor": vname, "type": "Same-Day Sale+Receipt",
                        "detail": f"{day}: Sale ₹{out_total:,.0f} + Receipt ₹{in_total:,.0f}",
                        "severity": "info"
                    })
                else:
                    pay_total = sum(t[4] for t in txns_on_day if "Payment" in t[1])
                    pur_total = sum(t[5] for t in txns_on_day if "Purchase" in t[1])
                    anomalies.append({
                        "vendor": vname, "type": "Same-Day Pay+Purchase",
                        "detail": f"{day}: Payment ₹{pay_total:,.0f} + Purchase ₹{pur_total:,.0f}",
                        "severity": "info"
                    })

    return anomalies



def build_summary_sentence(open_items, closing, last_settlement_date,
                            last_settlement_vch, ledger_type):
    from collections import defaultdict
    buckets = defaultdict(lambda: {"count": 0, "amount": 0.0})
    for item in open_items:
        rem = item["original"] - item["consumed"]
        if rem <= 0.01:
            continue
        rt = item["reason_type"]
        buckets[rt]["count"]  += 1
        buckets[rt]["amount"] += rem

    parts = []
    if buckets["OPENING_BALANCE_RESIDUAL"]["amount"]:
        b = buckets["OPENING_BALANCE_RESIDUAL"]
        parts.append(f"opening balance residual of \u20b9{b['amount']:,.0f}")
    if buckets["NEVER_TOUCHED"]["count"]:
        b = buckets["NEVER_TOUCHED"]
        parts.append(f"{b['count']} invoice(s) never touched (\u20b9{b['amount']:,.0f})")
    if buckets["PARTIALLY_PAID"]["count"]:
        b = buckets["PARTIALLY_PAID"]
        parts.append(f"{b['count']} partially paid invoice(s) (\u20b9{b['amount']:,.0f} remaining)")
    if buckets["POST_LAST_PAYMENT"]["count"]:
        b = buckets["POST_LAST_PAYMENT"]
        lbl = "payment" if ledger_type == "creditor" else "receipt"
        d = last_settlement_date.strftime("%d-%b-%Y") if last_settlement_date else "?"
        parts.append(
            f"{b['count']} invoice(s) raised after last {lbl} on {d} (\u20b9{b['amount']:,.0f})"
        )
    if buckets["RATE_REBATE_TAIL"]["count"]:
        b = buckets["RATE_REBATE_TAIL"]
        parts.append(f"{b['count']} likely rate rebate tail(s) (\u20b9{b['amount']:,.0f})")

    body = " + ".join(parts) if parts else "details unclear"
    return f"Total outstanding \u20b9{closing:,.0f} = {body}."


def run_fifo_matching(vendor_data: dict, ledger_type: str = "creditor") -> dict:
    from collections import deque

    def _d(dt):
        return dt.date() if hasattr(dt, "date") else dt

    def _fmt(dt):
        if dt is None:
            return ""
        try:
            return _d(dt).strftime("%d-%b-%Y")
        except Exception:
            return str(dt)

    for vname, data in vendor_data.items():
        txns    = data["transactions"]
        opening = data["opening"]
        cc      = data.get("computed_closing", 0)

        # Skip zero/negative closing
        if cc <= 0.5:
            data["fifo_items"] = []
            data["fifo_pattern"] = "SKIP"
            data["vendor_summary_sentence"] = (
                "Fully settled \u2014 no outstanding." if abs(cc) <= 0.5
                else f"Credit balance of \u20b9{abs(cc):,.0f} \u2014 no outstanding."
            )
            continue

        # Recompute running balance from transactions
        running = opening
        timeline = []
        for (dt, vt, vno, nar, deb, cre) in txns:
            deb = deb or 0.0
            cre = cre or 0.0
            if ledger_type == "debtor":
                running = round(running + deb - cre, 2)
                liability_amount  = deb
                settlement_amount = cre
            else:
                running = round(running + cre - deb, 2)
                liability_amount  = cre
                settlement_amount = deb
            timeline.append({
                "dt": dt, "vt": vt or "", "vno": str(vno or ""),
                "nar": str(nar or ""),
                "liability": liability_amount,
                "settlement": settlement_amount,
                "bal": running,
            })

        if not timeline:
            data["fifo_items"]  = []
            data["fifo_pattern"] = "SKIP"
            data["vendor_summary_sentence"] = "No transactions."
            continue

        # ── STEP 1: Find last zero in recomputed running balance ──────────────
        zero_indices = [i for i, t in enumerate(timeline) if abs(t["bal"]) < 0.5]
        last_zero_idx = max(zero_indices) if zero_indices else -1

        # ── STEP 2: Find last settlement (receipt/payment) ───────────────────
        last_settlement_idx = max(
            (i for i, t in enumerate(timeline) if t["settlement"] > 0.5), default=-1
        )
        last_settlement_date = timeline[last_settlement_idx]["dt"] if last_settlement_idx >= 0 else None
        last_settlement_vch  = timeline[last_settlement_idx]["vno"] if last_settlement_idx >= 0 else None
        last_settlement_vch_type = timeline[last_settlement_idx]["vt"] if last_settlement_idx >= 0 else None

        # ── STEP 3: Choose anchor and post-anchor slice ───────────────────────
        if last_zero_idx >= 0:
            # PATH A: balance hit zero — anchor there, FIFO only post-zero
            post = timeline[last_zero_idx + 1:]
            anchor_bal = 0.0
        else:
            # PATH B: never hit zero — anchor at last settlement
            post = timeline[last_settlement_idx + 1:] if last_settlement_idx >= 0 else timeline
            anchor_bal = timeline[last_settlement_idx]["bal"] if last_settlement_idx >= 0 else opening

        # ── STEP 4: Seed queue with residual if anchor_bal > 0 ───────────────
        q = deque()
        carry_over = 0.0  # excess settlement credit to apply against next invoices

        if anchor_bal > 0.5:
            # Find which invoice the residual sits on:
            pre_anchor = timeline[:last_settlement_idx] if last_settlement_idx >= 0 and last_zero_idx < 0 else []
            residual_invoice = None
            for t in reversed(pre_anchor):
                if t["liability"] > 0.5:
                    residual_invoice = t
                    break
            if residual_invoice:
                q.append({
                    "vch_no": residual_invoice["vno"],
                    "vch_type": residual_invoice["vt"],
                    "date": residual_invoice["dt"],
                    "original": residual_invoice["liability"],
                    "consumed": round(residual_invoice["liability"] - anchor_bal, 2),
                    "consuming_payments": [],
                    "reason_type": "PARTIALLY_PAID",
                })
            else:
                q.append({
                    "vch_no": "Prior Balance",
                    "vch_type": "Prior Balance",
                    "date": None,
                    "original": anchor_bal,
                    "consumed": 0.0,
                    "consuming_payments": [],
                    "reason_type": "OPENING_BALANCE_RESIDUAL",
                })
        elif anchor_bal < -0.5:
            # Overpayment carry: negative means credit to consume next invoices
            carry_over = abs(anchor_bal)

        # ── STEP 5: FIFO through post-anchor transactions ─────────────────────
        for t in post:
            if t["liability"] > 0.5:
                inv_amount = t["liability"]
                if carry_over > 0.01:
                    if carry_over >= inv_amount - 0.01:
                        carry_over = round(carry_over - inv_amount, 2)
                        continue  # fully consumed by carry
                    else:
                        inv_amount = round(inv_amount - carry_over, 2)
                        carry_over = 0.0
                q.append({
                    "vch_no": t["vno"],
                    "vch_type": t["vt"],
                    "date": t["dt"],
                    "original": t["liability"],
                    "consumed": round(t["liability"] - inv_amount, 2),
                    "consuming_payments": [],
                    "reason_type": None,
                })

            if t["settlement"] > 0.5:
                pay = t["settlement"]
                # Exact-match check: if receipt exactly matches any item's remaining,
                # clear that specific item directly (skip FIFO order) — fixes Bug 2
                exact_match = None
                for item in q:
                    rem = round(item["original"] - item["consumed"], 2)
                    if abs(rem - pay) < 0.5:
                        exact_match = item
                        break
                if exact_match is not None:
                    rem = round(exact_match["original"] - exact_match["consumed"], 2)
                    exact_match["consumed"] = exact_match["original"]
                    exact_match["consuming_payments"].append(
                        (t["dt"], t["vt"], t["vno"], rem)
                    )
                    q.remove(exact_match)
                    pay = round(pay - rem, 2)
                # Normal FIFO for any remainder
                while pay > 0.01 and q:
                    item = q[0]
                    rem = round(item["original"] - item["consumed"], 2)
                    if pay >= rem - 0.01:
                        item["consumed"] = item["original"]
                        item["consuming_payments"].append(
                            (t["dt"], t["vt"], t["vno"], rem)
                        )
                        q.popleft()
                        pay = round(pay - rem, 2)
                    else:
                        item["consumed"] = round(item["consumed"] + pay, 2)
                        item["consuming_payments"].append(
                            (t["dt"], t["vt"], t["vno"], pay)
                        )
                        pay = 0.0
                if pay > 0.01:
                    carry_over = round(carry_over + pay, 2)

        # ── STEP 6: Classify reason types ────────────────────────────────────
        open_items = list(q)
        for item in open_items:
            remaining = item["original"] - item["consumed"]
            if remaining <= 0.01:
                continue
            if item["reason_type"] in ("OPENING_BALANCE_RESIDUAL", "PARTIALLY_PAID"):
                pass  # already set during seeding
            elif remaining <= 250:
                item["reason_type"] = "RATE_REBATE_TAIL"
            elif item["consumed"] > 0.01:
                item["reason_type"] = "PARTIALLY_PAID"
            elif (last_settlement_date and item["date"] and
                  _d(item["date"]) > _d(last_settlement_date)):
                item["reason_type"] = "POST_LAST_PAYMENT"
            else:
                item["reason_type"] = "NEVER_TOUCHED"

        # ── STEP 7: Build reason text ─────────────────────────────────────────
        lsd_str = _fmt(last_settlement_date)
        for item in open_items:
            remaining = round(item["original"] - item["consumed"], 2)
            if remaining <= 0.01:
                item["reason_text"] = ""
                continue

            rt  = item["reason_type"]
            ref = item["vch_no"] if item["vch_no"] not in ("", "Opening Balance", "Prior Balance") else None
            d_s = _fmt(item["date"])
            pay = item["consuming_payments"]

            if rt == "OPENING_BALANCE_RESIDUAL":
                item["reason_text"] = (
                    f"Opening balance of \u20b9{remaining:,.0f} carried forward from before "
                    f"the period start. Partially or fully unpaid from prior period."
                )
            elif rt == "RATE_REBATE_TAIL":
                r_ref = f"Invoice {ref}" if ref else "This entry"
                item["reason_text"] = (
                    f"{r_ref} has a residual of \u20b9{remaining:,.0f} \u2014 "
                    f"likely an unwritten rate rebate or rounding difference."
                )
            elif rt == "NEVER_TOUCHED":
                r_ref = f"Invoice {ref}" if ref else "This entry"
                if ledger_type == "debtor":
                    item["reason_text"] = (
                        f"{r_ref} raised on {d_s} for \u20b9{item['original']:,.0f} "
                        f"has not been received/collected yet."
                    )
                else:
                    item["reason_text"] = (
                        f"{r_ref} raised on {d_s} for \u20b9{item['original']:,.0f} "
                        f"has never been offset by any payment or adjustment."
                    )
            elif rt == "POST_LAST_PAYMENT":
                r_ref = f"Invoice {ref}" if ref else "This entry"
                if ledger_type == "debtor":
                    item["reason_text"] = (
                        f"{r_ref} raised on {d_s} for \u20b9{item['original']:,.0f}. "
                        f"Last receipt was on {lsd_str} \u2014 raised after that, "
                        f"payment not yet received."
                    )
                else:
                    item["reason_text"] = (
                        f"{r_ref} raised on {d_s} for \u20b9{item['original']:,.0f}. "
                        f"Last settlement was {last_settlement_vch_type} {last_settlement_vch} "
                        f"on {lsd_str} \u2014 this invoice was raised after that and "
                        f"has not yet been addressed."
                    )
            elif rt == "PARTIALLY_PAID":
                r_ref = f"Invoice {ref}" if ref else "This entry"
                if len(pay) == 1:
                    pd, pvt, pvno, pamt = pay[0]
                    item["reason_text"] = (
                        f"{pvt} {pvno} on {_fmt(pd)} applied \u20b9{pamt:,.0f} against "
                        f"this invoice (\u20b9{item['original']:,.0f}), leaving "
                        f"\u20b9{remaining:,.0f} unpaid."
                    )
                elif len(pay) > 1:
                    entries = "; ".join(
                        f"{pvt} {pvno} on {_fmt(pd)} \u20b9{pamt:,.0f}"
                        for pd, pvt, pvno, pamt in pay
                    )
                    item["reason_text"] = (
                        f"Multiple entries partially cleared {r_ref} "
                        f"(\u20b9{item['original']:,.0f}): {entries}. "
                        f"\u20b9{remaining:,.0f} still unpaid."
                    )
                else:
                    item["reason_text"] = (
                        f"{r_ref} partially cleared before last receipt. "
                        f"\u20b9{remaining:,.0f} still unpaid."
                    )
            else:
                item["reason_text"] = f"\u20b9{remaining:,.0f} remaining."

        # ── STEP 8: Pattern and summary ───────────────────────────────────────
        genuinely_open = [
            i for i in open_items
            if (i["original"] - i["consumed"]) > 250
            and i["reason_type"] != "OPENING_BALANCE_RESIDUAL"
        ]
        if not last_settlement_date:
            pattern = "C"
        elif all(i["reason_type"] == "POST_LAST_PAYMENT" for i in genuinely_open) and genuinely_open:
            pattern = "A"
        else:
            pattern = "B"

        data["fifo_items"]               = open_items
        data["fifo_pattern"]             = pattern
        data["fifo_gap"]                 = 0  # algorithm guarantees match; no gap note needed
        data["last_settlement_date"]     = last_settlement_date
        data["last_settlement_vch"]      = last_settlement_vch
        data["last_settlement_vch_type"] = last_settlement_vch_type
        data["vendor_summary_sentence"]  = build_summary_sentence(
            open_items, cc, last_settlement_date, last_settlement_vch, ledger_type
        )

    return vendor_data
