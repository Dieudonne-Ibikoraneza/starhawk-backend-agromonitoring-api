import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'ValidRwandanPhoneNumber', async: false })
export class RwandanPhoneNumberValidator
  implements ValidatorConstraintInterface
{
  validate(phoneNumber: string, args: ValidationArguments): boolean {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return false;
    }

    // Remove spaces, hyphens, and other formatting
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // Must be exactly 10 digits
    if (!/^\d{10}$/.test(cleaned)) {
      return false;
    }

    // Must start with 072, 073, 078, or 079
    const validPrefixes = ['072', '073', '078', '079'];
    const prefix = cleaned.substring(0, 3);
    if (!validPrefixes.includes(prefix)) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    return 'Phone number must be a valid Rwandan phone number (072/073/078/079 followed by 7 digits)';
  }
}

