export function sortByDate(data, field, order = "desc") {
  return [...data].sort((a, b) => {
    const dateA = new Date(a[field] || 0);
    const dateB = new Date(b[field] || 0);

    return order === "asc" ? dateA - dateB : dateB - dateA;
  });
}