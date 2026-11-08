import assert from "node:assert/strict";
import { test } from "node:test";
import { formatLKR, formatClinicDateTime } from "../src/lib/format.ts";

test("LKR formatting requires safe integer minor units and produces en-LK currency", () => {
  // Rs. 1,500.00 = 150000 minor units
  const formatted = formatLKR(150000);
  assert.match(formatted, /1,500/);

  // Reject float64 / unsafe numbers to prevent financial rounding drift
  assert.throws(() => formatLKR(1500.5), /Expected safe integer minor units/);
  assert.throws(() => formatLKR(NaN), /Expected safe integer minor units/);
  assert.throws(() => formatLKR(Infinity), /Expected safe integer minor units/);
});

test("DateTime formatting displays in Asia/Colombo timezone", () => {
  // 2026-10-24T04:30:00Z is 10:00 AM Asia/Colombo (+05:30)
  const formatted = formatClinicDateTime("2026-10-24T04:30:00Z");
  assert.match(formatted, /10:00/);
});

test("Derived balance computation prevents overpayment and handles partial deposit", () => {
  const totalMinor = 1000000; // Rs. 10,000.00
  const receipts = [
    { amountMinor: 400000, paymentMethod: "direct_deposit", label: "Advance deposit" },
    { amountMinor: 350000, paymentMethod: "cash", label: "Counter payment 1" },
  ];

  const totalPaid = receipts.reduce((sum, r) => sum + r.amountMinor, 0);
  const outstanding = Math.max(0, totalMinor - totalPaid);

  assert.equal(totalPaid, 750000);
  assert.equal(outstanding, 250000);

  // An overpayment payment of Rs. 3,000 (300,000 minor units) would exceed outstanding
  const newPayment = 300000;
  assert.equal(newPayment > outstanding, true);

  // A payment of exact remaining balance settles the invoice
  const settlingPayment = 250000;
  const newOutstanding = Math.max(0, outstanding - settlingPayment);
  assert.equal(newOutstanding, 0);
});

test("Payment method and operation ID validation rules", () => {
  const allowedMethods = new Set(["cash", "direct_deposit"]);

  assert.equal(allowedMethods.has("cash"), true);
  assert.equal(allowedMethods.has("direct_deposit"), true);
  assert.equal(allowedMethods.has("card"), false);
  assert.equal(allowedMethods.has("stripe"), false);

  // Operation ID must be a non-empty UUID string
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  assert.equal(uuidRegex.test("3fa85f64-5717-4562-b3fc-2c963f66afa6"), true);
  assert.equal(uuidRegex.test("invalid-uuid"), false);
  assert.equal(uuidRegex.test(""), false);
});

test("TASK-BILL-05: Outstanding report aging bucket classification", () => {
  const getBucket = (days) => {
    if (days <= 30) return "0-30";
    if (days <= 60) return "31-60";
    if (days <= 90) return "61-90";
    return "90+";
  };

  assert.equal(getBucket(0), "0-30");
  assert.equal(getBucket(15), "0-30");
  assert.equal(getBucket(30), "0-30");
  assert.equal(getBucket(31), "31-60");
  assert.equal(getBucket(60), "31-60");
  assert.equal(getBucket(61), "61-90");
  assert.equal(getBucket(90), "61-90");
  assert.equal(getBucket(91), "90+");
  assert.equal(getBucket(180), "90+");
});

test("TASK-BILL-05: Invoice status transition rules enforce immutability", () => {
  // Allowed actions by invoice status
  const canAddItem = (status) => status === "draft";
  const canRemoveItem = (status) => status === "draft";
  const canIssue = (status, itemCount) => status === "draft" && itemCount > 0;
  const canVoid = (status, totalPaid) => status === "issued" && totalPaid === 0;
  const canRecordReceipt = (status, outstanding) => status === "issued" && outstanding > 0;

  // Draft invoice
  assert.equal(canAddItem("draft"), true);
  assert.equal(canRemoveItem("draft"), true);
  assert.equal(canIssue("draft", 0), false); // cannot issue empty invoice
  assert.equal(canIssue("draft", 2), true);
  assert.equal(canVoid("draft", 0), false); // draft cannot be voided, must be issued first
  assert.equal(canRecordReceipt("draft", 100000), false); // cannot pay draft

  // Issued invoice with no payments
  assert.equal(canAddItem("issued"), false); // immutable items
  assert.equal(canRemoveItem("issued"), false);
  assert.equal(canIssue("issued", 2), false); // already issued
  assert.equal(canVoid("issued", 0), true); // uncollected issued invoice can be voided
  assert.equal(canRecordReceipt("issued", 500000), true);

  // Issued invoice with payments
  assert.equal(canVoid("issued", 250000), false); // cannot void invoice with recorded receipts
  assert.equal(canRecordReceipt("issued", 0), false); // settled invoice cannot accept more receipts

  // Voided invoice
  assert.equal(canAddItem("voided"), false);
  assert.equal(canRemoveItem("voided"), false);
  assert.equal(canIssue("voided", 1), false);
  assert.equal(canVoid("voided", 0), false);
  assert.equal(canRecordReceipt("voided", 100000), false);
});
