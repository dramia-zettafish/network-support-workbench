export function requiredString(value, field, maxLength = null) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError(`${field} is required`);
  }

  const trimmed = value.trim();
  if (maxLength && trimmed.length > maxLength) {
    throw validationError(`${field} must be ${maxLength} characters or fewer`);
  }

  return trimmed;
}

export function optionalString(value, field, maxLength = null) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw validationError(`${field} must be a string`);
  }

  const trimmed = value.trim();
  if (maxLength && trimmed.length > maxLength) {
    throw validationError(`${field} must be ${maxLength} characters or fewer`);
  }

  return trimmed || null;
}

export function requiredInteger(value, field, { min = null, max = null } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw validationError(`${field} must be an integer`);
  }

  if (min !== null && parsed < min) {
    throw validationError(`${field} must be greater than or equal to ${min}`);
  }

  if (max !== null && parsed > max) {
    throw validationError(`${field} must be less than or equal to ${max}`);
  }

  return parsed;
}

export function optionalEnum(value, field, allowedValues) {
  if (value === undefined || value === null || value === '') return value === undefined ? undefined : null;
  if (!allowedValues.includes(value)) {
    throw validationError(`${field} is invalid`);
  }
  return value;
}

export function requiredEnum(value, field, allowedValues) {
  if (!allowedValues.includes(value)) {
    throw validationError(`${field} is invalid`);
  }
  return value;
}

export function rejectUnknownFields(payload, allowedFields) {
  Object.keys(payload || {}).forEach((field) => {
    if (!allowedFields.includes(field)) {
      throw validationError(`${field} is not allowed`);
    }
  });
}

export function validationError(message) {
  return Object.assign(new Error(message), { status: 400 });
}
