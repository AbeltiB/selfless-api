// E.164-ish: leading '+', country code, 6-14 more digits.
export const PHONE_REGEX = /^\+[1-9]\d{6,14}$/;
export const PHONE_INVALID_MESSAGE = 'phone must be in international format, e.g. +2519XXXXXXXX';
