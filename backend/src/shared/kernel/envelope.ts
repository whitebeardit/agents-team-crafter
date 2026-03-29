export interface ISuccessEnvelope<T = unknown> {
  success: true;
  data: T;
  meta: Record<string, unknown>;
}

export interface IErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export interface IErrorEnvelope {
  success: false;
  error: IErrorBody;
}

export function successEnvelope<T>(data: T, meta: Record<string, unknown> = {}): ISuccessEnvelope<T> {
  return { success: true, data, meta };
}

export function errorEnvelope(
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): IErrorEnvelope {
  return { success: false, error: { code, message, details } };
}
