import { ApiFetchError } from "@/lib/api";

export type FieldErrors = Record<string, string[]>;

export type FormErrors = {
  formError?: string;
  fieldErrors?: FieldErrors;
};

export function parseApiError(err: unknown): FormErrors {
  if (err instanceof ApiFetchError) {
    const details = err.details as any;
    const fieldErrors = details?.fieldErrors && typeof details.fieldErrors === "object" ? (details.fieldErrors as FieldErrors) : undefined;
    const formErrorsArr = Array.isArray(details?.formErrors) ? (details.formErrors as string[]) : [];
    const formError = [err.message, ...formErrorsArr].filter(Boolean).join(" ");
    return { formError: formError || err.message, fieldErrors };
  }
  if (err instanceof Error) return { formError: err.message };
  return { formError: "Something went wrong." };
}

export function firstFieldError(fieldErrors: FieldErrors | undefined, key: string) {
  const v = fieldErrors?.[key];
  if (!v || !Array.isArray(v) || v.length === 0) return null;
  return v[0] ?? null;
}


