export function validateRequired(formData, requiredFields) {
  const errors = {};
  Object.entries(requiredFields).forEach(([field, label]) => {
    if (!formData[field]) {
      errors[field] = `${label} harus diisi`;
    }
  });
  return errors;
}
