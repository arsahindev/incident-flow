export type IncidentFormState = {
  error: string | null;
  message: string | null;
};

export const initialIncidentFormState: IncidentFormState = {
  error: null,
  message: null,
};
