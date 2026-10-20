import { parsePhoneNumberFromString, type PhoneNumber } from 'libphonenumber-js/mobile'

/**
 * An Iraqi mobile number written any common way (0770 123 4567, +964 770…, 00964 770…), or
 * undefined. libphonenumber-js's mobile metadata knows which numbers are mobiles, so landlines
 * and foreign numbers are refused.
 */
export function parseIraqiMobile(value: string): PhoneNumber | undefined {
  const phone = parsePhoneNumberFromString(value, 'IQ')
  return phone?.country === 'IQ' && phone.isValid() ? phone : undefined
}
