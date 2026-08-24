export enum LedgerEntryType {
  SALE_CREDIT = 'SALE_CREDIT',
  COMMISSION_DEBIT = 'COMMISSION_DEBIT',
  REFUND_DEBIT = 'REFUND_DEBIT',
  PAYOUT_DEBIT = 'PAYOUT_DEBIT',
  ADJUSTMENT = 'ADJUSTMENT',
  // Append-only corrections (Stage 5). A full SellerOrder cancellation
  // reverses the entire original SALE_CREDIT/COMMISSION_DEBIT pair; a
  // partial refund reverses only the refunded portion. Never mutate or
  // delete the original entries — see README "Financial correction model".
  SELLER_EARNING_REVERSAL = 'SELLER_EARNING_REVERSAL',
  PLATFORM_COMMISSION_REVERSAL = 'PLATFORM_COMMISSION_REVERSAL',
}
