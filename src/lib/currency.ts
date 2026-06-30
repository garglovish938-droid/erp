/**
 * Currency Utility for Indian numbering format (INR)
 */
export const formatCurrency = (val: number | null | undefined, includeDecimals = true): string => {
  if (val === undefined || val === null || isNaN(val)) {
    return includeDecimals ? "₹0.00" : "₹0";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0
  }).format(val);
};
