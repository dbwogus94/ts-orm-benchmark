export function subDays<DateType extends Date>(
  date: DateType | number | string,
  amount: number
): DateType {
  const dateObj =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : new Date(date.getTime());

  dateObj.setDate(dateObj.getDate() - amount);
  // Return as the same DateType
  return dateObj as DateType;
}
