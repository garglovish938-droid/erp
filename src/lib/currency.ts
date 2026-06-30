/**
 * Currency Utility for Indian numbering format (INR)
 */
export const formatCurrency = (val: number | null | undefined): string => {
  if (val === undefined || val === null || isNaN(val)) {
    return "₹0";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(val);
};
