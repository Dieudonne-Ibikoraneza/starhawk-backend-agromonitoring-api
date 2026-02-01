import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'ValidRwandaId', async: false })
export class RwandaNationalIdValidator
  implements ValidatorConstraintInterface
{
  validate(nationalId: string, args: ValidationArguments): boolean {
    if (!nationalId || typeof nationalId !== 'string') {
      return false;
    }

    // Must be exactly 16 digits
    if (!/^\d{16}$/.test(nationalId)) {
      return false;
    }

    // Structure: GYYYY#NNNNNNNIFCC
    const structureRegex = /^(\d)(\d{4})([78])(\d{7})(\d)(\d{2})$/;
    const match = nationalId.match(structureRegex);
    if (!match) {
      return false;
    }

    const [, g, yearStr, gender, birthOrder, issueFreq] = match;

    // G (National Identifier): 1=Rwandan, 2=Refugee, 3=Foreigner
    const nationalIdentifier = parseInt(g, 10);
    if (nationalIdentifier < 1 || nationalIdentifier > 3) {
      return false;
    }

    // YYYY (Year of Birth): Must be valid year
    const birthYear = parseInt(yearStr, 10);
    const currentYear = new Date().getFullYear();
    if (birthYear < 1900 || birthYear > currentYear) {
      return false;
    }

    // Age validation: Must result in age 16-120 at issuance
    const ageAtIssuance = currentYear - birthYear;
    if (ageAtIssuance < 16 || ageAtIssuance > 120) {
      return false;
    }

    // # (Gender): 8=Male, 7=Female
    const genderDigit = parseInt(gender, 10);
    if (genderDigit !== 7 && genderDigit !== 8) {
      return false;
    }

    // NNNNNNN (Birth Order): Cannot be all zeros
    if (parseInt(birthOrder, 10) === 0) {
      return false;
    }

    // I (Issue Frequency): 0=First issuance, 1-9=Replacement
    const issueFrequency = parseInt(issueFreq, 10);
    if (issueFrequency < 0 || issueFrequency > 9) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    return 'National ID must be a valid 16-digit Rwanda National ID in format GYYYY#NNNNNNNIFCC';
  }
}

